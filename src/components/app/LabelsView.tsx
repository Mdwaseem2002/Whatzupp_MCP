'use client';

import React, { useState, useMemo } from 'react';
import { Tag, Plus, Trash2, ArrowRight, Activity, Users, Hash, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { LABEL_COLORS, LabelColor } from '@/types/workspace';
import LabelDetailsView from './LabelDetailsView';

export default function LabelsView() {
  const { state, addChatLabel, deleteChatLabel, updateChatLabel, viewLabelDetails } = useWorkspace();
  const [isCreating, setIsCreating] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<LabelColor>('green');

  const workspaceLabels = state.chatLabels.filter(l => l.workspaceId === state.activeWorkspaceId);

  // Statistics calculations
  const stats = useMemo(() => {
    let taggedContactsCount = 0;
    const labelUsage: Record<string, number> = {};

    workspaceLabels.forEach(l => { labelUsage[l.id] = 0; });

    state.contacts.forEach(c => {
      const activeLbs = state.conversationLabels[c.id] || [];
      const relevantLbs = activeLbs.filter(lId => workspaceLabels.some(w => w.id === lId));
      if (relevantLbs.length > 0) taggedContactsCount++;
      relevantLbs.forEach(lId => {
        if (labelUsage[lId] !== undefined) labelUsage[lId]++;
      });
    });

    let mostUsedId = '';
    let maxUsage = -1;
    Object.entries(labelUsage).forEach(([id, count]) => {
      if (count > maxUsage) {
        maxUsage = count;
        mostUsedId = id;
      }
    });

    const mostUsed = workspaceLabels.find(l => l.id === mostUsedId)?.name || 'None';
    // Mocking recently updated since we don't store updatedAt on labels yet
    const recentlyUpdated = workspaceLabels.length > 0 ? workspaceLabels[workspaceLabels.length - 1].name : 'None';

    return {
      total: workspaceLabels.length,
      taggedContacts: taggedContactsCount,
      mostUsed,
      recentlyUpdated
    };
  }, [workspaceLabels, state.contacts, state.conversationLabels]);

  const handleCreateOrUpdate = () => {
    if (!newName.trim()) return;
    
    if (editingLabelId) {
      updateChatLabel(editingLabelId, { name: newName.trim(), color: newColor });
      setEditingLabelId(null);
    } else {
      addChatLabel({
        name: newName.trim(),
        color: newColor,
        workspaceId: state.activeWorkspaceId || 'sfmc-ws-1'
      });
      setIsCreating(false);
    }
    setNewName('');
  };

  const startEditing = (e: React.MouseEvent, label: any) => {
    e.stopPropagation();
    setEditingLabelId(label.id);
    setNewName(label.name);
    setNewColor(label.color);
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (e: React.MouseEvent, labelId: string, labelName: string) => {
    e.stopPropagation();
    if (confirm(`Delete label "${labelName}"? This will remove it from all conversations.`)) {
      deleteChatLabel(labelId);
    }
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingLabelId(null);
    setNewName('');
  };

  if (state.activeLabelId) {
    return <LabelDetailsView />;
  }

  const colors = Object.entries(LABEL_COLORS) as [LabelColor, string][];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] font-sans">
      
      {/* ═══ Header Section ═══ */}
      <div className="bg-white border-b border-gray-200/80 px-8 pt-10 pb-8 shrink-0 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#25D366]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-[28px] font-black text-gray-900 tracking-tight flex items-center gap-3">
              Labels
            </h1>
            <p className="text-[14px] text-gray-500 font-medium mt-1.5 max-w-md leading-relaxed">
              Manage customer segments, sales stages, and conversation categories.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingLabelId(null);
              setNewName('');
              setIsCreating(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#1db954] text-white rounded-xl font-bold transition-all shadow-sm shadow-green-600/20 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={18} /> Create Label
          </button>
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Statistics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center"><Hash size={16} /></div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Labels</span>
              </div>
              <p className="text-2xl font-black text-gray-900">{stats.total}</p>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 text-green-500 flex items-center justify-center"><Users size={16} /></div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tagged Contacts</span>
              </div>
              <p className="text-2xl font-black text-gray-900">{stats.taggedContacts}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center"><Tag size={16} /></div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Most Used</span>
              </div>
              <p className="text-lg font-black text-gray-900 truncate">{stats.mostUsed}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center"><Activity size={16} /></div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recently Updated</span>
              </div>
              <p className="text-lg font-black text-gray-900 truncate">{stats.recentlyUpdated}</p>
            </div>
          </div>
          
          {/* Create/Edit Form Dropdown */}
          <AnimatePresence>
            {(isCreating || editingLabelId) && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                className="overflow-hidden"
              >
                <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-md shadow-gray-200/50 mb-4">
                  <h3 className="text-[13px] font-black text-gray-900 uppercase tracking-widest mb-5">
                    {editingLabelId ? 'Edit Label' : 'New Label'}
                  </h3>
                  <div className="flex flex-col md:flex-row gap-5 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Label Name</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. VIP Customer, Hot Lead"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all"
                        autoFocus
                      />
                    </div>
                    <div className="w-full md:w-auto">
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Color Theme</label>
                      <div className="flex items-center gap-2 h-[46px] px-3 bg-gray-50 border border-gray-200 rounded-xl">
                        {colors.map(([colorKey, hex]) => (
                          <button
                            key={colorKey}
                            onClick={() => setNewColor(colorKey)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${newColor === colorKey ? 'ring-[3px] ring-offset-2 ring-[#25D366] scale-110' : 'hover:scale-110 border border-black/10'}`}
                            style={{ backgroundColor: hex }}
                            title={colorKey}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto mt-5 md:mt-0">
                      <button
                        onClick={cancelForm}
                        className="px-5 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateOrUpdate}
                        disabled={!newName.trim()}
                        className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1db954] disabled:opacity-50 disabled:hover:bg-[#25D366] transition-colors shadow-sm"
                      >
                        {editingLabelId ? 'Save Changes' : 'Create Label'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cards Grid */}
          {workspaceLabels.length === 0 && !isCreating ? (
            <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-16 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-5 border border-gray-100">
                <Tag size={36} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2 tracking-tight">No Labels Created</h3>
              <p className="text-[15px] text-gray-500 max-w-sm mb-8 leading-relaxed font-medium">Create labels to effectively segment your audience and categorize your WhatsApp conversations.</p>
              <button
                onClick={() => setIsCreating(true)}
                className="px-8 py-3.5 bg-gray-900 hover:bg-black text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Create Your First Label
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-12">
              <AnimatePresence>
                {workspaceLabels.map((label, idx) => {
                  const usageCount = state.contacts.filter(c => (state.conversationLabels[c.id] || []).includes(label.id)).length;
                  
                  return (
                    <motion.div 
                      key={label.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.03, duration: 0.3 }}
                      onClick={() => viewLabelDetails(label.id)}
                      className="group bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:border-gray-300 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-[180px]"
                    >
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-auto">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: LABEL_COLORS[label.color] }} />
                            <h4 className="text-[16px] font-black text-gray-900 tracking-tight truncate">{label.name}</h4>
                          </div>
                          
                          {/* Hover Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1">
                            <button
                              onClick={(e) => startEditing(e, label)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit Label"
                            >
                              <Pencil size={14} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, label.id, label.name)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete Label"
                            >
                              <Trash2 size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-3xl font-black text-gray-900 tracking-tighter">{usageCount}</span>
                            <span className="text-[13px] font-bold text-gray-500">Contacts</span>
                          </div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Last Activity: Today</p>
                        </div>
                      </div>

                      {/* Footer Action */}
                      <div className="border-t border-gray-100 bg-gray-50/50 p-3.5 flex items-center justify-between group-hover:bg-gray-50 transition-colors">
                        <span className="text-[12px] font-bold text-gray-500 group-hover:text-gray-800 transition-colors">Manage Segments</span>
                        <ArrowRight size={14} className="text-gray-400 group-hover:text-gray-900 transition-colors group-hover:translate-x-0.5" />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
