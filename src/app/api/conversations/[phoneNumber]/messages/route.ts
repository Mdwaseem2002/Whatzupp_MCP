// src/app/api/conversations/[phoneNumber]/messages/route.ts
// API route to retrieve message history for a specific phone number
// Used by Salesforce Lightning Web Component & Web Dashboard

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import MessageModel from '@/models/Message';
import ConversationModel from '@/models/Conversation';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phoneNumber: string }> }
) {
  try {
    await connectMongoDB();

    const resolvedParams = await params;
    const rawPhone = resolvedParams.phoneNumber;

    if (!rawPhone) {
      return NextResponse.json(
        { success: false, error: 'Phone number parameter is required' },
        { status: 400 }
      );
    }

    // Normalize phone numbers (e.g. "+919952374972" -> "919952374972", "9952374972" -> "919952374972")
    const cleanPhone = rawPhone.replace(/^\+/, '').trim();
    const shortPhone = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

    // Search query matching full phone, short 10-digit phone, or with + prefix
    const query = {
      $or: [
        { conversationId: cleanPhone },
        { contactPhoneNumber: cleanPhone },
        { recipientId: cleanPhone },
        { conversationId: { $regex: shortPhone + '$' } },
        { contactPhoneNumber: { $regex: shortPhone + '$' } },
        { recipientId: { $regex: shortPhone + '$' } },
      ],
    };

    const messages = await MessageModel.find(query)
      .sort({ timestamp: 1 })
      .lean()
      .exec();

    // Map messages for Salesforce LWC / Web format
    const formattedMessages = messages.map((m: any) => ({
      id: m.id || m._id?.toString(),
      content: m.content || m.text?.body || '',
      timestamp: m.timestamp || new Date().toISOString(),
      sender: m.sender || (m.direction === 'OUTBOUND' ? 'user' : 'contact'),
      direction: m.sender === 'user' ? 'OUTBOUND' : 'INBOUND',
      status: m.status || 'DELIVERED',
      mediaType: m.mediaType || 'text',
      mediaId: m.mediaId,
      filename: m.filename,
    }));

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      count: formattedMessages.length,
    });
  } catch (error: any) {
    console.error('[conversations/messages] Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
