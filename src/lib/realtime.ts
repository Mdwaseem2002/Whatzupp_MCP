/**
 * Central SSE Realtime Message Emitter
 * Broadcasts messages to both per-phone stream and global stream.
 */
export async function emitRealtimeMessage(phoneNumber: string, message: {
  id: string;
  content: string;
  timestamp: string;
  sender: 'user' | 'contact';
  status: string;
  recipientId: string;
  localId?: string;
  mediaType?: string;
  mediaId?: string;
  mediaUrl?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? (process.env.VERCEL_URL?.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`)
    : 'http://localhost:3000';

  const cleanPhone = phoneNumber.replace(/^\+/, '');

  const payload = {
    phoneNumber: cleanPhone,
    message: {
      ...message,
      recipientId: cleanPhone,
    },
  };

  try {
    await Promise.all([
      fetch(`${appUrl}/api/messages/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(e => console.warn('[realtime] Per-phone SSE emit error:', e)),
      fetch(`${appUrl}/api/messages/stream/global`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(e => console.warn('[realtime] Global SSE emit error:', e)),
    ]);
  } catch (err) {
    console.error('[realtime] emitRealtimeMessage failed:', err);
  }
}
