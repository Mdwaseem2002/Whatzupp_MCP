// src/app/api/messages/route.ts
// Messaging route delegating directly to native Salesforce connectors

import { NextResponse } from 'next/server';
import { workspaceRegistry } from '@/lib/connectors/workspaceRegistry';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber') || searchParams.get('conversationId') || undefined;
    const headerWsId = request.headers.get('x-workspace-id') || request.headers.get('X-Workspace-Id');
    const workspaceId = searchParams.get('workspaceId') || headerWsId || 'salescloud-ws-1';

    const connector = workspaceRegistry.getConnector(workspaceId);
    if (!connector) {
      return NextResponse.json(
        { success: false, error: `Unknown workspace ${workspaceId}` },
        { status: 404 }
      );
    }

    const cleanPhone = phoneNumber ? phoneNumber.replace(/^\+/, '').trim() : undefined;
    const page = await connector.fetchMessages({ phoneNumber: cleanPhone });

    return NextResponse.json({
      success: true,
      workspaceId,
      messages: page.messages,
      count: page.messages.length,
    });
  } catch (error: any) {
    console.error('Error retrieving messages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phoneNumber, message, workspaceId: bodyWsId } = body;
    const headerWsId = request.headers.get('x-workspace-id') || request.headers.get('X-Workspace-Id');
    const workspaceId = bodyWsId || headerWsId || 'salescloud-ws-1';

    const connector = workspaceRegistry.getConnector(workspaceId);
    if (!connector) {
      return NextResponse.json(
        { success: false, error: `Unknown workspace ${workspaceId}` },
        { status: 404 }
      );
    }

    const content = message?.text?.body || message?.content || '';
    const cleanPhone = phoneNumber ? phoneNumber.replace(/^\+/, '').trim() : '';

    const result = await connector.sendMessage({
      recipientPhone: cleanPhone,
      content,
    });

    return NextResponse.json({
      success: true,
      workspaceId,
      messageId: result.messageId,
      status: result.status,
    });
  } catch (error: any) {
    console.error('Error storing/sending message:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}