import { NextResponse } from 'next/server';
import { SalesCloudConnector } from '@/lib/connectors/salesCloudConnector';
import { SFMCConnector } from '@/lib/connectors/sfmcConnector';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recipients, message, templateName, workspaceId } = body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Recipients array is required' }, { status: 400 });
    }

    const targetWs = workspaceId || 'salescloud-ws-1';
    const connector = targetWs === 'sfmc-ws-1' ? new SFMCConnector() : new SalesCloudConnector();

    const results = [];
    for (const phone of recipients) {
      try {
        const res = await connector.sendMessage({
          recipientPhone: phone.replace(/^\+/, ''),
          content: message || `[Template: ${templateName}]`,
        });
        results.push({ phone, status: 'success', messageId: res.messageId });
      } catch (err: any) {
        results.push({ phone, status: 'error', error: err.message });
      }
    }

    return NextResponse.json({ success: true, results, count: results.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk send failed' }, { status: 500 });
  }
}
