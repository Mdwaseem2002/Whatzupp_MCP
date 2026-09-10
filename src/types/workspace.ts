// src/types/workspace.ts
// All types for the multi-workspace CRM layer.
// These are purely frontend — no backend/MongoDB schema changes.

export interface Workspace {
  id: string;
  name: string;
  color: string;      // hex color e.g. '#3b82f6'
  icon: string;       // lucide icon name
  createdAt: string;  // ISO date string
  platform?: 'sfmc' | 'sales_cloud' | 'manual' | string;
  type?: 'sfmc' | 'salescloud' | string;
  connectionStatus?: 'connected' | 'disconnected' | 'syncing' | 'error';
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatar: string;      // base64 data-url, or empty string for initials fallback
  // Onboarding fields
  firstName?: string;
  lastName?: string;
  company?: string;
  role?: string;
  teamSize?: string;
}

export interface WorkspaceContact {
  id: string;
  name: string;
  phoneNumber: string;
  email: string;
  company: string;
  tags: string[];
  workspaceId: string; // links to Workspace.id
  avatar?: string;
  createdAt: string;   // ISO date string
}

export interface FastReplyTemplate {
  id: string;
  title: string;
  body: string;
  workspaceId?: string; // optional — if omitted, template is global
  createdAt: string;
}

export type AppScreen =
  | 'onboarding-profile'
  | 'onboarding-workspace'
  | 'dashboard'
  | 'chats'
  | 'contacts'
  | 'templates'
  | 'broadcasts'
  | 'automation'
  | 'analytics'
  | 'sfmc'
  | 'salescloud'
  | 'settings'
  | 'fast-reply';

export type ThemeMode = 'light' | 'dark';

export interface AppState {
  onboardingComplete: boolean;
  profile: UserProfile | null;
  workspaces: Workspace[];
  contacts: WorkspaceContact[];
  fastReplies: FastReplyTemplate[];
  activeWorkspaceId: string | null;
  activeScreen: AppScreen;
  theme: ThemeMode;
}

// Default seed workspaces for onboarding
export const SEED_WORKSPACES: Omit<Workspace, 'id' | 'createdAt'>[] = [
  { name: 'DBC', color: '#2563eb', icon: 'Building2' },     // blue-600
  { name: 'Pentacloud', color: '#7c3aed', icon: 'Globe' },   // violet-600
  { name: 'Hello Errors', color: '#059669', icon: 'Zap' },   // emerald-600
];

// Preset colors for workspace color picker
export const WORKSPACE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

// Seed contacts (added during onboarding)
export const SEED_CONTACTS: Omit<WorkspaceContact, 'id' | 'createdAt' | 'workspaceId'>[] = [
  // DBC contacts
  { name: 'Ahmed Khan', phoneNumber: '971501234567', email: 'ahmed@dbc.ae', company: 'DBC Trading', tags: ['VIP'], avatar: '' },
  { name: 'Sara Ali', phoneNumber: '971502345678', email: 'sara@dbc.ae', company: 'DBC Marketing', tags: ['Marketing'], avatar: '' },
  // Pentacloud contacts
  { name: 'Waseem Mohamed', phoneNumber: '919952374972', email: 'waseem@pentacloud.com', company: 'Pentacloud', tags: ['Internal'], avatar: '' },
  { name: 'Zuhaib', phoneNumber: '917019633010', email: 'zuhaib@pentacloud.com', company: 'Pentacloud', tags: ['Dev'], avatar: '' },
  { name: 'Ravi Kumar', phoneNumber: '919148229563', email: 'ravi@pentacloud.com', company: 'Pentacloud', tags: [], avatar: '' },
  // Hello Errors contacts
  { name: 'John Developer', phoneNumber: '14155551234', email: 'john@helloerrors.io', company: 'Hello Errors', tags: ['Support'], avatar: '' },
  { name: 'Emily QA', phoneNumber: '14155555678', email: 'emily@helloerrors.io', company: 'Hello Errors', tags: ['QA'], avatar: '' },
];

// Seed fast reply templates
export const SEED_FAST_REPLIES: Omit<FastReplyTemplate, 'id' | 'createdAt'>[] = [
  { title: 'Greeting', body: 'Hi! Thanks for reaching out. How can I help you today?' },
  { title: 'Follow Up', body: 'Just following up on our previous conversation. Please let me know if you have any questions.' },
  { title: 'Out of Office', body: 'Thank you for your message. I am currently out of the office and will respond as soon as possible.' },
];
