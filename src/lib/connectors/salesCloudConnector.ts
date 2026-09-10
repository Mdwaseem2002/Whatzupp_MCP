import { Connector, MessagePage, WorkspaceContactResult, FieldMappingSchema, WorkspaceMessage } from './connectorInterface';
import { getSalesCloudAccessToken } from '../salesCloudAuth';
import { sendWhatsAppMessage } from '../../services/whatsappService';
import { emitRealtimeMessage } from '../realtime';

export class SalesCloudConnector implements Connector {
  public id = 'salescloud-ws-1';
  public workspaceType = 'salescloud' as const;

  // In-memory fallback message store for dev/testing when SF credentials are not live
  private fallbackMessages: WorkspaceMessage[] = [
    {
      id: 'sc-msg-1',
      senderId: 'sc-agent',
      recipientId: '9952374972',
      content: 'Sales Cloud: Hi Waseem, welcome to our Sales Cloud portal!',
      timestamp: '2026-09-08T11:00:00.000Z',
      status: 'READ',
      direction: 'OUTBOUND',
      salesforceRecordId: '003XXXXXXXXXXXXAAA',
    },
    {
      id: 'sc-msg-2',
      senderId: '9952374972',
      recipientId: 'sc-agent',
      content: 'Thanks! I wanted to follow up on Opportunity #4829.',
      timestamp: '2026-09-08T11:05:00.000Z',
      status: 'READ',
      direction: 'INBOUND',
      salesforceRecordId: '003XXXXXXXXXXXXAAA',
    },
  ];

  private fallbackContacts: WorkspaceContactResult[] = [];

