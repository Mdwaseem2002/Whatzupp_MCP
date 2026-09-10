// src/app/api/webhook/route.ts
// Handles Meta WhatsApp webhook:
// - GET: Verification handshake
// - POST: Incoming messages + delivery status receipts (Conditional Fan-Out & Unmatched Queue)

import { NextResponse } from 'next/server';
import { writeReceivedMessage, updateSentMessageStatus, writeOptOutStatus } from '@/lib/sfmcDE';
import { SalesCloudConnector } from '@/lib/connectors/salesCloudConnector';
import { pushUnmatched } from '@/lib/storage/kvStore';
import { emitRealtimeMessage } from '@/lib/realtime';

const salesCloudConnector = new SalesCloudConnector();

// ----- Idempotency: Track processed wamids in-memory -----
const processedWamids = new Set<string>();
const MAX_PROCESSED_WAMIDS = 10000;

function markWamidProcessed(wamid: string): boolean {
  if (processedWamids.has(wamid)) {
    return false; // Already processed
  }
  if (processedWamids.size >= MAX_PROCESSED_WAMIDS) {
    const iterator = processedWamids.values();
    for (let i = 0; i < 1000; i++) {
      const oldest = iterator.next().value;
      if (oldest) processedWamids.delete(oldest);
    }
  }
  processedWamids.add(wamid);
  return true; // Newly processed
}

