import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, phoneNumberId } = await request.json();

    if (!accessToken && !phoneNumberId) {
      return NextResponse.json({ success: false, error: 'Access token or Phone Number ID is required' }, { status: 400 });
    }

    // 1. Update active process environment variables immediately
    if (accessToken) {
      process.env.WHATSAPP_ACCESS_TOKEN = accessToken;
    }
    if (phoneNumberId) {
      process.env.WHATSAPP_PHONE_NUMBER_ID = phoneNumberId;
    }

    // 2. Read and update .env.local file to persist across restarts
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    if (accessToken) {
      if (envContent.includes('WHATSAPP_ACCESS_TOKEN=')) {
        envContent = envContent.replace(
          /WHATSAPP_ACCESS_TOKEN=.*/g,
          `WHATSAPP_ACCESS_TOKEN="${accessToken}"`
        );
      } else {
        envContent += `\nWHATSAPP_ACCESS_TOKEN="${accessToken}"\n`;
      }
    }

    if (phoneNumberId) {
      if (envContent.includes('WHATSAPP_PHONE_NUMBER_ID=')) {
        envContent = envContent.replace(
          /WHATSAPP_PHONE_NUMBER_ID=.*/g,
          `WHATSAPP_PHONE_NUMBER_ID="${phoneNumberId}"`
        );
      } else {
        envContent += `\nWHATSAPP_PHONE_NUMBER_ID="${phoneNumberId}"\n`;
      }
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    
    console.log('[API] Dynamically updated WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID in .env.local');
    
    return NextResponse.json({ success: true, accessToken, phoneNumberId });
  } catch (error: any) {
    console.error('Error saving env vars:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
