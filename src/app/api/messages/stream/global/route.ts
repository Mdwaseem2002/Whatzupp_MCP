// src/app/api/messages/stream/global/route.ts
// Global SSE stream that broadcasts ALL incoming messages regardless of phone number.
// Used by the notification system to show toasts, badges, and browser notifications.

import { NextResponse } from 'next/server';
import { Message } from '@/types';

// Global emitter set partitioned by workspaceId
const globalEmitters: Record<string, Set<(data: { phoneNumber: string; message: Message; contactName?: string; workspaceId: string }) => void>> = {};

// Internal broadcast function
export function broadcastGlobalMessage(phoneNumber: string, message: Message, workspaceId: string, contactName?: string) {
  const emitters = globalEmitters[workspaceId];
  if (emitters) {
    emitters.forEach(emitter => {
      try {
        emitter({ phoneNumber, message, contactName, workspaceId });
      } catch {
        // Listener may have been closed
      }
    });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || 'sfmc-ws-1';

  const encoder = new TextEncoder();
  let listener: ((data: { phoneNumber: string; message: Message; contactName?: string; workspaceId: string }) => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`: connected\n\n`));

      listener = (data: { phoneNumber: string; message: Message; contactName?: string; workspaceId: string }) => {
        try {
          const eventData = JSON.stringify(data);
          controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
        } catch {
          console.warn('[global-stream] Could not enqueue to closed controller. Removing listener.');
          if (listener && globalEmitters[workspaceId]) globalEmitters[workspaceId].delete(listener);
        }
      };

      if (!globalEmitters[workspaceId]) {
        globalEmitters[workspaceId] = new Set();
      }
      globalEmitters[workspaceId].add(listener);

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
          if (listener && globalEmitters[workspaceId]) globalEmitters[workspaceId].delete(listener);
        }
      }, 30000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (listener && globalEmitters[workspaceId]) globalEmitters[workspaceId].delete(listener);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

// POST endpoint to receive broadcasts from the webhook
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phoneNumber, message, contactName, workspaceId } = body;
    const targetWsId = workspaceId || 'sfmc-ws-1';

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: 'Missing phoneNumber or message' },
        { status: 400 }
      );
    }

    broadcastGlobalMessage(phoneNumber, message, targetWsId, contactName);

    return NextResponse.json({
      success: true,
      listeners: globalEmitters.size,
    });
  } catch (error) {
    console.error('[global-stream] Broadcast error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