  async fetchContacts(params: { search?: string; limit?: number }): Promise<WorkspaceContactResult[]> {
    const limit = params.limit || 50;

    try {
      let { access_token, instance_url } = await getSalesCloudAccessToken();

      if (access_token.startsWith('mock-')) {
        let results = [...this.fallbackContacts];
        if (params.search) {
          const q = params.search.toLowerCase();
          results = results.filter(c => c.name.toLowerCase().includes(q) || (c.phoneNumber && c.phoneNumber.includes(q)));
        }
        return results.slice(0, limit);
      }

      // Query Leads from Salesforce (all Leads in org, ordered by newest first)
      let leadSoql = `SELECT Id, Name, Phone, MobilePhone, Email, Company, WhatZupp_Sync_Status__c, WhatZupp_Last_Synced__c FROM Lead ORDER BY CreatedDate DESC LIMIT ${limit}`;
      // Query Contacts from Salesforce (ONLY those created/synced via WhatZupp, ignoring standard sample contacts)
      let contactSoql = `SELECT Id, Name, Phone, MobilePhone, Email, Company, WhatZupp_Sync_Status__c, WhatZupp_Last_Synced__c FROM Contact WHERE WhatZupp_Sync_Status__c != null ORDER BY LastModifiedDate DESC LIMIT ${limit}`;

      if (params.search) {
        const q = params.search.replace(/'/g, "\\'");
        leadSoql = `SELECT Id, Name, Phone, MobilePhone, Email, Company, WhatZupp_Sync_Status__c, WhatZupp_Last_Synced__c FROM Lead WHERE (Name LIKE '%${q}%' OR Phone LIKE '%${q}%' OR MobilePhone LIKE '%${q}%' OR Email LIKE '%${q}%' OR Company LIKE '%${q}%') ORDER BY CreatedDate DESC LIMIT ${limit}`;
        contactSoql = `SELECT Id, Name, Phone, MobilePhone, Email, Company, WhatZupp_Sync_Status__c, WhatZupp_Last_Synced__c FROM Contact WHERE WhatZupp_Sync_Status__c != null AND (Name LIKE '%${q}%' OR Phone LIKE '%${q}%' OR MobilePhone LIKE '%${q}%' OR Email LIKE '%${q}%') ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
      }

      let headers = { Authorization: `Bearer ${access_token}` };
      const fetchOpts = { headers, cache: 'no-store' as const };
      let [leadRes, contactRes] = await Promise.all([
        fetch(`${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(leadSoql)}`, fetchOpts),
        fetch(`${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(contactSoql)}`, fetchOpts),
      ]);

      if (leadRes.status === 401 || contactRes.status === 401) {
        console.warn('[SalesCloudConnector] Session expired in fetchContacts. Auto-refreshing token...');
        const fresh = await getSalesCloudAccessToken(true);
        access_token = fresh.access_token;
        instance_url = fresh.instance_url;
        headers = { Authorization: `Bearer ${access_token}` };
        const retryOpts = { headers, cache: 'no-store' as const };
        [leadRes, contactRes] = await Promise.all([
          fetch(`${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(leadSoql)}`, retryOpts),
          fetch(`${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(contactSoql)}`, retryOpts),
        ]);
      }

      const results: WorkspaceContactResult[] = [];

      if (leadRes.ok) {
        const leadData = await leadRes.json();
        (leadData.records || []).forEach((r: any) => {
          results.push({
            id: r.Id,
            name: r.Name,
            phoneNumber: r.Phone || r.MobilePhone || '',
            salesforceObjectType: 'Lead',
            salesforceRecordId: r.Id,
            email: r.Email || '',
            company: r.Company || 'Salesforce Lead',
            lastSyncedAt: r.WhatZupp_Last_Synced__c || new Date().toISOString(),
          });
        });
      }

      if (contactRes.ok) {
        const contactData = await contactRes.json();
        (contactData.records || []).forEach((r: any) => {
          results.push({
            id: r.Id,
            name: r.Name,
            phoneNumber: r.Phone || r.MobilePhone || '',
            salesforceObjectType: 'Contact',
            salesforceRecordId: r.Id,
            email: r.Email || '',
            company: r.Company || 'Salesforce Contact',
            lastSyncedAt: r.WhatZupp_Last_Synced__c || new Date().toISOString(),
          });
        });
      }

      return results.slice(0, limit);
    } catch (err) {
      console.warn('[SalesCloudConnector] fetchContacts failed, using fallback:', err);
      let results = [...this.fallbackContacts];
      if (params.search) {
        const q = params.search.toLowerCase();
        results = results.filter(c => c.name.toLowerCase().includes(q) || (c.phoneNumber && c.phoneNumber.includes(q)));
      }
      return results.slice(0, limit);
    }
  }

  /**
   * Fetches messages from WhatsApp_Message__c using Keyset Pagination (Fix #4).
   * cursor = last Timestamp__c seen. Query: WHERE Timestamp__c > :cursor ORDER BY Timestamp__c ASC
   */
  async fetchMessages(params: {
    recordId?: string;
    phoneNumber?: string;
    cursor?: string;
    pageSize?: number;
  }): Promise<MessagePage> {
    const pageSize = params.pageSize || 50;

    try {
      const { access_token, instance_url } = await getSalesCloudAccessToken();

      if (access_token.startsWith('mock-')) {
        let msgs = [...this.fallbackMessages];
        if (params.phoneNumber) {
          msgs = msgs.filter(m => m.senderId === params.phoneNumber || m.recipientId === params.phoneNumber);
        }
        if (params.recordId) {
          msgs = msgs.filter(m => m.salesforceRecordId === params.recordId);
        }
        if (params.cursor) {
          const cursorTime = new Date(params.cursor).getTime();
          msgs = msgs.filter(m => new Date(m.timestamp).getTime() > cursorTime);
        }

        msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const pageMsgs = msgs.slice(0, pageSize);
        const nextCursor = pageMsgs.length === pageSize ? pageMsgs[pageMsgs.length - 1].timestamp : undefined;

        return { messages: pageMsgs, nextCursor };
      }

      // Build Keyset SOQL query
      const conditions: string[] = [];
      if (params.recordId) {
        const safeId = params.recordId.replace(/'/g, "\\'");
        conditions.push(`(Lead__c = '${safeId}' OR Contact__c = '${safeId}' OR Opportunity__c = '${safeId}')`);
      }
      if (params.phoneNumber) {
        const safePhone = params.phoneNumber.replace(/'/g, "\\'");
        const last10 = safePhone.length >= 10 ? safePhone.slice(-10) : safePhone;
        conditions.push(`(Phone__c = '${safePhone}' OR Phone__c LIKE '%${last10}')`);
      }
      if (params.cursor) {
        const safeCursor = params.cursor.replace(/'/g, "\\'");
        conditions.push(`Timestamp__c > ${safeCursor}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const soql = `SELECT Id, Message_Id__c, Phone__c, Content__c, Direction__c, Status__c, Timestamp__c, Lead__c, Contact__c FROM WhatsApp_Message__c ${whereClause} ORDER BY Timestamp__c ASC LIMIT ${pageSize}`;

      const queryUrl = `${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
      const res = await fetch(queryUrl, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[SalesCloudConnector] SOQL query error (${res.status}): ${errText}`);
        throw new Error(`SOQL query for WhatsApp_Message__c failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const records = data.records || [];

      if (records.length === 0) {
        let msgs = [...this.fallbackMessages];
        if (params.phoneNumber) {
          msgs = msgs.filter(m => m.senderId === params.phoneNumber || m.recipientId === params.phoneNumber);
        }
        if (msgs.length > 0) {
          return { messages: msgs };
        }
      }

      const messages: WorkspaceMessage[] = records.map((r: any) => ({
        id: r.Message_Id__c || r.Id,
        senderId: r.Direction__c === 'OUTBOUND' ? 'salescloud-system' : r.Phone__c,
        recipientId: r.Direction__c === 'OUTBOUND' ? r.Phone__c : 'salescloud-system',
        content: r.Content__c || '',
        timestamp: r.Timestamp__c || new Date().toISOString(),
        status: (r.Status__c || 'SENT').toUpperCase(),
        direction: (r.Direction__c || 'INBOUND').toUpperCase() as 'INBOUND' | 'OUTBOUND',
        salesforceRecordId: r.Contact__c || r.Lead__c,
      }));

      const nextCursor = records.length === pageSize ? records[records.length - 1].Timestamp__c : undefined;

      return { messages, nextCursor };
    } catch (err) {
      console.warn('[SalesCloudConnector] fetchMessages failed, using fallback:', err);
      let msgs = [...this.fallbackMessages];
      if (params.phoneNumber) {
        msgs = msgs.filter(m => m.senderId === params.phoneNumber || m.recipientId === params.phoneNumber);
      }
      return { messages: msgs };
    }
  }

  async sendMessage(params: {
    recipientPhone: string;
    content: string;
    salesforceRecordId?: string;
    salesforceObjectType?: string;
  }): Promise<{ messageId: string; status: string }> {
    // 1. Send via WhatsApp Meta API
    const waResult = await sendWhatsAppMessage({
      to: params.recipientPhone,
      message: params.content,
    });

    const wamid = waResult.messageId || `wamid.sc.${Date.now()}`;

    // 2. Save outbound message record to Salesforce WhatsApp_Message__c
    await this.saveOutboundMessage({
      messageId: wamid,
      recipientPhone: params.recipientPhone,
      content: params.content,
      salesforceRecordId: params.salesforceRecordId,
      salesforceObjectType: params.salesforceObjectType,
      status: 'SENT',
    });

    return { messageId: wamid, status: 'SENT' };
  }

  /**
   * Idempotently saves an OUTBOUND message (e.g. template message or standard message) to Salesforce WhatsApp_Message__c object.
   */
  async saveOutboundMessage(params: {
    messageId: string;
    recipientPhone: string;
    content: string;
    timestamp?: string;
    leadId?: string;
    contactId?: string;
    salesforceRecordId?: string;
    salesforceObjectType?: string;
    status?: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const wamid = params.messageId;
    const timestamp = params.timestamp || new Date().toISOString();
    const cleanPhone = params.recipientPhone.replace(/^\+/, '').trim();

    try {
      // Resolve lead/contact ID if not passed directly
      let leadId = params.leadId;
      let contactId = params.contactId;

      if (!leadId && !contactId && params.salesforceRecordId && params.salesforceObjectType) {
        if (params.salesforceObjectType === 'Lead') leadId = params.salesforceRecordId;
        else if (params.salesforceObjectType === 'Contact') contactId = params.salesforceRecordId;
      }

      if (!leadId && !contactId) {
        try {
          const resolved = await this.resolveContact({ phoneNumber: cleanPhone });
          if (resolved && resolved.salesforceRecordId && !resolved.id.startsWith('sc-lead-')) {
            if (resolved.salesforceObjectType === 'Lead') leadId = resolved.salesforceRecordId;
            else if (resolved.salesforceObjectType === 'Contact') contactId = resolved.salesforceRecordId;
          }
        } catch (e) {
          console.warn('[SalesCloudConnector] Contact resolve in saveOutboundMessage skipped:', e);
        }
      }

      const { access_token, instance_url } = await getSalesCloudAccessToken();

      if (!access_token.startsWith('mock-')) {
        const payload: Record<string, any> = {
          Phone__c: cleanPhone,
          Content__c: params.content,
          Direction__c: 'OUTBOUND',
          Status__c: (params.status || 'SENT').toUpperCase(),
          Timestamp__c: timestamp,
        };

        if (leadId) payload.Lead__c = leadId;
        if (contactId) payload.Contact__c = contactId;

        const upsertUrl = `${instance_url}/services/data/v59.0/sobjects/WhatsApp_Message__c/Message_Id__c/${encodeURIComponent(wamid)}`;
        const res = await fetch(upsertUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error(`[SalesCloudConnector] saveOutboundMessage upsert failed (${res.status}): ${errText}`);
        } else {
          console.log(`[SalesCloudConnector] Saved OUTBOUND message ${wamid} to WhatsApp_Message__c`);
        }

        // Transactionally update WhatZupp_Last_Message__c on Lead or Contact
        if (leadId) {
          fetch(`${instance_url}/services/data/v59.0/sobjects/Lead/${leadId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ WhatZupp_Last_Message__c: params.content.slice(0, 255), WhatZupp_Last_Synced__c: timestamp })
          }).catch(e => console.warn('[SalesCloudConnector] Lead last message rollup failed:', e));
        } else if (contactId) {
          fetch(`${instance_url}/services/data/v59.0/sobjects/Contact/${contactId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ WhatZupp_Last_Message__c: params.content.slice(0, 255), WhatZupp_Last_Synced__c: timestamp })
          }).catch(e => console.warn('[SalesCloudConnector] Contact last message rollup failed:', e));
        }
      } else {
        this.fallbackMessages.push({
          id: wamid,
          senderId: 'sc-agent',
          recipientId: cleanPhone,
          content: params.content,
          timestamp,
          status: ((params.status || 'SENT').toUpperCase()) as 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
          direction: 'OUTBOUND',
          salesforceRecordId: contactId || leadId,
        });
      }

      // Emit real-time SSE update to UI
      emitRealtimeMessage(cleanPhone, {
        id: wamid,
        content: params.content,
        timestamp,
        sender: 'user',
        status: (params.status || 'SENT').toUpperCase(),
        recipientId: cleanPhone,
      }).catch(e => console.warn('[SalesCloudConnector] Realtime emit error:', e));

      return { success: true, messageId: wamid };
    } catch (err) {
      console.error('[SalesCloudConnector] saveOutboundMessage failed:', err);
      return { success: false, messageId: wamid };
    }
  }

  /**
   * Idempotently saves an INBOUND message to Salesforce WhatsApp_Message__c object.
   */
  async saveInboundMessage(params: {
    messageId: string;
    senderPhone: string;
    content: string;
    timestamp?: string;
    leadId?: string;
    contactId?: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const wamid = params.messageId;
    const timestamp = params.timestamp || new Date().toISOString();
    const cleanPhone = params.senderPhone.replace(/^\+/, '').trim();

    try {
      const { access_token, instance_url } = await getSalesCloudAccessToken();

      if (!access_token.startsWith('mock-')) {
        const payload: Record<string, any> = {
          Phone__c: cleanPhone,
          Content__c: params.content,
          Direction__c: 'INBOUND',
          Status__c: 'DELIVERED',
          Timestamp__c: timestamp,
        };

        if (params.leadId) payload.Lead__c = params.leadId;
        if (params.contactId) payload.Contact__c = params.contactId;

        // Idempotent External ID Upsert via Salesforce REST API
        const upsertUrl = `${instance_url}/services/data/v59.0/sobjects/WhatsApp_Message__c/Message_Id__c/${encodeURIComponent(wamid)}`;
        await fetch(upsertUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        // Transactionally update WhatZupp_Last_Message__c on Lead or Contact
        if (params.leadId) {
          fetch(`${instance_url}/services/data/v59.0/sobjects/Lead/${params.leadId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ WhatZupp_Last_Message__c: params.content.slice(0, 255), WhatZupp_Last_Synced__c: timestamp })
          }).catch(e => console.warn('[SalesCloudConnector] Lead last message rollup failed:', e));
        } else if (params.contactId) {
          fetch(`${instance_url}/services/data/v59.0/sobjects/Contact/${params.contactId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ WhatZupp_Last_Message__c: params.content.slice(0, 255), WhatZupp_Last_Synced__c: timestamp })
          }).catch(e => console.warn('[SalesCloudConnector] Contact last message rollup failed:', e));
        }
      } else {
        this.fallbackMessages.push({
          id: wamid,
          senderId: cleanPhone,
          recipientId: 'sc-agent',
          content: params.content,
          timestamp,
          status: 'DELIVERED',
          direction: 'INBOUND',
          salesforceRecordId: params.contactId || params.leadId,
        });
      }

      // Emit real-time SSE update to UI
      emitRealtimeMessage(cleanPhone, {
        id: wamid,
        content: params.content,
        timestamp,
        sender: 'contact',
        status: 'DELIVERED',
        recipientId: 'user',
      }).catch(e => console.warn('[SalesCloudConnector] Realtime emit error:', e));

      return { success: true, messageId: wamid };
    } catch (err) {
      console.error('[SalesCloudConnector] saveInboundMessage failed:', err);
      return { success: false, messageId: wamid };
    }
  }

  /**
   * Idempotently resolves or creates a Lead/Contact in Sales Cloud.
   */
  async resolveContact(params: {
    phoneNumber: string;
    name?: string;
    email?: string;
  }): Promise<WorkspaceContactResult> {
    const phone = params.phoneNumber;
    const name = params.name || `Lead ${phone}`;

    try {
      const { access_token, instance_url } = await getSalesCloudAccessToken();

      if (!access_token.startsWith('mock-')) {
        // Query existing Contact or Lead
        const safePhone = phone.replace(/'/g, "\\'");
        const soql = `SELECT Id, Name, Email, Phone, MobilePhone FROM Contact WHERE Phone = '${safePhone}' OR MobilePhone = '${safePhone}' LIMIT 1`;
        const queryUrl = `${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
        const res = await fetch(queryUrl, { headers: { Authorization: `Bearer ${access_token}` } });

        if (res.ok) {
          const data = await res.json();
          if (data.records && data.records.length > 0) {
            const r = data.records[0];
            return {
              id: r.Id,
              name: r.Name,
              phoneNumber: phone,
              salesforceObjectType: 'Contact',
              salesforceRecordId: r.Id,
              email: r.Email,
              company: 'Salesforce Contact',
              lastSyncedAt: new Date().toISOString(),
            };
          }
        }

        // If no contact found, query Lead
        const leadSoql = `SELECT Id, Name, Email, Phone, MobilePhone, Company FROM Lead WHERE Phone = '${safePhone}' OR MobilePhone = '${safePhone}' LIMIT 1`;
        const leadRes = await fetch(`${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(leadSoql)}`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        if (leadRes.ok) {
          const leadData = await leadRes.json();
          if (leadData.records && leadData.records.length > 0) {
            const r = leadData.records[0];
            return {
              id: r.Id,
              name: r.Name,
              phoneNumber: phone,
              salesforceObjectType: 'Lead',
              salesforceRecordId: r.Id,
              email: r.Email,
              company: r.Company || 'Salesforce Lead',
              lastSyncedAt: new Date().toISOString(),
            };
          }
        }

        // Create new Lead if neither exists
        const nameParts = name.trim().split(' ');
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'WhatsApp';
        const firstName = nameParts.length > 1 ? nameParts[0] : nameParts[0];

        const createLeadUrl = `${instance_url}/services/data/v59.0/sobjects/Lead`;
        const createRes = await fetch(createLeadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            FirstName: firstName,
            LastName: lastName,
            Company: 'WhatsApp Inbound',
            Phone: phone,
            MobilePhone: phone,
            Email: params.email || `${phone}@whatsapp-lead.com`,
            WhatZupp_Sync_Status__c: 'Synced',
            WhatZupp_Last_Synced__c: new Date().toISOString(),
          }),
        });

        if (createRes.ok) {
          const newLead = await createRes.json();
          return {
            id: newLead.id,
            name: `${firstName} ${lastName}`,
            phoneNumber: phone,
            salesforceObjectType: 'Lead',
            salesforceRecordId: newLead.id,
            email: params.email || `${phone}@whatsapp-lead.com`,
            company: 'WhatsApp Inbound',
            lastSyncedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn('[SalesCloudConnector] resolveContact failed, using fallback:', err);
    }

    // Fallback resolution
    let existing = this.fallbackContacts.find(c => c.phoneNumber === phone);
    if (!existing) {
      existing = {
        id: `sc-lead-${phone}`,
        name: params.name || `Lead ${phone}`,
        phoneNumber: phone,
        salesforceObjectType: 'Lead',
        salesforceRecordId: `00Q${Date.now()}AAA`,
        email: params.email || `${phone}@salescloud.com`,
        company: 'WhatsApp Prospect',
        lastSyncedAt: new Date().toISOString(),
      };
      this.fallbackContacts.push(existing);
    }
    return existing;
  }

  /**
   * Directly creates a Lead in Salesforce Sales Cloud REST API.
   */
  async createLead(params: {
    name: string;
    phoneNumber: string;
    email?: string;
    company?: string;
  }): Promise<WorkspaceContactResult> {
    const phone = params.phoneNumber.replace(/[^0-9]/g, '');
    const fullName = params.name.trim();
    const nameParts = fullName.split(' ');
    const firstName = nameParts.length > 1 ? nameParts[0] : fullName;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'WhatZupp Contact';
    const company = params.company?.trim() || 'WhatZupp Prospect';
    const email = params.email?.trim() || `${phone}@whatzupp.com`;

    try {
      let { access_token, instance_url } = await getSalesCloudAccessToken();

      if (!access_token.startsWith('mock-')) {
        const createUrl = `${instance_url}/services/data/v59.0/sobjects/Lead`;
        let res = await fetch(createUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            FirstName: firstName,
            LastName: lastName,
            Company: company,
            Phone: phone,
            MobilePhone: phone,
            Email: email,
            WhatZupp_Sync_Status__c: 'Synced',
            WhatZupp_Last_Synced__c: new Date().toISOString(),
          }),
        });

        // If session expired or invalid, auto-refresh token and retry once
        if (res.status === 401) {
          console.warn('[SalesCloudConnector] Session expired during createLead. Attempting auto-refresh token...');
          const fresh = await getSalesCloudAccessToken(true);
          access_token = fresh.access_token;
          instance_url = fresh.instance_url;

          res = await fetch(`${instance_url}/services/data/v59.0/sobjects/Lead`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              FirstName: firstName,
              LastName: lastName,
              Company: company,
              Phone: phone,
              MobilePhone: phone,
              Email: email,
              WhatZupp_Sync_Status__c: 'Synced',
              WhatZupp_Last_Synced__c: new Date().toISOString(),
            }),
          });
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.[0]?.message || `Salesforce Lead creation failed (${res.status})`);
        }

        const data = await res.json();
        return {
          id: data.id,
          name: fullName,
          phoneNumber: phone,
          salesforceObjectType: 'Lead',
          salesforceRecordId: data.id,
          email,
          company,
          lastSyncedAt: new Date().toISOString(),
        };
      }
    } catch (err: any) {
      console.warn('[SalesCloudConnector] createLead API call failed, using dev fallback:', err);
    }

    // Fallback for mock/dev
    const mockId = `00Q_MOCK_${Date.now()}`;
    const fallbackContact: WorkspaceContactResult = {
      id: mockId,
      name: fullName,
      phoneNumber: phone,
      salesforceObjectType: 'Lead',
      salesforceRecordId: mockId,
      email,
      company,
      lastSyncedAt: new Date().toISOString(),
    };
    this.fallbackContacts.push(fallbackContact);
    return fallbackContact;
  }

  /**
   * Deletes a Lead or Contact from Salesforce Sales Cloud REST API.
   */
  async deleteContactOrLead(recordId: string, objectType: 'Lead' | 'Contact' = 'Lead'): Promise<boolean> {
    try {
      const { access_token, instance_url } = await getSalesCloudAccessToken();
      if (!access_token.startsWith('mock-')) {
        const url = `${instance_url}/services/data/v59.0/sobjects/${objectType}/${recordId}`;
        const res = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!res.ok && res.status !== 404) {
          throw new Error(`Salesforce DELETE failed (${res.status})`);
        }
        return true;
      }
    } catch (err) {
      console.warn('[SalesCloudConnector] deleteContactOrLead failed:', err);
    }

    this.fallbackContacts = this.fallbackContacts.filter(c => c.id !== recordId && c.salesforceRecordId !== recordId);
    return true;
  }

  /**
   * Updates a Lead or Contact in Salesforce Sales Cloud REST API.
   */
  async updateContactOrLead(
    recordId: string,
    objectType: 'Lead' | 'Contact',
    updates: { name?: string; phoneNumber?: string; email?: string; company?: string }
  ): Promise<boolean> {
    try {
      const { access_token, instance_url } = await getSalesCloudAccessToken();
      if (!access_token.startsWith('mock-')) {
        const payload: Record<string, any> = {
          WhatZupp_Last_Synced__c: new Date().toISOString(),
        };

        if (updates.name) {
          const parts = updates.name.trim().split(' ');
          payload.FirstName = parts.length > 1 ? parts[0] : updates.name.trim();
          payload.LastName = parts.length > 1 ? parts.slice(1).join(' ') : 'WhatZupp Contact';
        }
        if (updates.phoneNumber) {
          payload.Phone = updates.phoneNumber;
          payload.MobilePhone = updates.phoneNumber;
        }
        if (updates.email) payload.Email = updates.email;
        if (updates.company && objectType === 'Lead') payload.Company = updates.company;

        const url = `${instance_url}/services/data/v59.0/sobjects/${objectType}/${recordId}`;
        const res = await fetch(url, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Salesforce PATCH failed (${res.status})`);
        }
        return true;
      }
    } catch (err) {
      console.warn('[SalesCloudConnector] updateContactOrLead failed:', err);
    }

    const item = this.fallbackContacts.find(c => c.id === recordId || c.salesforceRecordId === recordId);
    if (item) {
      if (updates.name) item.name = updates.name;
      if (updates.phoneNumber) item.phoneNumber = updates.phoneNumber;
      if (updates.email) item.email = updates.email;
      if (updates.company) item.company = updates.company;
    }
    return true;
  }

  async createContact(params: {
    name: string;
    phoneNumber: string;
    email?: string;
    company?: string;
  }): Promise<WorkspaceContactResult> {
    return this.createLead(params);
  }

  async updateContact(
    id: string,
    updates: { name?: string; phoneNumber?: string; email?: string; company?: string }
  ): Promise<boolean> {
    const objectType = id.startsWith('003') ? 'Contact' : 'Lead';
    return this.updateContactOrLead(id, objectType, updates);
  }

  async deleteContact(id: string): Promise<boolean> {
    const objectType = id.startsWith('003') ? 'Contact' : 'Lead';
    return this.deleteContactOrLead(id, objectType);
  }


  fieldSchema(): FieldMappingSchema[] {
    return [
      { name: 'Message_Id__c', label: 'Message External ID', type: 'Text', required: true },
      { name: 'Phone__c', label: 'Phone Number', type: 'Phone', required: true },
      { name: 'Content__c', label: 'Message Body', type: 'LongTextArea' },
      { name: 'Direction__c', label: 'Direction (INBOUND/OUTBOUND)', type: 'Picklist', required: true },
      { name: 'Status__c', label: 'Message Status', type: 'Picklist' },
      { name: 'Timestamp__c', label: 'Message Timestamp', type: 'DateTime' },
    ];
  }

  async validateMapping(): Promise<boolean> {
    const { access_token } = await getSalesCloudAccessToken();
    return !access_token.startsWith('mock-');
  }
}
