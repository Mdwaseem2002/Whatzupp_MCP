import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronLeft, MoreVertical, Search, Paperclip, Mic, Phone, Video, X, Info, Reply, Copy, Forward, Pin, Star, Trash2, Smile, Cloud, Zap, Loader2, Check } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Contact, Message, MessageStatus } from '@/types';

interface ChatWindowProps {
  contact: Contact;
  messages: Message[];
  onSendMessage: (content: string, options?: { mediaId?: string; mediaType?: string; mimeType?: string; filename?: string }) => void;
  onSimulateIncoming: () => void;
  onCloseChat: () => void;
}

const formatMessageTime = (timestamp: string | number | Date) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatLastSeen = (timestamp: string | number | Date | undefined) => {
  if (!timestamp) return 'Offline';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Offline';
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  if (diffMinutes < 1) return 'Online';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getMessageDate = (timestamp: string | number | Date) => {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Unknown';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
};

// ─── Typing Indicator Dots ───
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-[7px] h-[7px] rounded-full bg-[#25D366]"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Fast Reply Chips ───
function FastReplyChips({ onSelect }: { onSelect: (text: string) => void }) {
  const replies = ['Thanks! 🙏', 'Got it 👍', 'I\'ll check', 'On my way 🚀', 'Sure!', 'Noted ✅', 'Later ⏰'];
  return (
    <div className="flex gap-2 overflow-x-auto py-1.5 px-1 scrollbar-none">
      {replies.map(r => (
        <motion.button
          key={r}
          onClick={() => onSelect(r)}
          whileHover={{ scale: 1.06, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className="shrink-0 px-4 py-2 rounded-2xl bg-white border border-gray-200 text-[12px] font-semibold text-gray-600 hover:bg-[#25D366]/[0.06] hover:text-[#25D366] hover:border-[#25D366]/25 transition-all shadow-sm hover:shadow-md"
        >
          {r}
        </motion.button>
      ))}
    </div>
  );
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  contact,
  messages,
  onSendMessage,
  onSimulateIncoming,
  onCloseChat,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showFastReplies, setShowFastReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [localMods, setLocalMods] = useState<Record<string, { deleted?: boolean; pinned?: boolean; starred?: boolean; reaction?: string }>>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number; isSent: boolean } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isLoading && mounted) {
      const timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [messages, isLoading, mounted]);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
      if (mounted) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
        }, 50);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [contact.id, mounted]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newMessage.trim() || isUploading) {
      let finalMessage = newMessage.trim();
      if (replyingTo && replyingTo.content) {
        const previewText = replyingTo.content.substring(0, 60).replace(/\n/g, ' ');
        finalMessage = `> Replying to: ${previewText}\n\n${finalMessage}`;
      }
      onSendMessage(finalMessage);
      setNewMessage('');
      setShowEmoji(false);
      setReplyingTo(null);
      setShowFastReplies(false);
      inputRef.current?.focus();
    }
  };

  const onEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  const handleFastReply = (text: string) => {
    onSendMessage(text);
    setShowFastReplies(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      setShowEmoji(false);
      const envRes = await fetch('/api/get-env-variables');
      const envData = await envRes.json();
      if (!envRes.ok) throw new Error('Could not get tokens for upload');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('accessToken', envData.accessToken);
      formData.append('phoneNumberId', envData.phoneNumberId);
      const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
      let mediaType = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';
      onSendMessage(newMessage.trim() || '', { mediaId: data.id, mediaType, mimeType: file.type, filename: file.name });
      setNewMessage('');
      setReplyingTo(null);
    } catch (err: any) {
      console.error('File Upload Error:', err);
      alert('Failed to upload file: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAction = (e: React.MouseEvent, action: string, msgId: string, msg: Message) => {
    e.stopPropagation();
    setContextMenu(null);
    setLocalMods(prev => {
      const current = prev[msgId] || {};
      switch (action) {
        case 'delete': return { ...prev, [msgId]: { ...current, deleted: true } };
        case 'pin': return { ...prev, [msgId]: { ...current, pinned: !current.pinned } };
        case 'star': return { ...prev, [msgId]: { ...current, starred: !current.starred } };
        default: return prev;
      }
    });
    if (action.startsWith('react:')) {
      const emoji = action.split(':')[1];
      setLocalMods(prev => ({ ...prev, [msgId]: { ...(prev[msgId] || {}), reaction: emoji } }));
    } else if (action === 'reply') {
      setReplyingTo(msg);
      inputRef.current?.focus();
    } else if (action === 'copy') {
      navigator.clipboard.writeText(msg.content || '');
    } else if (action === 'forward') {
      alert('Forward picker modal would open here.');
    } else if (action === 'info') {
      alert('Message details modal would open here.');
    }
  };

  const openContextMenu = (e: React.MouseEvent, msgId: string, isSent: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const windowHeight = window.innerHeight;
    let y = rect.bottom + 5;
    if (y + 350 > windowHeight) y = rect.top - 350;
    setContextMenu({ messageId: msgId, x: isSent ? rect.right - 220 : rect.left, y, isSent });
  };

  const getStatusIcon = (status: string | undefined, isSent: boolean) => {
    if (!isSent) return null;
    switch (status) {
      case MessageStatus.PENDING:
        return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Check size={12} style={{ color: 'rgba(255,255,255,0.5)' }} strokeWidth={3} /></motion.div>;
      case MessageStatus.SENT:
      case MessageStatus.DELIVERED:
      case MessageStatus.READ: {
        const color = status === MessageStatus.READ ? '#34B7F1' : 'rgba(255,255,255,0.7)';
        return (
          <motion.div
            className="relative w-3.5 h-3"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          >
            <Check size={12} style={{ color }} strokeWidth={3} className="absolute left-0" />
            <motion.div
              initial={{ x: -4, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.2 }}
            >
              <Check size={12} style={{ color }} strokeWidth={3} className="absolute left-1.5" />
            </motion.div>
          </motion.div>
        );
      }
      case MessageStatus.FAILED:
        return <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ color: '#fca5a5', fontWeight: 'bold', fontSize: '10px' }}>✗</motion.span>;
      default:
        return <Check size={12} style={{ color: 'rgba(255,255,255,0.5)' }} strokeWidth={3} />;
    }
  };

  const getStatusLabel = (status: string | undefined) => {
    switch (status) {
      case MessageStatus.SENT: return 'Sent';
      case MessageStatus.DELIVERED: return 'Delivered';
      case MessageStatus.READ: return 'Read';
      case MessageStatus.FAILED: return 'Failed';
      default: return '';
    }
  };

  const activePinnedMsg = messages.find(m => localMods[m.id]?.pinned && !localMods[m.id]?.deleted);

  const visibleMessages = (() => {
    const seen = new Set<string>();
    return messages.filter(m => {
      if (localMods[m.id]?.deleted) return false;
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  })();

  const groupedMessages = visibleMessages.reduce((groups, message) => {
    const timestamp = typeof message.timestamp === 'string' ? new Date(message.timestamp).getTime() : message.timestamp;
    const dateStr = getMessageDate(timestamp);
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  const initials = contact.name.split(' ').map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('');
  const isOnline = !!contact.online;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white relative font-sans">

      {/* ═══ CHAT HEADER — Glassmorphism ═══ */}
      <div className="flex items-center px-5 py-3 border-b border-gray-200/60 z-10 shrink-0" style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)',
      }}>
        <motion.button
          onClick={onCloseChat}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="mr-3 rounded-xl p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={22} />
        </motion.button>

        {/* Avatar with status ring */}
        <div className="relative mr-3 shrink-0">
          <div className={`w-11 h-11 flex items-center justify-center rounded-full text-white font-bold text-sm shadow-md
            ${isOnline ? 'ring-[2.5px] ring-[#25D366]/30 ring-offset-2 ring-offset-white' : ''}
            bg-gradient-to-br from-[#25D366] to-[#128C7E]
          `}>
            {initials}
          </div>
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#25D366] border-[2.5px] border-white">
              <motion.span
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full bg-[#25D366]"
              />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-gray-900 truncate">{contact.name}</h2>
          <p className="text-[12px] font-medium">
            {mounted ? (
              isOnline
                ? <span className="text-[#25D366] font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#25D366] inline-block" /> Online</span>
                : <span className="text-gray-400">Last seen {formatLastSeen(contact.lastSeen)}</span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          {[Video, Phone, Search, MoreVertical].map((Icon, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 rounded-xl text-gray-500 hover:text-[#25D366] hover:bg-[#25D366]/[0.06] transition-all"
            >
              <Icon size={19} />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Pinned Message Bar */}
      {activePinnedMsg && (
        <div className="bg-[#25D366]/[0.04] border-b border-[#25D366]/10 px-5 py-2.5 flex items-center gap-3 cursor-pointer shrink-0">
          <Pin size={14} className="text-[#25D366] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-[#25D366] uppercase tracking-wider mb-0.5">Pinned</p>
            <p className="text-[13px] text-gray-600 truncate font-medium">{activePinnedMsg.content}</p>
          </div>
          <button onClick={() => setLocalMods(p => ({ ...p, [activePinnedMsg.id]: { ...p[activePinnedMsg.id], pinned: false } }))} className="p-1 rounded-md hover:bg-gray-200 text-gray-400 pointer-events-auto"><X size={14} /></button>
        </div>
      )}

      {/* ═══ MESSAGES AREA — Dot Pattern Background ═══ */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-[5%] py-4"
        style={{
          background: `
            radial-gradient(ellipse at 15% 15%, rgba(37,211,102,0.04) 0%, transparent 55%),
            radial-gradient(ellipse at 85% 85%, rgba(18,140,126,0.03) 0%, transparent 55%),
            radial-gradient(ellipse at 50% 50%, rgba(37,211,102,0.015) 0%, transparent 70%),
            radial-gradient(#e2e8f0 0.7px, transparent 0.7px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 18px 18px',
          backgroundColor: '#F8FAFC',
        }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#25D366] mb-3" />
            <p className="text-xs font-medium text-gray-500">Loading messages...</p>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 px-7 py-6 rounded-2xl shadow-sm text-center max-w-[280px]">
              <div className="w-14 h-14 bg-[#25D366]/[0.08] rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Smile className="text-[#25D366] w-7 h-7" />
              </div>
              <p className="text-[16px] font-bold text-gray-900">Say Hello!</p>
              <p className="text-[13px] font-medium text-gray-500 mt-1 leading-relaxed">
                Start a conversation with {contact.name}.
              </p>
            </div>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex justify-center my-5">
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[11px] px-4 py-1.5 rounded-full font-bold uppercase tracking-wider bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-500 shadow-sm"
                >
                  {mounted ? date : '...'}
                </motion.span>
              </div>

              {dateMessages.map((message, index) => {
                const isSent = message.sender === 'user';
                const isFirstInGroup = index === 0 || dateMessages[index - 1].sender !== message.sender;
                const isLastInGroup = index === dateMessages.length - 1 || dateMessages[index + 1]?.sender !== message.sender;
                const mods = localMods[message.id] || {};
                const hasQuote = message.content && message.content.startsWith('> Replying to:');
                const isSfmc = isSent && /^\[Template:\s/.test(message.content || '');

                let rawText = message.content || '';
                let quoteText = '';
                if (hasQuote) {
                  const parts = rawText.split('\n\n');
                  if (parts.length > 1) {
                    quoteText = parts[0].replace('> Replying to:', '').trim();
                    rawText = parts.slice(1).join('\n\n').trim();
                  }
                }

                // Determine effective media type & source
                const matchMedia = rawText.match(/^\[(?:Media:\s*)?(image|video|document|audio)\]/i) || rawText.match(/^\[(image|video|document|audio)\]/i);
                let effectiveType = message.mediaType;
                if (!effectiveType || effectiveType === 'text') {
                  if (matchMedia) effectiveType = matchMedia[1].toLowerCase() as any;
                }

                const isImage = effectiveType === 'image' || effectiveType === 'sticker';
                const isVideo = effectiveType === 'video';
                const isDocument = effectiveType === 'document';
                const isAudio = effectiveType === 'audio';

                const mediaSrc = message.mediaUrl || (message.mediaId ? `/api/media?mediaId=${message.mediaId}` : null);
                const captionText = matchMedia ? rawText.replace(/^\[(?:Media:\s*)?(image|video|document|audio)\]\s*/i, '').trim() : rawText;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25, delay: index * 0.02 }}
                    key={message.id}
                    className={`flex ${isSent ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}
                  >
                    {/* Avatar for received — only on first of group */}
                    {!isSent && isFirstInGroup && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white text-[10px] font-bold shrink-0 mr-2 mt-1 shadow-sm">
                        {initials}
                      </div>
                    )}
                    {!isSent && !isFirstInGroup && <div className="w-8 mr-2 shrink-0" />}

                    <div
                      className="relative max-w-[75%] lg:max-w-[60%] group"
                      onMouseEnter={() => setHoveredMessageId(message.id)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                    >
                      <div className="flex flex-col">
                        {/* ─── The Bubble ─── */}
                        <div
                          className="relative px-3.5 py-2 transition-all"
                          style={{
                            background: isSent
                              ? 'linear-gradient(135deg, #25D366 0%, #1ebe5d 50%, #17a34a 100%)'
                              : 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)',
                            borderRadius: '18px',
                            borderTopRightRadius: isSent && isFirstInGroup ? '4px' : '18px',
                            borderTopLeftRadius: !isSent && isFirstInGroup ? '4px' : '18px',
                            borderBottomRightRadius: isSent && !isLastInGroup ? '6px' : '18px',
                            borderBottomLeftRadius: !isSent && !isLastInGroup ? '6px' : '18px',
                            border: isSent ? 'none' : '1px solid #e5e7eb',
                            boxShadow: isSent
                              ? '0 2px 8px rgba(37,211,102,0.22), 0 1px 3px rgba(37,211,102,0.12)'
                              : '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          {/* Context Menu Trigger */}
                          {hoveredMessageId === message.id && (
                            <button
                              onClick={(e) => openContextMenu(e, message.id, isSent)}
                              className={`absolute -top-1 ${isSent ? '-left-8' : '-right-8'} w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm hover:scale-110
                                bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-500 hover:text-gray-700
                              `}
                            >
                              <MoreVertical size={14} />
                            </button>
                          )}

                          <div className="break-words relative flex flex-col">
                            {/* Quote */}
                            {hasQuote && quoteText && (
                              <div className={`mt-1 mb-2 rounded-xl p-2.5 border-l-[3px] border-[#25D366] ${isSent ? 'bg-black/10' : 'bg-[#25D366]/5'}`}>
                                <p className="text-[12px] font-bold mb-0.5" style={{ color: isSent ? '#ffffff' : '#25D366' }}>{isSent ? 'You' : contact.name}</p>
                                <p className="text-[13px] opacity-90 line-clamp-2 leading-snug" style={{ color: isSent ? '#ffffff' : '#4b5563' }}>{quoteText}</p>
                              </div>
                            )}

                            {/* ─── Media: Image ─── */}
                            {isImage && (
                              <div className="relative group/media my-1 flex flex-col">
                                {mediaSrc ? (
                                  <img
                                    src={mediaSrc}
                                    alt="Media Attachment"
                                    className="rounded-xl object-cover max-w-xs cursor-pointer shadow-sm max-h-[300px] hover:brightness-95 transition-all"
                                    onClick={() => window.open(mediaSrc, '_blank')}
                                  />
                                ) : (
                                  <div className={`p-4 rounded-xl flex items-center gap-3 border ${isSent ? 'bg-black/10 border-white/20 text-white' : 'bg-gray-100 border-gray-200 text-gray-800'}`}>
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xl shrink-0">
                                      📷
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold uppercase tracking-wide opacity-90">Image Attachment</span>
                                      <span className="text-[11px] opacity-75">WhatsApp Media</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ─── Media: Video ─── */}
                            {isVideo && (
                              <div className="relative group/media my-1 flex flex-col">
                                {mediaSrc ? (
                                  <video src={mediaSrc} controls className="rounded-xl max-w-xs shadow-sm max-h-[280px]" />
                                ) : (
                                  <div className={`p-4 rounded-xl flex items-center gap-3 border ${isSent ? 'bg-black/10 border-white/20 text-white' : 'bg-gray-100 border-gray-200 text-gray-800'}`}>
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xl shrink-0">
                                      🎥
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold uppercase tracking-wide opacity-90">Video Attachment</span>
                                      <span className="text-[11px] opacity-75">WhatsApp Media</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ─── Media: Document ─── */}
                            {isDocument && (
                              <div className={`my-1 p-3 rounded-xl flex items-center gap-3 border ${isSent ? 'bg-black/10 border-white/20 text-white' : 'bg-gray-100 border-gray-200 text-gray-800'}`}>
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl shrink-0">
                                  📄
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-xs font-bold truncate">{message.filename || 'Document Attachment'}</span>
                                  <span className="text-[10px] opacity-75">File</span>
                                </div>
                                {mediaSrc && (
                                  <a href={mediaSrc} download target="_blank" rel="noreferrer" className="text-xs font-bold underline ml-2">
                                    Download
                                  </a>
                                )}
                              </div>
                            )}

                            {/* ─── Text / Caption Content ─── */}
                            {(!isImage && !isVideo && !isDocument && !isAudio) ? (
                              <span className="text-[15px] leading-relaxed pr-[4.5rem]" style={{ color: isSent ? '#ffffff' : '#111827' }}>
                                {rawText}
                              </span>
                            ) : captionText ? (
                              <span className="text-[14px] leading-relaxed mt-1 pr-[4.5rem]" style={{ color: isSent ? '#ffffff' : '#111827' }}>
                                {captionText}
                              </span>
                            ) : null}

                            {/* Timestamp + Status */}
                            <div className="absolute right-0 bottom-0 flex items-end gap-1 px-1 py-0.5">
                              {mods.starred && <Star size={11} className={isSent ? 'fill-white/80 text-white/80' : 'fill-gray-400 text-gray-400'} />}
                              <span className="text-[10px] font-medium tracking-wide" style={{ color: isSent ? 'rgba(255,255,255,0.8)' : '#9ca3af' }}>
                                {mounted ? formatMessageTime(message.timestamp) : ''}
                              </span>
                              {isSent && <div className="ml-0.5 leading-none">{getStatusIcon(message.status, isSent)}</div>}
                            </div>
                          </div>
                        </div>

                        {/* SFMC Badge */}
                        {isSfmc && (
                          <div className="flex justify-end mt-1" title="Sent via Salesforce Marketing Cloud">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
                              <Cloud size={10} /> Via SFMC
                            </span>
                          </div>
                        )}

                        {/* Status label for last sent message  */}
                        {isSent && isLastInGroup && message.status && message.status !== MessageStatus.PENDING && (
                          <div className="flex justify-end mt-0.5 pr-1">
                            <span className="text-[10px] text-gray-400 font-medium">{getStatusLabel(message.status)}</span>
                          </div>
                        )}

                        {/* Reaction */}
                        {mods.reaction && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={`absolute -bottom-3 ${isSent ? 'right-2' : 'left-10'} bg-white border border-gray-200 shadow-sm rounded-full px-1.5 py-0.5 text-[14px] z-10`}
                          >
                            {mods.reaction}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} className="h-6" />
      </div>

      {/* ═══ CONTEXT MENU ═══ */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="fixed bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/[0.08] py-2 z-[100] border border-gray-100 min-w-[200px] overflow-hidden"
            style={{ top: contextMenu.y, left: contextMenu.x, transformOrigin: contextMenu.isSent ? 'top right' : 'top left' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Quick Reactions */}
            <div className="px-4 py-2.5 border-b border-gray-100 flex justify-between bg-gray-50/50">
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                <button
                  key={emoji}
                  onClick={(e) => handleAction(e, `react:${emoji}`, contextMenu.messageId, messages.find(m => m.id === contextMenu.messageId)!)}
                  className="text-[20px] hover:scale-125 hover:-translate-y-1 transition-transform p-1"
                >{emoji}</button>
              ))}
            </div>
            {([
              { id: 'info', icon: <Info size={16} />, label: 'Message info' },
              { id: 'reply', icon: <Reply size={16} />, label: 'Reply' },
              { id: 'copy', icon: <Copy size={16} />, label: 'Copy message' },
              { id: 'forward', icon: <Forward size={16} />, label: 'Forward' },
              { id: 'pin', icon: <Pin size={16} />, label: 'Pin message' },
              { id: 'star', icon: <Star size={16} />, label: 'Star message' },
              { id: 'delete', icon: <Trash2 size={16} />, label: 'Delete for me', danger: true },
            ] as const).map(row => (
              <button
                key={row.id}
                onClick={e => handleAction(e, row.id, contextMenu.messageId, messages.find(m => m.id === contextMenu.messageId)!)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-[14px] font-medium transition-colors hover:bg-gray-50
                  ${'danger' in row && row.danger ? 'text-red-500' : 'text-gray-700'}
                `}
              >
                {row.icon} {row.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ REPLY PREVIEW BAR ═══ */}
      {replyingTo && (
        <div className="bg-[#25D366]/[0.03] border-t border-[#25D366]/10 px-5 py-3 flex items-center justify-between z-10 shrink-0">
          <div className="flex-1 min-w-0 border-l-[3px] border-[#25D366] pl-3">
            <p className="text-[12px] font-bold text-[#25D366] mb-0.5">
              Replying to {replyingTo.sender === 'user' ? 'yourself' : contact.name}
            </p>
            <p className="text-[13px] text-gray-500 truncate font-medium">{replyingTo.content}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors shrink-0 ml-4"><X size={16} /></button>
        </div>
      )}

      {/* ═══ FAST REPLY CHIPS ═══ */}
      <AnimatePresence>
        {showFastReplies && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white border-t border-gray-100 px-5 py-2 shrink-0"
          >
            <FastReplyChips onSelect={handleFastReply} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ INPUT BAR ═══ */}
      <div className="px-4 py-3 bg-white/80 backdrop-blur-xl border-t border-gray-200/80 flex items-end gap-2.5 z-20 shrink-0 relative">

        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmoji && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-[calc(100%+8px)] left-4 z-[100] shadow-2xl rounded-2xl overflow-hidden border border-gray-100"
            >
              <EmojiPicker onEmojiClick={onEmojiClick} autoFocusSearch={false} width={340} height={400} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Actions */}
        <div className="flex gap-0.5 pb-0.5 text-gray-400">
          <button onClick={() => setShowEmoji(!showEmoji)} className={`p-2.5 rounded-full transition-all ${showEmoji ? 'text-[#25D366] bg-[#25D366]/[0.08]' : 'hover:text-gray-600 hover:bg-gray-100'}`}>
            <Smile size={22} strokeWidth={1.5} />
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-2.5 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all disabled:opacity-50">
            {isUploading ? <Loader2 size={22} className="animate-spin text-[#25D366]" strokeWidth={1.5} /> : <Paperclip size={22} strokeWidth={1.5} />}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex-1 flex rounded-2xl overflow-hidden min-h-[48px] border border-gray-200/80 focus-within:border-[#25D366]/40 focus-within:ring-2 focus-within:ring-[#25D366]/10 focus-within:bg-white transition-all" style={{
          background: 'linear-gradient(135deg, #F8FAFC 0%, #f1f5f9 100%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), inset 0 1px 2px rgba(0,0,0,0.02)',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-transparent text-[15px] text-gray-900 focus:outline-none placeholder:text-gray-400 font-medium"
          />
        </form>

        {/* Fast Reply Toggle */}
        <button
          onClick={() => setShowFastReplies(!showFastReplies)}
          className={`p-2.5 rounded-full transition-all shrink-0 ${showFastReplies ? 'text-[#25D366] bg-[#25D366]/[0.08]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          title="Fast replies"
        >
          <Zap size={20} strokeWidth={1.5} />
        </button>

        {/* Send / Mic */}
        <motion.button
          onClick={handleSubmit}
          whileHover={{ scale: newMessage.trim() ? 1.1 : 1.05 }}
          whileTap={{ scale: 0.9 }}
          className={`p-3 rounded-full transition-all shrink-0 flex items-center justify-center
            ${newMessage.trim() || isUploading
              ? 'bg-gradient-to-br from-[#25D366] to-[#1ebe5d] text-white shadow-lg shadow-green-500/30'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-500'}
          `}
          style={{
            boxShadow: newMessage.trim() || isUploading ? '0 4px 16px rgba(37,211,102,0.35), 0 1px 3px rgba(37,211,102,0.2)' : undefined,
          }}
        >
          {newMessage.trim() || isUploading ? <Send size={18} className="ml-0.5" /> : <Mic size={20} />}
        </motion.button>
      </div>
    </div>
  );
};

export default ChatWindow;