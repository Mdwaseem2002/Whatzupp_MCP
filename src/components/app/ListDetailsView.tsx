'use client';

import React, { useState, useMemo } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { LABEL_COLORS, LabelColor } from '@/types/workspace';
import {
  ArrowLeft,
  Search,
  CheckSquare,
  Square,
  Edit2,
  Trash2,
  Send,
  Download,
  Users,
  Building2,
  Phone,
  Mail,
  Tag,
  Filter,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ListDetailsViewProps {
  listId: string;
  onBack: () => void;
  onEdit: () => void;
}

export default function ListDetailsView({ listId, onBack, onEdit }: ListDetailsViewProps) {
  const {
    activeSavedLists,
    state,
    activeContacts,
    deleteSavedList,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 1. Locate current list
  const currentList = useMemo(() => {
    return activeSavedLists.find(l => l.id === listId);
  }, [activeSavedLists, listId]);

  // 2. Resolve label objects for this list
  const listLabels = useMemo(() => {
    if (!currentList || !currentList.labelIds) return [];
    return state.chatLabels.filter(l => currentList.labelIds.includes(l.id));
  }, [currentList, state.chatLabels]);

  // 3. Filter contacts matching the list's label rules (ANY / ALL)
  const matchingContacts = useMemo(() => {
    if (!currentList || !currentList.labelIds || currentList.labelIds.length === 0) return [];

    const targetLabelIds = new Set(currentList.labelIds);
    const targetLabelNames = new Set(listLabels.map(l => l.name.toLowerCase()));
    const matchType = currentList.matchType || 'ANY';

    return activeContacts.filter(contact => {
      // Look up contact assigned label IDs
      const assignedIds = state.conversationLabels[contact.id] || [];
      
      // Also match by contact.tags strings if they match label names
      const contactTagNames = (contact.tags || []).map(t => t.toLowerCase());

      if (matchType === 'ALL') {
        // Must match EVERY label in currentList.labelIds
        return Array.from(targetLabelIds).every(labelId => {
          const labelObj = state.chatLabels.find(l => l.id === labelId);
          const hasIdMatch = assignedIds.includes(labelId);
          const hasNameMatch = labelObj ? contactTagNames.includes(labelObj.name.toLowerCase()) : false;
          return hasIdMatch || hasNameMatch;
        });
      } else {
        // ANY (OR) logic: Must match AT LEAST ONE label
        const hasIdMatch = assignedIds.some(id => targetLabelIds.has(id));
        const hasNameMatch = contactTagNames.some(tagName => targetLabelNames.has(tagName));
        return hasIdMatch || hasNameMatch;
      }
    });
  }, [currentList, listLabels, activeContacts, state.conversationLabels, state.chatLabels]);

  // 4. Apply search filter
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return matchingContacts;
    const q = searchQuery.toLowerCase();
    return matchingContacts.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.phoneNumber.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  }, [matchingContacts, searchQuery]);

  // 5. Bulk selection state
  const isAllSelected = filteredContacts.length > 0 && selectedContactIds.length === filteredContacts.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map(c => c.id));
    }
  };

  const toggleSelectContact = (id: string) => {
    setSelectedContactIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteList = async () => {
    if (!currentList) return;
    await deleteSavedList(currentList.id);
    onBack();
  };

  if (!currentList) {
    return (
      <div className="flex-1 p-8 text-center text-slate-500 font-sans">
        <p className="text-sm font-bold">List not found or has been deleted.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-sm hover:bg-emerald-700 transition-all"
        >
          Back to Lists
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full overflow-hidden font-sans">
      
      {/* ─── Top Header Bar ─── */}
      <div className="bg-white border-b border-slate-200/80 px-8 py-5 shrink-0 shadow-2xs">
        
        {/* Back Button */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 text-xs font-extrabold transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Lists</span>
          </button>

          <span className="text-slate-300 font-bold">/</span>

          {/* Match Type Badge */}
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#00C853] text-[10px] font-black uppercase tracking-wider">
            {currentList.matchType === 'ALL' ? 'Match All (AND)' : 'Match Any (OR)'}
          </span>
        </div>

        {/* Title, Description & Actions Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {currentList.name}
              </h1>
              <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-extrabold shadow-xs">
                {matchingContacts.length} Contacts
              </span>
            </div>
            {currentList.description && (
              <p className="text-xs text-slate-500 font-medium mt-1">
                {currentList.description}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => alert(`Broadcast feature ready: Target ${selectedContactIds.length || matchingContacts.length} contacts.`)}
              className="px-3.5 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#00C853] border border-emerald-200/80 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Broadcast to List"
            >
              <Send size={14} />
              <span>Broadcast</span>
            </button>

            <button
              onClick={() => alert(`Export feature ready: ${matchingContacts.length} contacts exported.`)}
              className="px-3.5 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Export List Contacts"
            >
              <Download size={14} />
              <span>Export</span>
            </button>

            <button
              onClick={onEdit}
              className="px-3.5 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Edit List Settings"
            >
              <Edit2 size={14} />
              <span>Edit</span>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3.5 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Delete List"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Assigned Labels Badge Pills */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 flex-wrap">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Tag size={12} />
            Included Labels:
          </span>

          {listLabels.map(label => {
            const hex = LABEL_COLORS[label.color as LabelColor] || '#00C853';
            return (
              <span
                key={label.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-2xs border"
                style={{
                  backgroundColor: `${hex}15`,
                  borderColor: `${hex}40`,
                  color: hex,
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
                {label.name}
              </span>
            );
          })}
        </div>

      </div>

      {/* ─── Search & Bulk Select Toolbar ─── */}
      <div className="px-8 py-4 bg-slate-50/80 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, email, or company..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00C853]/30 focus:border-[#00C853] transition-all shadow-2xs"
          />
        </div>

        {/* Bulk Select Checkbox Foundation */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
          >
            {isAllSelected ? (
              <CheckSquare size={16} className="text-[#00C853]" />
            ) : (
              <Square size={16} className="text-slate-400" />
            )}
            <span>Select All ({filteredContacts.length})</span>
          </button>

          {selectedContactIds.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-[#00C853] text-xs font-extrabold animate-fade-in">
              {selectedContactIds.length} Selected
            </span>
          )}
        </div>

      </div>

      {/* ─── Contact Cards Grid ─── */}
      <div className="flex-1 overflow-y-auto p-8">
        
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/80 shadow-inner">
              <Users size={26} />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              {searchQuery ? 'No Matching Contacts Found' : 'No Contacts in This List Yet'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm font-medium">
              {searchQuery
                ? `No contacts match "${searchQuery}". Try refining your search query.`
                : 'Contacts assigned to the selected labels will automatically populate here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredContacts.map(contact => {
              const isSelected = selectedContactIds.includes(contact.id);
              const assignedLabelIds = state.conversationLabels[contact.id] || [];
              const contactLabelObjs = state.chatLabels.filter(l => 
                assignedLabelIds.includes(l.id) || (contact.tags || []).map(t => t.toLowerCase()).includes(l.name.toLowerCase())
              );

              const initials = contact.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => toggleSelectContact(contact.id)}
                  className={`relative bg-white rounded-3xl border p-5 transition-all duration-200 cursor-pointer group hover:shadow-md ${
                    isSelected
                      ? 'border-[#00C853] ring-2 ring-[#00C853]/20 shadow-sm'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {/* Select Checkbox Top-Right */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelectContact(contact.id); }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-[#00C853] transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-[#00C853]" />
                    ) : (
                      <Square size={18} className="opacity-60 group-hover:opacity-100" />
                    )}
                  </button>

                  {/* Contact Avatar & Info */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00C853] to-[#00E676] text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <h4 className="font-extrabold text-sm text-slate-900 truncate tracking-tight">
                        {contact.name}
                      </h4>
                      {contact.company && (
                        <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <Building2 size={12} className="shrink-0 text-slate-400" />
                          <span>{contact.company}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contact Details (Phone / Email) */}
                  <div className="space-y-1 mb-4 text-xs font-medium text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px] font-bold">{contact.phoneNumber}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate text-[11px]">{contact.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Label Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-slate-100">
                    {contactLabelObjs.length === 0 ? (
                      <span className="text-[10px] text-slate-400 font-bold italic">No active labels</span>
                    ) : (
                      contactLabelObjs.map(lbl => {
                        const hex = LABEL_COLORS[lbl.color as LabelColor] || '#00C853';
                        return (
                          <span
                            key={lbl.id}
                            className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border shadow-2xs"
                            style={{
                              backgroundColor: `${hex}15`,
                              borderColor: `${hex}30`,
                              color: hex,
                            }}
                          >
                            {lbl.name}
                          </span>
                        );
                      })
                    )}
                  </div>

                </motion.div>
              );
            })}
          </div>
        )}

      </div>

      {/* ─── Delete Confirmation Modal ─── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center font-sans"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={22} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Delete "{currentList.name}"?
              </h3>
              <p className="text-xs text-slate-500 mb-5 font-medium">
                This list view will be permanently deleted. Contacts and their labels will not be modified or deleted.
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteList}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold transition-all cursor-pointer shadow-sm"
                >
                  Delete List
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