// Enable CORS and handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  } else {
    return new NextResponse("Forbidden", { 
      status: 403,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawBody);
  } catch {
    console.error("[webhook] Failed to parse webhook payload");
    return new NextResponse("Invalid JSON payload", { 
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (!data || data.object !== "whatsapp_business_account") {
    return new NextResponse("Not a WhatsApp event", { 
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const entries = (data.entry as Array<Record<string, unknown>>) || [];

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) || [];

      for (const change of changes) {
        if (change.field !== "messages") continue;

        const value = (change.value as Record<string, unknown>) || {};

        // ----- Handle Incoming Messages -----
        const messages = value.messages as Array<Record<string, unknown>> | undefined;
        if (messages && Array.isArray(messages)) {
          for (const message of messages) {
            console.log("[webhook] ===== INBOUND MESSAGE =====");
            console.log("[webhook] Type:", message.type, "| From:", message.from, "| ID:", message.id);

            if (["text", "image", "video", "document", "audio", "sticker"].includes(message.type as string)) {
              try {
                let contentText = '';
                let mediaType: string | undefined = undefined;
                let mediaId: string | undefined = undefined;
                let mimeType: string | undefined = undefined;
                let filename: string | undefined = undefined;
                let caption: string | undefined = undefined;

                if (message.type === "text") {
                  contentText = (message.text as Record<string, string>)?.body || '';
                } else {
                  const actualType = message.type === 'sticker' ? 'sticker' : message.type as string;
                  mediaType = actualType === 'sticker' ? 'image' : actualType;
                  const mediaObj = message[actualType] as Record<string, string>;
                  mediaId = mediaObj?.id;
                  mimeType = mediaObj?.mime_type;
                  caption = mediaObj?.caption;
                  filename = mediaObj?.filename;

                  if (mediaId) {
                    contentText = caption
                      ? `${caption}\n[Media: ${mediaType}: ${mediaId}]`
                      : `[Media: ${mediaType}: ${mediaId}]`;
                  } else if (caption) {
                    contentText = caption;
                  } else {
                    if (message.type === 'document') contentText = `[Document: ${filename || 'file'}]`;
                    else if (message.type === 'sticker') contentText = '[Sticker]';
                    else contentText = `[${(message.type as string).charAt(0).toUpperCase() + (message.type as string).slice(1)}]`;
                  }
                }

                const normalizedPhone = (message.from as string).replace(/^\+/, '');
                const messageId = (message.id as string) || `wamid_${Date.now()}`;
                const msgIsoTimestamp = message.timestamp
                  ? new Date(Number(message.timestamp) * 1000).toISOString()
                  : new Date().toISOString();

                // ─── STRICT WORKSPACE ISOLATION ───
                // Each workspace is isolated — messages go to ONE platform only.
                // Sales Cloud client → WhatsApp_Message__c ONLY
                // SFMC client → SFMC DE ONLY
                // Never cross-write between workspaces.

                // ----- Step 1: Check Sales Cloud Workspace Match -----
                let hasSalesCloudMatch = false;
                let scContact: any = null;
                try {
                  scContact = await salesCloudConnector.resolveContact({ phoneNumber: normalizedPhone });
                  if (scContact && scContact.salesforceRecordId) {
                    hasSalesCloudMatch = true;
                  }
                } catch (e) {
                  console.warn('[webhook] Sales Cloud resolveContact check failed:', e);
                }

                if (hasSalesCloudMatch) {
                  // ─── SALES CLOUD ONLY ───
                  console.log(`[webhook] Sales Cloud match for ${normalizedPhone}. Writing to WhatsApp_Message__c ONLY.`);
                  await salesCloudConnector.saveInboundMessage({
                    messageId,
                    senderPhone: normalizedPhone,
                    content: contentText,
                    timestamp: msgIsoTimestamp,
                    leadId: scContact?.salesforceObjectType === 'Lead' ? scContact.salesforceRecordId : undefined,
                    contactId: scContact?.salesforceObjectType === 'Contact' ? scContact.salesforceRecordId : undefined,
                  });
                } else {
                  // ----- Step 2: No Sales Cloud match — Check SFMC -----
                  const sfmcConfigured = !!(process.env.SFMC_REST_BASE_URI && process.env.SFMC_CLIENT_ID);

                  if (sfmcConfigured) {
                    // ─── SFMC ONLY ───
                    console.log(`[webhook] No Sales Cloud match. Writing to SFMC WhatsApp_Received_Messages DE for ${normalizedPhone}.`);
                    await writeReceivedMessage({
                      WaMid: messageId,
                      Phone: normalizedPhone,
                      ContactName: '',
                      MessageType: message.type as string || 'text',
                      MessageContent: contentText || '',
                      ReceivedTime: msgIsoTimestamp,
                    });
                    emitRealtimeMessage(normalizedPhone, {
                      id: messageId,
                      content: contentText || '',
                      timestamp: msgIsoTimestamp,
                      sender: 'contact',
                      status: 'DELIVERED',
                      recipientId: 'user',
                    }).catch(e => console.warn('[webhook] SFMC realtime emit failed:', e));
                  } else {
                    // ----- Step 3: Neither workspace configured — Unmatched Queue -----
                    console.log(`[webhook] Phone ${normalizedPhone} matched neither workspace. Pushing to Unmatched Queue.`);
                    await pushUnmatched({
                      id: messageId,
                      phoneNumber: normalizedPhone,
                      content: contentText,
                      timestamp: msgIsoTimestamp,
                      mediaType,
                      mediaId,
                      filename,
                      rawPayload: message as Record<string, unknown>
                    });
                  }
                }

                // ---- Opt-Out Processing (STOP keywords) ----
                const bodyText = contentText?.trim().toLowerCase() || '';
                if (/^(stop|unsubscribe|cancel|quit|end)$/.test(bodyText) && message.type === 'text') {
                  console.log(`[webhook] Opt-Out keyword detected from ${message.from}. Marking as unsubscribed.`);
                  try {
                    await writeOptOutStatus(message.from as string, 'OptOut');
                  } catch (e) {
                    console.error('[webhook] writeOptOutStatus failed:', e);
                  }
                }

              } catch (storeError) {
                console.error("[webhook] Error processing message:", storeError);
              }
            }
          }
        }

        // ----- Handle Delivery Status Updates -----
        const statuses = value.statuses as Array<Record<string, unknown>> | undefined;
        if (statuses && Array.isArray(statuses)) {
          for (const status of statuses) {
            const wamid = status.id as string;
            const statusValue = status.status as string;
            const recipientId = status.recipient_id as string;
            const timestamp = status.timestamp as string;

            if (!wamid) continue;

            const idempotencyKey = `${wamid}:${statusValue}`;
            if (!markWamidProcessed(idempotencyKey)) {
              console.log(`[webhook] Skipping duplicate status: ${idempotencyKey}`);
              continue;
            }

            try {
              const isoTimestamp = timestamp
                ? new Date(Number(timestamp) * 1000).toISOString()
                : new Date().toISOString();

              // ─── STRICT WORKSPACE ISOLATION for status updates ───
              // Try Sales Cloud first (update WhatsApp_Message__c if the wamid exists there)
              let statusWritten = false;
              try {
                const { access_token: scToken, instance_url } = await (await import('@/lib/salesCloudAuth')).getSalesCloudAccessToken();
                if (scToken && !scToken.startsWith('mock-')) {
                  // Query to check if this wamid exists in WhatsApp_Message__c
                  const checkSoql = `SELECT Id FROM WhatsApp_Message__c WHERE Message_Id__c = '${wamid.replace(/'/g, "\\\\'")}' LIMIT 1`;
                  const checkRes = await fetch(`${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(checkSoql)}`, {
                    headers: { Authorization: `Bearer ${scToken}` },
                  });
                  if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    if (checkData.records && checkData.records.length > 0) {
                      // Update status in Sales Cloud
                      const upsertUrl = `${instance_url}/services/data/v59.0/sobjects/WhatsApp_Message__c/Message_Id__c/${encodeURIComponent(wamid)}`;
                      await fetch(upsertUrl, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${scToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          Status__c: statusValue.toUpperCase(),
                        }),
                      });
                      statusWritten = true;
                      console.log(`[webhook] Status ${statusValue} updated in Sales Cloud for ${wamid}`);
                    }
                  }
                }
              } catch (scErr) {
                console.warn('[webhook] Sales Cloud status check failed:', scErr);
              }

              // If not found in Sales Cloud, update SFMC DE
              if (!statusWritten) {
                await updateSentMessageStatus({
                  WaMid: wamid,
                  Status: statusValue,
                  DeliveredTime: statusValue === 'delivered' ? isoTimestamp : undefined,
                  ReadTime: statusValue === 'read' ? isoTimestamp : undefined,
                  FailedReason: statusValue === 'failed' ? JSON.stringify(status.errors || {}) : undefined,
                });
              }
            } catch (statusError) {
              console.error(`[webhook] Status update failed for ${wamid}:`, statusError);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[webhook] Processing error:", error);
  }

  return new NextResponse("EVENT_RECEIVED", {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
