import { NextRequest, NextResponse } from 'next/server';
import { getSalesCloudAccessToken } from '@/lib/salesCloudAuth';
import { workspaceRegistry } from '@/lib/connectors/workspaceRegistry';

export async function POST(request: NextRequest) {
  const workspaceKey = request.headers.get('x-workspace-key') || request.headers.get('X-Workspace-Key');
  const validKey = workspaceRegistry.validateWorkspaceKey(workspaceKey || '');

  if (!validKey || validKey.workspaceId !== 'salescloud-ws-1') {
    return NextResponse.json({ error: 'Unauthorized: Invalid workspace key for Sales Cloud' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { leadId, contactId, opportunityId, accountId } = body;

    if (!leadId || !contactId) {
      return NextResponse.json({ error: 'leadId and contactId are required' }, { status: 400 });
    }

    console.log(`[Lead Convert Webhook] Remapping messages for Lead ${leadId} -> Contact ${contactId}`);

    const { access_token, instance_url } = await getSalesCloudAccessToken();

    if (!access_token.startsWith('mock-')) {
      // 1. SOQL to find messages associated with Lead
      const safeLeadId = leadId.replace(/'/g, "\\'");
      const soql = `SELECT Id FROM WhatsApp_Message__c WHERE Lead__c = '${safeLeadId}'`;
      const queryUrl = `${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
      const res = await fetch(queryUrl, { headers: { Authorization: `Bearer ${access_token}` } });

      if (res.ok) {
        const data = await res.json();
        const records = data.records || [];

        // 2. Patch each record to update Contact__c and clear Lead__c
        for (const record of records) {
          const patchUrl = `${instance_url}/services/data/v59.0/sobjects/WhatsApp_Message__c/${record.Id}`;
          await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              Contact__c: contactId,
              Lead__c: null,
            }),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Lead ${leadId} messages successfully re-mapped to Contact ${contactId}`,
      leadId,
      contactId,
    });
  } catch (error: any) {
    console.error('[Lead Convert Webhook] Error:', error);
    return NextResponse.json({ error: error.message || 'Lead conversion re-mapping failed' }, { status: 500 });
  }
}
