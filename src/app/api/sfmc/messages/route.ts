// src/app/api/sfmc/messages/route.ts
// Fetches messages from SFMC Data Extensions:
//   WhatsApp_Sent_Messages (outbound from Journey Builder)
//   WhatsApp_Received_Messages (inbound replies to SFMC messages)

import { NextRequest, NextResponse } from 'next/server';
import { getSfmcAccessToken, invalidateSfmcToken } from '@/lib/sfmcAuth';

interface SfmcMessage {
  id: string;
  direction: 'sent' | 'received';
  body: string;
  timestamp: string;
  contactKey: string;
  journeyName: string;
  templateName: string;
  status: string;
  source: 'sfmc';
  // Extra fields for the analytics table
  language?: string;
  parameters?: string;
  phone?: string;
  contactName?: string;
  messageType?: string;
  wamid?: string;
}

async function fetchDeRows(deKey: string, accessToken: string): Promise<any[]> {
  const restBase = (process.env.SFMC_REST_BASE_URI || '').replace(/\/$/, '');
  if (!restBase) throw new Error('SFMC_REST_BASE_URI not configured');

  const allItems: any[] = [];
  let page = 1;
  const pageSize = 2500;
  const maxPages = 20; // Safety limit to prevent infinite loops

  while (page <= maxPages) {
    const url = `${restBase}/data/v1/customobjectdata/key/${deKey}/rowset?$pageSize=${pageSize}&$page=${page}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      invalidateSfmcToken();
      throw new Error('SFMC token expired');
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`[SFMC Messages] Failed to fetch ${deKey} (page ${page}):`, response.status, text);
      throw new Error(`SFMC DE fetch failed (${response.status})`);
    }

    const data = await response.json();
    const items = data.items || [];
    allItems.push(...items);

    console.log(`[SFMC Messages] Fetched page ${page} of ${deKey}: ${items.length} rows (total so far: ${allItems.length})`);

    // If we got fewer items than pageSize, we've reached the last page
    if (items.length < pageSize) break;

    // Check for continuation token
    if (data.requestToken) {
      page++;
    } else {
      break;
    }
  }

  return allItems;
}

function getFieldValue(row: any, fieldName: string): string {
  const lowerKey = fieldName.toLowerCase();
  
  const searchObj = (obj: any) => {
    if (!obj) return null;
    const key = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
    return key ? obj[key] : null;
  };

  return searchObj(row.keys) || searchObj(row.values) || searchObj(row) || '';
}

/**
 * Normalize SFMC timestamps to ISO 8601.
 * SFMC DE returns dates in US locale format: "M/D/YYYY h:mm:ss AM/PM"
 * This function handles both ISO and US-locale formats.
 */
function normalizeTimestamp(raw: string): string {
  if (!raw) return new Date().toISOString();
  
  // Already ISO 8601 (contains T or starts with YYYY-)
  if (raw.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  
  // SFMC US locale: "M/D/YYYY h:mm:ss AM/PM" or "M/D/YYYY h:mm:ss"
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    const [, month, day, year, hourStr, min, sec, ampm] = match;
    let hour = parseInt(hourStr, 10);
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    }
    // Construct ISO string (SFMC times are UTC)
    const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${min}:${sec}.000Z`;
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  
  // Fallback: try native parsing
  const fallback = new Date(raw);
  if (!isNaN(fallback.getTime())) return fallback.toISOString();
  
  return new Date().toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactKey = searchParams.get('contactKey');

    const { access_token } = await getSfmcAccessToken();

    // Fetch both DEs in parallel
    const [sentRows, receivedRows] = await Promise.all([
      fetchDeRows('WhatsApp_Sent_Messages', access_token).catch(err => {
        console.error('[SFMC Messages] Sent DE error:', err.message);
        return [];
      }),
      fetchDeRows('WhatsApp_Received_Messages', access_token).catch(err => {
        console.error('[SFMC Messages] Received DE error:', err.message);
        return [];
      }),
    ]);

    // Transform sent messages
    const sentMessages: SfmcMessage[] = sentRows.map((row: any, i: number) => {
      const phone = getFieldValue(row, 'Phone');
      const wamid = getFieldValue(row, 'WaMid');
      const ck = getFieldValue(row, 'ContactKey');
      return {
        id: wamid || `sfmc-sent-${i}`,
        direction: 'sent' as const,
        body: getFieldValue(row, 'MessageContent') || `[Template: ${getFieldValue(row, 'TemplateName')}]`,
        timestamp: normalizeTimestamp(getFieldValue(row, 'SentTime')),
        contactKey: (ck && ck.trim() ? ck : phone),
        journeyName: getFieldValue(row, 'JourneyName') || '',
        templateName: getFieldValue(row, 'TemplateName') || '',
        status: getFieldValue(row, 'Status') || 'sent',
        source: 'sfmc' as const,
        language: getFieldValue(row, 'Language'),
        parameters: getFieldValue(row, 'Parameters'),
        phone,
        wamid,
      };
    });

    // Transform received messages
    const receivedMessages: SfmcMessage[] = receivedRows.map((row: any, i: number) => {
      const phone = getFieldValue(row, 'Phone');
      const wamid = getFieldValue(row, 'WaMid');
      const cn = getFieldValue(row, 'ContactName');
      return {
        id: wamid || `sfmc-recv-${i}`,
        direction: 'received' as const,
        body: getFieldValue(row, 'MessageContent') || '',
        timestamp: normalizeTimestamp(getFieldValue(row, 'ReceivedTime')),
        contactKey: (cn && cn.trim() ? cn : phone),
        journeyName: '',
        templateName: '',
        status: 'received',
        source: 'sfmc' as const,
        phone,
        contactName: cn,
        messageType: getFieldValue(row, 'MessageType'),
        wamid,
      };
    });

    let allMessages = [...sentMessages, ...receivedMessages];

    // Filter by contact key if provided (match on phone or contactKey)
    if (contactKey) {
      const normalized = contactKey.replace(/[^0-9]/g, '');
      if (normalized.length >= 10) {
        const last10 = normalized.slice(-10);
        allMessages = allMessages.filter(m => {
          const mPhone = (m.phone || m.contactKey || '').replace(/[^0-9]/g, '');
          if (!mPhone || mPhone.length < 10) return false;
          return mPhone.endsWith(last10) || last10.endsWith(mPhone.slice(-10));
        });
      }
    }

    // Sort by timestamp descending
    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      messages: allMessages,
      sentCount: sentMessages.length,
      receivedCount: receivedMessages.length,
      totalCount: allMessages.length,
    });
  } catch (error: any) {
    console.error('[SFMC Messages] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch SFMC messages', messages: [] },
      { status: 500 }
    );
  }
}
