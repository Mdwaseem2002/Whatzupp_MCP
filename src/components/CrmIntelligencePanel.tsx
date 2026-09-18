'use client';

// src/components/CrmIntelligencePanel.tsx
// Zone 4: CRM Intelligence Panel (Width: 380px) for WhatZupp Enterprise CRM Chat Platform
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Mail, MessageSquare, MoreHorizontal, Copy, Check, ExternalLink,
  Sparkles, RefreshCw, Shield, MapPin, Building, Briefcase, User, Star, ChevronRight, Edit3, X, Save
} from 'lucide-react';
import { Contact } from '@/types';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

interface CrmIntelligencePanelProps {
  contact: Contact | null;
  onClose?: () => void;
  onUpdateContact?: (updated: Contact) => void;
}

export default function CrmIntelligencePanel({ contact, onClose, onUpdateContact }: CrmIntelligencePanelProps) {
  const { activeWorkspace } = useWorkspace();
  const isSalesCloud = activeWorkspace?.type === 'salescloud' || activeWorkspace?.id === 'salescloud-ws-1';

  const [activeTab, setActiveTab] = useState<'contact' | 'crm' | 'notes' | 'activity'>('contact');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable local fields for the selected contact
  const [editFields, setEditFields] = useState({
    phone: '',
    email: '',
    company: '',
    designation: '',
    location: '',
    tags: ''
  });

  // Sync edit fields whenever the selected contact or active workspace changes
  useEffect(() => {
    if (contact) {
      const cleanName = contact.name.toLowerCase().replace(/[^a-z0-9]/g, '.');
      const comp = contact.company || (contact.name.includes('WhatZupp') ? 'WhatZupp Enterprise' : 'Pentacloud Consulting');
      const defaultEmail = (contact as any).email || `${cleanName}@${comp.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      const defaultPhone = contact.phoneNumber ? (contact.phoneNumber.startsWith('+') ? contact.phoneNumber : `+${contact.phoneNumber}`) : '+91 99523 74972';
      const defaultTagsStr = isSalesCloud ? 'Lead, Sales Cloud, VIP' : 'Subscriber, SFMC, VIP';

      setEditFields({
        phone: defaultPhone,
        email: defaultEmail,
        company: comp,
        designation: (contact as any).designation || (contact.name.includes('Contact') ? 'Enterprise Lead' : 'Sales Consultant'),
        location: (contact as any).location || 'Bengaluru, India',
        tags: (contact as any).tags ? (contact as any).tags.join(', ') : defaultTagsStr
      });
      setIsEditing(false);
    }
  }, [contact, isSalesCloud]);

  if (!contact) {
    return (
      <div className="w-[320px] h-full bg-white border-l border-slate-200/80 flex flex-col items-center justify-center p-5 text-center shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3 text-[#00C853]">
          <Shield size={24} />
        </div>
        <h3 className="text-sm font-extrabold text-slate-900 mb-1">CRM Intelligence Panel</h3>
        <p className="text-[11px] text-slate-500 max-w-[220px] leading-relaxed">
          Select a contact conversation to inspect real-time Salesforce records & AI insights.
        </p>
      </div>
    );
  }

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRefreshSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200);
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    if (onUpdateContact && contact) {
      onUpdateContact({
        ...contact,
        phoneNumber: editFields.phone.replace(/^\+/, ''),
        email: editFields.email,
        company: editFields.company,
        designation: editFields.designation,
        location: editFields.location,
        tags: editFields.tags.split(',').map(t => t.trim()).filter(Boolean)
      } as any);
    }
  };

  const initials = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'MW';

  // Derived dynamic fields from contact object
  const cleanName = contact.name.toLowerCase().replace(/[^a-z0-9]/g, '.');
  const compName = editFields.company || (contact as any).company || 'Pentacloud Consulting';
  const displayEmail = editFields.email || (contact as any).email || `${cleanName}@${compName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
  const displayPhone = editFields.phone || (contact.phoneNumber ? (contact.phoneNumber.startsWith('+') ? contact.phoneNumber : `+${contact.phoneNumber}`) : '+91 99523 74972');
  const displayDesignation = editFields.designation || (contact as any).designation || 'Sales Consultant';
  const displayLocation = editFields.location || (contact as any).location || 'Bengaluru, India';
  const tagList = editFields.tags ? editFields.tags.split(',').map(t => t.trim()).filter(Boolean) : ['Lead', 'Sales Cloud', 'VIP'];

  // Salesforce Dynamic Integration Details
  const leadStatus = (contact as any).salesforceObjectType === 'Contact' ? 'Converted' : 'Qualified';
  const sfAccount = compName;
  const sfContact = contact.name;
  const sfOpportunity = (contact as any).opportunityName || `New Business - ${contact.name.split(' ')[0]} ${new Date().getFullYear()}`;
  const sfOwner = (contact as any).ownerName || 'Waseem';
  const sfSyncUpdated = (contact as any).lastSyncedAt
    ? new Date((contact as any).lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Today, 01:10 PM';

  return (
    <aside className="w-[320px] h-full bg-white border-l border-slate-200/80 flex flex-col shrink-0 font-sans shadow-[-4px_0_20px_rgba(15,23,42,0.03)] z-20 overflow-hidden">
      
      {/* ─── Top Tabs ─── */}
      <div className="px-4 pt-2.5 pb-0 border-b border-slate-200/80 bg-slate-50/60 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
          {(['contact', 'crm', 'notes', 'activity'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 px-0.5 transition-all relative capitalize ${
                activeTab === tab
                  ? 'text-[#00C853] font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'notes' ? 'Notes (3)' : tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="crm-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00C853] rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Panel Content Body ─── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-thin">
        
        {/* Contact Card Header */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 shadow-xs flex flex-col items-center text-center relative group">
          <div className="relative mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#052E2B] via-[#00C853] to-[#00E676] flex items-center justify-center text-white text-base font-black shadow-md ring-2 ring-emerald-500/10">
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00C853] border-2 border-white ring-1 ring-emerald-500/20" />
          </div>

          <div className="flex items-center gap-1 justify-center">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{contact.name}</h3>
            <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={14} /></button>
          </div>
          <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{displayDesignation} | {compName}</p>
          <div className="flex items-center gap-1 mt-0.5 text-[10px] font-extrabold text-[#00C853]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse" /> Online
          </div>

          {/* Quick Action Pills */}
          <div className="grid grid-cols-4 gap-1.5 w-full mt-3 pt-3 border-t border-slate-200/60">
            <a
              href={`tel:${displayPhone}`}
              className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-white border border-slate-200/80 hover:border-[#00C853]/40 hover:bg-emerald-50/50 transition-all text-slate-700 shadow-2xs"
            >
              <Phone size={13} className="text-[#00C853]" />
              <span className="text-[9px] font-bold">Call</span>
            </a>
            <a
              href={`mailto:${displayEmail}`}
              className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-white border border-slate-200/80 hover:border-[#00C853]/40 hover:bg-emerald-50/50 transition-all text-slate-700 shadow-2xs"
            >
              <Mail size={13} className="text-blue-500" />
              <span className="text-[9px] font-bold">Email</span>
            </a>
            <a
              href={`https://wa.me/${contact.phoneNumber.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-white border border-slate-200/80 hover:border-[#00C853]/40 hover:bg-emerald-50/50 transition-all text-slate-700 shadow-2xs"
            >
              <MessageSquare size={13} className="text-[#00C853]" />
              <span className="text-[9px] font-bold">WhatsApp</span>
            </a>
            <button className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-white border border-slate-200/80 hover:border-[#00C853]/40 hover:bg-emerald-50/50 transition-all text-slate-700 shadow-2xs">
              <MoreHorizontal size={13} className="text-slate-400" />
              <span className="text-[9px] font-bold">More</span>
            </button>
          </div>
        </div>

        {/* About / Field Info Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">About</h4>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-extrabold text-[#00C853] hover:underline flex items-center gap-1"
            >
              {isEditing ? <X size={12} /> : <Edit3 size={12} />}
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditing ? (
            <div className="bg-slate-50 rounded-2xl border border-emerald-200 p-3.5 space-y-3 shadow-2xs text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Phone</label>
                <input
                  type="text"
                  value={editFields.phone}
                  onChange={e => setEditFields({ ...editFields, phone: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Email</label>
                <input
                  type="email"
                  value={editFields.email}
                  onChange={e => setEditFields({ ...editFields, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Company</label>
                <input
                  type="text"
                  value={editFields.company}
                  onChange={e => setEditFields({ ...editFields, company: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Designation</label>
                <input
                  type="text"
                  value={editFields.designation}
                  onChange={e => setEditFields({ ...editFields, designation: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Location</label>
                <input
                  type="text"
                  value={editFields.location}
                  onChange={e => setEditFields({ ...editFields, location: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={editFields.tags}
                  onChange={e => setEditFields({ ...editFields, tags: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                />
              </div>

              <button
                onClick={handleSaveEdit}
                className="w-full py-2 rounded-xl bg-[#00C853] hover:bg-[#00E676] text-white font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <Save size={13} /> Save Contact Details
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5 shadow-2xs text-xs">
              
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Phone</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 font-mono">{displayPhone}</span>
                  <button
                    onClick={() => copyToClipboard(displayPhone, 'phone')}
                    className="text-slate-400 hover:text-slate-700 p-0.5"
                    title="Copy Phone"
                  >
                    {copiedField === 'phone' ? <Check size={13} className="text-[#00C853]" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Email</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 truncate max-w-[160px]">{displayEmail}</span>
                  <button
                    onClick={() => copyToClipboard(displayEmail, 'email')}
                    className="text-slate-400 hover:text-slate-700 p-0.5"
                    title="Copy Email"
                  >
                    {copiedField === 'email' ? <Check size={13} className="text-[#00C853]" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Company</span>
                <span className="font-bold text-slate-900">{compName}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Designation</span>
                <span className="font-bold text-slate-900">{displayDesignation}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Location</span>
                <span className="font-bold text-slate-900">{displayLocation}</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500 font-semibold">Tags</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {tagList.map((tag, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                        tag.toLowerCase() === 'vip'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : tag.toLowerCase().includes('sales')
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Salesforce CRM / SFMC Intelligence Widget */}
        {isSalesCloud ? (
          /* ─── Sales Cloud Workspace View ─── */
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5 shadow-2xs relative overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 absolute top-0 left-0 right-0" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-xs">
                  ☁️
                </div>
                <h4 className="text-xs font-black text-slate-900">Salesforce Sales Cloud</h4>
              </div>

              <a
                href="https://salesforce.com"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-extrabold text-blue-600 hover:underline flex items-center gap-0.5"
              >
                View in Salesforce <ExternalLink size={11} />
              </a>
            </div>

            <div className="space-y-1.5 text-xs pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Lead Status</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[9px] border border-emerald-200/80">
                  {leadStatus}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Account</span>
                <span className="font-bold text-slate-900 truncate max-w-[150px] text-right">{sfAccount}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Contact</span>
                <span className="font-bold text-blue-600 hover:underline cursor-pointer">{sfContact}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Opportunity</span>
                <span className="font-bold text-slate-900 truncate max-w-[150px] text-right">{sfOpportunity}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Owner</span>
                <span className="font-bold text-slate-900">{sfOwner}</span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                <span className="text-slate-400 font-medium">Sync Updated</span>
                <button
                  onClick={handleRefreshSync}
                  className="text-slate-500 hover:text-slate-800 font-mono font-semibold flex items-center gap-1"
                >
                  <RefreshCw size={11} className={isSyncing ? 'animate-spin text-blue-600' : ''} /> {sfSyncUpdated}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ─── Marketing Cloud (SFMC) Workspace View ─── */
          <div className="bg-white rounded-2xl border border-emerald-200/80 p-3.5 space-y-2.5 shadow-2xs relative overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 absolute top-0 left-0 right-0" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-black text-xs">
                  ☁️
                </div>
                <h4 className="text-xs font-black text-slate-900">Marketing Cloud (SFMC)</h4>
              </div>

              <a
                href="https://mc.exacttarget.com"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-extrabold text-emerald-600 hover:underline flex items-center gap-0.5"
              >
                View Data Extension <ExternalLink size={11} />
              </a>
            </div>

            <div className="space-y-1.5 text-xs pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Subscriber Status</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[9px] border border-emerald-200/80">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Subscriber Key</span>
                <span className="font-mono font-bold text-slate-900 truncate max-w-[150px] text-right">
                  {contact.phoneNumber ? contact.phoneNumber.replace(/[^0-9]/g, '') : '919952374972'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Data Extension</span>
                <span className="font-bold text-emerald-700 truncate max-w-[150px] text-right">
                  WhatZupp_Contacts_DE
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Journey Status</span>
                <span className="font-bold text-slate-900 truncate max-w-[150px] text-right">
                  Pentacloud Onboarding
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Channel</span>
                <span className="font-bold text-slate-900">WhatsApp / SFMC</span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                <span className="text-slate-400 font-medium">DE Sync Updated</span>
                <button
                  onClick={handleRefreshSync}
                  className="text-slate-500 hover:text-slate-800 font-mono font-semibold flex items-center gap-1"
                >
                  <RefreshCw size={11} className={isSyncing ? 'animate-spin text-emerald-600' : ''} /> {sfSyncUpdated}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Assistant Widget */}
        <div className="bg-gradient-to-br from-[#F3ECFF] to-[#ECE4FF] border border-purple-200/80 rounded-2xl p-4 space-y-2 shadow-xs relative overflow-hidden group cursor-pointer hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs">
              <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles size={14} />
              </div>
              <span>AI Assistant</span>
            </div>
            <ChevronRight size={16} className="text-purple-600 group-hover:translate-x-1 transition-transform" />
          </div>

          <p className="text-[11px] text-purple-800 font-medium leading-relaxed">
            Get AI-powered insights, draft replies, and create CRM records instantly for {contact.name}.
          </p>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button className="px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-purple-900 text-[10px] font-extrabold border border-purple-200/60 shadow-2xs text-left truncate">
              ✨ Summarize Chat
            </button>
            <button className="px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-purple-900 text-[10px] font-extrabold border border-purple-200/60 shadow-2xs text-left truncate">
              ⚡ Generate Reply
            </button>
          </div>
        </div>

      </div>
    </aside>
  );
}
