import React, { useState } from 'react';
import { ArrowLeft, Edit2, Check, X, Phone, Mail, MessageSquare, Building2, Tag, Clock, MoreVertical, Plus } from 'lucide-react';
import type { WorkspaceContact } from '@/types/workspace';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { LABEL_COLORS } from '@/types/workspace';
import { motion, AnimatePresence } from 'framer-motion';

interface ContactDetailsPageProps {
  contact: WorkspaceContact;
  onBack: () => void;
  onStartChat: (contact: WorkspaceContact) => void;
}

export default function ContactDetailsPage({ contact, onBack, onStartChat }: ContactDetailsPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: contact.name,
    phoneNumber: contact.phoneNumber,
    email: contact.email || '',
    company: contact.company || '',
    tags: contact.tags.join(', ')
  });
  const [isSaving, setIsSaving] = useState(false);
  const { activeWorkspace, updateContact, state, setConversationLabels } = useWorkspace();
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const activeLabels = state.conversationLabels[contact.id] || [];
  const workspaceLabels = state.chatLabels.filter(l => l.workspaceId === (activeWorkspace?.id || ''));

  const toggleLabel = (labelId: string) => {
    if (activeLabels.includes(labelId)) {
      setConversationLabels(contact.id, activeLabels.filter(id => id !== labelId));
    } else {
      setConversationLabels(contact.id, [...activeLabels, labelId]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    if (activeWorkspace) {
      const isSalesCloud = activeWorkspace.type === 'salescloud' || activeWorkspace.platform === 'sales_cloud' || activeWorkspace.id === 'salescloud-ws-1';
      const wsKey = isSalesCloud
        ? (process.env.NEXT_PUBLIC_WORKSPACE_SALESCLOUD_API_KEY || 'salescloud-ws-key-secret')
        : (process.env.NEXT_PUBLIC_WORKSPACE_SFMC_API_KEY || 'sfmc-secret-key-123');
      
      const payload = {
        name: formData.name,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        company: formData.company,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      try {
        await fetch(`/api/workspaces/${activeWorkspace.id}/contacts`, {
          method: 'PATCH',
          headers: { 'X-Workspace-Key': wsKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: contact.id, ...payload })
        });
        await updateContact(contact.id, payload as any);
      } catch(e) {
        console.error(e);
      }
    }
    setIsSaving(false);
    setIsEditing(false);
  };

  const initials = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'CT';

  return (
    <div className="max-w-6xl mx-auto w-full pb-12 animate-in fade-in duration-300 font-sans">
      
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors mb-5 text-sm">
            <ArrowLeft size={16} /> Back to Contacts
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{contact.name}</h1>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider rounded-md border border-emerald-100 shadow-sm">
              {contact.company || 'Subscriber'}
            </span>
          </div>
          <p className="text-slate-400 text-xs font-semibold mt-2 flex items-center gap-1.5">
            <Clock size={12} /> Last Updated: Just now
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all text-sm shadow-sm">
              <Edit2 size={16} /> Edit Contact
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => { setIsEditing(false); setFormData({
                name: contact.name, phoneNumber: contact.phoneNumber, email: contact.email || '', company: contact.company || '', tags: contact.tags.join(', ')
              })}} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-colors text-sm shadow-sm">
                <X size={16} /> Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-[#00C853] hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors text-sm shadow-sm disabled:opacity-50">
                <Check size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 40 / 60 Split Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* LEFT PANEL: Premium Mobile-Style Profile Card (40%) */}
        <div className="w-full lg:w-5/12 xl:w-4/12 shrink-0">
          <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm overflow-hidden relative">
            
            {/* Subtle Gradient/Glassmorphism Header */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-500/10 to-transparent"></div>

            <div className="p-8 relative flex flex-col items-center text-center">
              
              {/* Larger Avatar */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-[#052E2B] via-[#00C853] to-[#00E676] flex items-center justify-center text-3xl font-black text-white shadow-xl mb-5 ring-4 ring-white z-10">
                {initials}
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">{isEditing ? formData.name : contact.name}</h2>
              <p className="text-slate-500 font-bold text-sm mb-8">{isEditing ? formData.company || 'Unknown' : contact.company || 'Unknown'}</p>

              {/* Floating Quick Actions */}
              <div className="flex items-center justify-center gap-4 w-full mb-8">
                 <button className="flex-1 max-w-[85px] aspect-square rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 text-slate-400 hover:text-blue-600 transition-all flex flex-col items-center justify-center gap-2 shadow-sm group">
                   <Phone size={20} className="group-hover:scale-110 transition-transform" />
                   <span className="text-[10px] font-extrabold uppercase">Call</span>
                 </button>
                 
                 <button onClick={() => onStartChat(contact)} className="flex-1 max-w-[85px] aspect-square rounded-2xl bg-emerald-50 hover:bg-[#00C853] border border-emerald-100 hover:border-[#00C853] text-[#00C853] hover:text-white transition-all flex flex-col items-center justify-center gap-2 shadow-sm group">
                   <MessageSquare size={20} className="group-hover:scale-110 transition-transform" />
                   <span className="text-[10px] font-extrabold uppercase">Message</span>
                 </button>
                 
                 <button className="flex-1 max-w-[85px] aspect-square rounded-2xl bg-slate-50 hover:bg-purple-50 border border-slate-100 hover:border-purple-200 text-slate-400 hover:text-purple-600 transition-all flex flex-col items-center justify-center gap-2 shadow-sm group">
                   <Mail size={20} className="group-hover:scale-110 transition-transform" />
                   <span className="text-[10px] font-extrabold uppercase">Email</span>
                 </button>
              </div>

              {/* Labels & Tags Section */}
              <div className="w-full text-left pt-6 border-t border-slate-100">
                 <div className="flex items-center justify-between mb-3">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chat Labels</h3>
                   <div className="relative">
                     <button onClick={() => setShowLabelPicker(!showLabelPicker)} className="text-[10px] font-bold text-[#00C853] hover:text-emerald-700 transition-colors flex items-center gap-1">
                       <Plus size={12} /> Add Label
                     </button>
                     <AnimatePresence>
                       {showLabelPicker && (
                         <>
                           <div className="fixed inset-0 z-40" onClick={() => setShowLabelPicker(false)} />
                           <motion.div
                             initial={{ opacity: 0, y: 5, scale: 0.95 }}
                             animate={{ opacity: 1, y: 0, scale: 1 }}
                             exit={{ opacity: 0, scale: 0.95 }}
                             className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
                           >
                             <div className="px-3 py-2 border-b border-gray-50 bg-gray-50/50">
                               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Labels</span>
                             </div>
                             <div className="max-h-60 overflow-y-auto py-1">
                               {workspaceLabels.map(lbl => (
                                 <button
                                   key={lbl.id}
                                   onClick={() => toggleLabel(lbl.id)}
                                   className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                                 >
                                   <div className="flex items-center gap-2">
                                     <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LABEL_COLORS[lbl.color] }} />
                                     <span className="text-[12px] font-semibold text-gray-700">{lbl.name}</span>
                                   </div>
                                   {activeLabels.includes(lbl.id) && <Check size={14} className="text-[#25D366]" />}
                                 </button>
                               ))}
                               {workspaceLabels.length === 0 && (
                                 <div className="px-3 py-4 text-center text-xs text-gray-400">No labels created.</div>
                               )}
                             </div>
                           </motion.div>
                         </>
                       )}
                     </AnimatePresence>
                   </div>
                 </div>
                 <div className="flex flex-wrap gap-2 mb-4">
                   {activeLabels.map(labelId => {
                     const lbl = workspaceLabels.find(l => l.id === labelId);
                     if (!lbl) return null;
                     return (
                       <span key={labelId} className="px-2.5 py-1 text-[11px] font-bold text-white rounded-md shadow-sm" style={{ backgroundColor: LABEL_COLORS[lbl.color] }}>
                         {lbl.name}
                       </span>
                     );
                   })}
                   {activeLabels.length === 0 && <span className="text-slate-400 text-xs italic">No chat labels</span>}
                 </div>

                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contact Tags</h3>
                 <div className="flex flex-wrap gap-2">
                   {(isEditing ? formData.tags.split(',').filter(Boolean) : contact.tags).map(t => (
                     <span key={t.trim()} className="px-3 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold shadow-sm">
                       {t.trim()}
                     </span>
                   ))}
                   {(!isEditing && contact.tags.length === 0) && <span className="text-slate-400 text-xs italic">No tags</span>}
                 </div>
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Compact Information Cards (60%) */}
        <div className="flex-1 w-full lg:w-7/12 xl:w-8/12">
          <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm p-6 sm:p-8">
             <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
               Contact Information
             </h3>
             
             {/* 2-Column Grid Layout */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Full Name Card */}
                <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Full Name</label>
                   {!isEditing ? (
                     <p className="text-slate-900 font-bold text-sm truncate">{contact.name}</p>
                   ) : (
                     <input 
                       type="text" 
                       value={formData.name} 
                       onChange={e => setFormData({...formData, name: e.target.value})} 
                       className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                     />
                   )}
                </div>
                
                {/* Phone Card */}
                <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Phone Number</label>
                   {!isEditing ? (
                     <p className="text-slate-900 font-bold text-sm truncate">{contact.phoneNumber}</p>
                   ) : (
                     <input 
                       type="text" 
                       value={formData.phoneNumber} 
                       onChange={e => setFormData({...formData, phoneNumber: e.target.value})} 
                       className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                     />
                   )}
                </div>

                {/* Email Card */}
                <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Email Address</label>
                   {!isEditing ? (
                     <p className="text-slate-900 font-bold text-sm truncate">{contact.email || '—'}</p>
                   ) : (
                     <input 
                       type="email" 
                       value={formData.email} 
                       onChange={e => setFormData({...formData, email: e.target.value})} 
                       className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                     />
                   )}
                </div>

                {/* Company Card */}
                <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Company</label>
                   {!isEditing ? (
                     <p className="text-slate-900 font-bold text-sm truncate">{contact.company || '—'}</p>
                   ) : (
                     <input 
                       type="text" 
                       value={formData.company} 
                       onChange={e => setFormData({...formData, company: e.target.value})} 
                       className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                     />
                   )}
                </div>

                {/* Tags Card (Full Width) */}
                {isEditing && (
                  <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 md:col-span-2 hover:bg-slate-50 transition-colors">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tags (Comma Separated)</label>
                     <input 
                       type="text" 
                       value={formData.tags} 
                       onChange={e => setFormData({...formData, tags: e.target.value})} 
                       className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                       placeholder="e.g. VIP, SFMC DE"
                     />
                  </div>
                )}

             </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
