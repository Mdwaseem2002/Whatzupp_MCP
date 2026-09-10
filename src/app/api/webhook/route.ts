// src/app/api/webhook/route.ts
// Handles Meta WhatsApp webhook:
// - GET: Verification handshake
// - POST: Incoming messages + delivery status receipts (→ SFMC Data Extension)

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import { writeReceivedMessage, updateSentMessageStatus, writeOptOutStatus } from '@/lib/sfmcDE';
import MessageModel from '@/models/Message';
import Conversation from '@/models/Conversation';
import { MessageStatus } from '@/types';

// ----- Idempotency: Track processed wamids in-memory -----
const processedWamids = new Set<string>();
const MAX_PROCESSED_WAMIDS = 10000;

function markWamidProcessed(wamid: string): boolean {
  if (processedWamids.has(wamid)) {
    return false; // Already processed
  }
  // LRU-style eviction: if at capacity, clear oldest entries
  if (processedWamids.size >= MAX_PROCESSED_WAMIDS) {
    const iterator = processedWamids.values();
    // Delete first 1000 entries (oldest)
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

  // Support both env var names for backwards compatibility
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
  // ----- Acknowledge Meta IMMEDIATELY with 200 -----
  // We parse the body first since we can only read it once,
  // but we structure the code to respond quickly.
  
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

  // Not a WhatsApp event — acknowledge and return
  if (!data || data.object !== "whatsapp_business_account") {
    return new NextResponse("Not a WhatsApp event", { 
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  // ----- Process in background after acknowledging -----
  // Using waitUntil pattern: we return 200 immediately and process async
  // In Next.js App Router, we process synchronously but respond 200 regardless

  try {
    // Ensure MongoDB connection for incoming messages
    await connectMongoDB();

    const entries = (data.entry as Array<Record<string, unknown>>) || [];

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) || [];

      for (const change of changes) {
        if (change.field !== "messages") continue;

        const value = (change.value as Record<string, unknown>) || {};

        // ----- Handle Incoming Messages (existing logic) -----
        const messages = value.messages as Array<Record<string, unknown>> | undefined;
        if (messages && Array.isArray(messages)) {
          for (const message of messages) {
            console.log("[webhook] ===== INBOUND MESSAGE =====");
            console.log("[webhook] Type:", message.type, "| From:", message.from, "| ID:", message.id);
            console.log("[webhook] Full payload:", JSON.stringify(message, null, 2));

            if (["text", "image", "video", "document", "audio", "sticker"].includes(message.type as string)) {
              try {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                
                // Dynamic Media Extraction
                let contentText = '';
                let mediaType: string | undefined = undefined;
                let mediaId: string | undefined = undefined;
                let mimeType: string | undefined = undefined;
                let filename: string | undefined = undefined;
                let caption: string | undefined = undefined;
                let mediaData: string | undefined = undefined;

                if (message.type === "text") {
                  contentText = (message.text as Record<string, string>)?.body || '';
                } else {
                  // For sticker, treat as image
                  const actualType = message.type === 'sticker' ? 'sticker' : message.type as string;
                  mediaType = actualType === 'sticker' ? 'image' : actualType;
                  const mediaObj = message[actualType] as Record<string, string>;
                  mediaId = mediaObj?.id;
                  mimeType = mediaObj?.mime_type;
                  caption = mediaObj?.caption;
                  filename = mediaObj?.filename;
                  
                  console.log("[webhook] Media extracted -> mediaType:", mediaType, "| mediaId:", mediaId, "| mimeType:", mimeType);
                  
                  // === MEDIA CACHING: Download binary now so it survives Meta's 30-day expiry ===
                  if (mediaId) {
                    try {
                      const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
                      if (ACCESS_TOKEN) {
                        // Step 1: Get download URL from Meta Graph API
                        const urlRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
                          headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
                        });
                        if (urlRes.ok) {
                          const urlData = await urlRes.json();
                          if (urlData.url) {
                            // Step 2: Download binary
                            const binRes = await fetch(urlData.url, {
                              headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
                            });
                            if (binRes.ok) {
                              const arrayBuffer = await binRes.arrayBuffer();
                              // Only cache if under 10MB to avoid MongoDB 16MB doc limit
                              if (arrayBuffer.byteLength < 10 * 1024 * 1024) {
                                mediaData = Buffer.from(arrayBuffer).toString('base64');
                                console.log("[webhook] Media cached successfully:", mediaId, "size:", arrayBuffer.byteLength, "bytes");
                              } else {
                                console.log("[webhook] Media too large to cache:", arrayBuffer.byteLength, "bytes");
                              }
                            }
                          }
                        }
                      }
                    } catch (cacheErr) {
                      console.error("[webhook] Media cache failed (non-fatal):", cacheErr);
                    }
                  }

                  if (caption) {
                    contentText = caption;
                  } else {
                    if (message.type === 'document') contentText = `[Document: ${filename || 'file'}]`;
                    else if (message.type === 'sticker') contentText = '[Sticker]';
                    else contentText = `[${(message.type as string).charAt(0).toUpperCase() + (message.type as string).slice(1)}]`;
                  }
                }

                const finalMessageObj = {
                  ...message,
                  text: { body: contentText },
                  from: 'contact',
                  content: contentText,
                  mediaType,
                  mediaId,
                  mimeType,
                  filename,
                  caption,
                  mediaData
                };
                
                const normalizedPhone = (message.from as string).replace(/^\+/, '');
                const messageId = (message.id as string) || `wamid_${Date.now()}`;
                const msgIsoTimestamp = message.timestamp
                  ? new Date(Number(message.timestamp) * 1000).toISOString()
                  : new Date().toISOString();

                const messageData = {
                  id: messageId,
                  content: contentText,
                  timestamp: msgIsoTimestamp,
                  sender: 'contact',
                  status: MessageStatus.DELIVERED,
                  recipientId: normalizedPhone,
                  contactPhoneNumber: normalizedPhone,
                  originalId: messageId,
                  conversationId: normalizedPhone,
                  mediaType: mediaType || 'text',
                  mediaId,
                  mimeType,
                  filename,
                  caption,
                  mediaData
                };

                // Direct MongoDB Message Save
                await MessageModel.updateOne(
                  { id: messageId },
                  { 
                    $setOnInsert: messageData,
                    $set: { status: MessageStatus.DELIVERED }
                  },
                  { upsert: true }
                );

                // Direct MongoDB Conversation Update
                await Conversation.updateOne(
                  { phoneNumber: normalizedPhone },
                  { 
                    $set: { 
                      lastMessage: contentText,
                      lastMessageTimestamp: msgIsoTimestamp 
                    },
                    $inc: { unreadCount: 1 },
                    $setOnInsert: { contactName: normalizedPhone }
                  },
                  { upsert: true }
                );

                console.log("[webhook] Message stored successfully in MongoDB:", messageId);
                const storeResult = { success: true, message: messageData };

                // --- Emit SSE for real-time frontend update ---
                const host = request.headers.get('host') || 'localhost:3000';
                const protocol = host.includes('localhost') ? 'http' : 'https';
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

                  // Extract contact name for notification display
                  const contacts = value.contacts as Array<Record<string, unknown>> | undefined;
                  let notifContactName = normalizedPhone;
                  if (contacts && contacts.length > 0) {
                    const profile = (contacts[0] as Record<string, unknown>).profile as Record<string, string> | undefined;
                    notifContactName = profile?.name || normalizedPhone;
                  }

                  // Per-phone SSE emit (existing)
                  await fetch(`${appUrl}/api/messages/stream`, {
                    method: "POST",
                    headers: { 
                      "Content-Type": "application/json",
                      "x-internal-secret": process.env.JWT_SECRET || 'fallback-secret'
                    },
                    body: JSON.stringify({
                      phoneNumber: normalizedPhone,
                      message: storeResult.message
                    })
                  }).catch(err => console.error('[webhook] SSE emit failed:', err));

                  // Global notification SSE emit (NEW — for toasts, badges, browser notifications)
                  await fetch(`${appUrl}/api/messages/stream/global`, {
                    method: "POST",
                    headers: { 
                      "Content-Type": "application/json",
                      "x-internal-secret": process.env.JWT_SECRET || 'fallback-secret'
                    },
                    body: JSON.stringify({
                      phoneNumber: normalizedPhone,
                      message: storeResult.message,
                      contactName: notifContactName
                    })
                  }).catch(err => console.error('[webhook] Global notification emit failed:', err));
                }

                // --- Write to SFMC WhatsApp_Received_Messages DE ---
                try {
                  // Extract contact name from webhook payload if available
                  const contacts = value.contacts as Array<Record<string, unknown>> | undefined;
                  let contactName = '';
                  if (contacts && contacts.length > 0) {
                    const profile = (contacts[0] as Record<string, unknown>).profile as Record<string, string> | undefined;
                    contactName = profile?.name || '';
                  }

                  const msgTimestamp = message.timestamp
                    ? new Date(Number(message.timestamp) * 1000).toISOString()
                    : new Date().toISOString();

                  await writeReceivedMessage({
                    WaMid: message.id as string,
                    Phone: message.from as string,
                    ContactName: contactName,
                    MessageType: message.type as string || 'text',
                    MessageContent: contentText || '',
                    ReceivedTime: msgTimestamp,
                  });

                  // ---- Opt-Out Processing (STOP keywords) ----
                  const bodyText = contentText?.trim().toLowerCase() || '';
                  if (/^(stop|unsubscribe|cancel|quit|end)$/.test(bodyText) && message.type === 'text') {
                    console.log(`[webhook] Opt-Out keyword detected from ${message.from}. Marking as unsubscribed.`);
                    
                    // 1. Write to SFMC WhatsApp_OptOuts DE
                    try {
                      await writeOptOutStatus(message.from as string, 'OptOut');
                    } catch (e) {
                      console.error('[webhook] writeOptOutStatus failed, but continuing with opt-out:', e);
                    }
                    
                    // 2. Update MongoDB Conversation local state
                    await Conversation.findOneAndUpdate(
                      { phoneNumber: message.from },
                      { isOptedOut: true }
                    );

                    // 3. Send automated WhatsApp confirmation reply
                    const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
                    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
                    if (ACCESS_TOKEN && PHONE_NUMBER_ID) {
                      await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${ACCESS_TOKEN}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          messaging_product: "whatsapp",
                          to: message.from,
                          type: "text",
                          text: { body: "You have been successfully unsubscribed from these messages." }
                        })
                      }).catch(e => console.error('[webhook] Failed to send opt-out confirm', e));
                    }
                  } else {
                    // ---- First-time Welcome Message processing ----
                    const conversation = await Conversation.findOne({ phoneNumber: message.from });
                    if (conversation && !conversation.hasReceivedWelcomeMsg) {
                      console.log(`[webhook] First time message from ${message.from}. Sending Welcome auto-reply.`);
                      
                      // 1. Mark as received so we only send it once
                      await Conversation.findOneAndUpdate(
                        { phoneNumber: message.from },
                        { hasReceivedWelcomeMsg: true }
                      );

                      // 2. Send automated WhatsApp Welcome reply
                      const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
                      const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
                      if (ACCESS_TOKEN && PHONE_NUMBER_ID) {
                        const welcomeMsg = "Thank you for reaching out to Pentacloud Consulting! A member of our team will be with you shortly.";
                        await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${ACCESS_TOKEN}`,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            messaging_product: "whatsapp",
                            to: message.from,
                            type: "text",
                            text: { body: welcomeMsg }
                          })
                        }).catch(e => console.error('[webhook] Failed to send welcome auto-reply', e));
                      }
                    }
                  }

                } catch (sfmcError) {
                  console.error('[webhook] SFMC Received DE write failed:', sfmcError);
                }
              } catch (storeError) {
                console.error("[webhook] Error storing message:", storeError);
              }
            }
          }
        }

        // ----- Handle Delivery Status Updates (NEW — SFMC integration) -----
        const statuses = value.statuses as Array<Record<string, unknown>> | undefined;
        if (statuses && Array.isArray(statuses)) {
          for (const status of statuses) {
            const wamid = status.id as string;
            const statusValue = status.status as string; // sent, delivered, read, failed
            const recipientId = status.recipient_id as string;
            const timestamp = status.timestamp as string;

            if (!wamid) continue;

            const errors = status.errors ? JSON.stringify(status.errors) : '';
            console.log(`[webhook] Status update: wamid=${wamid}, status=${statusValue}, recipient=${recipientId} ${errors ? `| errors=${errors}` : ''}`);

            // ----- Idempotency Check -----
            // Build a composite key: wamid + status (same wamid can have multiple statuses: sent → delivered → read)
            const idempotencyKey = `${wamid}:${statusValue}`;
            if (!markWamidProcessed(idempotencyKey)) {
              console.log(`[webhook] Skipping duplicate status: ${idempotencyKey}`);
              continue;
            }

            // ----- Write status update to SFMC WhatsApp_Sent_Messages DE -----
            try {
              const isoTimestamp = timestamp
                ? new Date(Number(timestamp) * 1000).toISOString()
                : new Date().toISOString();

              const statusRow: {
                WaMid: string;
                Status: string;
                DeliveredTime?: string;
                ReadTime?: string;
                FailedReason?: string;
              } = {
                WaMid: wamid,
                Status: statusValue,
              };

              if (statusValue === 'delivered') statusRow.DeliveredTime = isoTimestamp;
              if (statusValue === 'read') statusRow.ReadTime = isoTimestamp;
              if (statusValue === 'failed') {
                statusRow.FailedReason = errors || 'Unknown error';
              }

              await updateSentMessageStatus(statusRow);
            } catch (sfmcError) {
              console.error(`[webhook] SFMC Sent DE status update failed for ${wamid}:`, sfmcError);
            }

            // ----- Update Message Status in MongoDB -----
            try {
              let mappedStatus = MessageStatus.FAILED;
              if (statusValue === 'sent') mappedStatus = MessageStatus.SENT;
              if (statusValue === 'delivered') mappedStatus = MessageStatus.DELIVERED;
              if (statusValue === 'read') mappedStatus = MessageStatus.READ;

              // Use original recipientId, or contactPhoneNumber if that's what was used
              // Let's find the message first
              const updatedMessage = await MessageModel.findOneAndUpdate(
                { id: wamid },
                { status: mappedStatus },
                { new: true }
              );

              if (updatedMessage) {
                console.log(`[webhook] DB Update: Message ${wamid} status changed to ${mappedStatus}`);
                
                // ----- Push to SSE Stream -----
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                
                // Format the object properly for the broadasting API
                const sseMessage = {
                  id: updatedMessage.id,
                  content: updatedMessage.content,
                  timestamp: updatedMessage.timestamp,
                  sender: updatedMessage.sender,
                  status: updatedMessage.status,
                  recipientId: updatedMessage.recipientId,
                  contactPhoneNumber: updatedMessage.contactPhoneNumber
                };

                const sseResponse = await fetch(`${appUrl}/api/messages/stream`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    "x-internal-secret": process.env.JWT_SECRET || 'fallback-secret'
                  },
                  body: JSON.stringify({
                    phoneNumber: updatedMessage.contactPhoneNumber || updatedMessage.recipientId,
                    message: sseMessage
                  })
                });
                
                if (!sseResponse.ok) {
                   console.error(`[webhook] Failed to broadcast status update via SSE for wamid=${wamid}`);
                }
              } else {
                 console.log(`[webhook] Message with wamid=${wamid} not found in DB to update status.`);
              }
            } catch (dbError) {
              console.error(`[webhook] DB update failed for ${wamid}:`, dbError);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[webhook] Processing error:", error);
    // Still return 200 — Meta has already been acknowledged
  }

  return new NextResponse("EVENT_RECEIVED", {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
