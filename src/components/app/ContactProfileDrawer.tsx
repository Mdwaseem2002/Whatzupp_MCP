import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, MessageSquare, Phone, Mail, Sparkles, Building2, Users,
  Clock, Activity, Tag, BarChart3, Cloud, FileText, CheckCircle2, Link2, Globe
} from 'lucide-react';
import type { WorkspaceContact } from '@/types/workspace';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

interface ContactProfileDrawerProps {
  contact: WorkspaceContact | null;
  onClose: () => void;
  onStartChat: (contact: WorkspaceContact) => void;
}

type TabType = 'overview' | 'activity' | 'notes' | 'crm';

export default function ContactProfileDrawer({ contact, onClose, onStartChat }: ContactProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { activeWorkspace } = useWorkspace();

  if (!contact) return null;

  const initials = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'CT';
  const isSalesCloud = activeWorkspace?.type === 'salescloud' || activeWorkspace?.platform === 'sales_cloud' || activeWorkspace?.id === 'salescloud-ws-1';

  return (
    <div className="fixed inset-y-0 right-0 z-[100] flex justify-end pointer-events-none w-full">
      
      {/* Backdrop (invisible but clickable to close, optional if we want it to close on outside click) */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px] pointer-events-auto"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.25, type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-[480px] h-full bg-[#F8FAFC] shadow-2xl pointer-events-auto flex flex-col font-sans overflow-hidden border-l border-slate-200"
      >
        
        {/* Banner Header */}
        <div className="h-32 bg-gradient-to-tr from-slate-900 via-[#052E2B] to-[#00C853] shrink-0 relative">
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-sm transition-all"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Profile Info Overlay */}
        <div className="px-6 relative -mt-12 shrink-0">
          <div className="flex items-end justify-between">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200">
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-emerald-400 to-[#00C853] flex items-center justify-center font-black text-white text-3xl shadow-inner relative overflow-hidden">
                  {initials}
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                </div>
              </div>
            </div>
            
            {/* Quick Action Buttons */}
            <div className="flex gap-2 pb-2">
              <button 
                onClick={() => onStartChat(contact)}
                className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00C853] border border-emerald-200 hover:bg-[#00C853] hover:text-white flex items-center justify-center transition-all shadow-sm"
                title="Message"
              >
                <MessageSquare size={18} />
              </button>
              <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all shadow-sm" title="Call">
                <Phone size={18} />
              </button>
              <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all shadow-sm" title="Email">
                <Mail size={18} />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              {contact.name}
              <CheckCircle2 size={18} className="text-blue-500" />
            </h2>
            <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mt-1">
              <Building2 size={15} />
              <span>{contact.company || 'Pentacloud Consulting'}</span>
              <span className="text-slate-300">•</span>
              <Globe size={14} />
              <span>Dubai, UAE</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 mt-6 shrink-0 border-b border-slate-200/80">
          <div className="flex items-center gap-6">
            {(['overview', 'activity', 'notes', 'crm'] as TabType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-extrabold capitalize transition-all relative ${
                  activeTab === tab ? 'text-[#00C853]' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00C853] rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Contact Intelligence (KPI Grid) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Activity size={12} className="text-[#00C853]" /> Lead Score</span>
                    <span className="text-2xl font-black text-slate-900 tracking-tight">87<span className="text-xs text-emerald-500 ml-1 font-bold">↑ High</span></span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><MessageSquare size={12} className="text-blue-500" /> Total Messages</span>
                    <span className="text-2xl font-black text-slate-900 tracking-tight">342</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock size={12} className="text-purple-500" /> Customer Since</span>
                    <span className="text-sm font-bold text-slate-800 mt-1">Mar 2024</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Users size={12} className="text-amber-500" /> Record Owner</span>
                    <span className="text-sm font-bold text-slate-800 mt-1">Waseem (Sales)</span>
                  </div>
                </div>

                {/* Contact Information Box */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Link2 size={14} className="text-slate-400" /> Connect Details
                    </h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Phone</span>
                      <span className="text-sm font-semibold text-slate-800 font-mono mt-0.5">{contact.phoneNumber}</span>
                    </div>
                    {contact.email && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Email</span>
                        <span className="text-sm font-semibold text-slate-800 mt-0.5">{contact.email}</span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">Tags / Labels</span>
                      <div className="flex flex-wrap gap-1.5">
                        {contact.tags.map(t => (
                          <span key={t} className="px-2 py-1 rounded-md text-[10px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ACTIVITY TIMELINE TAB */}
            {activeTab === 'activity' && (
              <motion.div key="activity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pb-4">
                  
                  <div className="relative pl-6">
                    <div className="absolute w-4 h-4 rounded-full bg-[#00C853] ring-4 ring-emerald-50 -left-[9px] top-1"></div>
                    <p className="text-[10px] font-extrabold text-[#00C853] mb-1 uppercase tracking-wider">Today, 10:45 AM</p>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-sm font-bold text-slate-800 mb-1">WhatsApp message delivered</p>
                      <p className="text-xs text-slate-500 font-medium">Campaign template "Q4 Kickoff" was delivered successfully.</p>
                    </div>
                  </div>

                  <div className="relative pl-6">
                    <div className="absolute w-4 h-4 rounded-full bg-blue-500 ring-4 ring-blue-50 -left-[9px] top-1"></div>
                    <p className="text-[10px] font-extrabold text-slate-400 mb-1 uppercase tracking-wider">Yesterday, 03:15 PM</p>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-sm font-bold text-slate-800 mb-1">Lead status updated to Qualified</p>
                      <p className="text-xs text-slate-500 font-medium">Triggered by high engagement score.</p>
                    </div>
                  </div>

                  <div className="relative pl-6">
                    <div className="absolute w-4 h-4 rounded-full bg-slate-300 ring-4 ring-slate-50 -left-[9px] top-1"></div>
                    <p className="text-[10px] font-extrabold text-slate-400 mb-1 uppercase tracking-wider">Aug 28, 09:00 AM</p>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-sm font-bold text-slate-800 mb-1">Contact synchronized</p>
                      <p className="text-xs text-slate-500 font-medium">Imported from {isSalesCloud ? 'Salesforce Sales Cloud' : 'SFMC Data Extension'}.</p>
                    </div>
                  </div>
                  
                </div>
              </motion.div>
            )}

            {/* NOTES TAB */}
            {activeTab === 'notes' && (
              <motion.div key="notes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                <textarea 
                  className="w-full h-32 p-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00C853] focus:border-transparent resize-none shadow-sm placeholder:text-slate-400"
                  placeholder="Type a note here..."
                />
                <button className="px-5 py-2.5 bg-slate-900 text-white text-xs font-extrabold rounded-xl shadow-sm hover:bg-slate-800 transition-colors">
                  Save Note
                </button>

                <div className="mt-6 space-y-3">
                  <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-2xl">
                    <p className="text-[10px] font-extrabold text-yellow-600 mb-2 uppercase tracking-wider">Aug 15 • Pinned</p>
                    <p className="text-sm text-slate-700 font-medium leading-relaxed">Client is interested in the enterprise upgrade but needs approval from the board. Follow up next quarter.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CRM TAB */}
            {activeTab === 'crm' && (
              <motion.div key="crm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud size={16} className={isSalesCloud ? "text-blue-600" : "text-[#00C853]"} />
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        {isSalesCloud ? 'Sales Cloud Sync' : 'Marketing Cloud Integration'}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-extrabold">CONNECTED</span>
                  </div>
                  
                  <div className="p-5 space-y-5">
                    
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Salesforce Record</span>
                        <p className="text-sm font-semibold text-slate-800 mt-1">{isSalesCloud ? 'Contact (003xx)' : 'Subscriber Key'}</p>
                      </div>
                      <button className="text-blue-600 hover:text-blue-800 text-[10px] font-extrabold uppercase bg-blue-50 px-2 py-1 rounded">View in CRM ↗</button>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Lead Status</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00C853]"></span>
                        <p className="text-sm font-bold text-slate-900">Qualified Lead</p>
                      </div>
                    </div>

                    {!isSalesCloud && (
                      <>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Active Journey</span>
                          <p className="text-sm font-semibold text-slate-800 mt-1">Enterprise Onboarding Q3</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Data Extension</span>
                          <p className="text-sm font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded mt-1 inline-block border border-slate-100">SFMC_VIP_Leads_2026</p>
                        </div>
                      </>
                    )}

                    {isSalesCloud && (
                      <>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Recent Campaign</span>
                          <p className="text-sm font-semibold text-slate-800 mt-1">Dreamforce 2026 Follow-up</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Opportunity</span>
                          <p className="text-sm font-semibold text-blue-600 mt-1 cursor-pointer hover:underline">New Business - 50 Licenses</p>
                        </div>
                      </>
                    )}

                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* AI Assistant Sticky Footer */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-purple-600 fill-purple-100" />
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">AI Insights & Actions</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="flex-1 py-2 px-3 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[11px] font-extrabold transition-colors">
              Summarize Contact
            </button>
            <button className="flex-1 py-2 px-3 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 text-[11px] font-extrabold transition-colors">
              Draft Follow-up
            </button>
            <button className="w-full py-2 px-3 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 text-[11px] font-extrabold transition-colors flex items-center justify-center gap-2">
              <FileText size={12} /> Extract Sentiment Analysis
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
