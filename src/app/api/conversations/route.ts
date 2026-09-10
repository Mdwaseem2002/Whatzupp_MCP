// src/app/api/conversations/route.ts
// Retrieves active conversations from native workspace connectors (Sales Cloud / SFMC)
// Bypasses MongoDB completely

import { NextResponse } from 'next/server';
import { workspaceRegistry } from '@/lib/connectors/workspaceRegistry';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const headerWsId = request.headers.get('x-workspace-id') || request.headers.get('X-Workspace-Id');
    const workspaceId = searchParams.get('workspaceId') || headerWsId || 'salescloud-ws-1';

    const connector = workspaceRegistry.getConnector(workspaceId);
    if (!connector) {
      return NextResponse.json(
        { success: false, error: `Unknown workspace ${workspaceId}` },
        { status: 404 }
      );
    }

    const contacts = await connector.fetchContacts({ limit: 50 });
    const conversations = contacts.map(c => ({
      _id: c.id,
      phoneNumber: c.phoneNumber,
      contactName: c.name,
      lastMessage: 'WhatsApp Sync',
      lastMessageTimestamp: c.lastSyncedAt,
      unreadCount: 0,
    }));

    return NextResponse.json({
      success: true,
      workspaceId,
      conversations,
      count: conversations.length,
    });
  } catch (error: any) {
    console.error('Error retrieving conversations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}