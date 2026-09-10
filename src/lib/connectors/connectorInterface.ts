export interface WorkspaceMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: string; // ISO String
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  direction: 'INBOUND' | 'OUTBOUND';
  mediaUrl?: string;
  salesforceRecordId?: string;
}

export interface MessagePage {
  messages: WorkspaceMessage[];
  nextCursor?: string;
}

export interface WorkspaceContactResult {
  id: string;
  name: string;
  phoneNumber: string;
  salesforceObjectType?: 'Lead' | 'Contact' | 'Account' | 'Opportunity';
  salesforceRecordId?: string;
  email?: string;
  company?: string;
  lastSyncedAt: string;
}

export interface FieldMappingSchema {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

export interface Connector {
  id: string; // e.g., 'sfmc-ws-1', 'salescloud-ws-1'
  workspaceType: 'sfmc' | 'salescloud';

  fetchContacts(params: { search?: string; limit?: number }): Promise<WorkspaceContactResult[]>;

  fetchMessages(params: {
    recordId?: string;
    phoneNumber?: string;
    cursor?: string;
    pageSize?: number;
  }): Promise<MessagePage>;

  sendMessage(params: {
    recipientPhone: string;
    content: string;
    salesforceRecordId?: string;
    salesforceObjectType?: string;
  }): Promise<{ messageId: string; status: string }>;

  resolveContact(params: {
    phoneNumber: string;
    name?: string;
    email?: string;
  }): Promise<WorkspaceContactResult>;

  createContact(params: {
    name: string;
    phoneNumber: string;
    email?: string;
    company?: string;
  }): Promise<WorkspaceContactResult>;

  updateContact(
    id: string,
    updates: { name?: string; phoneNumber?: string; email?: string; company?: string }
  ): Promise<boolean>;

  deleteContact(id: string): Promise<boolean>;

  fieldSchema(): FieldMappingSchema[];
  validateMapping(): Promise<boolean>;
}
