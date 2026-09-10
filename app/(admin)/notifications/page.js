'use client';
import { useState } from 'react';
import { Bell, Send, Users, Package } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// Note: FCM server-side notifications require a backend (Firebase Cloud Functions)
// This page shows the UI. Connect to Cloud Functions in Phase 2.

const QUICK_MESSAGES = [
  { title: 'Order Confirmed', body: 'Your order has been confirmed and is being processed.' },
  { title: 'Out for Delivery', body: 'Your order is on its way! It will be delivered shortly.' },
  { title: 'Order Delivered', body: 'Your order has been delivered. Thank you for shopping with TheekKart!' },
  { title: 'Special Offer', body: "Don't miss today's special offers on TheekKart!" },
];

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!title || !body) return toast.error('Title and message are required');
    setSending(true);
    // TODO: Connect to Firebase Cloud Functions endpoint in Phase 2
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Notification queued (connect Cloud Functions in Phase 2)');
    setSending(false);
    setTitle('');
    setBody('');
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="max-w-2xl space-y-6">
        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <Bell size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Phase 2 Feature</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Push notifications require Firebase Cloud Functions. The UI is ready — connect your FCM endpoint in Phase 2 to send real notifications.
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
          <h2 className="font-semibold text-gray-800 mb-4">Compose Notification</h2>
          <div className="space-y-4">
            {/* Target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Send To</label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${target === 'all' ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
                  <input type="radio" value="all" checked={target === 'all'} onChange={() => setTarget('all')} className="accent-orange-500" />
                  <Users size={16} className="text-orange-500" />
                  <span className="text-sm font-medium">All Customers</span>
                </label>
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${target === 'order' ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
                  <input type="radio" value="order" checked={target === 'order'} onChange={() => setTarget('order')} className="accent-orange-500" />
                  <Package size={16} className="text-orange-500" />
                  <span className="text-sm font-medium">Specific Order</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text" value={title} placeholder="e.g. Order Confirmed"
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
                    <p className="text-xs font-semibold text-gray-900">{title || 'Notification Title'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{body || 'Notification message…'}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSend} disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors"
            >
              <Send size={16} /> {sending ? 'Sending…' : 'Send Notification'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
