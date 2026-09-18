// Contact represents a WhatsApp contact/recipient
export interface Contact {
    online?: boolean | unknown;
    id: string;
    name: string;
    phoneNumber: string;
    avatar?: string;
    lastSeen?: string;
    email?: string;
    company?: string;
    designation?: string;
    location?: string;
    tags?: string[];
    salesforceObjectType?: string;
    salesforceRecordId?: string;
    leadStatus?: string;
    accountName?: string;
    opportunityName?: string;
    ownerName?: string;
    lastSyncedAt?: string;
  }
  
  // Different statuses a message can have
  export enum MessageStatus {
    PENDING = 'pending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    READ = 'read',
    FAILED = 'failed',
    QUEUED = "QUEUED"
  }
  
  // Message represents a chat message
  export interface Message {
    attachments: boolean;
    id: string;
    content: string;
    timestamp: string;
    sender: 'user' | 'contact'; // 'user' is the current user, 'contact' is the recipient
    status: MessageStatus;
    recipientId: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'video' | 'document' | 'text' | 'sticker';
    mediaId?: string;
    mimeType?: string;
    filename?: string;
    caption?: string;
    contactPhoneNumber?: string;
    conversationId?: string;
    originalId?: string;
  }

  // WhatsApp configuration settings
  export interface WhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    verificationToken?: string;
    webhookUrl?: string;
  }
  
  // WebhookMessage represents an incoming message from the WhatsApp API
  export interface WebhookMessage {
    object: string;
    entry: WebhookEntry[];
  }
  
  export interface WebhookEntry {
    id: string;
    changes: WebhookChange[];
  }
  
  export interface WebhookChange {
    field: string;
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: WebhookContact[];
      messages?: WebhookIncomingMessage[];
      statuses?: WebhookMessageStatus[];
    };
  }
  
  export interface WebhookContact {
    profile: {
      name: string;
    };
    wa_id: string;
  }
  
  export interface WebhookIncomingMessage {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: {
      body: string;
    };
    image?: {
      id: string;
      mime_type: string;
      sha256: string;
      caption?: string;
    };
    audio?: unknown;
    video?: unknown;
    document?: unknown;
  }
  
  export interface WebhookMessageStatus {
    id: string;
    recipient_id: string;
    status: string;
    timestamp: string;
    conversation?: {
      id: string;
      expiration_timestamp?: string;
      origin?: {
        type: string;
      };
    };
    pricing?: {
      billable: boolean;
      pricing_model: string;
      category: string;
    };
  }

  
  export interface Message {
    id: string;
    content: string;
    timestamp: string;
    sender: 'user' | 'contact';
    status: MessageStatus;
    mediaType?: 'image' | 'audio' | 'video' | 'document' | 'text' | 'sticker';
    mediaId?: string;
    mimeType?: string;
    filename?: string;
    caption?: string;
  }
  
  export interface Contact {
    id: string;
    name: string;
    avatar?: string;
    lastSeen?: string;
    phoneNumber: string;
    online?: boolean | unknown;
    email?: string;
    company?: string;
    designation?: string;
    location?: string;
    tags?: string[];
    salesforceObjectType?: string;
    salesforceRecordId?: string;
    leadStatus?: string;
    accountName?: string;
    opportunityName?: string;
    ownerName?: string;
    lastSyncedAt?: string;
  }
  
  