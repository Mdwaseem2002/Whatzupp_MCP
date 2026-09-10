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

      // Helper to fetch all pages from a DE
      const fetchAllDeRows = async (deKey: string): Promise<any[]> => {
        const allItems: any[] = [];
        let page = 1;
        const fetchPageSize = 2500;
        const maxPages = 20;

        while (page <= maxPages) {
          const url = `${baseUri}/data/v1/customobjectdata/key/${deKey}/rowset?$pageSize=${fetchPageSize}&$page=${page}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${access_token}` },
          });

          if (!res.ok) break;

          const data = await res.json();
          const items = data.items || [];
          allItems.push(...items);

          if (items.length < fetchPageSize) break;
          if (data.requestToken) {
            page++;
          } else {
            break;
          }
        }
        return allItems;
      };

      const [sentItems, recvItems] = await Promise.all([
        fetchAllDeRows('WhatsApp_Sent_Messages'),
        fetchAllDeRows('WhatsApp_Received_Messages'),
      ]);

      const sentData = { items: sentItems };
      const recvData = { items: recvItems };


      const messages: WorkspaceMessage[] = [];

function getFieldValue(row: any, fieldName: string): string {
  if (!row) return '';
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
 */
function normalizeTimestamp(raw: string): string {
  if (!raw) return new Date().toISOString();
  
  // Already ISO 8601
  if (raw.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  
  // SFMC US locale: "M/D/YYYY h:mm:ss AM/PM"
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    const [, month, day, year, hourStr, min, sec, ampm] = match;
    let hour = parseInt(hourStr, 10);
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    }
    const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${min}:${sec}.000Z`;
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  
  const fallback = new Date(raw);
  if (!isNaN(fallback.getTime())) return fallback.toISOString();
  return new Date().toISOString();
}

      (sentData.items || []).forEach((item: any) => {
        const phone = getFieldValue(item, 'Phone');
        const wamid = getFieldValue(item, 'WaMid');
        const content = getFieldValue(item, 'MessageContent') || `[Template: ${getFieldValue(item, 'TemplateName')}]`;
        const timestamp = normalizeTimestamp(getFieldValue(item, 'SentTime') || getFieldValue(item, 'CreatedDate'));
        const status = (getFieldValue(item, 'Status') || 'SENT').toUpperCase();

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const cleanParamPhone = (params.phoneNumber || '').replace(/[^0-9]/g, '');
        const matches = !cleanParamPhone || (cleanPhone.length >= 10 && cleanParamPhone.length >= 10 && (cleanPhone.endsWith(cleanParamPhone.slice(-10)) || cleanParamPhone.endsWith(cleanPhone.slice(-10))));

        if (matches) {
          messages.push({
            id: wamid || `sent-${Math.random()}`,
            senderId: 'sfmc-system',
            recipientId: phone,
            content,
            timestamp,
            status: status as any,
            direction: 'OUTBOUND',
          });
        }
      });

      (recvData.items || []).forEach((item: any) => {
        const phone = getFieldValue(item, 'Phone');
        const wamid = getFieldValue(item, 'WaMid');
        const content = getFieldValue(item, 'MessageContent');
        const timestamp = normalizeTimestamp(getFieldValue(item, 'ReceivedTime') || getFieldValue(item, 'CreatedDate'));

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const cleanParamPhone = (params.phoneNumber || '').replace(/[^0-9]/g, '');
        const matches = !cleanParamPhone || (cleanPhone.length >= 10 && cleanParamPhone.length >= 10 && (cleanPhone.endsWith(cleanParamPhone.slice(-10)) || cleanParamPhone.endsWith(cleanPhone.slice(-10))));

        if (matches) {
          messages.push({
            id: wamid || `recv-${Math.random()}`,
            senderId: phone,
            recipientId: 'sfmc-system',
            content,
            timestamp,
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

  async createContact(params: {
    name: string;
    phoneNumber: string;
    email?: string;
    company?: string;
  }): Promise<WorkspaceContactResult> {
    const cleanPhone = params.phoneNumber.replace(/[^0-9]/g, '');
    const contactKey = params.name.trim() || cleanPhone;

    const sfmcRestBaseUri = process.env.SFMC_REST_BASE_URI;
    if (sfmcRestBaseUri) {
      try {
        const { access_token } = await getSfmcAccessToken();
        const baseUri = sfmcRestBaseUri.replace(/\/$/, '');
        const url = `${baseUri}/hub/v1/dataevents/key:WhatsApp_Test_Audience/rowset`;

        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([
            {
              keys: { contactkey: contactKey },
              values: { mobilephone: cleanPhone }
            }
          ])
        });
      } catch (err) {
        console.error('[SFMCConnector] createContact error:', err);
      }
    }

    return {
      id: `sfmc-${cleanPhone}`,
      name: contactKey,
      phoneNumber: cleanPhone,
      email: params.email || `${cleanPhone}@sfmc-contacts.com`,
      company: 'SFMC Subscriber',
      lastSyncedAt: new Date().toISOString(),
    };
  }

  async updateContact(
    id: string,
    updates: { name?: string; phoneNumber?: string; email?: string; company?: string }
  ): Promise<boolean> {
    const key = id.replace(/^sfmc-/, '');
    const name = updates.name || key;
    const phone = (updates.phoneNumber || key).replace(/[^0-9]/g, '');

    const sfmcRestBaseUri = process.env.SFMC_REST_BASE_URI;
    if (sfmcRestBaseUri) {
      try {
        const { access_token } = await getSfmcAccessToken();
        const baseUri = sfmcRestBaseUri.replace(/\/$/, '');
        const url = `${baseUri}/hub/v1/dataevents/key:WhatsApp_Test_Audience/rowset`;

        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([
            {
              keys: { contactkey: name },
              values: { mobilephone: phone }
            }
          ])
        });
      } catch (err) {
        console.error('[SFMCConnector] updateContact error:', err);
      }
    }
    return true;
  }

  async deleteContact(id: string): Promise<boolean> {
    let key = id.replace(/^sfmc-/, '');
    const sfmcAuthBaseUri = process.env.SFMC_AUTH_BASE_URI;

    if (sfmcAuthBaseUri) {
      try {
        const { access_token } = await getSfmcAccessToken();
        const soapUrl = `${sfmcAuthBaseUri.replace(/\/$/, '').replace('.auth.', '.soap.')}/Service.asmx`;

        // If id was a numeric phone, try deleting both key=id and contactkey in DE
        const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <fueloauth>${access_token}</fueloauth>
  </s:Header>
  <s:Body>
    <DeleteRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <Objects xsi:type="DataExtensionObject" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <CustomerKey>WhatsApp_Test_Audience</CustomerKey>
        <Keys>
          <Key>
            <Name>contactkey</Name>
            <Value>${key}</Value>
          </Key>
        </Keys>
      </Objects>
    </DeleteRequest>
  </s:Body>
</s:Envelope>`;

        const res = await fetch(soapUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'Delete'
          },
          body: soapBody
        });

        if (!res.ok) {
          console.warn('[SFMCConnector] deleteContact SOAP request failed:', res.status);
        }
      } catch (err) {
        console.error('[SFMCConnector] deleteContact error:', err);
      }
    }
    return true;
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
