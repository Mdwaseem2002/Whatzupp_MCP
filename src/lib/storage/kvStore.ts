// src/lib/storage/kvStore.ts
// Universal Storage Adapter for non-customer app config & unmatched queue
// Ephemeral-safe: uses Vercel KV / Redis in production, local JSON fallback in dev

import fs from 'fs';
import path from 'path';

export interface UnmatchedMessage {
  id: string;
  phoneNumber: string;
  content: string;
  timestamp: string;
  mediaType?: string;
  mediaId?: string;
  filename?: string;
  rawPayload?: Record<string, unknown>;
}

function ensureProductionConfigured() {
  if (process.env.NODE_ENV === 'production' && !process.env.KV_REST_API_URL && !process.env.REDIS_URL) {
    throw new Error(
      "FATAL: KV_REST_API_URL is required in production environments to guarantee persistent unmatched queue storage."
    );
  }
}

const DATA_DIR = path.resolve(process.cwd(), 'src', 'data');

function ensureDataDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// In-memory cache for dev mode
let devUnmatchedQueue: UnmatchedMessage[] = [];
let devConfigStore: Record<string, unknown> = {};

export async function getUnmatchedQueue(): Promise<UnmatchedMessage[]> {
  ensureProductionConfigured();

  if (process.env.KV_REST_API_URL) {
    try {
      const res = await fetch(`${process.env.KV_REST_API_URL}/get/unmatched_queue`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        return data.result ? JSON.parse(data.result) : [];
      }
    } catch (err) {
      console.error('[kvStore] KV read failed:', err);
    }
  }

  // Local Dev Fallback
  ensureDataDirExists();
  const filePath = path.join(DATA_DIR, 'unmatched_queue.json');
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      devUnmatchedQueue = JSON.parse(content);
    } catch {
      devUnmatchedQueue = [];
    }
  }
  return devUnmatchedQueue;
}

export async function pushUnmatched(msg: UnmatchedMessage): Promise<void> {
  ensureProductionConfigured();

  const queue = await getUnmatchedQueue();
  // Idempotent push by id
  const existingIdx = queue.findIndex(item => item.id === msg.id);
  if (existingIdx >= 0) {
    queue[existingIdx] = msg;
  } else {
    queue.push(msg);
  }

  if (process.env.KV_REST_API_URL) {
    try {
      await fetch(`${process.env.KV_REST_API_URL}/set/unmatched_queue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        body: JSON.stringify(JSON.stringify(queue)),
      });
      return;
    } catch (err) {
      console.error('[kvStore] KV write failed:', err);
    }
  }

  // Local Dev Fallback
  ensureDataDirExists();
  devUnmatchedQueue = queue;
  const filePath = path.join(DATA_DIR, 'unmatched_queue.json');
  fs.writeFileSync(filePath, JSON.stringify(queue, null, 2), 'utf8');
}

export async function removeUnmatched(id: string): Promise<boolean> {
  ensureProductionConfigured();

  const queue = await getUnmatchedQueue();
  const filtered = queue.filter(item => item.id !== id);
  const wasRemoved = filtered.length < queue.length;

  if (process.env.KV_REST_API_URL) {
    try {
      await fetch(`${process.env.KV_REST_API_URL}/set/unmatched_queue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        body: JSON.stringify(JSON.stringify(filtered)),
      });
      return wasRemoved;
    } catch (err) {
      console.error('[kvStore] KV delete failed:', err);
    }
  }

  ensureDataDirExists();
  devUnmatchedQueue = filtered;
  const filePath = path.join(DATA_DIR, 'unmatched_queue.json');
  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf8');
  return wasRemoved;
}

export async function getConfig(key: string): Promise<unknown> {
  ensureProductionConfigured();

  if (process.env.KV_REST_API_URL) {
    try {
      const res = await fetch(`${process.env.KV_REST_API_URL}/get/cfg_${key}`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        return data.result ? JSON.parse(data.result) : null;
      }
    } catch (err) {
      console.error('[kvStore] KV getConfig failed:', err);
    }
  }

  ensureDataDirExists();
  const filePath = path.join(DATA_DIR, 'app_config.json');
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      devConfigStore = JSON.parse(content);
      return devConfigStore[key] ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  ensureProductionConfigured();

  if (process.env.KV_REST_API_URL) {
    try {
      await fetch(`${process.env.KV_REST_API_URL}/set/cfg_${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        body: JSON.stringify(JSON.stringify(value)),
      });
      return;
    } catch (err) {
      console.error('[kvStore] KV setConfig failed:', err);
    }
  }

  ensureDataDirExists();
  devConfigStore[key] = value;
  const filePath = path.join(DATA_DIR, 'app_config.json');
  fs.writeFileSync(filePath, JSON.stringify(devConfigStore, null, 2), 'utf8');
}
