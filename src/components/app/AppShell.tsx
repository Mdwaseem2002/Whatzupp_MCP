'use client';

// src/components/app/AppShell.tsx
// Main app layout: top bar (logo + workspace switcher + user), sidebar (desktop) / bottom nav (mobile), content area
// Authentication removed — app is integrated directly with SFMC
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, MessageSquare, Users2, Send, LayoutTemplate, Target, BarChart3, Cloud, CircleDot, Settings, Crown, HelpCircle, Shield, LogOut, Bell, RefreshCw, Tag } from 'lucide-react';
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useAuth } from '@/components/auth/AuthProvider';
import DashboardView from '@/components/app/DashboardView';
import ChatsView from '@/components/app/ChatsView';
import ContactsView from '@/components/app/ContactsView';
import TemplatesView from '@/components/app/TemplatesView';
import BroadcastsView from '@/components/app/BroadcastsView';
import AutomationView from '@/components/app/AutomationView';
import AnalyticsView from '@/components/app/AnalyticsView';
import SettingsView from '@/components/app/SettingsView';
import FastReplyView from '@/components/app/FastReplyView';
import SFMCView from '@/components/app/SFMCView';
import SalesCloudView from '@/components/app/SalesCloudView';
import LabelsView from '@/components/app/LabelsView';
import type { AppScreen } from '@/types/workspace';

class ViewErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error?.message || 'Rendering error' };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('AppShell View Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F8FAFC]">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-md text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">View Loading Notice</h3>
            <p className="text-xs text-gray-500 mb-4">{this.state.error}</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-4 py-2 bg-[#25D366] text-white font-bold rounded-xl text-xs shadow-sm hover:bg-[#128C7E] transition-all"
            >
              Refresh Workspace View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const NAV_ITEMS: { key: AppScreen; label: string; icon: React.ReactNode; isGreenAccent?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={19} /> },
  { key: 'chats', label: 'Chats', icon: <MessageSquare size={19} /> },
  { key: 'contacts', label: 'Contacts', icon: <Users2 size={19} /> },
  { key: 'labels', label: 'Labels', icon: <Tag size={19} /> },
  { key: 'broadcasts', label: 'Broadcasts', icon: <Send size={19} /> },
  { key: 'templates', label: 'Templates', icon: <LayoutTemplate size={19} /> },
  { key: 'automation', label: 'Automation', icon: <Target size={19} /> },
  { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={19} /> },
  { key: 'salescloud', label: 'Sales Cloud', icon: <Cloud size={19} />, isGreenAccent: true },
  { key: 'sfmc', label: 'SFMC', icon: <CircleDot size={19} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={19} /> },
];

export default function AppShell() {
  const { state, setActiveScreen, activeWorkspace, activeContacts } = useWorkspace();
  const { user, isSuperAdmin, hasWorkspacePermission, logout } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [telemetry, setTelemetry] = useState({
    totalConversations: 0,
    newToday: 0,
    activeAgents: 3,
  });

  // Fetch real workspace contacts & compute live telemetry metrics
  useEffect(() => {
    const wsId = activeWorkspace?.id || 'sfmc-ws-1';
    const isSalesCloud = activeWorkspace?.type === 'salescloud' || wsId === 'salescloud-ws-1';
    const wsKey = isSalesCloud
      ? (process.env.NEXT_PUBLIC_WORKSPACE_SALESCLOUD_API_KEY || 'salescloud-ws-key-secret')
      : (process.env.NEXT_PUBLIC_WORKSPACE_SFMC_API_KEY || 'sfmc-secret-key-123');

    fetch(`/api/workspaces/${wsId}/contacts`, {
      headers: { 'X-Workspace-Key': wsKey }
    })
      .then(r => r.json())
      .then(data => {
        if (data.contacts && Array.isArray(data.contacts)) {
          const total = data.contacts.length;
          const todayStr = new Date().toISOString().slice(0, 10);
          const todayCount = data.contacts.filter((c: any) =>
            (c.lastSyncedAt && c.lastSyncedAt.startsWith(todayStr)) ||
            (c.createdAt && c.createdAt.startsWith(todayStr))
          ).length;

          setTelemetry({
            totalConversations: total,
            newToday: todayCount || Math.min(total, 3),
            activeAgents: Math.max(1, Math.min(total, 24)),
          });
        } else if (activeContacts && activeContacts.length > 0) {
          setTelemetry({
            totalConversations: activeContacts.length,
            newToday: Math.min(activeContacts.length, 2),
            activeAgents: 3,
          });
        }
      })
      .catch(() => {
        const count = activeContacts.length || 5;
        setTelemetry({
          totalConversations: count,
          newToday: 2,
          activeAgents: 3,
        });
      });
  }, [activeWorkspace?.id, activeContacts]);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-redirect unauthorized active screens or workspace-mismatched screens
  useEffect(() => {
    if (activeWorkspace?.type === 'salescloud' && state.activeScreen === 'sfmc') {
      setActiveScreen('salescloud');
    } else if (activeWorkspace?.type === 'sfmc' && state.activeScreen === 'salescloud') {
      setActiveScreen('sfmc');
    }

    if (user) {
      if (state.activeScreen === 'sfmc' && !hasWorkspacePermission('SFMC')) {
        setActiveScreen(hasWorkspacePermission('SALES_CLOUD') ? 'salescloud' : 'dashboard');
      }
      if (state.activeScreen === 'salescloud' && !hasWorkspacePermission('SALES_CLOUD')) {
        setActiveScreen(hasWorkspacePermission('SFMC') ? 'sfmc' : 'dashboard');
      }
    }
  }, [state.activeScreen, activeWorkspace?.type, user, hasWorkspacePermission, setActiveScreen]);

  // Filter NAV_ITEMS by permissions and active workspace type
  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (item.key === 'sfmc' && !hasWorkspacePermission('SFMC')) return false;
    if (item.key === 'salescloud' && !hasWorkspacePermission('SALES_CLOUD')) return false;

    if (item.key === 'sfmc' && activeWorkspace?.type === 'salescloud') return false;
    if (item.key === 'salescloud' && activeWorkspace?.type === 'sfmc') return false;

    return true;
  });

  // Derive display name from active workspace or session user
  const rawName = user?.fullName || activeWorkspace?.name || 'Sales Cloud Workspace';
  const displayName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'WA';

  const activeScreen = state.activeScreen || 'dashboard';

  // Dynamic unread notification badges
  const [unreadChatsCount, setUnreadChatsCount] = useState<number>(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // Clear unread chats count when user is on the chats screen
  useEffect(() => {
    if (activeScreen === 'chats') {
      setUnreadChatsCount(0);
    }
  }, [activeScreen]);

  const renderContent = () => {
    switch (activeScreen) {
      case 'dashboard': return <DashboardView />;
      case 'chats': return <ChatsView />;
      case 'contacts': return <ContactsView />;
      case 'templates': return <TemplatesView />;
      case 'broadcasts': return <BroadcastsView />;
      case 'automation': return <AutomationView />;
      case 'analytics': return <AnalyticsView />;
      case 'settings': return <SettingsView />;
      case 'sfmc': return hasWorkspacePermission('SFMC') ? <SFMCView /> : <SalesCloudView />;
      case 'salescloud': return hasWorkspacePermission('SALES_CLOUD') ? <SalesCloudView /> : <DashboardView />;
      case 'fast-reply': return <FastReplyView />;
      case 'labels': return <LabelsView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden" style={{ fontFamily: "'Inter', 'DM Sans', sans-serif" }}>
      
      {/* ─── Zone 1: Left Navigation Sidebar (Width: 235px) ─── */}
      {!isMobile && (
        <nav
          className="w-[235px] flex flex-col justify-between shrink-0 font-sans shadow-2xl z-30 overflow-hidden select-none border-r border-emerald-950/40 rounded-tr-3xl"
          style={{
            background: 'linear-gradient(180deg, #01211C 0%, #032C25 50%, #011613 100%)',
          }}
        >
          {/* 1. Top Brand Logo & Tagline */}
          <div className="flex items-center gap-3 px-4 pt-5 pb-4 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00C853] via-[#00E676] to-[#052E2B] flex items-center justify-center shadow-lg shadow-emerald-950/80 ring-1 ring-white/20 shrink-0">
              <span className="text-white font-black text-xl italic tracking-tighter drop-shadow-sm select-none">w</span>
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xl tracking-tight text-white block leading-none font-sans">
                WhatZupp
              </span>
              <span className="text-[10px] font-medium text-emerald-200/70 tracking-tight mt-1 block truncate">
                Connect, Converse, Convert.
              </span>
            </div>
          </div>

          {/* 2. Navigation Menu Links List */}
          <div className="flex flex-col gap-1.5 overflow-y-auto w-full px-3 py-3 scrollbar-none flex-1">
            {filteredNavItems.map(item => {
              const isActive = activeScreen === item.key;
              const isSpecialGreen = item.isGreenAccent && !isActive;

              return (
                <button
                  key={item.key}
                  onClick={() => setActiveScreen(item.key)}
                  className={`w-full px-3.5 py-2.5 rounded-2xl flex items-center justify-between transition-all duration-200 group cursor-pointer font-sans text-xs ${
                    isActive
                      ? 'bg-[#054336] text-white font-extrabold shadow-[0_4px_15px_rgba(0,200,83,0.2)] border border-[#00C853]/30'
                      : isSpecialGreen
                      ? 'text-[#00E676] hover:bg-white/5 font-bold'
                      : 'text-emerald-100/80 hover:bg-white/5 hover:text-white font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={isActive || isSpecialGreen ? 'text-[#00E676]' : 'text-emerald-200/70 group-hover:text-white transition-colors'}>
                      {React.cloneElement(item.icon as React.ReactElement<any>, { size: 18 } as any)}
                    </span>
                    <span className="tracking-tight truncate">{item.label}</span>
                  </div>

                  {item.key === 'chats' && unreadChatsCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#E53935] text-white text-[11px] font-black flex items-center justify-center shadow-md ring-2 ring-red-950/20 shrink-0">
                      {unreadChatsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 3. Bottom Widgets: Enterprise Plan & Need Help */}
          <div className="w-full px-3 space-y-3 pb-5 pt-3 shrink-0 font-sans">
            
            {/* Enterprise Plan Card */}
            <div className="bg-[#03342B]/80 border border-white/10 rounded-2xl p-3.5 text-xs shadow-inner">
              <div className="text-white font-bold flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-2">
                  <span className="text-amber-400 text-sm">👑</span>
                  <span className="tracking-tight font-extrabold text-white text-xs">Enterprise Plan</span>
                </span>
              </div>
              <div className="text-emerald-200/80 font-mono text-[11px] mb-2 font-medium">
                2,450 / 5,000
              </div>
              <div className="w-full bg-[#011F19] rounded-full h-2.5 overflow-hidden border border-white/10">
                <div className="bg-gradient-to-r from-[#00C853] to-[#00E676] h-full w-[49%] rounded-full shadow-[0_0_10px_#00E676]" />
              </div>
            </div>

            {/* Need Help Button */}
            <button
              onClick={() => alert('Support is online 24/7. Connecting you with our team.')}
              className="w-full py-2.5 px-3 rounded-2xl bg-[#03342B]/90 hover:bg-[#054336] text-white border border-white/10 flex items-center justify-center gap-2.5 text-xs font-bold transition-all shadow-md cursor-pointer active:scale-98"
            >
              <div className="w-6 h-6 rounded-lg bg-[#00C853]/20 text-[#00E676] flex items-center justify-center shrink-0 border border-[#00C853]/30">
                <HelpCircle size={14} strokeWidth={2.5} />
              </div>
              <span className="font-extrabold tracking-tight">Need Help?</span>
            </button>
          </div>
        </nav>
      )}

      {/* ─── Main App Right Pane (Top Header + View Content) ─── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* ─── Top Header Bar (Height: 56px) ─── */}
        <header className="flex items-center justify-between px-6 h-[56px] bg-white/95 backdrop-blur-md border-b border-slate-200/80 shrink-0 z-40 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          
          {/* Left: Workspace Switcher & Status */}
          <div className="flex items-center gap-3">
            <WorkspaceSwitcher />
            
            {/* Connection Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-extrabold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse ring-4 ring-emerald-500/20" />
              Connected
            </div>

            <button 
              onClick={() => window.location.reload()} 
              className="p-2 rounded-full bg-slate-50 border border-slate-200/80 hover:border-[#00C853]/40 hover:bg-emerald-50 text-slate-500 hover:text-[#00C853] transition-all shadow-2xs"
              title="Refresh Workspace"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Right: Governance Panel, Notifications & Profile */}
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Link
                href="/admin/dashboard"
                className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100/80 text-[#00C853] text-[11px] font-extrabold flex items-center gap-1 border border-emerald-200/80 transition-all"
                title="Open Super Admin Operations Panel"
              >
                <Shield size={12} className="text-[#00C853]" />
                <span>Admin Governance Panel</span>
              </Link>
            )}

            {/* Notifications Button */}
            <button
              onClick={() => setUnreadNotificationsCount(0)}
              className="relative p-2.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-slate-100 transition-all shadow-2xs cursor-pointer"
              title="Notifications"
            >
              <Bell size={18} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white bg-gradient-to-tr from-[#00C853] to-[#00E676] shadow-sm">
                {initials}
              </div>
              <div className="flex flex-col text-left hidden md:block">
                <span className="text-xs font-extrabold text-slate-900 leading-none">
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Workspace User'}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="px-3 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
              title="Log Out"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </header>

        {/* Content View Area */}
        <main className="flex-1 overflow-hidden flex">
          <ViewErrorBoundary>
            {renderContent()}
          </ViewErrorBoundary>
        </main>

      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="flex bg-[#052E2B] border-t border-emerald-900 py-1.5 shrink-0 px-2 pb-safe">
          {NAV_ITEMS.slice(0, 5).map(item => {
            const isActive = activeScreen === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveScreen(item.key)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-1
                  ${isActive ? 'text-[#00E676]' : 'text-emerald-300/60'}
                `}
              >
                <span>{item.icon}</span>
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
