// src/app/api/webhook/route.ts
// Handles Meta WhatsApp webhook:
// - GET: Verification handshake
// - POST: Incoming messages + delivery status receipts (Conditional Fan-Out & Unmatched Queue)

import { NextResponse } from 'next/server';
import { writeReceivedMessage, updateSentMessageStatus, writeOptOutStatus } from '@/lib/sfmcDE';
import { workspaceRegistry } from '@/lib/connectors/workspaceRegistry';
import { pushUnmatched, getConversationOwner, setConversationOwner } from '@/lib/storage/kvStore';
import { normalizePhoneNumber } from '@/utils/phone';
import { emitRealtimeMessage } from '@/lib/realtime';

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
                    const fnStr = filename ? ` ${filename}` : '';
                    contentText = caption
                      ? `${caption}\n[Media: ${mediaType}: ${mediaId}]${fnStr}`
                      : `[Media: ${mediaType}: ${mediaId}]${fnStr}`;
                  } else if (caption) {
                    contentText = caption;
                  } else {
                    if (message.type === 'document') contentText = `[Document: ${filename || 'file'}]`;
                    else if (message.type === 'sticker') contentText = '[Sticker]';
                    else contentText = `[${(message.type as string).charAt(0).toUpperCase() + (message.type as string).slice(1)}]`;
                  }
                }

                const normalizedPhone = normalizePhoneNumber(message.from as string);
                const messageId = (message.id as string) || `wamid_${Date.now()}`;
                const msgIsoTimestamp = message.timestamp
                  ? new Date(Number(message.timestamp) * 1000).toISOString()
                  : new Date().toISOString();

                // Idempotency check for incoming wamid
                if (!markWamidProcessed(messageId)) {
                  console.log(`[webhook] Skipping duplicate inbound message: ${messageId}`);
                  continue;
                }

                // ─── ONE CONVERSATION, ONE OWNING WORKSPACE ROUTING ───
                // 
                // Ownership determination strategy (production-safe):
                //   1. Try kvStore (works in dev, ephemeral on Vercel without KV)
                //   2. Query Salesforce WhatsApp_Message__c for last OUTBOUND message
                //      — this is the REAL persistent source of truth
                //   3. Fall through to findContact lookup across workspaces

                let ownerWorkspaceId: string | null = null;
                console.log(`[webhook] DIAGNOSTIC: Inbound Phone: ${message.from}`);
                console.log(`[webhook] DIAGNOSTIC: Normalized Phone: ${normalizedPhone}`);

                // Step 1: Try kvStore first (fast path, works when KV_REST_API_URL is set)
                const kvOwner = await getConversationOwner(normalizedPhone);
                if (kvOwner && kvOwner.workspaceId) {
                  const owningConnector = workspaceRegistry.getConnector(kvOwner.workspaceId);
                  if (owningConnector) {
                    ownerWorkspaceId = kvOwner.workspaceId;
                    console.log(`[webhook] Ownership from kvStore: ${ownerWorkspaceId}`);
                  }
                }

                // Step 2: kvStore miss → query persistent stores for last OUTBOUND message
                // This survives Vercel cold starts
                if (!ownerWorkspaceId) {
                  try {
                    const { SalesCloudConnector } = await import('@/lib/connectors/salesCloudConnector');
                    const scConnector = new SalesCloudConnector();
                    
                    let scLastOutboundDate: Date | null = null;
                    let sfmcLastOutboundDate: Date | null = null;

                    // Check Sales Cloud Outbound History
                    try {
                      const lastScOutbound = await scConnector.execSoql(
                        `SELECT Id, Phone__c, Timestamp__c FROM WhatsApp_Message__c WHERE Direction__c = 'OUTBOUND' AND (Phone__c = '${normalizedPhone}' OR Phone__c LIKE '%${normalizedPhone.slice(-10)}') ORDER BY Timestamp__c DESC LIMIT 1`
                      );
                      if (lastScOutbound && lastScOutbound.length > 0) {
                        scLastOutboundDate = new Date(lastScOutbound[0].Timestamp__c);
                      }
                    } catch (scErr) {
                      console.warn('[webhook] Salesforce outbound history check failed:', scErr);
                    }

                    // Check SFMC Outbound History
                    try {
                      const { getSfmcAccessToken } = await import('@/lib/sfmcAuth');
                      const { access_token } = await getSfmcAccessToken();
                      const sfmcRestBaseUri = process.env.SFMC_REST_BASE_URI!.replace(/\/$/, '');
                      
                      // Using $top=1 and orderby SentTime/CreatedDate
                      const sfmcUrl = `${sfmcRestBaseUri}/data/v1/customobjectdata/key/WhatsApp_Sent_Messages/rowset?$filter=Phone%20eq%20'${normalizedPhone}'%20or%20endswith(Phone,'${normalizedPhone.slice(-10)}')&$orderBy=SentTime%20DESC&$top=1`;
                      
                      const sfmcRes = await fetch(sfmcUrl, {
                        headers: { 'Authorization': `Bearer ${access_token}` },
                      });
                      
                      if (sfmcRes.ok) {
                        const sfmcData = await sfmcRes.json();
                        if (sfmcData.items && sfmcData.items.length > 0) {
                          const item = sfmcData.items[0].values;
                          const sentTimeStr = item.senttime || item.createddate || item.SentTime || item.CreatedDate;
                          if (sentTimeStr) sfmcLastOutboundDate = new Date(sentTimeStr);
                        }
                      }
                    } catch (sfmcErr) {
                      console.warn('[webhook] SFMC outbound history check failed:', sfmcErr);
                    }

                    // Determine Winner
                    if (scLastOutboundDate || sfmcLastOutboundDate) {
                      if (scLastOutboundDate && (!sfmcLastOutboundDate || scLastOutboundDate > sfmcLastOutboundDate)) {
                        ownerWorkspaceId = 'salescloud-ws-1';
                        console.log(`[webhook] Ownership from OUTBOUND history: salescloud-ws-1`);
                        await setConversationOwner(normalizedPhone, 'salescloud-ws-1', 'outbound');
                      } else if (sfmcLastOutboundDate) {
                        ownerWorkspaceId = 'sfmc-ws-1';
                        console.log(`[webhook] Ownership from OUTBOUND history: sfmc-ws-1`);
                        await setConversationOwner(normalizedPhone, 'sfmc-ws-1', 'outbound');
                      }
                    }
                  } catch (err) {
                    console.warn('[webhook] Outbound history check failed:', err);
                  }
                }

                console.log(`[webhook] DIAGNOSTIC: conversation_owner lookup result: ${ownerWorkspaceId}`);

                let handled = false;

                // Route to owning workspace
                if (ownerWorkspaceId) {
                  console.log(`[webhook] Conversation for ${normalizedPhone} owned by workspace ${ownerWorkspaceId}. Writing to ${ownerWorkspaceId} ONLY.`);

                  if (ownerWorkspaceId === 'salescloud-ws-1') {
                    const scConnector = workspaceRegistry.getConnector('salescloud-ws-1') as any;
                    if (scConnector) {
                      const contact = await scConnector.findContact({ phoneNumber: normalizedPhone });
                      await scConnector.saveInboundMessage(normalizedPhone, {
                        messageId,
                        content: contentText,
                        timestamp: msgIsoTimestamp,
                        leadId: contact?.salesforceObjectType === 'Lead' ? contact.salesforceRecordId : undefined,
                        contactId: contact?.salesforceObjectType === 'Contact' ? contact.salesforceRecordId : undefined,
                      });
                      emitRealtimeMessage(normalizedPhone, {
                        id: messageId,
                        content: contentText || '',
                        timestamp: msgIsoTimestamp,
                        sender: 'contact',
                        status: 'DELIVERED',
                        recipientId: 'user',
                      }, ownerWorkspaceId).catch(e => console.warn('[webhook] Sales Cloud realtime emit failed:', e));
                      handled = true;
                    }
                  } else if (ownerWorkspaceId === 'sfmc-ws-1') {
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
                    }, ownerWorkspaceId).catch(e => console.warn('[webhook] SFMC realtime emit failed:', e));
                    handled = true;
                  }
                }

                // Step 3: No ownership found — findContact lookup across workspaces
                if (!handled) {
                  const allWorkspaces = workspaceRegistry.getAllWorkspaces();
                  const matches: Array<{ workspaceId: string; connector: any; contact: any }> = [];

                  for (const ws of allWorkspaces) {
                    try {
                      const contact = await ws.connector.findContact({ phoneNumber: normalizedPhone });
                      if (contact) {
                        matches.push({ workspaceId: ws.workspaceId, connector: ws.connector, contact });
                      }
                    } catch (err) {
                      console.warn(`[webhook] findContact error for ${ws.workspaceId}:`, err);
                    }
                  }

                  const matchedIds = matches.map(m => m.workspaceId).join(', ');
                  console.log(`[webhook] DIAGNOSTIC: fallback matched workspaces: ${matchedIds || 'none'}`);

                  console.log(`[webhook] Workspace matches for ${normalizedPhone}: ${matches.map(m => m.workspaceId).join(', ')}`);

                  if (matches.length === 1) {
                    const singleMatch = matches[0];
                    console.log(`[webhook] Exactly 1 workspace match (${singleMatch.workspaceId}). Writing & setting ownership.`);

                    if (singleMatch.workspaceId === 'salescloud-ws-1') {
                      await singleMatch.connector.saveInboundMessage(normalizedPhone, {
                        messageId,
                        content: contentText,
                        timestamp: msgIsoTimestamp,
                        leadId: singleMatch.contact?.salesforceObjectType === 'Lead' ? singleMatch.contact.salesforceRecordId : undefined,
                        contactId: singleMatch.contact?.salesforceObjectType === 'Contact' ? singleMatch.contact.salesforceRecordId : undefined,
                      });
                      emitRealtimeMessage(normalizedPhone, {
                        id: messageId,
                        content: contentText || '',
                        timestamp: msgIsoTimestamp,
                        sender: 'contact',
                        status: 'DELIVERED',
                        recipientId: 'user',
                      }, singleMatch.workspaceId).catch(e => console.warn('[webhook] Sales Cloud realtime emit failed:', e));
                    } else if (singleMatch.workspaceId === 'sfmc-ws-1') {
                      await writeReceivedMessage({
                        WaMid: messageId,
                        Phone: normalizedPhone,
                        ContactName: singleMatch.contact?.name || '',
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
                      }, singleMatch.workspaceId).catch(e => console.warn('[webhook] SFMC realtime emit failed:', e));
                    }

                    await setConversationOwner(normalizedPhone, singleMatch.workspaceId, 'inbound_match');
                  } else if (matches.length > 1) {
                    console.log(`[webhook] Ambiguous match (${matches.length} workspaces). Pushing to Ambiguous Queue.`);
                    await pushUnmatched({
                      id: messageId,
                      phoneNumber: normalizedPhone,
                      content: contentText,
                      timestamp: msgIsoTimestamp,
                      status: 'ambiguous',
                      candidateWorkspaces: matches.map(m => m.workspaceId),
                      mediaType,
                      mediaId,
                      filename,
                      rawPayload: message as Record<string, unknown>
                    });
                  } else {
                    // matches.length === 0
                    console.log(`[webhook] Zero workspace matches. Pushing to Unmatched Queue.`);
                    await pushUnmatched({
                      id: messageId,
                      phoneNumber: normalizedPhone,
                      content: contentText,
                      timestamp: msgIsoTimestamp,
                      status: 'unmatched',
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
