import { NextResponse } from 'next/server';
import { writeSentMessage } from '@/lib/sfmcDE';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, message, mediaId, mediaType, mimeType, filename, localId, workspaceId: bodyWsId } = body;
    const headerWsId = request.headers.get('x-workspace-id') || request.headers.get('X-Workspace-Id');
    const targetWorkspaceId = bodyWsId || headerWsId;

    if (targetWorkspaceId) {
      const { workspaceRegistry } = await import('@/lib/connectors/workspaceRegistry');
      const connector = workspaceRegistry.getConnector(targetWorkspaceId);
      if (connector) {
        const result = await connector.sendMessage({
          recipientPhone: to.replace('+', ''),
          content: message || '',
        });
        return NextResponse.json({ success: true, data: result, workspaceId: targetWorkspaceId });
      }
    }

    // Always prefer server-side env (updated in real-time via /api/save-env)
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || body.accessToken;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || body.phoneNumberId;

    if (!to || (!message && !mediaId) || !accessToken || !phoneNumberId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Format the phone number to remove '+' if present, as WhatsApp API expects it without '+'
    const formattedPhone = to.replace('+', '');

    // Construct Meta payload
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
    };

    if (mediaId && mediaType) {
      payload.type = mediaType;
      payload[mediaType] = { id: mediaId };
      if (message) {
        payload[mediaType].caption = message;
      }
      if (filename && mediaType === 'document') {
        payload[mediaType].filename = filename;
      }
    } else {
      payload.type = 'text';
      payload.text = { preview_url: false, body: message || '' };
    }

    // Send message to WhatsApp Business API
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WhatsApp API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to send message', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const wamid = data?.messages?.[0]?.id;

    if (wamid) {
      const sentMessageData = {
        id: wamid,
        localId,
        content: message || `[Media: ${mediaType}]`,
        timestamp: new Date().toISOString(),
        sender: 'user',
        status: 'sent',
        recipientId: formattedPhone,
        contactPhoneNumber: formattedPhone,
      };

      // Write to SFMC Data Extension
      try {
        await writeSentMessage({
          WaMid: wamid,
          Phone: formattedPhone,
          MessageContent: message || `[Media: ${mediaType}]`,
          Status: 'sent',
          SentTime: new Date().toISOString(),
          Source: 'manual_send',
        });
      } catch (sfmcError) {
        console.error('[send-message] SFMC DE write failed:', sfmcError);
      }

      // Write to Salesforce Sales Cloud WhatsApp_Message__c object if workspace specified
      if (targetWorkspaceId === 'salescloud-ws-1') {
        try {
          const { SalesCloudConnector } = await import('@/lib/connectors/salesCloudConnector');
          const scConnector = new SalesCloudConnector();
          await scConnector.sendMessage({
            recipientPhone: formattedPhone,
            content: message || `[Media: ${mediaType}]`,
          });
        } catch (scErr) {
          console.warn('[send-message] Sales Cloud write failed:', scErr);
        }
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      // Broadcast via SSE for real-time UI updates
      // Per-phone SSE stream (updates the active chat window)
      fetch(`${appUrl}/api/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.JWT_SECRET || 'fallback-secret',
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          message: sentMessageData,
        }),
      }).catch(err => console.error('[send-message] SSE per-phone emit failed:', err));

      // Global SSE stream (updates notifications and other chat views)
      fetch(`${appUrl}/api/messages/stream/global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.JWT_SECRET || 'fallback-secret',
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          message: sentMessageData,
        }),
      }).catch(err => console.error('[send-message] SSE global emit failed:', err));
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}