// src/app/api/media/route.ts
// Proxy endpoint to stream WhatsApp media binaries from Meta Graph API

import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Workspace-Id, X-Workspace-Key, bypass-tunnel-reminder',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mediaId = searchParams.get('mediaId');
    const download = searchParams.get('download') === 'true';
    const filename = searchParams.get('filename');

    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID is required' }, { status: 400, headers: corsHeaders });
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'WhatsApp Access Token is not configured' }, { status: 500, headers: corsHeaders });
    }

    const metaGraphUrl = `https://graph.facebook.com/v25.0/${mediaId}`;
    const urlResponse = await fetch(metaGraphUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!urlResponse.ok) {
      const errorData = await urlResponse.json().catch(() => ({}));
      if (errorData?.error?.code === 190 || errorData?.error?.type === 'OAuthException') {
        return NextResponse.json(
          { error: 'Meta Access Token Expired (code 190). Please update WHATSAPP_ACCESS_TOKEN in Vercel or Settings ⚙️.', details: errorData },
          { status: 401, headers: corsHeaders }
        );
      }
      if (errorData?.error?.code === 100) {
        return NextResponse.json(
          { error: 'Media has expired on WhatsApp servers.' },
          { status: 410, headers: corsHeaders }
        );
      }
      return NextResponse.json({ error: 'Failed to find media URL on Meta Graph', details: errorData }, { status: urlResponse.status, headers: corsHeaders });
    }

    const { url, mime_type } = await urlResponse.json();
    if (!url) {
      return NextResponse.json({ error: 'Graph API response did not contain a URL' }, { status: 500, headers: corsHeaders });
    }

    const binaryResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!binaryResponse.ok) {
      return NextResponse.json({ error: 'Failed to download binary from Meta' }, { status: binaryResponse.status, headers: corsHeaders });
    }

    const arrayBuffer = await binaryResponse.arrayBuffer();
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Content-Type', mime_type || 'application/pdf');
    headers.set('Content-Length', arrayBuffer.byteLength.toString());
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    if (download) {
      const outFilename = filename || `document_${mediaId}.pdf`;
      headers.set('Content-Disposition', `attachment; filename="${outFilename}"`);
    } else {
      headers.set('Content-Disposition', 'inline');
    }

    return new NextResponse(Buffer.from(arrayBuffer), { status: 200, headers });
  } catch (error: any) {
    console.error('API /api/media error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
