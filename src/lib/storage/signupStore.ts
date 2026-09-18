// src/lib/storage/signupStore.ts
import fs from 'fs';
import path from 'path';

export interface LocalSignupRequest {
  id: string;
  fullName: string;
  organizationName: string;
  email: string;
  phone: string | null;
  passwordHash?: string;
  requestedWorkspaces: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'src', 'data');
const SIGNUP_FILE = path.join(DATA_DIR, 'signup_requests.json');

function ensureDataDirExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Ignore read-only errors
  }
}

export function getLocalSignupRequests(): LocalSignupRequest[] {
  ensureDataDirExists();
  if (fs.existsSync(SIGNUP_FILE)) {
    try {
      const content = fs.readFileSync(SIGNUP_FILE, 'utf8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }
  return [];
}

export function saveLocalSignupRequest(req: LocalSignupRequest): void {
  ensureDataDirExists();
  const current = getLocalSignupRequests();
  const index = current.findIndex(item => item.email.toLowerCase() === req.email.toLowerCase());
  if (index >= 0) {
    current[index] = { ...current[index], ...req };
  } else {
    current.unshift(req);
  }
  try {
    fs.writeFileSync(SIGNUP_FILE, JSON.stringify(current, null, 2), 'utf8');
  } catch {
    // Ignore write errors
  }
}

export function updateLocalSignupRequestStatus(idOrEmail: string, status: 'APPROVED' | 'REJECTED' | 'PENDING'): void {
  ensureDataDirExists();
  const current = getLocalSignupRequests();
  const req = current.find(item => item.id === idOrEmail || item.email.toLowerCase() === idOrEmail.toLowerCase());
  if (req) {
    req.status = status;
    try {
      fs.writeFileSync(SIGNUP_FILE, JSON.stringify(current, null, 2), 'utf8');
    } catch {
      // Ignore
    }
  }
}

export function updateLocalSignupRequest(idOrEmail: string, updates: Partial<LocalSignupRequest>): void {
  ensureDataDirExists();
  const current = getLocalSignupRequests();
  const req = current.find(item => item.id === idOrEmail || item.email.toLowerCase() === idOrEmail.toLowerCase());
  if (req) {
    Object.assign(req, updates);
    try {
      fs.writeFileSync(SIGNUP_FILE, JSON.stringify(current, null, 2), 'utf8');
    } catch {
      // Ignore
    }
  }
}

export function deleteLocalSignupRequest(idOrEmail: string): boolean {
  ensureDataDirExists();
  const current = getLocalSignupRequests();
  const filtered = current.filter(item => item.id !== idOrEmail && item.email.toLowerCase() !== idOrEmail.toLowerCase());
  const wasRemoved = filtered.length < current.length;
  if (wasRemoved) {
    try {
      fs.writeFileSync(SIGNUP_FILE, JSON.stringify(filtered, null, 2), 'utf8');
    } catch {
      // Ignore
    }
  }
  return wasRemoved;
}
