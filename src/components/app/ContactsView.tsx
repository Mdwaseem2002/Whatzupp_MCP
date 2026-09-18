'use client';

// src/components/app/ContactsView.tsx
// World-Class Enterprise SaaS Contacts Screen (SFMC & Sales Cloud Integrated)

import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import type { WorkspaceContact } from '@/types/workspace';
import {
  Search, Plus, Users, Edit2, Trash2, Phone, Mail, Building2, Briefcase, Globe,
  Users2 as UsersIcon, ShoppingBag, Zap, MessageSquare, ExternalLink, Copy, Check,
  Sparkles, Filter, LayoutGrid, List, MoreHorizontal, ShieldCheck, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ContactDetailsPage from './ContactDetailsPage';
import { LABEL_COLORS } from '@/types/workspace';
// import ContactProfileDrawer from './ContactProfileDrawer'; // Deprecated

const renderIcon = (name: string, props: any = { size: 16 }) => {
  switch (name) {
    case 'Building2': return <Building2 {...props} />;
    case 'Briefcase': return <Briefcase {...props} />;
    case 'Globe': return <Globe {...props} />;
    case 'Users2': return <UsersIcon {...props} />;
    case 'ShoppingBag': return <ShoppingBag {...props} />;
    case 'Zap': return <Zap {...props} />;
    default: return <Building2 {...props} />;
  }
};

export default function ContactsView() {
  const { activeWorkspace, activeContacts, setActiveScreen, addContact, updateContact, deleteContact, state, setConversationLabels } = useWorkspace();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<WorkspaceContact | null>(null);
  const [liveContacts, setLiveContacts] = useState<WorkspaceContact[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const contactIdParam = searchParams.get('contact');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch live workspace contacts
  useEffect(() => {
    if (!activeWorkspace) return;

    const wsId = activeWorkspace.id;
    const isSalesCloud = activeWorkspace.type === 'salescloud' || activeWorkspace.platform === 'sales_cloud' || wsId === 'salescloud-ws-1';
    const wsKey = isSalesCloud
      ? (process.env.NEXT_PUBLIC_WORKSPACE_SALESCLOUD_API_KEY || 'salescloud-ws-key-secret')
      : (process.env.NEXT_PUBLIC_WORKSPACE_SFMC_API_KEY || 'sfmc-secret-key-123');

    fetch(`/api/workspaces/${wsId}/contacts`, {
      headers: { 'X-Workspace-Key': wsKey },
      cache: 'no-store'
    })
      .then(res => res.json())
      .then(data => {
        if (data.contacts && Array.isArray(data.contacts)) {
          const formatted: WorkspaceContact[] = data.contacts.map((c: any) => ({
            id: c.id || c.salesforceRecordId || c.phoneNumber,
            name: c.name,
            phoneNumber: c.phoneNumber,
            email: c.email || '',
            company: c.company || (wsId === 'sfmc-ws-1' ? 'SFMC Subscriber' : 'Sales Cloud'),
            tags: c.salesforceObjectType ? [c.salesforceObjectType] : wsId === 'sfmc-ws-1' ? ['SFMC DE', 'VIP'] : ['Sales Cloud', 'Lead'],
            workspaceId: wsId,
            createdAt: c.lastSyncedAt || new Date().toISOString(),
          }));
          setLiveContacts(formatted);
        } else {
          setLiveContacts([]);
        }
      })
      .catch(() => setLiveContacts([]));
  }, [activeWorkspace?.id, activeWorkspace?.platform, activeWorkspace?.type, refreshKey]);

  if (!activeWorkspace) return null;

  const displayContacts = useMemo(() => {
    if (liveContacts.length === 0) return activeContacts;
    
    // Merge live contacts with local active contacts to preserve local edits (like tags)
    const mergedMap = new Map<string, WorkspaceContact>();
    
    // First, add all live contacts
    liveContacts.forEach(c => {
      mergedMap.set(c.id, c);
    });

    // Then, overlay any local edits or add missing local contacts
    activeContacts.forEach(localC => {
      if (mergedMap.has(localC.id)) {
        const liveC = mergedMap.get(localC.id)!;
        mergedMap.set(localC.id, {
          ...liveC,
          name: localC.name !== liveC.name ? localC.name : liveC.name,
          tags: localC.tags?.length && localC.tags.join(',') !== liveC.tags.join(',') ? localC.tags : liveC.tags,
          company: localC.company || liveC.company,
          email: localC.email || liveC.email
        });
      } else {
        mergedMap.set(localC.id, localC);
      }
    });

    return Array.from(mergedMap.values());
  }, [liveContacts, activeContacts]);

  const viewingProfile = useMemo(() => {
    if (!contactIdParam) return null;
    return displayContacts.find(c => c.id === contactIdParam) || null;
  }, [displayContacts, contactIdParam]);

  const handleSetViewingProfile = (contact: WorkspaceContact | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (contact) {
      params.set('contact', contact.id);
    } else {
      params.delete('contact');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey(prev => prev + 1);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Tag options
  const allTags = Array.from(
    new Set(displayContacts.flatMap(c => c.tags))
  );

  const filtered = displayContacts.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phoneNumber.includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.company && c.company.toLowerCase().includes(search.toLowerCase()));

    const matchesTag = selectedTag === 'all' || c.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  const accentColor = '#00C853';

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] font-sans flex flex-col h-full">
      
      {viewingProfile ? (
        <div className="p-6">
          <ContactDetailsPage 
            contact={viewingProfile} 
            onBack={() => handleSetViewingProfile(null)}
            onStartChat={(c) => {
              handleSetViewingProfile(null);
              setActiveScreen('chats');
            }}
          />
        </div>
      ) : (
        <>
      {/* ─── Top Header Section ─── */}
      <div className="px-6 py-5 bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-[0_2px_12px_rgba(15,23,42,0.02)] shrink-0">
        
        {/* Row 1: Title & Telemetry Metrics + Add Contact Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Contacts & Subscribers
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#00C853] text-[10px] font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse" />
                {activeWorkspace.type === 'salescloud' ? 'Sales Cloud Sync' : 'SFMC DE Live'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage enterprise subscribers, campaign contacts, and real-time CRM records.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-3">
            
            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-emerald-50 hover:border-emerald-300 text-slate-600 hover:text-[#00C853] transition-all shadow-2xs"
              title="Refresh Contacts"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#00C853]' : ''} />
            </button>

            {/* Add Contact Button */}
            <button
              onClick={() => { setEditingContact(null); setShowAddModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #00C853 0%, #00E676 100%)',
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Contact</span>
            </button>
          </div>

        </div>

        {/* Row 2: Search Input, Tag Filters, View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, or company..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00C853]/30 focus:border-[#00C853] focus:bg-white transition-all shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right Toolbar: Tag Filters & Grid/Table Toggle */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            
            {/* Tag Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  selectedTag === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({displayContacts.length})
              </button>

              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    selectedTag === tag
                      ? 'bg-[#00C853] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* View Mode Toggle (Grid / Table) */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table List View"
              >
                <List size={15} />
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* ─── Main Content Display Area ─── */}
      <div className="p-6 flex-1">
        {filtered.length === 0 ? (
          
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 shadow-2xs">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-[#00C853] flex items-center justify-center mb-4 border border-emerald-100 shadow-sm">
              <Users size={32} />
            </div>
            <h3 className="text-base font-extrabold text-slate-800 mb-1">
              No contacts {search ? 'matching search' : 'in this workspace'}
            </h3>
            <p className="text-xs font-medium text-slate-500 mb-6 max-w-xs text-center leading-relaxed">
              {search
                ? `No contacts found for "${search}". Try adjusting your keywords or clearing filters.`
                : "Your subscriber dataset is empty. Add new contacts to sync with SFMC Data Extensions."}
            </p>
            {!search && (
              <button
                onClick={() => { setEditingContact(null); setShowAddModal(true); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-md transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #00C853 0%, #00E676 100%)' }}
              >
                <Plus size={16} /> Add First Contact
              </button>
            )}
          </div>

        ) : viewMode === 'grid' ? (
          
          /* ═══ GRID CARDS VIEW ═══ */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(contact => {
              const initials = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'CT';

              return (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleSetViewingProfile(contact)}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-xl hover:border-emerald-500/30 transition-all duration-300 group relative flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    {/* Header Row: Avatar & Contact Info */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#052E2B] via-[#00C853] to-[#00E676] flex items-center justify-center font-black text-white text-base shadow-sm ring-2 ring-emerald-500/10">
                          {initials}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00C853] border-2 border-white" />
                      </div>

                      <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="text-sm font-extrabold text-slate-900 truncate leading-snug group-hover:text-[#00C853] transition-colors">
                          {contact.name}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">
                          {contact.company || 'Pentacloud Consulting'}
                        </p>
                      </div>
                    </div>

                    {/* Contact Details Rows */}
                    <div className="space-y-1.5 mb-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                      
                      {/* Phone */}
                      <div className="flex items-center justify-between text-slate-700 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Phone size={13} className="text-[#00C853]" />
                          <span>{contact.phoneNumber}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy(contact.phoneNumber, `phone-${contact.id}`); }}
                          className="text-slate-400 hover:text-slate-700 p-1"
                          title="Copy phone"
                        >
                          {copiedId === `phone-${contact.id}` ? <Check size={12} className="text-[#00C853]" /> : <Copy size={12} />}
                        </button>
                      </div>

                      {/* Email */}
                      {contact.email && (
                        <div className="flex items-center justify-between text-slate-700 text-[11px] pt-1 border-t border-slate-200/50">
                          <div className="flex items-center gap-1.5 font-medium truncate max-w-[190px]">
                            <Mail size={13} className="text-blue-500 shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(contact.email, `email-${contact.id}`); }}
                            className="text-slate-400 hover:text-slate-700 p-1 shrink-0"
                            title="Copy email"
                          >
                            {copiedId === `email-${contact.id}` ? <Check size={12} className="text-[#00C853]" /> : <Copy size={12} />}
                          </button>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Footer Row: Tags & Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map(tag => (
                        <span
                          key={tag}
                          className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border ${
                            tag.toLowerCase().includes('vip')
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

                    {/* Action Icon Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveScreen('chats'); }}
                        className="p-1.5 rounded-lg bg-emerald-50 text-[#00C853] hover:bg-[#00C853] hover:text-white transition-all"
                        title="Start Chat"
                      >
                        <MessageSquare size={13} />
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingContact(contact); setShowAddModal(true); }}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                        title="Edit Contact"
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Delete ${contact.name}?`)) {
                            const isSalesCloud = activeWorkspace.type === 'salescloud' || activeWorkspace.platform === 'sales_cloud' || activeWorkspace.id === 'salescloud-ws-1';
                            const wsKey = isSalesCloud
                              ? (process.env.NEXT_PUBLIC_WORKSPACE_SALESCLOUD_API_KEY || 'salescloud-ws-key-secret')
                              : (process.env.NEXT_PUBLIC_WORKSPACE_SFMC_API_KEY || 'sfmc-secret-key-123');

                            try {
                              const targetId = contact.id;
                              await fetch(`/api/workspaces/${activeWorkspace.id}/contacts?id=${encodeURIComponent(targetId)}`, {
                                method: 'DELETE',
                                headers: { 'X-Workspace-Key': wsKey }
                              });
                            } catch (e) {
                              console.error('Delete workspace contact error:', e);
                            }
                            try { await deleteContact(contact.id); } catch(e) { /* ignore generic API errors */ }
                            setRefreshKey(prev => prev + 1);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
                        title="Delete Contact"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                </motion.div>
              );
            })}
          </div>

        ) : (

          /* ═══ DATATABLE LIST VIEW ═══ */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Subscriber Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Tags / DE</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map(contact => {
                  const initials = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'CT';

                  return (
                    <tr key={contact.id} onClick={() => handleSetViewingProfile(contact)} className="hover:bg-slate-50/80 transition-colors cursor-pointer">
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#052E2B] to-[#00C853] flex items-center justify-center font-bold text-white text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block">{contact.name}</span>
                            <span className="text-[10px] text-slate-400 font-semibold block">ID: {contact.id.slice(-8)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {contact.phoneNumber}
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {contact.email || '—'}
                      </td>

                      {/* Company */}
                      <td className="py-3 px-4 text-slate-700 font-semibold">
                        {contact.company || 'Pentacloud Consulting'}
                      </td>

                      {/* Tags */}
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {contact.tags.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded bg-emerald-50 text-[#00C853] font-bold text-[10px] border border-emerald-200/60">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveScreen('chats'); }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-[#00C853] hover:text-white text-[#00C853] font-extrabold text-[11px] transition-all"
                          >
                            Chat
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingContact(contact); setShowAddModal(true); }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        )}
      </div>

        </>
      )}

      {showAddModal && (
        <ContactModal
          workspace={activeWorkspace}
          existingContact={editingContact}
          workspaceLabels={state.chatLabels.filter(l => l.workspaceId === activeWorkspace.id)}
          initialLabelIds={editingContact ? (state.conversationLabels[editingContact.id] || []) : []}
          onSave={async (data, selectedLabelIds) => {
            const isSalesCloud = activeWorkspace.type === 'salescloud' || activeWorkspace.platform === 'sales_cloud' || activeWorkspace.id === 'salescloud-ws-1';
            const wsKey = isSalesCloud
              ? (process.env.NEXT_PUBLIC_WORKSPACE_SALESCLOUD_API_KEY || 'salescloud-ws-key-secret')
              : (process.env.NEXT_PUBLIC_WORKSPACE_SFMC_API_KEY || 'sfmc-secret-key-123');

            // Resolve label IDs to label names for Salesforce storage
            const wsLabels = state.chatLabels.filter(l => l.workspaceId === activeWorkspace.id);
            const labelNames = selectedLabelIds.map(id => wsLabels.find(l => l.id === id)?.name).filter(Boolean).join(', ');

            try {
              if (editingContact) {
                const targetId = editingContact.id;
                // Update via workspace-specific Salesforce API
                await fetch(`/api/workspaces/${activeWorkspace.id}/contacts`, {
                  method: 'PATCH',
                  headers: { 'X-Workspace-Key': wsKey, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: targetId, ...data, labels: labelNames })
                });
                // Update local state only (skip generic /api/user/contacts for Sales Cloud)
                try { await updateContact(editingContact.id, data); } catch(e) { /* ignore generic API errors for live workspaces */ }
                await setConversationLabels(targetId, selectedLabelIds);
              } else {
                // Create via workspace-specific Salesforce API
                const wsRes = await fetch(`/api/workspaces/${activeWorkspace.id}/contacts`, {
                  method: 'POST',
                  headers: { 'X-Workspace-Key': wsKey, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...data, labels: labelNames })
                });
                const wsJson = await wsRes.json();
                // Use the ID returned from the workspace API if available
                const newContactId = wsJson?.contact?.id || wsJson?.contact?.salesforceRecordId || `contact-${Date.now()}`;
                try {
                  const newContact = await addContact({ ...data, workspaceId: activeWorkspace.id });
                  await setConversationLabels(newContact.id, selectedLabelIds);
                } catch(e) {
                  // If generic API fails (e.g. Sales Cloud), assign labels using the workspace API ID
                  await setConversationLabels(newContactId, selectedLabelIds);
                }
              }
            } catch (e) {
              console.error('Save workspace contact error:', e);
            }
            setShowAddModal(false);
            setEditingContact(null);
            setRefreshKey(prev => prev + 1);
          }}
          onClose={() => { setShowAddModal(false); setEditingContact(null); }}
        />
      )}
    </div>
  );
}

// ─── Contact Modal ───
function ContactModal({ workspace, existingContact, workspaceLabels, initialLabelIds, onSave, onClose }: {
  workspace: { id: string; color: string; name: string; icon: string };
  existingContact: WorkspaceContact | null;
  workspaceLabels: any[];
  initialLabelIds: string[];
  onSave: (data: Omit<WorkspaceContact, 'id' | 'createdAt'>, selectedLabelIds: string[]) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existingContact?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(existingContact?.phoneNumber || '');
  const [email, setEmail] = useState(existingContact?.email || '');
  const [company, setCompany] = useState(existingContact?.company || '');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(initialLabelIds);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phoneNumber.trim()) return;
    onSave({
      name: name.trim(),
      phoneNumber: phoneNumber.replace(/[^0-9]/g, ''),
      email: email.trim(),
      company: company.trim(),
      tags: [],
      workspaceId: existingContact?.workspaceId || workspace.id,
      avatar: '',
    }, selectedLabelIds);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-slate-100 font-sans"
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#00C853] flex items-center justify-center font-bold">
              <Users size={18} />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              {existingContact ? 'Edit Subscriber' : 'Add New Subscriber'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">Full Name *</label>
            <input 
              value={name} onChange={e => setName(e.target.value)} 
              placeholder="Mohamed Waseem" required 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C853]/30 focus:border-[#00C853] focus:bg-white transition-all"
            />
          </div>
          
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">Phone Number *</label>
            <input 
              value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} 
              placeholder="919952374972" required 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#00C853]/30 focus:border-[#00C853] focus:bg-white transition-all"
            />
          </div>
          
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)} 
              placeholder="waseem@pentacloud.com" 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C853]/30 focus:border-[#00C853] focus:bg-white transition-all"
            />
          </div>
          
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">Company</label>
            <input 
              value={company} onChange={e => setCompany(e.target.value)} 
              placeholder="Pentacloud Consulting" 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C853]/30 focus:border-[#00C853] focus:bg-white transition-all"
            />
          </div>
          
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-2">Labels</label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[50px]">
              {workspaceLabels.map(label => {
                const isSelected = selectedLabelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedLabelIds(prev => prev.filter(id => id !== label.id));
                      } else {
                        setSelectedLabelIds(prev => [...prev, label.id]);
                      }
                    }}
                    className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md tracking-wide transition-all ${
                      isSelected 
                        ? 'text-white shadow-sm ring-1 ring-black/10' 
                        : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                    }`}
                    style={{ backgroundColor: isSelected ? (LABEL_COLORS as any)[label.color] || '#25D366' : undefined }}
                  >
                    {label.name}
                  </button>
                );
              })}
              {workspaceLabels.length === 0 && (
                <span className="text-xs text-slate-400 font-medium italic">No labels available in this workspace.</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-xs">
            <span className="w-6 h-6 rounded-lg bg-[#00C853] flex items-center justify-center text-white shrink-0">
              {renderIcon(workspace.icon, { size: 13 })}
            </span>
            <span className="text-slate-600 text-[11px] font-medium">
              Target Workspace: <strong className="text-slate-900 font-bold">{workspace.name}</strong>
            </span>
          </div>
          
          <div className="flex gap-2.5 pt-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2 rounded-xl text-white text-xs font-extrabold shadow-sm transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #00C853 0%, #00E676 100%)' }}
            >
              {existingContact ? 'Save Changes' : 'Add Subscriber'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
