'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, ShoppingBag, MessageCircle, Wrench, Bike, Store, BellRing } from 'lucide-react';
import { useAlerts, markAlertsRead } from '@/lib/alertStore';
import { agoText } from '@/lib/geo';

// The header bell: live "needs attention" counts + the latest alerts.
export default function NotificationBell() {
  const { counts, alerts, unread } = useAlerts();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState('granted');
  const ref = useRef(null);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const rows = [
    { href: '/orders?tab=received', icon: ShoppingBag, label: 'New orders', n: counts.newOrders },
    { href: '/orders?tab=needs_rider', icon: Bike, label: 'Orders waiting for a rider', n: counts.needsRider },
    { href: '/orders?tab=needs_vendor', icon: Store, label: 'Orders waiting for a vendor', n: counts.needsVendor },
    { href: '/requests', icon: MessageCircle, label: 'Requests & issues', n: counts.requests },
    { href: '/home-services', icon: Wrench, label: 'Home service requests', n: counts.services },
  ];
  const pending = rows.reduce((s, r) => s + r.n, 0);
  const badge = Math.max(unread, 0) || pending;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(o => !o); markAlertsRead(); }} aria-label="Notifications"
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-orange-500 hover:bg-orange-50 transition-colors">
        <Bell size={18} />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-orange-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white flex items-center justify-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-800 text-sm">Notifications</p>
            <p className="text-xs text-gray-400">{pending > 0 ? `${pending} thing${pending !== 1 ? 's' : ''} need your attention` : 'Nothing needs your attention'}</p>
          </div>

          <div className="py-1">
            {rows.map(r => (
              <Link key={r.href} href={r.href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                <r.icon size={15} className={r.n > 0 ? 'text-orange-500' : 'text-gray-300'} />
                <span className={`flex-1 text-sm ${r.n > 0 ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{r.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.n > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>{r.n}</span>
              </Link>
            ))}
          </div>

          <div className="border-t border-gray-100">
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase text-gray-400">Recent alerts</p>
            {alerts.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-gray-400">New alerts appear here while this page is open.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto pb-1">
                {alerts.map(a => {
                  const body = (
                    <div className="px-4 py-2 hover:bg-gray-50">
                      <p className="text-sm text-gray-800">{a.title}</p>
                      {a.body && <p className="text-xs text-gray-500">{a.body}</p>}
                      <p className="text-[10px] text-gray-300 mt-0.5">{agoText(a.at)}</p>
                    </div>
                  );
                  return a.url
                    ? <Link key={a.id} href={a.url} onClick={() => setOpen(false)}>{body}</Link>
                    : <div key={a.id}>{body}</div>;
                })}
              </div>
            )}
          </div>

          {permission !== 'granted' && typeof Notification !== 'undefined' && (
            <button onClick={async () => { setPermission(await Notification.requestPermission()); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border-t border-orange-100">
              <BellRing size={14} />
              {permission === 'denied' ? 'Desktop alerts are blocked — allow them in the browser address bar' : 'Turn on desktop alerts + sound'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
