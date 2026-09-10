'use client';

// src/components/app/SalesCloudView.tsx
// Sales Cloud Integration Dashboard & Monitoring View

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Cloud, RefreshCw, UserCheck, MessageSquare, CheckCircle,
  AlertCircle, ExternalLink, ArrowRight, ShieldCheck, Database, Send
} from 'lucide-react';

interface ContactItem {
  id: string;
  name: string;
  phoneNumber: string;
  salesforceObjectType?: string;
  salesforceRecordId?: string;
  email?: string;
  company?: string;
  lastSyncedAt: string;
}

interface MessageItem {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: string;
  status: string;
  direction: 'INBOUND' | 'OUTBOUND';
}

export default function SalesCloudView() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');

  const workspaceId = 'salescloud-ws-1';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, mRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/contacts`),
        fetch(`/api/workspaces/${workspaceId}/messages`),
      ]);

      if (cRes.ok) {
        const cData = await cRes.json();
        setContacts(cData.contacts || []);
      }
      if (mRes.ok) {
        const mData = await mRes.json();
        setMessages(mData.messages || []);
      }
    } catch (err) {
      console.error('Error loading Sales Cloud data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone) return;
    setResolving(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/contacts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: newPhone, name: newName }),
      });

      if (res.ok) {
        setNewPhone('');
        setNewName('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed resolving contact:', err);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-8" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#00A1E0] via-[#0070D2] to-[#0B5CAD] text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-6 h-6" />
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full">Connected Workspace</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Salesforce Sales Cloud Connector</h1>
            <p className="text-sm text-blue-100 mt-1">
              Workspace Isolated (`salescloud-ws-1`) ⇄ Syncing WhatsApp Messages & Contacts with Sales Cloud records
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white px-4 py-2.5 rounded-xl font-semibold text-sm backdrop-blur-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Workspace
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0070D2] flex items-center justify-center">
              <UserCheck size={22} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Synced Contacts</p>
              <p className="text-xl font-bold text-gray-900">{contacts.length}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageSquare size={22} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Synced Messages</p>
              <p className="text-xl font-bold text-gray-900">{messages.length}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Workspace Isolation</p>
              <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle size={14} /> Enforced
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Database size={22} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Lead Convert Webhook</p>
              <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle size={14} /> Active
              </p>
            </div>
          </div>
        </div>

        {/* Content Section: Synced Contacts & Resolve Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Contacts Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-gray-900 text-base">Sales Cloud Contacts & Leads</h2>
              <span className="text-xs text-gray-400 font-normal">Workspace: salescloud-ws-1</span>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Contact / Lead</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Salesforce ID</th>
                    <th className="py-3 px-4">Sync Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {contacts.map(c => (
                    <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        {c.name}
                        <div className="text-xs font-normal text-gray-400">{c.email || c.company}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-600">{c.phoneNumber}</td>
                      <td className="py-3.5 px-4">
                        <span className="bg-blue-50 text-[#0070D2] px-2 py-0.5 rounded text-xs font-mono font-medium">
                          {c.salesforceRecordId || c.id}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500">
                        {new Date(c.lastSyncedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                        No contacts synced yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resolve Contact Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-900 text-base">Resolve Contact / Lead</h2>
            <p className="text-xs text-gray-500">
              Query or idempotently create a Lead record in Sales Cloud for incoming WhatsApp numbers.
            </p>

            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9952374972"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0070D2]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Waseem"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0070D2]"
                />
              </div>

              <button
                type="submit"
                disabled={resolving}
                className="w-full bg-[#0070D2] hover:bg-[#005fb3] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                {resolving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Resolve in Sales Cloud
              </button>
            </form>
          </div>
        </div>

        {/* Message Log */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 text-base mb-4">Workspace Message Log (`WhatsApp_Message__c`)</h2>
          <div className="space-y-3">
            {messages.map(m => (
              <div key={m.id} className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex justify-between items-center text-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${m.direction === 'OUTBOUND' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {m.direction}
                    </span>
                    <span className="font-mono text-xs text-gray-500">{m.senderId} ➔ {m.recipientId}</span>
                  </div>
                  <p className="text-gray-800 font-medium">{m.content}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 block">{new Date(m.timestamp).toLocaleTimeString()}</span>
                  <span className="text-xs font-semibold text-emerald-600">{m.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
