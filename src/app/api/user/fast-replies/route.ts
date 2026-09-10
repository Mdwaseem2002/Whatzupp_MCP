import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import FastReply from '@/models/FastReply';
import { getSfmcAccessToken } from '@/lib/sfmcAuth';

// Default SFMC user ID — used when auth is bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let docId = '';
    let doc = {
      userId: SFMC_USER_ID,
      title: body.title,
      body: body.body,
    };

    try {
      await connectMongoDB();
      const reply = await FastReply.create({
        userId: SFMC_USER_ID,
        title: body.title,
        body: body.body,
      });
      const dbDoc = reply.toObject() as any;
      docId = dbDoc._id.toString();
      doc = { ...dbDoc, _id: undefined, __v: undefined };
    } catch (dbError: any) {
      console.warn('[Fast Replies] MongoDB disabled or failed. Falling back to SFMC Data Extensions.', dbError.message);
      docId = 'fr_' + Date.now().toString();
    }

    // ─── START: Save to SFMC Data Extension ───
    try {
      const { access_token } = await getSfmcAccessToken();
      const sfmcRestBaseUri = process.env.SFMC_REST_BASE_URI || '';
      if (sfmcRestBaseUri) {
        const baseUri = sfmcRestBaseUri.replace(/\/$/, '');
        const url = `${baseUri}/hub/v1/dataevents/key:WhatsApp_Fast_Replies/rowset`;

        const payload = [{
          keys: { Id: docId },
          values: {
            UserId: SFMC_USER_ID,
            Title: body.title || '',
            Body: body.body || '',
            CreatedAt: new Date().toISOString()
          }
        }];

        const sfmcRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!sfmcRes.ok) {
          console.error('[Fast Replies] Failed to save to SFMC DE:', await sfmcRes.text());
        } else {
          console.log(`[Fast Replies] Successfully saved to SFMC DE: WhatsApp_Fast_Replies`);
        }
      }
    } catch (sfmcErr) {
      console.error('[Fast Replies] Error saving to SFMC DE:', sfmcErr);
    }
    // ─── END: Save to SFMC Data Extension ───

    return NextResponse.json({ 
      success: true, 
      data: { ...doc, id: docId } 
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Shortcut already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    try {
      await connectMongoDB();
      const result = await FastReply.findOneAndDelete({ _id: id, userId: SFMC_USER_ID });
      if (!result) {
         console.warn('[Fast Replies] Not found in MongoDB, proceeding to success anyway for SFMC mode');
      }
    } catch (dbError: any) {
      console.warn('[Fast Replies] MongoDB disabled or failed during DELETE.', dbError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
