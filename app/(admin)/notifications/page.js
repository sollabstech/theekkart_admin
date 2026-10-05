'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bell, Send, Users, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

const QUICK_MESSAGES = [
  { title: '✅ Order Confirmed!',     body: 'Your order has been confirmed and is being prepared.' },
  { title: '🚴 Out for Delivery!',   body: 'Your order is on the way! It will be delivered shortly.' },
  { title: '🎉 Order Delivered!',     body: 'Your order has been delivered. Thank you for shopping with TheekKart!' },
  { title: '🏷️ Special Offer!',      body: "Don't miss today's exclusive deals on TheekKart — open the app now!" },
  { title: '🛍️ New Items Added!',    body: 'Fresh products just arrived. Check them out on TheekKart!' },
];

const AUDIENCES = [
  { key: 'customers', label: 'All customers', collection: 'users' },
  { key: 'vendors',   label: 'All vendors',   collection: 'partner_requests', role: 'vendor' },
  { key: 'riders',    label: 'All riders',    collection: 'partner_requests', role: 'rider' },
];

// Devices that have registered for push, per audience
async function loadDevices() {
  const [users, partners] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'partner_requests')),
  ]);
  const rows = [
    ...users.docs.map(d => ({ id: d.id, audience: 'customers', name: d.data().name || 'Customer', token: d.data().fcmToken || null })),
    ...partners.docs.map(d => ({
      id: d.id, audience: d.data().role === 'rider' ? 'riders' : 'vendors',
      name: d.data().shopName || d.data().name || 'Partner', token: d.data().fcmToken || null,
    })),
  ];
  return rows;
}

export default function NotificationsPage() {
  const [title,   setTitle]   = useState('');
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState('customers');
  const [status,  setStatus]  = useState(null);     // server push check
  const [checking, setChecking] = useState(false);
  const [devices, setDevices] = useState([]);
  const [testTo,  setTestTo]  = useState('');

  async function check() {
    setChecking(true);
    try {
      const [res, rows] = await Promise.all([fetch('/api/push-status').then(r => r.json()), loadDevices()]);
      setStatus(res);
      setDevices(rows);
    } catch { setStatus({ error: true }); }
    setChecking(false);
  }
  useEffect(() => { check(); }, []);

  const withToken = devices.filter(d => d.token);
  const countFor = key => ({ total: devices.filter(d => d.audience === key).length, tokens: devices.filter(d => d.audience === key && d.token).length });
  const serverReady = status && status.serviceAccountConfigured && status.credentialsValid !== false;

  async function sendTest() {
    const target = withToken.find(d => `${d.audience}:${d.id}` === testTo);
    if (!target) return toast.error('Choose a device to test');
    setSending(true);
    try {
      const res = await fetch('/api/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: target.token, title: '🔔 Test notification', body: `Push is working for ${target.name}` }),
      });
      const data = await res.json();
      if (data.ok) toast.success(`Test sent to ${target.name} — check that phone`);
      else toast.error(data.error || 'The test could not be delivered (the device token may be old — ask them to reopen the app)');
    } catch { toast.error('Failed to send the test'); }
    setSending(false);
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) return toast.error('Title and message are required');
    setSending(true);

    try {
      // Collect the FCM tokens of the chosen audience
      const rows = devices.length ? devices : await loadDevices();
      const tokens = [...new Set(rows.filter(d => d.audience === audience && d.token).map(d => d.token))];

      if (tokens.length === 0) {
        toast.error('No registered devices found for this audience. They must open the app (and allow notifications) at least once.');
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

        {/* Push status — what is actually working */}
        <div className={`rounded-2xl p-4 border ${!status ? 'bg-gray-50 border-gray-200' : serverReady ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            {!status ? <RefreshCw size={20} className="text-gray-400 flex-shrink-0 mt-0.5 animate-spin" />
              : serverReady ? <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
              : <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1 text-sm">
              <p className={`font-semibold ${serverReady ? 'text-green-800' : status ? 'text-red-800' : 'text-gray-700'}`}>
                {!status ? 'Checking push setup…' : serverReady ? 'Push is set up on the server' : 'Push is NOT working yet'}
              </p>
              {status && !status.error && (
                <ul className="mt-2 space-y-1 text-xs text-gray-700">
                  <li>{status.serviceAccountConfigured ? '✅' : '❌'} Firebase service account key {status.serviceAccountProject ? `(${status.serviceAccountProject})` : ''}</li>
                  <li>{status.credentialsValid === true ? '✅' : status.credentialsValid === false ? '❌' : '⚠️'} Firebase accepts the key {status.credentialsValid == null ? '(could not verify)' : ''}</li>
                  <li>{status.orderEventSecretConfigured ? '✅' : '❌'} App-to-server secret (<code className="bg-white/70 px-1 rounded">ORDER_EVENT_SECRET</code>)</li>
                  <li>{withToken.length > 0 ? '✅' : '⚠️'} {withToken.length} device{withToken.length !== 1 ? 's' : ''} registered ({['customers', 'vendors', 'riders'].map(k => `${countFor(k).tokens} ${k}`).join(', ')})</li>
                </ul>
              )}
              {status?.error && <p className="text-xs text-red-700 mt-1">Could not reach the server to check.</p>}
              {status && !serverReady && (
                <p className="text-xs text-red-700 mt-2">
                  {status.detail} <b>Fix:</b> Vercel → your project → Settings → Environment Variables → add
                  <code className="bg-white/70 px-1 mx-1 rounded">FIREBASE_SERVICE_ACCOUNT_KEY</code> (Firebase console → Project settings → Service accounts → Generate new private key → paste the whole file)
                  and <code className="bg-white/70 px-1 mx-1 rounded">ORDER_EVENT_SECRET</code>, then redeploy.
                </p>
              )}
              {status && serverReady && !status.orderEventSecretConfigured && (
                <p className="text-xs text-amber-700 mt-2 flex gap-1"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> {status.detail}</p>
              )}
              {status && serverReady && withToken.length === 0 && (
                <p className="text-xs text-amber-700 mt-2">No phone has registered for push yet. Each person must open the app and allow notifications (customers must be signed in).</p>
              )}
            </div>
            <button onClick={check} disabled={checking} title="Check again"
              className="p-2 rounded-lg text-gray-500 hover:bg-white/70 disabled:opacity-50"><RefreshCw size={15} className={checking ? 'animate-spin' : ''} /></button>
          </div>
        </div>

        {/* Test one device */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-1">Send a test</h2>
          <p className="text-xs text-gray-400 mb-3">Pick one phone and check that the notification arrives.</p>
          <div className="flex gap-2 flex-wrap">
            <select value={testTo} onChange={e => setTestTo(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">— choose a registered device —</option>
              {withToken.map(d => <option key={`${d.audience}:${d.id}`} value={`${d.audience}:${d.id}`}>{d.name} · {d.audience.slice(0, -1)}</option>)}
            </select>
            <button onClick={sendTest} disabled={sending || !testTo}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">Send test</button>
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
            <h2 className="font-semibold text-gray-800">Broadcast</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Send to</label>
              <div className="flex gap-2 flex-wrap">
                {AUDIENCES.map(a => (
                  <button key={a.key} type="button" onClick={() => setAudience(a.key)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border ${audience === a.key ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {a.label} <span className="opacity-70">({countFor(a.key).tokens})</span>
                  </button>
                ))}
              </div>
            </div>
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
              <Send size={16} /> {sending ? 'Sending…' : `Send to ${AUDIENCES.find(a => a.key === audience).label.toLowerCase()}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
