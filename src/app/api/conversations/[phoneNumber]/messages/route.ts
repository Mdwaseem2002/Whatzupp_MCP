// src/app/api/conversations/[phoneNumber]/messages/route.ts
// API route to retrieve message history for a specific phone number
// Delegates to native Salesforce connectors (SalesCloudConnector / SFMCConnector) based on workspaceId

import { NextResponse } from 'next/server';
import { workspaceRegistry } from '@/lib/connectors/workspaceRegistry';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phoneNumber: string }> }
) {
  try {
    const resolvedParams = await params;
    const rawPhone = resolvedParams.phoneNumber;

    if (!rawPhone) {
      return NextResponse.json(
        { success: false, error: 'Phone number parameter is required' },
        { status: 400 }
      );
    }

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

    const cleanPhone = rawPhone.replace(/^\+/, '').trim();
    const page = await connector.fetchMessages({ phoneNumber: cleanPhone });

    const formattedMessages = page.messages.map((m: any) => ({
      id: m.id,
      content: m.content,
      timestamp: m.timestamp,
      sender: m.direction === 'OUTBOUND' ? 'user' : 'contact',
      direction: m.direction,
      status: m.status,
      salesforceRecordId: m.salesforceRecordId,
    }));

    return NextResponse.json({
      success: true,
      workspaceId,
      messages: formattedMessages,
      count: formattedMessages.length,
    });
  } catch (error: any) {
    console.error('[conversations/messages] Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
