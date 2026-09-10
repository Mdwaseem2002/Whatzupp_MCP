'use client';

// src/components/app/ChatsView.tsx
// Chat screen — ChatList + ChatWindow. Templates & Broadcasts now live in their own sidebar screens.
// STRICT WORKSPACE ISOLATION: only contacts saved in the active workspace appear.
// Fast reply templates accessible via ⚡ overlay button in the chat area.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserPlus, Zap, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatList from '@/components/ChatList';
import ChatWindow from '@/components/ChatWindow';
import AddRecipientModal from '@/components/AddRecipientModel';
import ToastNotification from '@/components/ToastNotification';
import { useRealtimeMessages } from '@/app/hooks/useRealtimeMessages';
import { useGlobalNotifications } from '@/app/hooks/useGlobalNotifications';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { Contact, Message, MessageStatus } from '@/types';



// Helper: normalize phone number by stripping leading '+'
function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  return String(phone).replace(/^\+/, '');
}

export default function ChatsView() {
  const {
    activeWorkspace,
    activeContacts: workspaceContacts, // contacts from WorkspaceProvider scoped to the active workspace
    activeFastReplies,
  } = useWorkspace();

  const [allBackendContacts, setAllBackendContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const { messages: realtimeMessages, phoneNumber: realtimeMessagesPhone } = useRealtimeMessages(selectedContact);
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
  } = useGlobalNotifications(selectedPhoneNormalized);

  // ─── STRICT WORKSPACE FILTERING ───
  // Build the contacts list for ChatList using ONLY workspace contacts.
  // For each workspace contact, check if there's a matching backend conversation
  // and use the workspace contact's name (not "Unknown" or raw phone number).
  // ─── STRICT WORKSPACE FILTERING ───
  // Build the contacts list for ChatList using ONLY contacts belonging to the active workspace.
  const filteredContacts: Contact[] = useMemo(() => {
    const wsId = activeWorkspace?.id || 'sfmc-ws-1';

    // 1. If we have workspaceContacts matching activeWorkspace.id, use them
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

    // 2. Fallback to allBackendContacts loaded specifically for the active workspace
    return allBackendContacts;
  }, [workspaceContacts, allBackendContacts, activeWorkspace?.id]);

  // Clear selected contact when workspace changes
  useEffect(() => {
    setSelectedContact(null);
  }, [activeWorkspace?.id]);

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

    // Reset contacts and messages whenever active workspace changes
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
            // Hydrate messages for SFMC workspace contacts from SFMC DEs
            fetch('/api/sfmc/messages')
              .then(r => r.json())
              .then(msgData => {
                if (msgData.messages && Array.isArray(msgData.messages)) {
                  const initialMessages: Record<string, Message[]> = {};
                  const sfmcPhones = new Set(wsContacts.map(c => c.phoneNumber));

                  msgData.messages.forEach((msg: any) => {
                    const normPhone = normalizePhone(msg.phone || msg.contactKey);
                    if (!normPhone || !sfmcPhones.has(normPhone)) return;

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

                  setMessages(prev => ({ ...initialMessages, ...prev }));
                }
              })
              .catch(err => console.error('Failed to hydrate messages from SFMC:', err));
          } else {
            // Hydrate messages for Sales Cloud workspace contacts
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
      // Deduplicate by message id to prevent duplicate key React errors
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
    // Optimistic UI update
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
      // We no longer call /api/messages here. The backend /api/send-message will handle it 
      // with the correct wamid, preventing duplicate entries.
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

  // Handle fast reply selection — send the message immediately
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

  const getContactMessages = (phoneNumber: string): Message[] => {
    return messages[normalizePhone(phoneNumber)] || [];
  };

  const accentColor = '#25D366';

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Left Sidebar — Chat List */}
      <div className="h-full flex flex-col border-r" style={{ width: '340px', borderColor: '#e2e8f0', background: '#ffffff', flexShrink: 0 }}>
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

      {/* Right Side — Chat Window + Fast Reply Overlay */}
      <div className="flex-1 h-full flex flex-col" style={{ background: '#f8fafc', position: 'relative' }}>
        {selectedContact ? (
          <>
            <ChatWindow
              contact={selectedContact}
              messages={getContactMessages(selectedContact.phoneNumber)}
              onSendMessage={sendMessage}
              onSimulateIncoming={() => simulateIncomingMessage(selectedContact, 'This is a test reply')}
              onCloseChat={() => setSelectedContact(null)}
            />

            {/* ⚡ Fast Reply Button — premium floating button */}
            <motion.button
              onClick={() => setShowFastReply(!showFastReply)}
              title="Fast Replies"
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              animate={showFastReply ? { rotate: 0 } : { rotate: 0 }}
              style={{
                position: 'absolute', bottom: '76px', right: '20px',
                width: '44px', height: '44px', borderRadius: '50%',
                background: showFastReply
                  ? 'linear-gradient(135deg, #25D366 0%, #1ebe5d 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                border: showFastReply ? 'none' : `2px solid ${accentColor}40`,
                boxShadow: showFastReply
                  ? '0 4px 20px rgba(37,211,102,0.35)'
                  : '0 4px 16px rgba(37,211,102,0.15)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', zIndex: 30,
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
                  style={{
                    position: 'absolute', bottom: '128px', right: '16px',
                    width: '320px', maxHeight: '360px', overflowY: 'auto',
                    borderRadius: '20px',
                    zIndex: 30,
                    background: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: '1px solid rgba(226,232,240,0.8)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
                  }}>
                  <div style={{
                    padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      fontSize: '14px', fontWeight: '700', color: '#0f172a',
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}08)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Zap size={14} style={{ color: accentColor }} />
                      </div>
                      Quick Replies
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                      {activeFastReplies.length} available
                    </span>
                  </div>
                  {activeFastReplies.length === 0 ? (
                    <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '14px',
                        background: `${accentColor}08`, margin: '0 auto 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Zap size={22} style={{ color: accentColor, opacity: 0.5 }} />
                      </div>
                      <p style={{ color: '#64748b', fontSize: '13px', fontWeight: '600', margin: '0 0 4px' }}>
                        No quick replies yet
                      </p>
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                        Add them in the Fast Reply tab
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {activeFastReplies.map((fr, idx) => (
                        <motion.button
                          key={fr.id}
                          onClick={() => handleFastReplySelect(fr.body)}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.04 }}
                          whileHover={{ scale: 1.04, y: -1 }}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: '8px 14px', border: '1px solid #e2e8f0',
                            borderRadius: '20px', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            textAlign: 'left', transition: 'all 0.15s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            fontSize: '12px', fontWeight: '600', color: '#334155',
                            fontFamily: "'Inter', sans-serif",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = `${accentColor}08`;
                            e.currentTarget.style.borderColor = `${accentColor}30`;
                            e.currentTarget.style.color = accentColor;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.color = '#334155';
                          }}
                        >
                          {fr.title}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center" style={{
            background: 'radial-gradient(ellipse at 50% 40%, rgba(37,211,102,0.04) 0%, transparent 60%)',
          }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 mx-auto"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}12, ${accentColor}06)`,
                  border: `1px solid ${accentColor}18`,
                  boxShadow: `0 8px 32px ${accentColor}10`,
                }}>
                <MessageSquare size={36} style={{ color: accentColor, opacity: 0.7 }} />
              </div>
              <p className="text-xl font-bold" style={{ color: '#0f172a', fontFamily: "'Syne', 'Inter', sans-serif" }}>
                WhatZupp for Business
              </p>
              <p className="text-sm mt-2 max-w-[260px] mx-auto leading-relaxed" style={{ color: '#64748b' }}>
                Select a conversation from the left panel to start messaging
              </p>
              <div className="flex items-center justify-center gap-2 mt-5">
                <div className="w-8 h-[2px] rounded-full" style={{ background: `${accentColor}30` }} />
                <div className="w-2 h-2 rounded-full" style={{ background: `${accentColor}40` }} />
                <div className="w-8 h-[2px] rounded-full" style={{ background: `${accentColor}30` }} />
              </div>
            </motion.div>
          </div>
        )}
      </div>

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
