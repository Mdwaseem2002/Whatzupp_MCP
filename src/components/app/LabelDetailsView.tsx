'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, Search, Megaphone, Users, Download, X, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { LABEL_COLORS } from '@/types/workspace';

export default function LabelDetailsView() {
  const { state, viewLabelDetails, setConversationLabels } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  const label = state.chatLabels.find(l => l.id === state.activeLabelId);
  
  const contactsWithLabel = useMemo(() => {
    if (!label) return [];
    return state.contacts.filter(c => (state.conversationLabels[c.id] || []).includes(label.id));
  }, [state.contacts, state.conversationLabels, label]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contactsWithLabel;
    const query = searchQuery.toLowerCase();
    return contactsWithLabel.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.phoneNumber.includes(query)
    );
  }, [contactsWithLabel, searchQuery]);

  if (!label) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F8FAFC]">
        <p className="text-gray-500">Label not found.</p>
      </div>
    );
  }

  const handleToggleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length && filteredContacts.length > 0) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleToggleSelect = (contactId: string) => {
    const next = new Set(selectedContacts);
    if (next.has(contactId)) next.delete(contactId);
    else next.add(contactId);
    setSelectedContacts(next);
  };

  const handleRemoveLabel = (contactId: string) => {
    if (!confirm('Remove this label from the contact?')) return;
    const currentLabels = state.conversationLabels[contactId] || [];
    setConversationLabels(contactId, currentLabels.filter(id => id !== label.id));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200/80 px-8 py-6 shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <button 
              onClick={() => viewLabelDetails(null)}
              className="flex items-center gap-1.5 text-[13px] font-bold text-gray-400 hover:text-gray-700 transition-colors mb-3"
            >
              <ChevronLeft size={16} /> Back to Labels
            </button>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <span className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: LABEL_COLORS[label.color] }} />
              {label.name}
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">{contactsWithLabel.length} Conversations</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition-all text-[13px] border border-gray-200/80 shadow-sm">
              <Megaphone size={15} className="text-gray-400" /> Broadcast
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition-all text-[13px] border border-gray-200/80 shadow-sm">
              <Users size={15} className="text-gray-400" /> Assign
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition-all text-[13px] border border-gray-200/80 shadow-sm">
              <Download size={15} className="text-gray-400" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Stats & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-4">
              <div className="bg-white px-5 py-3 rounded-2xl border border-gray-200/80 shadow-sm">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Contacts</p>
                <p className="text-xl font-black text-gray-900">{contactsWithLabel.length}</p>
              </div>
              <div className="bg-white px-5 py-3 rounded-2xl border border-gray-200/80 shadow-sm">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Unread</p>
                <p className="text-xl font-black text-gray-900">0</p>
              </div>
              <div className="bg-white px-5 py-3 rounded-2xl border border-gray-200/80 shadow-sm">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Assigned To Me</p>
                <p className="text-xl font-black text-gray-900">0</p>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search Contact..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Bulk Actions Header */}
          <div className="flex items-center gap-3 px-2 py-2">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded-md border-gray-300 text-[#25D366] focus:ring-[#25D366] cursor-pointer"
              checked={filteredContacts.length > 0 && selectedContacts.size === filteredContacts.length}
              onChange={handleToggleSelectAll}
            />
            <span className="text-[13px] font-bold text-gray-500">
              {selectedContacts.size > 0 ? `${selectedContacts.size} selected` : 'Select All'}
            </span>
            {selectedContacts.size > 0 && (
              <div className="flex gap-2 ml-4">
                <button className="text-[12px] font-bold text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg">Broadcast to Selected</button>
                <button className="text-[12px] font-bold text-red-600 hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg">Remove Label</button>
              </div>
            )}
          </div>

          {/* Contacts Grid */}
          {filteredContacts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-12 text-center flex flex-col items-center">
               <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4">
                 <Users size={32} />
               </div>
               <h3 className="text-lg font-bold text-gray-900 mb-1">No contacts found</h3>
               <p className="text-sm text-gray-500">There are no contacts matching your search criteria in this label.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredContacts.map((contact, idx) => {
                const initials = contact.name.split(' ').map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('');
                const isSelected = selectedContacts.has(contact.id);
                
                return (
                  <motion.div 
                    key={contact.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden group
                      ${isSelected ? 'border-[#25D366] shadow-[0_4px_15px_rgba(37,211,102,0.15)] ring-1 ring-[#25D366]' : 'border-gray-200/80 shadow-sm hover:border-[#25D366]/50 hover:shadow-md'}
                    `}
                  >
                    <div className="p-4 flex flex-col h-full relative">
                      {/* Checkbox */}
                      <div className="absolute top-4 right-4 z-10">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded-md border-gray-300 text-[#25D366] focus:ring-[#25D366] cursor-pointer"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(contact.id)}
                        />
                      </div>
                      
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#25D366] to-[#1ebe5d] flex items-center justify-center text-white text-[13px] font-bold shadow-sm shrink-0">
                          {initials}
                        </div>
                        <div className="pr-6 min-w-0">
                          <h4 className="text-[14px] font-bold text-gray-900 truncate" title={contact.name}>{contact.name}</h4>
                          <p className="text-[12px] font-medium text-gray-500 truncate">{contact.phoneNumber}</p>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                        <span className="px-2 py-1 text-[10px] font-extrabold text-white rounded-md tracking-wide shadow-sm" style={{ backgroundColor: LABEL_COLORS[label.color] }}>
                          {label.name}
                        </span>
                        
                        <button 
                          onClick={() => handleRemoveLabel(contact.id)}
                          className="text-[11px] font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
                          title="Remove Label"
                        >
                          <X size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
