'use client';

// src/components/app/ContactsView.tsx
import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import type { WorkspaceContact } from '@/types/workspace';
import { Search, Plus, Users, Edit2, Trash2, Phone, Mail, Building2, Briefcase, Globe, Users2 as UsersIcon, ShoppingBag, Zap } from 'lucide-react';

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
  const { activeWorkspace, activeContacts, addContact, updateContact, deleteContact } = useWorkspace();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<WorkspaceContact | null>(null);
  const [liveContacts, setLiveContacts] = useState<WorkspaceContact[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

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
            tags: c.salesforceObjectType ? [c.salesforceObjectType] : wsId === 'sfmc-ws-1' ? ['SFMC DE'] : ['Sales Cloud'],
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

  const displayContacts = liveContacts.length > 0 ? liveContacts : activeContacts;

  const filtered = displayContacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phoneNumber.includes(search) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 font-sans">
      
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Contacts
          </h2>
          <button
            onClick={() => { setEditingContact(null); setShowAddModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium shadow-sm transition-all hover:-translate-y-0.5"
            style={{ backgroundColor: activeWorkspace.color }}
          >
            <Plus size={18} /> Add Contact
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-colors"
            style={{ ':focus': { outlineColor: activeWorkspace.color, ringColor: activeWorkspace.color } } as any}
          />
        </div>
      </div>

      {/* Contact List */}
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
            <Users size={64} className="mb-6 opacity-30" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">No contacts {search ? 'found' : 'yet'}</h3>
            <p className="text-sm font-medium text-slate-500 mb-6 max-w-[300px] text-center">
              {search ? `Your search for "${search}" did not return any results.` : "Your workspace is empty. Create contacts to start sending campaigns and managing relationships."}
            </p>
            {!search && (
              <button
                onClick={() => { setEditingContact(null); setShowAddModal(true); }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold shadow-sm transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: activeWorkspace.color }}
              >
                <Plus size={18} /> Add Your First Contact
              </button>
            )}
          </div>

        ) : (
          filtered.map(contact => (
            <div 
              key={contact.id} 
              className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-md transition-shadow group relative"
            >
              <div className="flex items-start gap-4 mb-4">
                {/* Avatar */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 transition-colors"
                  style={{ backgroundColor: activeWorkspace.color + '15', color: activeWorkspace.color }}
                >
                  {contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-[15px] font-bold text-slate-900 truncate">
                    {contact.name}
                  </h3>
                  <p className="text-[13px] text-slate-500 truncate mt-0.5 font-medium">
                    {contact.company || 'No Company'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2.5 text-[13px] text-slate-600 font-medium">
                  <Phone size={14} className="text-slate-400" />
                  {contact.phoneNumber}
                </div>
                {contact.email && (
                  <div className="flex items-center gap-2.5 text-[13px] text-slate-600 font-medium truncate">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
              </div>

              {contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-50">
                  {contact.tags.map(tag => (
                    <span 
                      key={tag} 
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: activeWorkspace.color + '10', color: activeWorkspace.color }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Hover Actions */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button 
                  onClick={() => { setEditingContact(contact); setShowAddModal(true); }} 
                  className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  title="Edit Contact"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={async () => {
                    if (confirm('Delete this contact?')) {
                      await deleteContact(contact.id);
                      setRefreshKey(prev => prev + 1);
                    }
                  }} 
                  className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
                  title="Delete Contact"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Contact Modal */}
      {showAddModal && (
        <ContactModal
          workspace={activeWorkspace}
          existingContact={editingContact}
          onSave={async (data) => {
            if (editingContact) {
              await updateContact(editingContact.id, data);
            } else {
              await addContact({ ...data, workspaceId: activeWorkspace.id });
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
function ContactModal({ workspace, existingContact, onSave, onClose }: {
  workspace: { id: string; color: string; name: string; icon: string };
  existingContact: WorkspaceContact | null;
  onSave: (data: Omit<WorkspaceContact, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existingContact?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(existingContact?.phoneNumber || '');
  const [email, setEmail] = useState(existingContact?.email || '');
  const [company, setCompany] = useState(existingContact?.company || '');
  const [tagsStr, setTagsStr] = useState(existingContact?.tags.join(', ') || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phoneNumber.trim()) return;
    onSave({
      name: name.trim(),
      phoneNumber: phoneNumber.replace(/[^0-9]/g, ''),
      email: email.trim(),
      company: company.trim(),
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      workspaceId: existingContact?.workspaceId || workspace.id,
      avatar: '',
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <h3 className="text-xl font-bold text-slate-900 mb-6 tracking-tight">
          {existingContact ? 'Edit Contact' : 'Add Contact'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Full Name *</label>
            <input 
              value={name} onChange={e => setName(e.target.value)} 
              placeholder="John Doe" required 
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all"
            />
          </div>
          
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Phone Number *</label>
            <input 
              value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} 
              placeholder="1234567890" required 
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all"
            />
          </div>
          
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Email</label>
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)} 
              placeholder="john@company.com" 
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all"
            />
          </div>
          
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Company</label>
            <input 
              value={company} onChange={e => setCompany(e.target.value)} 
              placeholder="Company name" 
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all"
            />
          </div>
          
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Tags (comma-separated)</label>
            <input 
              value={tagsStr} onChange={e => setTagsStr(e.target.value)} 
              placeholder="VIP, Marketing" 
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-xl mt-2" style={{ backgroundColor: workspace.color + '10' }}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: workspace.color }}>
              {renderIcon(workspace.icon, { size: 14 })}
            </span>
            <span className="text-[13px] font-medium text-slate-600">
              Workspace: <strong className="text-slate-900">{workspace.name}</strong>
            </span>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: workspace.color }}
            >
              {existingContact ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
