// src/app/api/unmatched-messages/route.ts
// Top-level endpoint for listing unmatched WhatsApp messages and assigning them
// Bypasses workspace-specific middleware dynamic routing

import { NextResponse } from 'next/server';
import { getUnmatchedQueue, removeUnmatched } from '@/lib/storage/kvStore';
import { SalesCloudConnector } from '@/lib/connectors/salesCloudConnector';
import { SFMCConnector } from '@/lib/connectors/sfmcConnector';
import { writeReceivedMessage } from '@/lib/sfmcDE';

const salesCloudConnector = new SalesCloudConnector();

export async function GET() {
  try {
    const queue = await getUnmatchedQueue();
    return NextResponse.json({
      success: true,
      unmatchedMessages: queue,
      count: queue.length,
    });
  } catch (error: any) {
    console.error('[unmatched-messages] GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch unmatched messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, targetWorkspaceId, salesforceRecordId, objectType, contactName } = body;

    if (!messageId || !targetWorkspaceId) {
      return NextResponse.json(
        { success: false, error: 'messageId and targetWorkspaceId are required' },
        { status: 400 }
      );
    }

    const queue = await getUnmatchedQueue();
    const targetMsg = queue.find(m => m.id === messageId);

    if (!targetMsg) {
      return NextResponse.json(
        { success: false, error: `Unmatched message ${messageId} not found in queue` },
        { status: 404 }
      );
    }

    // ----- Write-Through Execution -----
    if (targetWorkspaceId === 'salescloud-ws-1') {
      let leadId = objectType === 'Lead' ? salesforceRecordId : undefined;
      let contactId = objectType === 'Contact' ? salesforceRecordId : undefined;

      // If no explicit record ID provided, create a Lead in Sales Cloud
      if (!salesforceRecordId) {
        const newLead = await salesCloudConnector.createLead({
          name: contactName || `WhatsApp ${targetMsg.phoneNumber}`,
          phoneNumber: targetMsg.phoneNumber,
        });
        leadId = newLead.id;
      }

      await salesCloudConnector.saveInboundMessage({
        messageId: targetMsg.id,
        senderPhone: targetMsg.phoneNumber,
        content: targetMsg.content,
        timestamp: targetMsg.timestamp,
        leadId,
        contactId,
      });

    } else if (targetWorkspaceId === 'sfmc-ws-1') {
      await writeReceivedMessage({
        WaMid: targetMsg.id,
        Phone: targetMsg.phoneNumber,
        ContactName: contactName || targetMsg.phoneNumber,
        MessageContent: targetMsg.content,
        ReceivedTime: targetMsg.timestamp,
      });
    }

    // ----- Delete from Unmatched Queue after Successful Write-Through -----
    await removeUnmatched(messageId);

    return NextResponse.json({
      success: true,
      message: `Successfully assigned message ${messageId} to ${targetWorkspaceId}`,
      messageId,
      targetWorkspaceId,
    });
  } catch (error: any) {
    console.error('[unmatched-messages] POST assign error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to assign unmatched message' },
      { status: 500 }
    );
  }
}
