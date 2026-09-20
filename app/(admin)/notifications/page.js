'use client';
import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bell, Send, Users, CheckCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

const QUICK_MESSAGES = [
  { title: '✅ Order Confirmed!',     body: 'Your order has been confirmed and is being prepared.' },
  { title: '🚴 Out for Delivery!',   body: 'Your order is on the way! It will be delivered shortly.' },
  { title: '🎉 Order Delivered!',     body: 'Your order has been delivered. Thank you for shopping with TheekKart!' },
  { title: '🏷️ Special Offer!',      body: "Don't miss today's exclusive deals on TheekKart — open the app now!" },
  { title: '🛍️ New Items Added!',    body: 'Fresh products just arrived. Check them out on TheekKart!' },
];

export default function NotificationsPage() {
  const [title,   setTitle]   = useState('');
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!title.trim() || !body.trim()) return toast.error('Title and message are required');
    setSending(true);

    try {
      // Collect all FCM tokens from users collection
      const snap = await getDocs(collection(db, 'users'));
      const tokens = snap.docs
        .map(d => d.data().fcmToken)
        .filter(Boolean);

      if (tokens.length === 0) {
        toast.error('No registered devices found. Make sure users have opened the app at least once.');
        setSending(false);
        return;
      }

      // Send in batches of 500 (FCM multicast limit)
      const batches = [];
      for (let i = 0; i < tokens.length; i += 500) {
        batches.push(tokens.slice(i, i + 500));
      }

      let successCount = 0;
      for (const batch of batches) {
        const res = await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: batch, title: title.trim(), body: body.trim() }),
        });
        const data = await res.json();
        if (data.ok) {
          successCount += batch.length;
        } else {
          toast.error(data.error || 'Send failed');
        }
      }

      if (successCount > 0) {
        toast.success(`Notification sent to ${tokens.length} device${tokens.length !== 1 ? 's' : ''}!`);
        setTitle('');
        setBody('');
      }
    } catch (err) {
      toast.error('Failed to send notification');
    }
    setSending(false);
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="max-w-2xl space-y-6">

        {/* How it works banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
          <CheckCircle size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Push Notifications Active</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Order status updates are sent automatically when you update an order. Use this page to broadcast announcements to all customers.
              <br />
              <span className="font-medium">Requires <code className="bg-blue-100 px-1 rounded">FCM_SERVER_KEY</code> in <code className="bg-blue-100 px-1 rounded">.env.local</code>.</span>
            </p>
          </div>
        </div>

        {/* Quick templates */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Quick Templates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_MESSAGES.map(msg => (
              <button
                key={msg.title}
                onClick={() => { setTitle(msg.title); setBody(msg.body); }}
                className="text-left p-3 border border-gray-100 rounded-xl hover:border-orange-200 hover:bg-orange-50 transition-colors"
              >
                <p className="font-medium text-gray-800 text-sm">{msg.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{msg.body}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Compose */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-orange-500" />
            <h2 className="font-semibold text-gray-800">Broadcast to All Customers</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text" value={title} placeholder="e.g. Special Offer!"
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={body} rows={3} placeholder="Enter notification message…"
                onChange={e => setBody(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            {/* Preview */}
            {(title || body) && (
              <div className="bg-gray-900 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-2">Preview</p>
                <div className="bg-white rounded-xl p-3 flex gap-3">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bell size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{title || 'Title'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{body || 'Message…'}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSend} disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors"
            >
              <Send size={16} /> {sending ? 'Sending…' : 'Send to All Customers'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
