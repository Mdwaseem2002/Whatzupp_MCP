import { Connector, MessagePage, WorkspaceContactResult, FieldMappingSchema, WorkspaceMessage } from './connectorInterface';
import { getSfmcAccessToken } from '../sfmcAuth';
import { writeSentMessage, writeReceivedMessage } from '../sfmcDE';
import { sendWhatsAppMessage } from '../../services/whatsappService';

export class SFMCConnector implements Connector {
  public id = 'sfmc-ws-1';
  public workspaceType = 'sfmc' as const;

  async fetchContacts(params: { search?: string; limit?: number }): Promise<WorkspaceContactResult[]> {
    const limit = params.limit || 50;
    const sfmcRestBaseUri = process.env.SFMC_REST_BASE_URI;

    if (!sfmcRestBaseUri) {
      // Graceful fallback when SFMC credentials not configured
      return [
        {
          id: 'sfmc-c-1',
          name: 'Waseem (SFMC)',
          phoneNumber: '9952374972',
          email: 'waseem.sfmc@example.com',
          company: 'SFMC Marketing Cloud',
          lastSyncedAt: new Date().toISOString(),
        },
      ];
    }

    try {
      const { access_token } = await getSfmcAccessToken();
      const baseUri = sfmcRestBaseUri.replace(/\/$/, '');
      const url = `${baseUri}/data/v1/customobjectdata/key/WhatsApp_Test_Audience/rowset?$pageSize=${limit}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!res.ok) {
        throw new Error(`SFMC fetch contacts failed: ${res.status}`);
      }

      const data = await res.json();
      const items = data.items || [];

      // Group by phone number
      const contactMap = new Map<string, WorkspaceContactResult>();
      items.forEach((item: any) => {
        const phone = item.keys?.MobilePhone || item.values?.MobilePhone || item.keys?.mobilephone || item.values?.mobilephone || item.MobilePhone || item.keys?.Phone || item.values?.Phone || item.keys?.phone || item.values?.phone || item.Phone;
        const name = item.keys?.ContactKey || item.values?.ContactKey || item.keys?.contactkey || item.values?.contactkey || item.ContactKey || `Subscriber ${phone}`;
        if (phone && !contactMap.has(phone)) {
          contactMap.set(phone, {
            id: `sfmc-${phone}`,
            name,
            phoneNumber: phone,
            email: `${phone}@sfmc-contacts.com`,
            company: 'SFMC Subscriber',
            lastSyncedAt: new Date().toISOString(),
          });
        }
      });

      let results = Array.from(contactMap.values());
      if (params.search) {
        const query = params.search.toLowerCase();
        results = results.filter(c => c.name.toLowerCase().includes(query) || c.phoneNumber.includes(query));
      }

      return results;
    } catch (err) {
      console.warn('[SFMCConnector] Error fetching contacts, falling back:', err);
      return [
        {
          id: 'sfmc-c-1',
          name: 'Waseem (SFMC)',
          phoneNumber: '9952374972',
          email: 'waseem.sfmc@example.com',
          company: 'SFMC Marketing Cloud',
          lastSyncedAt: new Date().toISOString(),
        },
      ];
    }
  }

  async fetchMessages(params: {
    recordId?: string;
    phoneNumber?: string;
    cursor?: string;
    pageSize?: number;
  }): Promise<MessagePage> {
    const pageSize = params.pageSize || 50;
    const sfmcRestBaseUri = process.env.SFMC_REST_BASE_URI;

    if (!sfmcRestBaseUri) {
      // Fallback sample messages for SFMC workspace
      const phone = params.phoneNumber || '9952374972';
      if (phone === '9952374972') {
        return {
          messages: [
            {
              id: 'sfmc-msg-1',
              senderId: 'sfmc-system',
              recipientId: '9952374972',
              content: 'SFMC Campaign: Welcome to our VIP Loyalty Program!',
              timestamp: '2026-09-08T10:00:00.000Z',
              status: 'READ',
              direction: 'OUTBOUND',
            },
            {
              id: 'sfmc-msg-2',
              senderId: '9952374972',
              recipientId: 'sfmc-system',
              content: 'Thanks! What discount code do I use?',
              timestamp: '2026-09-08T10:02:00.000Z',
              status: 'READ',
              direction: 'INBOUND',
            },
            {
              id: 'sfmc-msg-3',
              senderId: 'sfmc-system',
              recipientId: '9952374972',
              content: 'SFMC Promo Code: VIP2026 for 20% off your next purchase.',
              timestamp: '2026-09-08T10:05:00.000Z',
              status: 'DELIVERED',
              direction: 'OUTBOUND',
            },
          ],
        };
      }
      return { messages: [] };
    }

    try {
      const { access_token } = await getSfmcAccessToken();
      const baseUri = sfmcRestBaseUri.replace(/\/$/, '');
      const sentUrl = `${baseUri}/data/v1/customobjectdata/key/WhatsApp_Sent_Messages/rowset?$pageSize=${pageSize}`;
      const recvUrl = `${baseUri}/data/v1/customobjectdata/key/WhatsApp_Received_Messages/rowset?$pageSize=${pageSize}`;

      const [sentRes, recvRes] = await Promise.all([
        fetch(sentUrl, { headers: { Authorization: `Bearer ${access_token}` } }),
        fetch(recvUrl, { headers: { Authorization: `Bearer ${access_token}` } }),
      ]);

      const sentData = sentRes.ok ? await sentRes.json() : { items: [] };
      const recvData = recvRes.ok ? await recvRes.json() : { items: [] };

      const messages: WorkspaceMessage[] = [];

      (sentData.items || []).forEach((item: any) => {
        const phone = item.keys?.Phone || item.values?.Phone || item.Phone;
        if (!params.phoneNumber || phone === params.phoneNumber) {
          messages.push({
            id: item.keys?.WaMid || item.values?.WaMid || `sent-${Math.random()}`,
            senderId: 'sfmc-system',
            recipientId: phone,
            content: item.values?.MessageContent || item.MessageContent || '',
            timestamp: item.values?.SentTime || new Date().toISOString(),
            status: (item.values?.Status || 'SENT').toUpperCase(),
            direction: 'OUTBOUND',
          });
        }
      });

      (recvData.items || []).forEach((item: any) => {
        const phone = item.keys?.Phone || item.values?.Phone || item.Phone;
        if (!params.phoneNumber || phone === params.phoneNumber) {
          messages.push({
            id: item.keys?.WaMid || item.values?.WaMid || `recv-${Math.random()}`,
            senderId: phone,
            recipientId: 'sfmc-system',
            content: item.values?.MessageContent || item.MessageContent || '',
            timestamp: item.values?.ReceivedTime || new Date().toISOString(),
            status: 'READ',
            direction: 'INBOUND',
          });
        }
      });

      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return { messages };
    } catch (err) {
      console.warn('[SFMCConnector] Error fetching messages:', err);
      return { messages: [] };
    }
  }

  async sendMessage(params: {
    recipientPhone: string;
    content: string;
    salesforceRecordId?: string;
    salesforceObjectType?: string;
  }): Promise<{ messageId: string; status: string }> {
    const waResult = await sendWhatsAppMessage({
      to: params.recipientPhone,
      message: params.content,
    });

    const wamid = waResult.messageId || `wamid.${Date.now()}`;

    // Log outbound message to SFMC DE
    try {
      await writeSentMessage({
        WaMid: wamid,
        Phone: params.recipientPhone,
        MessageContent: params.content,
        Status: 'sent',
        SentTime: new Date().toISOString(),
        Source: 'WhatZupp_SFMC_Connector',
      });
    } catch (e) {
      console.warn('[SFMCConnector] Failed to write to SFMC DE:', e);
    }

    return { messageId: wamid, status: 'SENT' };
  }

  async resolveContact(params: {
    phoneNumber: string;
    name?: string;
    email?: string;
  }): Promise<WorkspaceContactResult> {
    return {
      id: `sfmc-${params.phoneNumber}`,
      name: params.name || `Subscriber ${params.phoneNumber}`,
      phoneNumber: params.phoneNumber,
      email: params.email || `${params.phoneNumber}@sfmc-contacts.com`,
      company: 'SFMC Subscriber',
      lastSyncedAt: new Date().toISOString(),
    };
  }

  fieldSchema(): FieldMappingSchema[] {
    return [
      { name: 'WaMid', label: 'WhatsApp Message ID', type: 'Text', required: true },
      { name: 'Phone', label: 'Subscriber Phone', type: 'Phone', required: true },
      { name: 'ContactKey', label: 'SFMC Contact Key', type: 'Text' },
      { name: 'MessageContent', label: 'Message Text', type: 'Text' },
      { name: 'Status', label: 'Delivery Status', type: 'Text' },
    ];
  }

  async validateMapping(): Promise<boolean> {
    return Boolean(process.env.SFMC_REST_BASE_URI && process.env.SFMC_CLIENT_ID);
  }
}
