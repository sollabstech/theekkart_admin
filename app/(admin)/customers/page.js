'use client';
/**
 * Customers page — email-based
 *
 * One email = one customer = all their orders.
 * Orders are the source of truth. We group them by customerEmail.
 * For old orders without customerEmail we fall back to customerId.
 */
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { formatTimestamp } from '@/lib/firestore';
import { Search, Mail, ShoppingBag, Phone } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    async function load() {
      try {
        const ordersSnap = await getDocs(collection(db, 'orders'));

        // ── Group orders by email (primary) or customerId (fallback) ──
        // key: email string if present, else "uid:<customerId>"
        const groups = {};

        ordersSnap.docs.forEach(d => {
          const data  = d.data();
          const email = (data.customerEmail || '').trim().toLowerCase();
          const name  = (data.customerName  || '').trim();
          const key   = email
            || (data.customerId ? `uid:${data.customerId}` : null)
            || (name ? `name:${name.toLowerCase()}` : null);
          if (!key) return; // skip orders with no identifying info at all

          if (!groups[key]) {
            groups[key] = {
              email:     email || '',          // real email or empty for legacy
              key,
              name:      data.customerName || 'Unknown',
              phone:     data.phone || '',
              orders:    [],
              firstSeen: data.createdAt,
            };
          }

          groups[key].orders.push({ id: d.id, ...data });

          // Keep the earliest date as "first seen"
          const t    = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
          const curr = groups[key].firstSeen?.toDate
            ? groups[key].firstSeen.toDate()
            : new Date(groups[key].firstSeen || 0);
          if (t < curr) groups[key].firstSeen = data.createdAt;

          // Use the most recent name (latest order)
          const latest = groups[key].orders.sort((a, b) => {
            const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return tb - ta;
          })[0];
          if (latest) {
            groups[key].name  = latest.customerName || groups[key].name;
            groups[key].phone = latest.phone        || groups[key].phone;
          }
        });

        // Convert to sorted array — most orders first
        const list = Object.values(groups).sort(
          (a, b) => b.orders.length - a.orders.length || a.name.localeCompare(b.name)
        );

        setCustomers(list);
      } catch (e) {
        console.error('Customers load error:', e);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.includes(q) ||
      (c.phone || '').includes(q)
    );
  });

  return (
    <div className="space-y-4">

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text" placeholder="Search by name, email or phone…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
            focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading customers…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {customers.length === 0
              ? 'No customers yet. They appear here once they place an order.'
              : 'No customers match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3">Customer</th>
                  <th className="text-left px-5 py-3">Contact</th>
                  <th className="text-left px-5 py-3">Orders</th>
                  <th className="text-left px-5 py-3">First order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => (
                  <tr key={c.key} className="hover:bg-gray-50">

                    {/* Name + avatar */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center
                          text-orange-600 font-bold text-sm uppercase shrink-0">
                          {(c.name || '?').charAt(0)}
                        </div>
                        <span className="font-medium text-gray-800">{c.name}</span>
                      </div>
                    </td>

                    {/* Email + phone */}
                    <td className="px-5 py-3">
                      <div className="space-y-0.5">
                        {c.email ? (
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Mail size={12} className="text-gray-400 shrink-0" />
                            <span className="text-xs">{c.email}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">no email (legacy order)</span>
                        )}
                        {c.phone && c.phone !== '00000000000' && c.phone !== '0000000000' && (
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Phone size={12} className="text-gray-400 shrink-0" />
                            <span className="text-xs">{c.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Order count — link to filtered orders */}
                    <td className="px-5 py-3">
                      <Link
                        href={c.email
                          ? `/orders?customerEmail=${encodeURIComponent(c.email)}`
                          : c.key.startsWith('uid:')
                            ? `/orders?customerId=${encodeURIComponent(c.key.replace('uid:', ''))}`
                            : `/orders?customerName=${encodeURIComponent(c.name)}`
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                          text-xs font-semibold transition-colors"
                        style={{ background: '#FFF7ED', color: '#f97316' }}>
                        <ShoppingBag size={12} />
                        {c.orders.length} order{c.orders.length !== 1 ? 's' : ''}
                      </Link>
                    </td>

                    {/* First order date */}
                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatTimestamp(c.firstSeen) || '—'}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        {customers.length} customer{customers.length !== 1 ? 's' : ''} total
      </p>
    </div>
  );
}
