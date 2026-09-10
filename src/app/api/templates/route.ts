// src/app/api/templates/route.ts
// Fetches all APPROVED WhatsApp message templates from Meta
// Used by Journey Builder activity UI dropdown & Salesforce LWC

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface MetaTemplate {
  name: string;
  status: string;
  language: string;
  category: string;
  id: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: Record<string, unknown>;
    buttons?: Array<Record<string, unknown>>;
  }>;
}

interface MetaTemplatesResponse {
  data: MetaTemplate[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

export async function GET() {
  try {
    // ----- Env Vars -----
    let accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    let wabaId = process.env.WABA_ID;

    // Dynamically read .env.local to get live tokens without server restart
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
          if (key === 'WABA_ID' && val) wabaId = val;
        }
      }
    } catch (e) {
      console.warn('[templates] Could not read .env.local fallback:', e);
    }

    if (!accessToken || !wabaId) {
      console.error('[templates] Missing WHATSAPP_ACCESS_TOKEN or WABA_ID');
      return NextResponse.json(
        { success: false, error: 'WhatsApp Access Token or WABA ID not configured. Please check .env.local or Settings.' },
        { status: 400 }
      );
    }

    // ----- Fetch Templates with Pagination -----
    const allTemplates: MetaTemplate[] = [];
    let nextUrl: string | null = `https://graph.facebook.com/v25.0/${wabaId}/message_templates?limit=100`;

    console.log('[templates] Fetching approved templates from Meta...');

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[templates] Meta API error:', JSON.stringify(errorData));
        const msg = errorData.error?.message || errorData.error?.error_user_msg || `Meta API Error ${response.status}`;
        return NextResponse.json(
          { success: false, error: `Meta API Error: ${msg}`, details: errorData },
          { status: 502 }
        );
      }

      const data: MetaTemplatesResponse = await response.json();

      if (data.data && Array.isArray(data.data)) {
        allTemplates.push(...data.data);
      }

      // Follow pagination if more pages exist
      nextUrl = data.paging?.next || null;
    }

    // ----- Filter Only APPROVED Templates -----
    const approvedTemplates = allTemplates.filter(
      (template) => template.status === 'APPROVED'
    );

    console.log(`[templates] Found ${approvedTemplates.length} approved templates out of ${allTemplates.length} total`);

    // ----- Return Clean Response -----
    const cleanTemplates = approvedTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      language: template.language,
      category: template.category,
      status: template.status,
      components: template.components || [],
    }));

    return NextResponse.json({
      success: true,
      templates: cleanTemplates,
      count: cleanTemplates.length,
    });
  } catch (error: any) {
    console.error('[templates] Internal error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
