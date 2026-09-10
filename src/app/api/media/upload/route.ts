// src/app/api/media/upload/route.ts
// Uploads media (images, documents, video, audio) to Meta WhatsApp Graph API
// Dynamically reads live .env.local tokens to support real-time token updates from Settings ⚙️

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    let accessToken = process.env.WHATSAPP_ACCESS_TOKEN || (formData.get('accessToken') as string);
    let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || (formData.get('phoneNumberId') as string);

    // Dynamically read .env.local to get live updated tokens without requiring server restart
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const [key, ...rest] = trimmed.split('=');
          let val = rest.join('=').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (key === 'WHATSAPP_ACCESS_TOKEN' && val) accessToken = val;
          if (key === 'WHATSAPP_PHONE_NUMBER_ID' && val) phoneNumberId = val;
        }
      }
    } catch (e) {
      console.warn('[media/upload] Could not read .env.local fallback:', e);
    }

    if (!file || !accessToken || !phoneNumberId) {
      return NextResponse.json({ error: 'Missing required fields or WhatsApp credentials' }, { status: 400 });
    }

    // Prepare FormData for Meta Graph API
    const metaFormData = new FormData();
    metaFormData.append('messaging_product', 'whatsapp');
    metaFormData.append('file', file);
    
    // Upload to Meta Graph API
    const metaUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/media`;
    
    const metaResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: metaFormData
    });

    if (!metaResponse.ok) {
      const errorData = await metaResponse.json().catch(() => ({}));
      console.error('[Media Upload] Meta API error:', JSON.stringify(errorData));
      
      const isExpiredToken = errorData?.error?.code === 190 || errorData?.error?.type === 'OAuthException';
      const errorMsg = isExpiredToken
        ? 'Meta Session Expired: Your Meta Access Token has expired. Please click ⚙️ Settings and update your fresh Meta Access Token.'
        : errorData?.error?.message || 'Failed to upload media to Meta';

      return NextResponse.json({ error: errorMsg, details: errorData }, { status: metaResponse.status });
    }

    const data = await metaResponse.json();
    return NextResponse.json({ success: true, id: data.id });
    
  } catch (error: any) {
    console.error('[Media Upload] Internal Server Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
