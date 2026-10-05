'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { quickSearch } from '@/lib/quickSearch';
import { Search, CornerDownLeft, X } from 'lucide-react';

// Pages offered in the "Pages" group (kept in sync with the sidebar by hand — it is a short list).
const PAGES = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Orders', keywords: 'order list' },
  { href: '/live-map', label: 'Live Map', keywords: 'riders map location' },
  { href: '/products', label: 'Products' },
  { href: '/categories', label: 'Categories', keywords: 'emoji icon' },
  { href: '/users', label: 'App Users', keywords: 'signed in customers' },
  { href: '/customers', label: 'Customers' },
  { href: '/requests', label: 'Requests', keywords: 'ask theekkart issues' },
  { href: '/home-services', label: 'Home Services', keywords: 'service requests' },
  { href: '/promo-codes', label: 'Promo Codes', keywords: 'discount coupon' },
  { href: '/banners', label: 'Banners' },
  { href: '/notifications', label: 'Notifications', keywords: 'push broadcast' },
  { href: '/riders', label: 'Riders', keywords: 'delivery partners add rider' },
  { href: '/vendors', label: 'Vendors', keywords: 'shops add vendor' },
  { href: '/partners', label: 'All Partners' },
  { href: '/settlements', label: 'Settlements', keywords: 'commission payout vendor revenue' },
  { href: '/delivery-area', label: 'Delivery Area', keywords: 'radius limit location service area' },
  { href: '/reports', label: 'Reports' },
];

// Loaded once per ~minute when the palette opens (kept at module level so reopening is instant).
let cache = { at: 0, data: null };
async function loadData() {
  if (cache.data && Date.now() - cache.at < 60_000) return cache.data;
  const rows = async q => (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  const safe = p => p.catch(() => []);
  const [orders, users, partners, products] = await Promise.all([
    safe(rows(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(300)))),
    safe(rows(query(collection(db, 'users'), limit(500)))),
    safe(rows(query(collection(db, 'partner_requests'), limit(500)))),
    safe(rows(query(collection(db, 'products'), limit(500)))),
  ]);
  cache = { at: Date.now(), data: { orders, users, partners, products, pages: PAGES } };
  return cache.data;
}

export default function QuickSearch({ open, onClose }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [data, setData] = useState(cache.data || { pages: PAGES });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setText(''); setActive(0);
    setTimeout(() => inputRef.current?.focus(), 30);
    setLoading(true);
    loadData().then(setData).finally(() => setLoading(false));
  }, [open]);

  const groups = useMemo(() => quickSearch(text, data), [text, data]);
  const flat = useMemo(() => groups.flatMap(g => g.items), [groups]);

  useEffect(() => { setActive(0); }, [text]);

  function go(item) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); go(flat[active]); }
  }

  if (!open) return null;
  let index = -1;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-start justify-center p-4 pt-[12vh]"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-gray-100">
          <Search size={16} className="text-gray-400" />
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search orders, customers, vendors, riders, products, pages…"
            className="flex-1 py-4 text-sm focus:outline-none" />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close search"><X size={16} /></button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {text.trim() === '' ? (
            <p className="p-6 text-sm text-gray-400 text-center">
              Type an order number, customer name or phone, shop, rider, product or page name.
              {loading && <span className="block mt-2 text-xs">Loading data…</span>}
            </p>
          ) : groups.length === 0 ? (
            <p className="p-6 text-sm text-gray-400 text-center">
              {loading ? 'Searching…' : `No results for "${text.trim()}"`}
            </p>
          ) : groups.map(g => (
            <div key={g.key}>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase text-gray-400">{g.label}</p>
              {g.items.map(item => {
                index += 1;
                const i = index;
                return (
                  <button key={`${g.key}-${item.id}`} onClick={() => go(item)} onMouseEnter={() => setActive(i)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${i === active ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                      {item.subtitle && <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>}
                    </div>
                    {i === active && <CornerDownLeft size={13} className="text-orange-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400 flex gap-4">
          <span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
