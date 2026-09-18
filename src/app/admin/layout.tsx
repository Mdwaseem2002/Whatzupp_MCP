'use client';

// src/app/admin/layout.tsx
// Super Admin Panel Layout for WhatZupp SaaS - White / Light Theme
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CheckSquare, Building2, Users2, Shield, Bell, FileText, Settings, ArrowLeft, MessageSquare, LogOut
} from 'lucide-react';

const ADMIN_NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/admin/approvals', label: 'Approvals Queue', icon: <CheckSquare size={18} /> },
  { href: '/admin/tenants', label: 'Tenants & Clients', icon: <Building2 size={18} /> },
  { href: '/admin/notifications', label: 'Notifications', icon: <Bell size={18} /> },
  { href: '/admin/audit', label: 'Audit Logs', icon: <FileText size={18} /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="h-screen max-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-[#25D366] selection:text-white overflow-hidden">
      
      {/* Top Header */}
      <header className="h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-50 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#128C7E] via-[#25D366] to-[#34D399] flex items-center justify-center shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/10">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <div className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2">
              WhatZupp Platform Admin 
              <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80 shadow-2xs">
                SUPER_ADMIN
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium -mt-0.5">Enterprise Governance & Multi-Tenant Operations</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50/60 border border-emerald-200/60 text-[11px] text-emerald-800 font-semibold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" />
            System Status: <span className="font-bold text-emerald-900">Operational</span>
          </div>

          <Link
            href="/dashboard"
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
          >
            <ArrowLeft size={13} /> Back to Live App
          </Link>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 flex items-center justify-center font-black text-xs text-white shadow-sm ring-2 ring-emerald-500/20">
            WA
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-56 border-r border-slate-200/80 bg-white p-3 flex flex-col justify-between shrink-0 shadow-[2px_0_10px_-4px_rgba(0,0,0,0.02)]">
          <div className="space-y-1">
            <div className="px-3 py-1.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
              Management Modules
            </div>

            {ADMIN_NAV.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-extrabold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <span className={isActive ? 'text-emerald-600' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <Link
              href="/"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut size={13} /> Platform Landing Page
            </Link>
          </div>
        </aside>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-5 bg-[#F8FAFC] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.05),rgba(255,255,255,0))]">
          {children}
        </main>
      </div>
    </div>
  );
}
