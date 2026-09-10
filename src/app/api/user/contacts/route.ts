// src/app/api/user/contacts/route.ts
// User Contacts API delegating directly to Salesforce Sales Cloud / SFMC native connectors

import { NextRequest, NextResponse } from 'next/server';
import { workspaceRegistry } from '@/lib/connectors/workspaceRegistry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'salescloud-ws-1';
    const connector = workspaceRegistry.getConnector(workspaceId);

    if (!connector) {
      return NextResponse.json({ success: false, error: `Unknown workspace ${workspaceId}` }, { status: 404 });
    }

    const contacts = await connector.fetchContacts({});
    return NextResponse.json({
      success: true,
      data: contacts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId || 'salescloud-ws-1';

    if (workspaceId.includes('salescloud') || workspaceId === 'salescloud-ws-1') {
      const connector = workspaceRegistry.getConnector('salescloud-ws-1') as any;
      if (connector && typeof connector.createLead === 'function') {
        const leadResult = await connector.createLead({
          name: body.name,
          phoneNumber: body.phoneNumber,
          email: body.email,
          company: body.company,
        });
        return NextResponse.json({
          success: true,
          data: {
            id: leadResult.id,
            name: leadResult.name,
            phoneNumber: leadResult.phoneNumber,
            workspaceId,
            company: leadResult.company,
            email: leadResult.email,
            tags: [leadResult.salesforceObjectType || 'Lead'],
            createdAt: leadResult.lastSyncedAt,
          },
        });
      }
    }

    // SFMC fallback write
    const { getSfmcAccessToken } = await import('@/lib/sfmcAuth');
    const { access_token } = await getSfmcAccessToken();
    const baseUri = (process.env.SFMC_REST_BASE_URI || '').replace(/\/$/, '');
    const url = `${baseUri}/hub/v1/dataevents/key:WhatsApp_Test_Audience/rowset`;
    const payload = [{ keys: { ContactKey: body.name }, values: { MobilePhone: body.phoneNumber } }];
    await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: `${body.name}_${Date.now()}`,
        name: body.name,
        phoneNumber: body.phoneNumber,
        workspaceId,
        tags: body.tags || [],
        company: body.company || '',
        email: body.email || '',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const workspaceId = searchParams.get('workspaceId') || 'salescloud-ws-1';
    const objectType = (searchParams.get('objectType') as 'Lead' | 'Contact') || (id?.startsWith('003') ? 'Contact' : 'Lead');

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    if (id.startsWith('00Q') || id.startsWith('003') || workspaceId.includes('salescloud')) {
      const connector = workspaceRegistry.getConnector('salescloud-ws-1') as any;
      if (connector && typeof connector.deleteContactOrLead === 'function') {
        await connector.deleteContactOrLead(id, objectType);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const workspaceId = body.workspaceId || 'salescloud-ws-1';
    if (workspaceId.includes('salescloud') || id.startsWith('00Q') || id.startsWith('003')) {
      const objectType = body.salesforceObjectType || (id.startsWith('003') ? 'Contact' : 'Lead');
      const connector = workspaceRegistry.getConnector('salescloud-ws-1') as any;
      if (connector && typeof connector.updateContactOrLead === 'function') {
        await connector.updateContactOrLead(id, objectType, updates);
      }
    }

    return NextResponse.json({
      success: true,
      data: { id, ...updates },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
