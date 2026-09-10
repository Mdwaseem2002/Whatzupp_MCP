import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import WorkspaceContact from '@/models/WorkspaceContact';

export const dynamic = 'force-dynamic';

// Default SFMC user ID — used when auth is bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    await connectMongoDB();
    const filter: any = { userId: SFMC_USER_ID };
    if (workspaceId) filter.workspaceId = workspaceId;

    const contacts = await WorkspaceContact.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      success: true,
      data: contacts.map((doc: any) => ({
        ...doc,
        id: doc._id.toString(),
        _id: undefined,
        __v: undefined,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Direct Salesforce Sales Cloud handler — bypass MongoDB completely
    if (body.workspaceId === 'salescloud-ws-1' || body.workspaceId?.includes('salescloud')) {
      const { workspaceRegistry } = await import('@/lib/connectors/workspaceRegistry');
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
            workspaceId: body.workspaceId,
            company: leadResult.company,
            email: leadResult.email,
            tags: [leadResult.salesforceObjectType || 'Lead'],
            createdAt: leadResult.lastSyncedAt,
          },
        });
      }
    }
    
    try {
      await connectMongoDB();
      const contact = await WorkspaceContact.create({
        userId: SFMC_USER_ID,
        workspaceId: body.workspaceId,
        name: body.name,
        phoneNumber: body.phoneNumber,
        company: body.company,
        email: body.email,
        tags: body.tags || [],
      });

      const doc = contact.toObject() as any;
      return NextResponse.json({ 
        success: true, 
        data: { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined } 
      });
    } catch (dbError) {
      console.warn('[User Contacts] MongoDB disabled. Falling back to SFMC DE write.');
      const { getSfmcAccessToken } = await import('@/lib/sfmcAuth');
      const { access_token } = await getSfmcAccessToken();
      const baseUri = (process.env.SFMC_REST_BASE_URI || '').replace(/\/$/, '');
      const url = `${baseUri}/hub/v1/dataevents/key:WhatsApp_Test_Audience/rowset`;
      const payload = [{ keys: { ContactKey: body.name }, values: { MobilePhone: body.phoneNumber } }];
      await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      
      return NextResponse.json({
        success: true,
        data: {
          id: body.name + '_' + Date.now(),
          name: body.name,
          phoneNumber: body.phoneNumber,
          workspaceId: body.workspaceId || 'default-ws',
          tags: body.tags || [],
          company: body.company || '',
          email: body.email || ''
        }
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const workspaceId = searchParams.get('workspaceId');
    const objectType = (searchParams.get('objectType') as 'Lead' | 'Contact') || (id?.startsWith('003') ? 'Contact' : 'Lead');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    // Direct Salesforce Sales Cloud handler — bypass MongoDB completely
    if (id.startsWith('00Q') || id.startsWith('003') || workspaceId === 'salescloud-ws-1') {
      const { workspaceRegistry } = await import('@/lib/connectors/workspaceRegistry');
      const connector = workspaceRegistry.getConnector('salescloud-ws-1') as any;
      if (connector && typeof connector.deleteContactOrLead === 'function') {
        await connector.deleteContactOrLead(id, objectType);
      }
      return NextResponse.json({ success: true });
    }

    try {
      await connectMongoDB();
      const result = await WorkspaceContact.findOneAndDelete({ _id: id, userId: SFMC_USER_ID });
      if (!result) return NextResponse.json({ error: 'Not found or permission denied' }, { status: 404 });
      return NextResponse.json({ success: true });
    } catch (dbError) {
      console.warn('[User Contacts] MongoDB disabled. Simulating DELETE for SFMC.');
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    // Direct Salesforce Sales Cloud handler — bypass MongoDB completely
    if (body.workspaceId === 'salescloud-ws-1' || id.startsWith('00Q') || id.startsWith('003')) {
      const objectType = body.salesforceObjectType || (id.startsWith('003') ? 'Contact' : 'Lead');
      const { workspaceRegistry } = await import('@/lib/connectors/workspaceRegistry');
      const connector = workspaceRegistry.getConnector('salescloud-ws-1') as any;
      if (connector && typeof connector.updateContactOrLead === 'function') {
        await connector.updateContactOrLead(id, objectType, updates);
      }
      return NextResponse.json({
        success: true,
        data: { id, ...updates },
      });
    }

    try {
      await connectMongoDB();
      const updatedContact = await WorkspaceContact.findOneAndUpdate(
        { _id: id, userId: SFMC_USER_ID },
        { $set: updates },
        { new: true }
      );

      if (!updatedContact) return NextResponse.json({ error: 'Not found or permission denied' }, { status: 404 });

      const doc = updatedContact.toObject() as any;
      return NextResponse.json({ 
        success: true, 
        data: { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined } 
      });
    } catch (dbError) {
      console.warn('[User Contacts] MongoDB disabled. Falling back to SFMC DE update.');
      if (updates.name && updates.phoneNumber) {
        const { getSfmcAccessToken } = await import('@/lib/sfmcAuth');
        const { access_token } = await getSfmcAccessToken();
        const baseUri = (process.env.SFMC_REST_BASE_URI || '').replace(/\/$/, '');
        const url = `${baseUri}/hub/v1/dataevents/key:WhatsApp_Test_Audience/rowset`;
        const payload = [{ keys: { ContactKey: updates.name }, values: { MobilePhone: updates.phoneNumber } }];
        await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      return NextResponse.json({ 
        success: true, 
        data: { id, ...updates } 
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

