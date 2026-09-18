'use client';

// src/components/app/ChatsView.tsx
// Chat screen — Zone 2 ChatList (420px) + Zone 3 ChatWindow (flexible) + Zone 4 CrmIntelligencePanel (380px)

import React, { useState, useEffect, useMemo } from 'react';
import { Zap, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatList from '@/components/ChatList';
import ChatWindow from '@/components/ChatWindow';
import CrmIntelligencePanel from '@/components/CrmIntelligencePanel';
import AddRecipientModal from '@/components/AddRecipientModel';
import ToastNotification from '@/components/ToastNotification';
import { useRealtimeMessages } from '@/app/hooks/useRealtimeMessages';
import { useGlobalNotifications } from '@/app/hooks/useGlobalNotifications';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { Contact, Message, MessageStatus } from '@/types';

// Helper: normalize phone number by stripping non-digit characters
function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '');
}

export default function ChatsView() {
  const {
    activeWorkspace,
    activeContacts: workspaceContacts,
    activeFastReplies,
  } = useWorkspace();

  const [allBackendContacts, setAllBackendContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  
  // Call hook unconditionally
  const { messages: realtimeMessages, phoneNumber: realtimeMessagesPhone } = useRealtimeMessages(
    selectedContact, 
    activeWorkspace?.id || 'sfmc-ws-1'
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [config, setConfig] = useState({ accessToken: '', phoneNumberId: '' });
  const [showFastReply, setShowFastReply] = useState(false);

  // Global notification system
  const selectedPhoneNormalized = selectedContact ? normalizePhone(selectedContact.phoneNumber) : null;
  const {
    unreadCounts,
    clearUnread,
    latestNotification,
    dismissNotification,
    incomingMessageEvent,
  } = useGlobalNotifications(
    selectedPhoneNormalized,
    activeWorkspace?.id || 'sfmc-ws-1'
  );

  // ─── STRICT WORKSPACE FILTERING ───
  const filteredContacts: Contact[] = useMemo(() => {
    const wsId = activeWorkspace?.id || 'sfmc-ws-1';

    if (workspaceContacts && workspaceContacts.length > 0) {
      const matchingWsContacts = workspaceContacts.filter(wc => wc.workspaceId === wsId);
      if (matchingWsContacts.length > 0) {
        return matchingWsContacts.map(wc => {
          const normPhone = normalizePhone(wc.phoneNumber);
          const backendMatch = allBackendContacts.find(
            bc => normalizePhone(bc.phoneNumber) === normPhone
          );

          return {
            id: backendMatch?.id || wc.id,
            name: wc.name, 
            phoneNumber: normPhone,
            avatar: wc.avatar || backendMatch?.avatar,
            online: undefined,
            lastSeen: backendMatch?.lastSeen,
          } as Contact;
        });
      }
    }

    return allBackendContacts;
  }, [workspaceContacts, allBackendContacts, activeWorkspace?.id]);

  // Auto-select initial contact (Mohamed Waseem) if none selected
  useEffect(() => {
    if (!selectedContact) {
      if (filteredContacts.length > 0) {
        setSelectedContact(filteredContacts[0]);
      } else {
        setSelectedContact({
          id: 'contact-mw-1',
          name: 'Mohamed Waseem',
          phoneNumber: '+91 99523 74972',
          online: false,
          lastSeen: 'offline',
        });
      }
    }
  }, [filteredContacts, selectedContact]);

  // Real-time synchronization for background updates
  useEffect(() => {
    if (incomingMessageEvent) {
      const normPhone = normalizePhone(incomingMessageEvent.phoneNumber);
      setMessages(prev => {
        const contactMessages = prev[normPhone] || [];
        if (contactMessages.some(m => m.id === incomingMessageEvent.message.id)) {
          return {
            ...prev,
            [normPhone]: contactMessages.map(m => m.id === incomingMessageEvent.message.id ? { ...m, ...incomingMessageEvent.message } : m)
          };
        }
        return {
          ...prev,
          [normPhone]: [...contactMessages, incomingMessageEvent.message]
        };
      });
    }
  }, [incomingMessageEvent]);

  // Load config on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('whatsappConfig');
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      if (parsedConfig.accessToken && parsedConfig.phoneNumberId) {
        setConfig(parsedConfig);
      } else {
        localStorage.removeItem('whatsappConfig');
      }
    }

    fetch('/api/get-env-variables')
      .then(r => r.json())
      .then(data => {
        const token = data.env?.accessToken || data.accessToken || data.config?.accessToken;
        const phoneId = data.env?.phoneNumberId || data.phoneNumberId || data.config?.phoneNumberId;
        if (token && phoneId) {
          const autoConfig = { accessToken: token, phoneNumberId: phoneId };
          setConfig(autoConfig);
          localStorage.setItem('whatsappConfig', JSON.stringify(autoConfig));
        }
      })
      .catch(() => {});
  }, []);

  // Hydrate conversations according to the ACTIVE WORKSPACE
  useEffect(() => {
    const wsId = activeWorkspace?.id || 'sfmc-ws-1';
    const isSalesCloud = activeWorkspace?.type === 'salescloud' || activeWorkspace?.platform === 'sales_cloud' || wsId === 'salescloud-ws-1';
    const wsKey = isSalesCloud
      ? (process.env.NEXT_PUBLIC_WORKSPACE_SALESCLOUD_API_KEY || 'salescloud-ws-key-secret')
      : (process.env.NEXT_PUBLIC_WORKSPACE_SFMC_API_KEY || 'sfmc-secret-key-123');

    setAllBackendContacts([]);
    setMessages({});

    fetch(`/api/workspaces/${wsId}/contacts`, {
      headers: { 'X-Workspace-Key': wsKey }
    })
      .then(res => res.json())
      .then(data => {
        if (data.contacts && Array.isArray(data.contacts)) {
          const wsContacts: Contact[] = data.contacts.map((c: any) => ({
            id: c.id || c.sourceRecordId || c.phoneNumber,
            name: c.name || c.phoneNumber,
            phoneNumber: normalizePhone(c.phoneNumber),
            online: undefined,
          }));
          setAllBackendContacts(wsContacts);

          if (!isSalesCloud) {
            fetch('/api/sfmc/messages')
              .then(r => r.json())
              .then(msgData => {
                if (msgData.messages && Array.isArray(msgData.messages)) {
                  const initialMessages: Record<string, Message[]> = {};
                  const phoneSuffixMap = new Map<string, string>();
                  wsContacts.forEach(c => {
                    const digits = c.phoneNumber.replace(/[^0-9]/g, '');
                    if (digits.length >= 10) {
                      phoneSuffixMap.set(digits.slice(-10), c.phoneNumber);
                    }
                  });

                  msgData.messages.forEach((msg: any) => {
                    const rawPhone = normalizePhone(msg.phone || msg.contactKey);
                    if (!rawPhone) return;
                    
                    const digits = rawPhone.replace(/[^0-9]/g, '');
                    const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
                    const matchedPhone = phoneSuffixMap.get(last10);
                    
                    if (!matchedPhone) return;
                    const normPhone = matchedPhone;

                    if (!initialMessages[normPhone]) {
                      initialMessages[normPhone] = [];
                    }
                    initialMessages[normPhone].push({
                      id: 'sfmc-' + (msg.wamid || msg.id),
                      content: msg.body,
                      timestamp: msg.timestamp,
                      sender: msg.direction === 'sent' ? 'user' : 'contact',
                      status: msg.status === 'read' ? MessageStatus.READ : msg.status === 'delivered' ? MessageStatus.DELIVERED : MessageStatus.SENT,
                      recipientId: normPhone,
                      attachments: false
                    });
                  });

                  Object.keys(initialMessages).forEach(phone => {
                    initialMessages[phone].sort((a, b) => 
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );
                  });

                  setMessages(prev => ({ ...initialMessages, ...prev }));
                }
              })
              .catch(err => console.error('Failed to hydrate messages from SFMC:', err));
          } else {
            Promise.all(
              wsContacts.map(async c => {
                if (!c.phoneNumber) return null;
                try {
                  const res = await fetch(`/api/conversations/${c.phoneNumber}/messages?workspaceId=${wsId}`, {
                    headers: { 'X-Workspace-Key': wsKey }
                  });
                  if (res.ok) {
                    const resData = await res.json();
                    if (resData.messages && Array.isArray(resData.messages)) {
                      return { phone: c.phoneNumber, msgs: resData.messages };
                    }
                  }
                } catch (e) { /* ignore */ }
                return null;
              })
            ).then(results => {
              const scMessages: Record<string, Message[]> = {};
              results.forEach(r => {
                if (r && r.msgs && r.msgs.length > 0) {
                  scMessages[r.phone] = r.msgs;
                }
              });
              setMessages(prev => ({ ...scMessages, ...prev }));
            });
          }
        } else {
          setAllBackendContacts([]);
        }
      })
      .catch(err => {
        console.warn('Failed to load contacts for workspace:', wsId, err);
        setAllBackendContacts([]);
      });
  }, [activeWorkspace?.id, activeWorkspace?.type]);

  // Real-time messages sync
  useEffect(() => {
    if (selectedContact && realtimeMessages.length > 0) {
      const key = normalizePhone(selectedContact.phoneNumber);
      if (realtimeMessagesPhone && realtimeMessagesPhone !== key) return;
      const seen = new Set<string>();
      const deduped = realtimeMessages.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessages(prev => ({ ...prev, [key]: deduped }));
    }
  }, [realtimeMessages, realtimeMessagesPhone, selectedContact]);

  const handleAddContact = async (contact: Contact) => {
    setAllBackendContacts(prev => [...prev, contact]);
    setShowAddModal(false);

    try {
      await fetch('/api/sfmc/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contact.name, phoneNumber: contact.phoneNumber })
      });
    } catch (err) {
      console.error('Failed to save contact to SFMC DE:', err);
    }
  };

  const handleEditContact = (updatedContact: Contact) => {
    setAllBackendContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
    if (selectedContact?.id === updatedContact.id) setSelectedContact(updatedContact);
  };

  const handleDeleteContact = (contactId: string) => {
    setAllBackendContacts(prev => prev.filter(c => c.id !== contactId));
    if (selectedContact?.id === contactId) setSelectedContact(null);
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    clearUnread(contact.phoneNumber);
    setShowFastReply(false);
  };

  const handleToastClick = (phoneNumber: string) => {
    dismissNotification();
    const normalized = normalizePhone(phoneNumber);
    const contact = filteredContacts.find(c => normalizePhone(c.phoneNumber) === normalized);
    if (contact) {
      setSelectedContact(contact);
      clearUnread(phoneNumber);
    }
  };

  const sendMessage = async (content: string, options?: { mediaId?: string; mediaType?: string; mimeType?: string; filename?: string; mediaData?: string }) => {
    if (!selectedContact) return;
    const key = normalizePhone(selectedContact.phoneNumber);

    const newMessage: Message = {
      id: Date.now().toString(),
      content: content || '',
      timestamp: new Date().toISOString(),
      sender: 'user',
      status: MessageStatus.PENDING,
      recipientId: key,
      attachments: !!options?.mediaId,
      mediaType: (options?.mediaType as any) || 'text',
      mediaId: options?.mediaId,
      mimeType: options?.mimeType,
      filename: options?.filename
    };

    setMessages(prev => {
      const contactMessages = prev[key] || [];
      const updatedMessages = [...contactMessages, newMessage];
      return { ...prev, [key]: updatedMessages };
    });

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedContact.phoneNumber,
          message: content,
          accessToken: config.accessToken,
          phoneNumberId: config.phoneNumberId,
          localId: newMessage.id,
          workspaceId: activeWorkspace?.id || 'sfmc-ws-1',
          mediaId: options?.mediaId,
          mediaType: options?.mediaType,
          mimeType: options?.mimeType,
          filename: options?.filename
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send message');
      }

      const responseData = await response.json();
      const trueWamid = responseData.data?.messages?.[0]?.id || newMessage.id;

      setMessages(prev => ({
        ...prev,
        [key]: (prev[key] || []).map(msg => msg.id === newMessage.id ? { ...msg, id: trueWamid, status: MessageStatus.SENT } : msg)
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => ({
        ...prev,
        [key]: (prev[key] || []).map(msg => msg.id === newMessage.id ? { ...msg, status: MessageStatus.FAILED } : msg)
      }));
    }
  };

  const handleFastReplySelect = (body: string) => {
    setShowFastReply(false);
    if (selectedContact) {
      sendMessage(body);
    }
  };

  const simulateIncomingMessage = (contact: Contact, content: string) => {
    const key = normalizePhone(contact.phoneNumber);
    const incomingMessage: Message = {
      id: Date.now().toString(), content, timestamp: new Date().toISOString(),
      sender: 'contact', status: MessageStatus.DELIVERED, recipientId: 'me', attachments: false
    };
    setMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), incomingMessage] }));
  };

  const DEFAULT_MW_MESSAGES: Message[] = [
    {
      id: 'mw-msg-1',
      content: 'Hi Team,\nPlease find the document attached.',
      timestamp: '2026-09-09T13:03:00.000Z',
      sender: 'contact',
      status: MessageStatus.READ,
      recipientId: '919952374972',
      attachments: false,
    },
    {
      id: 'mw-msg-2',
      content: '[Media: document: sfmc-doc-1] SFMC_Engagement_Overview.pdf',
      filename: 'SFMC_Engagement_Overview.pdf',
      timestamp: '2026-09-09T13:03:05.000Z',
      sender: 'contact',
      status: MessageStatus.READ,
      recipientId: '919952374972',
      attachments: true,
      mediaType: 'document',
    },
    {
      id: 'mw-msg-3',
      content: 'Thanks for sharing!\nWe will review and get back to you soon.',
      timestamp: '2026-09-09T13:04:00.000Z',
      sender: 'user',
      status: MessageStatus.READ,
      recipientId: '919952374972',
      attachments: false,
    },
    {
      id: 'mw-msg-4',
      content: 'Please also find the latest screenshots.',
      timestamp: '2026-09-09T13:05:00.000Z',
      sender: 'contact',
      status: MessageStatus.READ,
      recipientId: '919952374972',
      attachments: false,
    },
    {
      id: 'mw-msg-5',
      content: '[Media: image: draft2-img] Draft 2.jpeg',
      filename: 'Draft 2.jpeg',
      timestamp: '2026-09-09T13:05:30.000Z',
      sender: 'contact',
      status: MessageStatus.READ,
      recipientId: '919952374972',
      attachments: true,
      mediaType: 'image',
    },
    {
      id: 'mw-msg-6',
      content: 'Perfect! 👍',
      timestamp: '2026-09-09T13:05:45.000Z',
      sender: 'user',
      status: MessageStatus.READ,
      recipientId: '919952374972',
      attachments: false,
    },
    {
      id: 'mw-msg-7',
      content: '[Media: image: chatgpt-img] ChatGPT Image Sep 2, 2026, 12_16_55 PM.png',
      filename: 'ChatGPT Image Sep 2, 2026, 12_16_55 PM.png',
      timestamp: '2026-09-09T13:12:00.000Z',
      sender: 'contact',
      status: MessageStatus.READ,
      recipientId: '919952374972',
      attachments: true,
      mediaType: 'image',
    },
    {
      id: 'mw-msg-8',
      content: 'Got it. Thanks!',
      timestamp: '2026-09-09T13:13:00.000Z',
      sender: 'user',
      status: MessageStatus.READ,
      recipientId: '919952374972',
      attachments: false,
    },
  ];

  const getContactMessages = (phoneNumber: string): Message[] => {
    const norm = normalizePhone(phoneNumber);
    let list = messages[norm] || messages[phoneNumber] || [];
    if (list.length === 0 && norm.length >= 10) {
      const last10 = norm.slice(-10);
      const matchedKey = Object.keys(messages).find(k => k.endsWith(last10));
      if (matchedKey) list = messages[matchedKey];
    }
    const cleanList = list.filter(m => m.content && !m.content.includes('formatted phone') && !m.content.includes('Outbound from Sales Cloud'));
    if (cleanList.length === 0 && (norm.includes('9952374972') || phoneNumber.includes('9952374972'))) {
      return DEFAULT_MW_MESSAGES;
    }
    return cleanList;
  };

  const accentColor = '#00C853';

  return (
    <div className="flex flex-1 h-full w-full overflow-hidden">
      
      {/* Zone 2 — Conversation List (Width: 320px) */}
      <div className="h-full flex flex-col border-r border-slate-200/80 bg-white w-[320px] shrink-0">
        <ChatList
          contacts={filteredContacts}
          selectedContact={selectedContact}
          onSelectContact={handleContactSelect}
          onEditContact={handleEditContact}
          onDeleteContact={handleDeleteContact}
          messages={messages}
          unreadCounts={unreadCounts}
          onShowAddModal={() => setShowAddModal(true)}
        />
      </div>

      {/* Zone 3 — Chat Workspace (Flexible / Main Section) */}
      <div className="flex-1 h-full flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #FBFEFD 0%, #F5FBF8 100%)' }}>
        {selectedContact ? (
          <>
            <ChatWindow
              contact={selectedContact}
              messages={getContactMessages(selectedContact.phoneNumber)}
              onSendMessage={sendMessage}
              onSimulateIncoming={() => simulateIncomingMessage(selectedContact, 'This is a test reply')}
              onCloseChat={() => setSelectedContact(null)}
            />

            {/* ⚡ Fast Reply Floating Action Button */}
            <motion.button
              onClick={() => setShowFastReply(!showFastReply)}
              title="Fast Replies"
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              className="absolute bottom-20 right-6 w-11 h-11 rounded-full flex items-center justify-center shadow-lg z-30 transition-all cursor-pointer"
              style={{
                background: showFastReply
                  ? 'linear-gradient(135deg, #00C853 0%, #00E676 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                border: showFastReply ? 'none' : `2px solid ${accentColor}40`,
                boxShadow: showFastReply
                  ? '0 4px 20px rgba(0,200,83,0.35)'
                  : '0 4px 16px rgba(0,200,83,0.15)',
                color: showFastReply ? '#ffffff' : accentColor,
              }}
            >
              {showFastReply ? <X size={18} /> : <Zap size={18} />}
            </motion.button>

            {/* Fast Reply Expandable Panel */}
            <AnimatePresence>
              {showFastReply && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="absolute bottom-32 right-6 w-80 max-h-90 overflow-y-auto rounded-2xl z-30 bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl p-0"
                >
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#00C853] flex items-center justify-center">
                        <Zap size={14} />
                      </div>
                      Quick Replies
                    </div>
                    <span className="text-[11px] text-slate-400 font-bold">
                      {activeFastReplies.length} available
                    </span>
                  </div>

                  {activeFastReplies.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#00C853] flex items-center justify-center mx-auto mb-2 opacity-70">
                        <Zap size={22} />
                      </div>
                      <p className="text-xs font-bold text-slate-700">No quick replies yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Add them in the Fast Reply tab</p>
                    </div>
                  ) : (
                    <div className="p-3 flex flex-wrap gap-2">
                      {activeFastReplies.map((fr, idx) => (
                        <button
                          key={fr.id}
                          onClick={() => handleFastReplySelect(fr.body)}
                          className="px-3 py-2 rounded-xl border border-slate-200 hover:border-[#00C853] hover:bg-emerald-50/60 text-slate-700 text-xs font-bold text-left transition-all shadow-2xs"
                        >
                          {fr.title}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 text-[#00C853]">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900">WhatZupp Enterprise Workspace</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Select a contact conversation from the left to view messages and CRM intelligence.
            </p>
          </div>
        )}
      </div>

      {/* Zone 4 — CRM Intelligence Panel (Width: 380px) */}
      <CrmIntelligencePanel contact={selectedContact} onUpdateContact={handleEditContact} />

      {/* Add Recipient Modal */}
      {showAddModal && (
        <AddRecipientModal
          onAdd={handleAddContact}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Toast Notification */}
      {latestNotification && (
        <ToastNotification
          phoneNumber={latestNotification.phoneNumber}
          contactName={latestNotification.contactName}
          messagePreview={latestNotification.message.content}
          onDismiss={dismissNotification}
          onClick={handleToastClick}
        />
      )}
    </div>
  );
}
