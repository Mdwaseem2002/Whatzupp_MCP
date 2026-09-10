import React, { useState } from 'react';
import { Contact, Message } from '@/types';
import { formatTimestamp } from '@/utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, X, Check, MessageSquare, Search, UserPlus, Plus, FileText, LayoutTemplate } from 'lucide-react';

interface ChatListProps {
  contacts: Contact[];
  selectedContact: Contact | null;
  onSelectContact: (contact: Contact) => void;
  onEditContact: (contact: Contact) => void;
  onDeleteContact: (contactId: string) => void;
  messages: Record<string, Message[]>;
  unreadCounts?: Record<string, number>;
  onShowAddModal?: () => void;
}

const ChatList: React.FC<ChatListProps> = ({
  contacts,
  selectedContact,
  onSelectContact,
  onEditContact,
  onDeleteContact,
  messages,
  unreadCounts = {},
  onShowAddModal
}) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editName, setEditName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const getLastMessage = (phoneNumber: string): { text: string; time: string; timestamp: number; isTemplate: boolean } => {
    const normalizedPhone = phoneNumber.replace(/^\+/, '');
    const contactMessages = messages[normalizedPhone] || messages[phoneNumber] || [];
    if (contactMessages.length === 0) {
      return { text: 'No messages yet', time: '', timestamp: 0, isTemplate: false };
    }
    const lastMsg = contactMessages[contactMessages.length - 1];
    const rawContent = lastMsg.content || '';

    const matchMedia = rawContent.match(/\[(?:Media:\s*)?(image|video|document|audio)(?::\s*[^\s\]]+)?\]/i);
    let displayText = rawContent;
    if (matchMedia) {
      const mediaType = matchMedia[1].toLowerCase();
      const caption = rawContent.replace(/\[(?:Media:\s*)?(image|video|document|audio)(?::\s*[^\s\]]+)?\]\s*/i, '').trim();
      if (mediaType === 'image') displayText = caption ? `📷 ${caption}` : '📷 Photo';
      else if (mediaType === 'video') displayText = caption ? `🎥 ${caption}` : '🎥 Video';
      else if (mediaType === 'document') displayText = caption ? `📄 ${caption}` : '📄 Document';
      else if (mediaType === 'audio') displayText = caption ? `🎙️ ${caption}` : '🎙️ Audio';
    }

    const isTemplate = /^\[Template:/.test(rawContent);
    const msgTime = lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : 0;

    return {
      text: displayText.length > 35 ? displayText.substring(0, 32) + '...' : displayText,
      time: formatTimestamp(lastMsg.timestamp),
      timestamp: isNaN(msgTime) ? 0 : msgTime,
      isTemplate,
    };
  };

  const handleStartEdit = (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation();
    setEditingContact(contact);
    setEditName(contact.name);
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingContact && editName.trim()) {
      onEditContact({ ...editingContact, name: editName.trim() });
      setEditingContact(null);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingContact(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, contactId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(contactId);
  };

  const handleConfirmDelete = (e: React.MouseEvent, contactId: string) => {
    e.stopPropagation();
    onDeleteContact(contactId);
    setDeleteConfirmId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  const filteredContacts = contacts.filter(c =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phoneNumber.includes(searchQuery)
  );

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const aUnread = unreadCounts[a.phoneNumber.replace(/^\+/, '')] || 0;
    const bUnread = unreadCounts[b.phoneNumber.replace(/^\+/, '')] || 0;
    if (bUnread !== aUnread) {
      return bUnread - aUnread;
    }

    const aTime = getLastMessage(a.phoneNumber).timestamp;
    const bTime = getLastMessage(b.phoneNumber).timestamp;
    return bTime - aTime;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white font-sans">
      
      {/* ─── Header ─── */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Chats</h2>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">{contacts.length} conversation{contacts.length !== 1 ? 's' : ''}</p>
          </div>
          {onShowAddModal && (
            <motion.button
              onClick={onShowAddModal}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#25D366] to-[#1ebe5d] text-white flex items-center justify-center hover:shadow-lg shadow-md shadow-green-600/20 transition-shadow"
            >
              <Plus size={16} strokeWidth={2.5} />
            </motion.button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-gray-200/80 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/10 transition-all"
          />
        </div>
      </div>
      
      {/* ─── Contact List ─── */}
      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 mt-6 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-[#25D366]/[0.06]">
              <MessageSquare size={28} className="text-[#25D366]" />
            </div>
            <h3 className="text-[16px] font-bold text-gray-900 mb-1.5">No conversations</h3>
            <p className="text-[13px] text-gray-500 max-w-[220px] leading-relaxed">
              Start by adding a new recipient to begin chatting.
            </p>
            {onShowAddModal && (
              <button
                onClick={onShowAddModal}
                className="mt-5 flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-bold text-white rounded-xl transition-all shadow-sm shadow-green-600/20 hover:shadow-md hover:-translate-y-0.5 bg-[#25D366] hover:bg-[#1db954]"
              >
                <UserPlus size={16} /> Add Recipient
              </button>
            )}
          </div>
        ) : sortedContacts.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">No results for &quot;{searchQuery}&quot;</div>
        ) : (
          <div className="py-1">
            {sortedContacts.map((contact, idx) => {
              const lastMessage = getLastMessage(contact.phoneNumber);
              const isSelected = selectedContact?.id === contact.id;
              const isDeleting = deleteConfirmId === contact.id;
              const isEditing = editingContact?.id === contact.id;
              const normalizedPhone = contact.phoneNumber.replace(/^\+/, '');
              const unreadCount = unreadCounts[normalizedPhone] || 0;
              const initials = contact.name.split(' ').map(word => word.charAt(0).toUpperCase()).slice(0, 2).join('');

              return (
                <motion.div
                  key={contact.id}
                  onClick={() => !isDeleting && !isEditing && onSelectContact(contact)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  whileHover={!isSelected ? { y: -1, backgroundColor: 'rgba(248,250,252,0.9)' } : undefined}
                  className={`group relative flex items-center px-4 py-3.5 cursor-pointer transition-all duration-200
                    ${isSelected
                      ? 'bg-[#25D366]/[0.08]'
                      : 'hover:bg-[#F8FAFC]'}
                  `}
                  style={{
                    borderLeft: isSelected ? '3px solid #25D366' : '3px solid transparent',
                    boxShadow: isSelected ? 'inset 0 0 20px rgba(37,211,102,0.04)' : 'none',
                  }}
                  layout
                >
                  {/* Avatar with online dot */}
                  <div className="relative mr-3 shrink-0">
                    <motion.div
                      className={`w-12 h-12 flex items-center justify-center rounded-full text-white font-bold text-[14px] shadow-sm
                        ${isSelected ? 'bg-gradient-to-br from-[#25D366] to-[#128C7E] ring-2 ring-[#25D366]/20' : 'bg-gradient-to-br from-[#25D366] to-[#1ebe5d]'}
                      `}
                      whileHover={{ scale: 1.08 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    >
                      {initials}
                    </motion.div>
                    {/* Online indicator with pulse */}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#25D366] border-[2.5px] border-white">
                      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-40" />
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] bg-white text-gray-900 border-gray-200"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveEdit(e as unknown as React.MouseEvent);
                              if (e.key === 'Escape') handleCancelEdit(e as unknown as React.MouseEvent);
                            }}
                          />
                          <button onClick={handleSaveEdit} className="p-1 text-[#25D366] hover:bg-green-50 rounded-md transition-colors"><Check size={16} /></button>
                          <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"><X size={16} /></button>
                        </div>
                      ) : (
                        <h3 className={`text-[15px] truncate
                          ${unreadCount > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}
                        `}>
                          {contact.name}
                        </h3>
                      )}
                      {!isEditing && (
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          {lastMessage.time && (
                            <span className={`text-[11px]
                              ${unreadCount > 0 ? 'text-[#25D366] font-bold' : 'text-gray-400 font-medium'}
                            `}>
                              {lastMessage.time}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete confirmation vs Last Message */}
                    <AnimatePresence mode="wait">
                      {isDeleting ? (
                        <motion.div
                          key="deleting"
                          className="flex items-center gap-2 mt-1"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                        >
                          <span className="text-[12px] font-medium text-red-500">Delete?</span>
                          <button onClick={(e) => handleConfirmDelete(e, contact.id)} className="text-[11px] font-bold text-white px-3 py-1 rounded-full bg-red-500 hover:bg-red-600 transition-colors">Yes</button>
                          <button onClick={handleCancelDelete} className="text-[11px] font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">No</button>
                        </motion.div>
                      ) : (
                        <motion.div key="message" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {/* Message type indicator */}
                            {lastMessage.isTemplate ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#25D366] bg-[#25D366]/[0.08] px-1.5 py-0.5 rounded-md shrink-0">
                                <LayoutTemplate size={9} /> TPL
                              </span>
                            ) : lastMessage.text !== 'No messages yet' ? (
                              <FileText size={12} className="text-gray-300 shrink-0" />
                            ) : null}
                            <p className={`text-[13px] truncate leading-relaxed
                              ${unreadCount > 0 ? 'font-semibold text-gray-800' : 'text-gray-500'}
                            `}>
                              {lastMessage.text}
                            </p>
                          </div>

                          {/* Unread Badge / Action Buttons */}
                          <div className="flex items-center ml-2 h-5 shrink-0">
                            {unreadCount > 0 && !isSelected ? (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                                className="inline-flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br from-[#25D366] to-[#1ebe5d] min-w-[20px] h-[20px] rounded-full px-1.5 shadow-md shadow-green-500/25"
                              >
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </motion.span>
                            ) : (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => handleStartEdit(e, contact)} className="p-1 rounded-md text-gray-400 hover:text-[#25D366] hover:bg-[#25D366]/10 transition-all hover:scale-110" title="Edit"><Pencil size={13} /></button>
                                <button onClick={(e) => handleDeleteClick(e, contact.id)} className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all hover:scale-110" title="Delete"><Trash2 size={13} /></button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;