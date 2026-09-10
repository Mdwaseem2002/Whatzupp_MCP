'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Workspace,
  UserProfile,
  WorkspaceContact,
  FastReplyTemplate,
  AppScreen,
  ThemeMode,
  AppState,
} from '@/types/workspace';

interface WorkspaceContextValue {
  state: AppState;
  isReady: boolean;
  setProfile: (profile: UserProfile) => Promise<void>;
  completeOnboarding: () => void;
  addWorkspace: (ws: Omit<Workspace, 'id' | 'createdAt'>) => Promise<Workspace>;
  updateWorkspace: (id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  activeWorkspace: Workspace | null;
  addContact: (contact: Omit<WorkspaceContact, 'id' | 'createdAt'>) => Promise<WorkspaceContact>;
  updateContact: (id: string, updates: Partial<Omit<WorkspaceContact, 'id' | 'createdAt'>>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  activeContacts: WorkspaceContact[];
  allContacts: WorkspaceContact[];
  getWorkspaceForPhone: (phone: string) => string | null;
  isPhoneVisibleInActiveWorkspace: (phone: string) => boolean;
  addFastReply: (reply: Omit<FastReplyTemplate, 'id' | 'createdAt'>) => Promise<void>;
  updateFastReply: (id: string, updates: Partial<Omit<FastReplyTemplate, 'id' | 'createdAt'>>) => Promise<void>;
  deleteFastReply: (id: string) => Promise<void>;
  activeFastReplies: FastReplyTemplate[];
  setActiveScreen: (screen: AppScreen) => void;
  setTheme: (theme: ThemeMode) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  return String(phone).replace(/^\+/, '');
}

const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'salescloud-ws-1',
    name: 'Sales Cloud Workspace',
    color: '#0070D2',
    icon: 'Cloud',
    type: 'salescloud',
    connectionStatus: 'connected',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sfmc-ws-1',
    name: 'Marketing Cloud Workspace',
    color: '#25D366',
    icon: 'Building2',
    type: 'sfmc',
    connectionStatus: 'connected',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_STATE: AppState = {
  onboardingComplete: true,
  profile: null,
  workspaces: DEFAULT_WORKSPACES,
  contacts: [],
  fastReplies: [],
  activeWorkspaceId: 'salescloud-ws-1',
  activeScreen: 'dashboard',
  theme: 'light',
};

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [isReady, setIsReady] = useState(false);

  // Restore saved localStorage state on client mount
  useEffect(() => {
    try {
      const cachedWsStr = localStorage.getItem('wz_cached_workspaces');
      const savedWsId = localStorage.getItem('wz_active_workspace');
      const savedScreen = localStorage.getItem('wz_active_screen') as AppScreen | null;

      if (cachedWsStr || savedWsId || savedScreen) {
        setState(prev => {
          let workspaces = prev.workspaces;
          if (cachedWsStr) {
            const parsed = JSON.parse(cachedWsStr);
            if (Array.isArray(parsed) && parsed.length > 0) workspaces = parsed;
          }
          const activeWorkspaceId = (savedWsId && workspaces.some(w => w.id === savedWsId))
            ? savedWsId
            : (workspaces[0]?.id || 'salescloud-ws-1');
          const activeScreen = savedScreen || prev.activeScreen;

          return {
            ...prev,
            workspaces,
            activeWorkspaceId,
            activeScreen,
          };
        });
      }
    } catch (e) {}
  }, []);

  // Sync data from backend on mount
  useEffect(() => {
    const fetchSync = async () => {
      try {
        const res = await fetch('/api/user/sync');
        if (res.ok) {
          const { data } = await res.json();
          const workspaces = (data.workspaces && data.workspaces.length > 0)
            ? data.workspaces
            : DEFAULT_WORKSPACES;

          if (typeof window !== 'undefined') {
            localStorage.setItem('wz_cached_workspaces', JSON.stringify(workspaces));
          }

          setState(prev => {
            const savedWsId = typeof window !== 'undefined' ? localStorage.getItem('wz_active_workspace') : null;
            const savedScreen = typeof window !== 'undefined' ? localStorage.getItem('wz_active_screen') : null;

            const targetWsId = (savedWsId && workspaces.some((w: any) => w.id === savedWsId))
              ? savedWsId
              : (workspaces.some((w: any) => w.id === prev.activeWorkspaceId) ? prev.activeWorkspaceId : (workspaces[0]?.id || 'salescloud-ws-1'));

            const targetScreen = (savedScreen || prev.activeScreen || 'dashboard') as AppScreen;

            return {
              ...prev,
              profile: data.profile || null,
              workspaces,
              contacts: data.contacts || [],
              fastReplies: data.fastReplies || [],
              onboardingComplete: true,
              activeWorkspaceId: targetWsId,
              activeScreen: targetScreen,
            };
          });
        }
      } catch (e) {
        console.error('Failed to sync workspace data', e);
      } finally {
        setIsReady(true);
      }
    };
    fetchSync();
  }, []);

  // Sync theme
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', state.theme);
    }
  }, [state.theme]);

  // Mutations
  const setProfile = useCallback(async (profile: UserProfile) => {
    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update profile');
    setState(prev => ({ ...prev, profile: json.data }));
  }, []);

  const completeOnboarding = useCallback(() => {
    setState(prev => {
      const firstWs = prev.workspaces[0];
      return {
        ...prev,
        onboardingComplete: true,
        activeWorkspaceId: firstWs?.id || 'salescloud-ws-1',
        activeScreen: 'dashboard',
      };
    });
  }, []);

  const addWorkspace = useCallback(async (ws: Omit<Workspace, 'id' | 'createdAt'>): Promise<Workspace> => {
    const res = await fetch('/api/user/workspaces', { method: 'POST', body: JSON.stringify(ws) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add workspace');
    setState(prev => ({ ...prev, workspaces: [...prev.workspaces, json.data] }));
    return json.data;
  }, []);

  const updateWorkspace = useCallback(async (id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) => {
    setState(prev => ({
      ...prev,
      workspaces: prev.workspaces.map(ws => ws.id === id ? { ...ws, ...updates } : ws),
    }));
  }, []);

  const deleteWorkspace = useCallback(async (id: string) => {
    try {
      await fetch(`/api/user/workspaces?id=${id}`, { method: 'DELETE' });
      setState(prev => {
        const filtered = prev.workspaces.filter(ws => ws.id !== id);
        const newActiveId = prev.activeWorkspaceId === id ? (filtered[0]?.id || 'salescloud-ws-1') : prev.activeWorkspaceId;
        return {
          ...prev,
          workspaces: filtered,
          activeWorkspaceId: newActiveId,
          contacts: prev.contacts.filter(c => c.workspaceId !== id),
        };
      });
    } catch (e) { console.error(e); }
  }, []);

  const setActiveWorkspace = useCallback((id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wz_active_workspace', id);
    }
    setState(prev => ({ ...prev, activeWorkspaceId: id }));
  }, []);

  const activeWorkspace = useMemo(() => {
    return state.workspaces.find(ws => ws.id === state.activeWorkspaceId) || state.workspaces[0] || DEFAULT_WORKSPACES[0];
  }, [state.workspaces, state.activeWorkspaceId]);

  // Contacts
  const addContact = useCallback(async (contact: Omit<WorkspaceContact, 'id' | 'createdAt'>): Promise<WorkspaceContact> => {
    const res = await fetch('/api/user/contacts', { method: 'POST', body: JSON.stringify(contact) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add contact');
    setState(prev => ({ ...prev, contacts: [json.data, ...prev.contacts] }));
    return json.data;
  }, []);

  const updateContact = useCallback(async (id: string, updates: Partial<Omit<WorkspaceContact, 'id' | 'createdAt'>>) => {
    try {
      const res = await fetch('/api/user/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update contact');
      
      setState(prev => ({
        ...prev,
        contacts: prev.contacts.map(c => c.id === id ? { ...c, ...updates } : c),
      }));
    } catch (e) {
      console.error('Failed to update contact:', e);
      throw e;
    }
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    try {
      await fetch(`/api/user/contacts?id=${id}`, { method: 'DELETE' });
      setState(prev => ({ ...prev, contacts: prev.contacts.filter(c => c.id !== id) }));
    } catch (e) { console.error(e); }
  }, []);

  const activeContacts = useMemo(() => {
    if (!state.activeWorkspaceId) return [];
    return state.contacts.filter(c => c.workspaceId === state.activeWorkspaceId);
  }, [state.contacts, state.activeWorkspaceId]);

  const allContacts = state.contacts;

  const getWorkspaceForPhone = useCallback((phone: string): string | null => {
    const normalized = normalizePhone(phone);
    const contact = state.contacts.find(c => normalizePhone(c.phoneNumber) === normalized);
    return contact?.workspaceId || null;
  }, [state.contacts]);

  const isPhoneVisibleInActiveWorkspace = useCallback((phone: string): boolean => {
    const normalized = normalizePhone(phone);
    const contact = state.contacts.find(c => normalizePhone(c.phoneNumber) === normalized);
    if (!contact) return false;
    return contact.workspaceId === state.activeWorkspaceId;
  }, [state.contacts, state.activeWorkspaceId]);

  // Fast Replies
  const addFastReply = useCallback(async (reply: Omit<FastReplyTemplate, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/user/fast-replies', { method: 'POST', body: JSON.stringify(reply) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add fast reply');
    setState(prev => ({ ...prev, fastReplies: [...prev.fastReplies, json.data] }));
    return json.data;
  }, []);

  const updateFastReply = useCallback(async (id: string, updates: Partial<Omit<FastReplyTemplate, 'id' | 'createdAt'>>) => {
    setState(prev => ({
      ...prev,
      fastReplies: prev.fastReplies.map(r => r.id === id ? { ...r, ...updates } : r),
    }));
  }, []);

  const deleteFastReply = useCallback(async (id: string) => {
    try {
      await fetch(`/api/user/fast-replies?id=${id}`, { method: 'DELETE' });
      setState(prev => ({ ...prev, fastReplies: prev.fastReplies.filter(r => r.id !== id) }));
    } catch(e) { console.error(e); }
  }, []);

  const activeFastReplies = useMemo(() => {
    return state.fastReplies;
  }, [state.fastReplies]);

  const setActiveScreen = useCallback((screen: AppScreen) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wz_active_screen', screen);
    }
    setState(prev => ({ ...prev, activeScreen: screen }));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    setState(prev => ({ ...prev, theme }));
  }, []);

  const value: WorkspaceContextValue = useMemo(() => ({
    state, isReady, setProfile, completeOnboarding, addWorkspace, updateWorkspace, deleteWorkspace, setActiveWorkspace, activeWorkspace,
    addContact, updateContact, deleteContact, activeContacts, allContacts, getWorkspaceForPhone, isPhoneVisibleInActiveWorkspace,
    addFastReply, updateFastReply, deleteFastReply, activeFastReplies, setActiveScreen, setTheme,
  }), [
    state, isReady, setProfile, completeOnboarding, addWorkspace, updateWorkspace, deleteWorkspace, setActiveWorkspace, activeWorkspace,
    addContact, updateContact, deleteContact, activeContacts, allContacts, getWorkspaceForPhone, isPhoneVisibleInActiveWorkspace,
    addFastReply, updateFastReply, deleteFastReply, activeFastReplies, setActiveScreen, setTheme,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
