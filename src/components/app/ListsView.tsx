'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { LABEL_COLORS, LabelColor, SavedList } from '@/types/workspace';
import ListDetailsView from '@/components/app/ListDetailsView';
import {
  FolderKanban,
  Plus,
  Users,
  Layers,
  Sparkles,
  Tag,
  ArrowRight,
  X,
  CheckSquare,
  Square,
  Clock,
  Edit2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ListsView() {
  const {
    activeSavedLists,
    state,
    activeContacts,
    activeWorkspace,
    addSavedList,
    updateSavedList,
    deleteSavedList,
    activeListId,
    setActiveListId
  } = useWorkspace();

  // Live workspace contacts fetched directly from workspace API
  const [liveContacts, setLiveContacts] = useState<any[]>([]);

  // Fetch live contacts from workspace API (Sales Cloud / SFMC)
  useEffect(() => {
    if (!activeWorkspace) return;
    const wsId = activeWorkspace.id || 'salescloud-ws-1';
    const isSalesCloud = activeWorkspace.type === 'salescloud' || wsId === 'salescloud-ws-1';
    const wsKey = isSalesCloud
      ? (process.env.NEXT_PUBLIC_WORKSPACE_SALESCLOUD_API_KEY || 'salescloud-ws-key-secret')
      : (process.env.NEXT_PUBLIC_WORKSPACE_SFMC_API_KEY || 'sfmc-secret-key-123');

    fetch(`/api/workspaces/${wsId}/contacts`, {
      headers: { 'X-Workspace-Key': wsKey },
      cache: 'no-store'
    })
      .then(r => r.json())
      .then(data => {
        if (data.contacts && Array.isArray(data.contacts)) {
          setLiveContacts(data.contacts);
        }
      })
      .catch(err => console.warn('[ListsView] Fetch live contacts failed:', err));
  }, [activeWorkspace?.id]);

  // Combine live workspace contacts + local activeContacts
  const allWorkspaceContacts = useMemo(() => {
    const map = new Map<string, any>();
    liveContacts.forEach(c => map.set(c.id, c));
    activeContacts.forEach(c => {
      if (!map.has(c.id)) map.set(c.id, c);
      else map.set(c.id, { ...map.get(c.id), ...c });
    });
    return Array.from(map.values());
  }, [liveContacts, activeContacts]);

  // Robust multi-source label matching helper
  const contactHasLabel = (contact: any, labelId: string, labelName: string): boolean => {
    const normName = labelName.toLowerCase().trim();

    // 1. Check conversationLabels by contact.id, phoneNumber, or salesforceRecordId
    const assignedById = state.conversationLabels[contact.id] || [];
    const assignedByPhone = contact.phoneNumber ? (state.conversationLabels[contact.phoneNumber] || []) : [];
    const assignedBySfId = contact.salesforceRecordId ? (state.conversationLabels[contact.salesforceRecordId] || []) : [];

    if (assignedById.includes(labelId) || assignedByPhone.includes(labelId) || assignedBySfId.includes(labelId)) {
      return true;
    }

    // 2. Check contact.labels string (comma separated from Salesforce e.g. "Qualified, VIP")
    const rawLabelsStr = contact.labels || contact.WhatZupp_Labels__c || '';
    if (rawLabelsStr && typeof rawLabelsStr === 'string') {
      const splitNames = rawLabelsStr.split(',').map(s => s.trim().toLowerCase());
      if (splitNames.includes(normName)) return true;
    }

    // 3. Check contact.tags array (e.g. ["Qualified", "VIP"])
    if (Array.isArray(contact.tags)) {
      const normTags = contact.tags.map((t: string) => String(t).trim().toLowerCase());
      if (normTags.includes(normName)) return true;
    }

    return false;
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<SavedList | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [matchType, setMatchType] = useState<'ANY' | 'ALL'>('ANY');

  const handleOpenCreate = () => {
    setEditingList(null);
    setName('');
    setDescription('');
    setSelectedLabelIds([]);
    setMatchType('ANY');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (list: SavedList, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingList(list);
    setName(list.name);
    setDescription(list.description || '');
    setSelectedLabelIds(list.labelIds || []);
    setMatchType(list.matchType || 'ANY');
    setIsModalOpen(true);
  };

  const handleSaveList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cachedCount = livePreviewCount;

    if (editingList) {
      await updateSavedList(editingList.id, {
        name: name.trim(),
        description: description.trim(),
        labelIds: selectedLabelIds,
        matchType,
        contactCount: cachedCount,
      });
    } else {
      await addSavedList({
        name: name.trim(),
        description: description.trim(),
        labelIds: selectedLabelIds,
        matchType,
        contactCount: cachedCount,
        workspaceId: state.activeWorkspaceId || 'salescloud-ws-1',
      });
    }

    setIsModalOpen(false);
  };

  // Calculate live preview count of matching contacts for the modal form
  const livePreviewCount = useMemo(() => {
    if (selectedLabelIds.length === 0) return 0;

    const targetLabelObjs = state.chatLabels.filter(l => selectedLabelIds.includes(l.id));

    return allWorkspaceContacts.filter(contact => {
      if (matchType === 'ALL') {
        return targetLabelObjs.every(lObj => contactHasLabel(contact, lObj.id, lObj.name));
      } else {
        return targetLabelObjs.some(lObj => contactHasLabel(contact, lObj.id, lObj.name));
      }
    }).length;
  }, [selectedLabelIds, matchType, allWorkspaceContacts, state.conversationLabels, state.chatLabels]);

  // Compute contacts count for each list in the dashboard grid
  const getListContactCount = (list: SavedList): number => {
    if (!list.labelIds || list.labelIds.length === 0) return 0;

    const targetLabelObjs = state.chatLabels.filter(l => list.labelIds.includes(l.id));
    const type = list.matchType || 'ANY';

    return allWorkspaceContacts.filter(contact => {
      if (type === 'ALL') {
        return targetLabelObjs.every(lObj => contactHasLabel(contact, lObj.id, lObj.name));
      } else {
        return targetLabelObjs.some(lObj => contactHasLabel(contact, lObj.id, lObj.name));
      }
    }).length;
  };

  // Dashboard Statistics
  const totalLists = activeSavedLists.length;

  const totalContactsInLists = useMemo(() => {
    const matchedContactIds = new Set<string>();

    activeSavedLists.forEach(list => {
      if (!list.labelIds || list.labelIds.length === 0) return;
      const targetLabelObjs = state.chatLabels.filter(l => list.labelIds.includes(l.id));
      const type = list.matchType || 'ANY';

      allWorkspaceContacts.forEach(contact => {
        let matches = false;
        if (type === 'ALL') {
          matches = targetLabelObjs.every(lObj => contactHasLabel(contact, lObj.id, lObj.name));
        } else {
          matches = targetLabelObjs.some(lObj => contactHasLabel(contact, lObj.id, lObj.name));
        }
        if (matches) matchedContactIds.add(contact.id);
      });
    });

    return matchedContactIds.size;
  }, [activeSavedLists, allWorkspaceContacts, state.conversationLabels, state.chatLabels]);

  const mostActiveList = useMemo(() => {
    if (activeSavedLists.length === 0) return 'None';
    let topList = activeSavedLists[0];
    let topCount = getListContactCount(topList);

    for (let i = 1; i < activeSavedLists.length; i++) {
      const cnt = getListContactCount(activeSavedLists[i]);
      if (cnt > topCount) {
        topCount = cnt;
        topList = activeSavedLists[i];
      }
    }
    return topList.name;
  }, [activeSavedLists, allWorkspaceContacts, state.conversationLabels, state.chatLabels]);

  const recentlyUpdatedList = useMemo(() => {
    if (activeSavedLists.length === 0) return 'None';
    const sorted = [...activeSavedLists].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
    return sorted[0].name;
  }, [activeSavedLists]);

  const toggleLabelSelection = (labelId: string) => {
    setSelectedLabelIds(prev =>
      prev.includes(labelId) ? prev.filter(id => id !== labelId) : [...prev, labelId]
    );
  };

  if (activeListId) {
    const listToEdit = activeSavedLists.find(l => l.id === activeListId);
    return (
      <ListDetailsView
        listId={activeListId}
        onBack={() => setActiveListId(null)}
        onEdit={() => listToEdit && handleOpenEdit(listToEdit)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full overflow-y-auto font-sans p-8">
      
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#00C853]/10 border border-[#00C853]/20 flex items-center justify-center text-[#00C853] shadow-2xs">
              <FolderKanban size={22} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Lists
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Create dynamic customer segments using one or more labels.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#00C853] to-[#00E676] hover:from-[#00B048] hover:to-[#00C853] text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-98 shrink-0"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Create List</span>
        </button>
      </div>

      {/* Dashboard Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        
        {/* Card 1: Total Lists */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Total Lists
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {totalLists}
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            Active customer segments
          </p>
        </div>

        {/* Card 2: Total Contacts Inside Lists */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Segmented Contacts
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#00C853] flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {totalContactsInLists}
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            Unique contacts in lists
          </p>
        </div>

        {/* Card 3: Most Active List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Most Active List
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 tracking-tight truncate" title={mostActiveList}>
            {mostActiveList}
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            Highest audience reach
          </p>
        </div>

        {/* Card 4: Recently Updated List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Recently Updated
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 tracking-tight truncate" title={recentlyUpdatedList}>
            {recentlyUpdatedList}
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            Latest list activity
          </p>
        </div>

      </div>

      {/* Main Section: Lists Grid OR Empty State */}
      {activeSavedLists.length === 0 ? (
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 bg-white rounded-3xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center shadow-2xs my-4"
        >
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-[#00C853] flex items-center justify-center mb-4 border border-emerald-200/60 shadow-inner">
            <FolderKanban size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mb-1">
            No Lists Yet
          </h2>
          <p className="text-xs text-slate-500 max-w-md font-medium mb-6 leading-relaxed">
            Create your first customer segment using one or more labels. Lists automatically collect matching contacts with zero manual upkeep.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#00C853] to-[#00E676] hover:from-[#00B048] hover:to-[#00C853] text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-98"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Create List</span>
          </button>
        </motion.div>

      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeSavedLists.map(list => {
            const count = getListContactCount(list);
            const listLabelObjs = state.chatLabels.filter(l => (list.labelIds || []).includes(l.id));

            return (
              <motion.div
                key={list.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setActiveListId(list.id)}
                className="bg-white rounded-3xl border border-slate-200/80 p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00C853] to-[#00E676] opacity-0 group-hover:opacity-100 transition-opacity" />

                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-black text-slate-900 tracking-tight group-hover:text-[#00C853] transition-colors">
                      {list.name}
                    </h3>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleOpenEdit(list, e)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                        title="Edit List"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSavedList(list.id); }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Delete List"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {list.description && (
                    <p className="text-xs text-slate-500 font-medium mb-4 line-clamp-2">
                      {list.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-extrabold shadow-2xs">
                      {count} {count === 1 ? 'Contact' : 'Contacts'}
                    </span>

                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                      {list.matchType === 'ALL' ? 'Match All (AND)' : 'Match Any (OR)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mb-6">
                    {listLabelObjs.length === 0 ? (
                      <span className="text-[11px] font-bold text-slate-400 italic">No labels selected</span>
                    ) : (
                      listLabelObjs.map(label => {
                        const hex = LABEL_COLORS[label.color as LabelColor] || '#00C853';
                        return (
                          <span
                            key={label.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs"
                            style={{
                              backgroundColor: `${hex}15`,
                              borderColor: `${hex}30`,
                              color: hex,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
                            {label.name}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-extrabold text-[#00C853] group-hover:translate-x-0.5 transition-transform">
                  <span>Open Workspace Segment</span>
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-[#00C853] flex items-center justify-center group-hover:bg-[#00C853] group-hover:text-white transition-all">
                    <ArrowRight size={14} />
                  </div>
                </div>

              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit List Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 font-sans overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#00C853] flex items-center justify-center font-bold">
                    <FolderKanban size={18} />
                  </div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    {editingList ? 'Edit List' : 'Create List'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveList} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">
                    List Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. VIP Customers, High Priority Leads"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00C853]/30 focus:border-[#00C853] focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. High value customers for targeted promotions"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00C853]/30 focus:border-[#00C853] focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Label Matching Rule
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMatchType('ANY')}
                      className={`px-3 py-2 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer text-center ${
                        matchType === 'ANY'
                          ? 'bg-[#00C853] text-white border-[#00C853] shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Match Any Label (OR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchType('ALL')}
                      className={`px-3 py-2 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer text-center ${
                        matchType === 'ALL'
                          ? 'bg-[#00C853] text-white border-[#00C853] shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Match All Labels (AND)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Select Included Labels
                  </label>
                  
                  <div className="max-h-40 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-2.5 space-y-1.5 scrollbar-thin">
                    {state.chatLabels.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2 font-medium">No labels available in this workspace yet.</p>
                    ) : (
                      state.chatLabels.map(label => {
                        const isChecked = selectedLabelIds.includes(label.id);
                        const hex = LABEL_COLORS[label.color as LabelColor] || '#00C853';

                        return (
                          <div
                            key={label.id}
                            onClick={() => toggleLabelSelection(label.id)}
                            className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer select-none ${
                              isChecked ? 'bg-white shadow-2xs border border-slate-200' : 'hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isChecked ? (
                                <CheckSquare size={16} className="text-[#00C853]" />
                              ) : (
                                <Square size={16} className="text-slate-400" />
                              )}
                              <span className="text-xs font-extrabold text-slate-800">{label.name}</span>
                            </div>

                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: hex }}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-xs font-extrabold text-[#00C853]">
                  <span className="flex items-center gap-2">
                    <Sparkles size={16} />
                    <span>Matching Contacts Preview:</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#00C853] text-white text-xs font-black">
                    {livePreviewCount} Contacts
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00C853] to-[#00E676] hover:from-[#00B048] hover:to-[#00C853] text-white text-xs font-extrabold transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                  >
                    {editingList ? 'Save Changes' : 'Create List'}
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
