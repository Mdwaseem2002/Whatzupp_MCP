'use client';

// src/app/page.tsx
// Public SaaS Landing Page for WhatZupp Platform v2.0
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MessageSquare, ShieldCheck, Zap, Layers, Sparkles, CheckCircle2,
  Users2, ArrowRight, ArrowUpRight, Lock, ChevronRight, BarChart3, Cloud, Workflow
} from 'lucide-react';
import ChatMockup from '@/components/landing/ChatMockup';

export default function SaaSLandingPage() {
  return (
    <div className="min-h-screen bg-[#090D16] text-white selection:bg-[#25D366] selection:text-black overflow-x-hidden font-sans">
      
      {/* ── Background Glow Effects ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#25D366]/15 via-emerald-600/5 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-[25%] right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[160px] rounded-full" />
        <div className="absolute top-[60%] left-0 w-[600px] h-[600px] bg-[#25D366]/10 blur-[180px] rounded-full" />
      </div>

      {/* ── Top Navigation Bar ── */}
      <nav className="relative z-50 border-b border-white/10 bg-[#090D16]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-lg shadow-[#25D366]/20">
              <MessageSquare size={20} className="text-white" />
            </div>
            <span className="font-[Syne] font-extrabold text-xl tracking-tight text-white">
              WhatZupp <span className="text-[#25D366] text-xs font-semibold px-2 py-0.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 ml-1">v2.0 SaaS</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-[#25D366] transition-colors">Features</a>
            <a href="#architecture" className="hover:text-[#25D366] transition-colors">Architecture</a>
            <a href="#licensing" className="hover:text-[#25D366] transition-colors">Licensing</a>
            <a href="#integrations" className="hover:text-[#25D366] transition-colors">Integrations</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
            >
              Client Login
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20bd5a] hover:to-[#0f7a6e] text-white font-bold text-sm shadow-lg shadow-[#25D366]/20 hover:shadow-[#25D366]/30 transition-all flex items-center gap-2"
            >
              Request Workspace <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative z-10 pt-16 pb-28 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-8 text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366] text-xs font-semibold"
            >
              <Sparkles size={14} />
              Enterprise Multi-Tenant WhatsApp SaaS Platform
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-[Syne] text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.1]"
            >
              Unified Customer <br />
              Conversations for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#25D366] via-emerald-400 to-teal-200">
                Multi-Tenant Enterprises
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-gray-400 text-lg sm:text-xl max-w-xl font-normal leading-relaxed"
            >
              Isolated tenant environments, Salesforce Cloud & SFMC connectors, approval-gated onboarding, and granular workspace permissions in one secure platform.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4 pt-2"
            >
              <Link
                href="/signup"
                className="px-7 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold text-base shadow-xl shadow-[#25D366]/25 hover:shadow-[#25D366]/40 transition-all flex items-center gap-2.5"
              >
                Onboard Your Company <ArrowRight size={18} />
              </Link>

              <Link
                href="/dashboard"
                className="px-6 py-3.5 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-base transition-all flex items-center gap-2"
              >
                Launch Demo App <ArrowUpRight size={18} />
              </Link>
            </motion.div>

            {/* Feature Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs text-gray-400"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#25D366]" /> Strict Tenant Isolation
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#25D366]" /> SFMC Journey Builder
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#25D366]" /> Sales Cloud Sync
              </div>
            </motion.div>
          </div>

          {/* Interactive Chat Mockup */}
          <div className="lg:col-span-5 flex justify-center pt-8 lg:pt-0">
            <ChatMockup />
          </div>
        </div>
      </section>

      {/* ── Multi-Tenant Security & Isolation Section ── */}
      <section id="architecture" className="relative z-10 py-24 bg-[#0D1322] border-t border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-[#25D366] font-bold text-xs uppercase tracking-widest px-3 py-1 rounded-full border border-[#25D366]/30 bg-[#25D366]/10">
              5-Layer Defense Model
            </span>
            <h2 className="font-[Syne] text-3xl sm:text-5xl font-extrabold text-white">
              Enterprise Tenant Security & Licensing Boundary
            </h2>
            <p className="text-gray-400 text-base sm:text-lg">
              Every client organization is completely isolated. User permissions are bounded strictly by tenant-purchased workspace licenses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-[#25D366]/50 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">Tenant Isolation</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Database records, WhatsApp webhook routes, and conversation threads are hard-scoped to each client’s unique tenant identifier.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-[#25D366]/50 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">Approval-Gated Access</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                No self-service tenant spam. Platform Super Admins review every signup request before tenant and user provisioning.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-[#25D366]/50 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <Layers size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">Workspace Licensing</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Granularly grant workspace products (SFMC, Sales Cloud) at the tenant level, then delegate user permissions safely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Core Workspace Modules Grid ── */}
      <section id="features" className="relative z-10 py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="font-[Syne] text-3xl sm:text-5xl font-extrabold text-white">
            Built for Modern Omnichannel Operations
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            Complete WhatsApp messaging suite integrated seamlessly with enterprise CRMs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <MessageSquare className="text-[#25D366]" />, title: 'Real-Time Chats', desc: 'Live WhatsApp webchats with automated response suggestions and media preview.' },
            { icon: <Cloud className="text-sky-400" />, title: 'SFMC Integration', desc: 'Journey Builder activities, Data Extension sync, and automated transactional messages.' },
            { icon: <Cloud className="text-indigo-400" />, title: 'Sales Cloud Connector', desc: 'Sync WhatsApp interactions directly to Salesforce Leads, Contacts, and Accounts.' },
            { icon: <Workflow className="text-purple-400" />, title: 'Automation Engine', desc: 'Trigger automated WhatsApp flows based on user actions or webhook events.' },
            { icon: <BarChart3 className="text-emerald-400" />, title: 'Analytics & Insights', desc: 'Track message delivery rates, read receipts, and agent response performance.' },
            { icon: <Zap className="text-amber-400" />, title: 'Fast Reply Hub', desc: 'Pre-approved message templates for rapid agent resolution and customer support.' },
            { icon: <Users2 className="text-rose-400" />, title: 'Contact Management', desc: 'Centralized database with custom metadata tagging and workspace filtering.' },
            { icon: <ShieldCheck className="text-teal-400" />, title: 'Platform Audit Logs', desc: 'Full audit log trail for tenant creation, user approvals, and security events.' },
          ].map((item, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                {item.icon}
              </div>
              <h4 className="text-base font-bold text-white">{item.title}</h4>
              <p className="text-gray-400 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/10 bg-[#060911] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#25D366] flex items-center justify-center text-black font-bold">
              W
            </div>
            <span className="font-[Syne] font-bold text-white text-base">WhatZupp SaaS v2.0</span>
          </div>
          <div className="text-xs text-gray-500">
            © {new Date().getFullYear()} WhatZupp SaaS. All rights reserved. Multi-Tenant Enterprise Edition.
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/login" className="hover:text-white">Login</Link>
            <Link href="/signup" className="hover:text-white">Request Access</Link>
            <Link href="/admin/dashboard" className="hover:text-white text-[#25D366]">Super Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}