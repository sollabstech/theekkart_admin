'use client';
import { useEffect, useState } from 'react';
import { listenToOrders, ORDER_STATUS, formatTimestamp } from '@/lib/firestore';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import {
  ShoppingBag, Clock, CheckCircle, XCircle,
  TrendingUp, Package, ArrowRight, Zap, Users, BarChart3
} from 'lucide-react';

/* ── Stat card ─────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, gradient, textColor, delta }) {
  return (
    <div className="relative bg-white rounded-2xl p-5 overflow-hidden"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.05)' }}>
      {/* Background tint */}
      <div className="absolute top-0 right-0 w-32 h-32 -translate-y-6 translate-x-6 rounded-full opacity-10"
        style={{ background: gradient }} />
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: gradient + '1a' }}>
          <Icon size={18} style={{ color: textColor }} />
        </div>
      </div>
      <p className="text-3xl font-black text-gray-900">{value}</p>
      {delta !== undefined && (
        <p className="text-xs mt-1.5 font-medium" style={{ color: textColor }}>{delta}</p>
      )}
    </div>
  );
}

/* ── Mini metric pill ───────────────────────────────────────── */
function MetricPill({ label, value, color }) {
  return (
    <div className="flex-1 text-center p-3 rounded-xl" style={{ background: color + '12', border: `1px solid ${color}20` }}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-black text-lg" style={{ color }}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsub = listenToOrders(data => {
      setOrders(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const counts = {
    new:       orders.filter(o => o.status === ORDER_STATUS.RECEIVED).length,
    active:    orders.filter(o => [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING, ORDER_STATUS.OUT_FOR_DELIVERY].includes(o.status)).length,
    delivered: orders.filter(o => o.status === ORDER_STATUS.DELIVERED).length,
    cancelled: orders.filter(o => o.status === ORDER_STATUS.CANCELLED).length,
  };

  const todayOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
    return d.toDateString() === new Date().toDateString();
  });

  const todayRevenue  = todayOrders.filter(o => o.status === ORDER_STATUS.DELIVERED).reduce((s, o) => s + (o.total || 0), 0);
  const totalRevenue  = orders.filter(o => o.status === ORDER_STATUS.DELIVERED).reduce((s, o) => s + (o.total || 0), 0);
  const recentOrders  = orders.slice(0, 10);

  const v = (n) => loading ? '–' : n;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Hero banner ────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden text-white px-6 py-6 flex items-center justify-between"
        style={{
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 60%, #0f172a 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(8px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -60, right: 120,
          width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div>
          <p className="text-orange-400 text-xs font-semibold tracking-widest uppercase mb-1">TheekKart Dashboard</p>
          <h2 className="text-2xl font-black text-white">
            ₹{loading ? '–' : totalRevenue.toLocaleString('en-IN')}
          </h2>
          <p className="text-gray-400 text-sm mt-1">Lifetime delivered revenue</p>
          <div className="flex gap-2 mt-3">
            <MetricPill label="Today" value={`₹${todayRevenue.toLocaleString('en-IN')}`} color="#f97316" />
            <MetricPill label="Today Orders" value={todayOrders.length} color="#3b82f6" />
            <MetricPill label="Total Orders" value={orders.length} color="#8b5cf6" />
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-2">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
            style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.2)' }}>
            🛒
          </div>
          <Link href="/orders"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors"
            style={{ background: 'rgba(249,115,22,0.25)', border: '1px solid rgba(249,115,22,0.3)' }}>
            View Orders <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── Stat grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="New Orders"  value={v(counts.new)}       icon={ShoppingBag}  gradient="#3b82f6" textColor="#3b82f6"  delta="Waiting to confirm" />
        <StatCard label="In Progress" value={v(counts.active)}    icon={Clock}        gradient="#f97316" textColor="#f97316"  delta="Being prepared" />
        <StatCard label="Delivered"   value={v(counts.delivered)} icon={CheckCircle}  gradient="#22c55e" textColor="#22c55e"  delta="Completed" />
        <StatCard label="Cancelled"   value={v(counts.cancelled)} icon={XCircle}      gradient="#ef4444" textColor="#ef4444"  delta="Not fulfilled" />
      </div>

      {/* ── Quick actions ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: '/products',  icon: Package,    label: 'Add Product',   color: '#f97316' },
          { href: '/orders',    icon: ShoppingBag,label: 'Manage Orders', color: '#3b82f6' },
          { href: '/reports',   icon: BarChart3,  label: 'View Reports',  color: '#8b5cf6' },
        ].map(({ href, icon: Icon, label, color }) => (
          <Link key={href} href={href}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center transition-all hover:scale-[1.02]"
            style={{ background: 'white', border: `1px solid ${color}20`, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: color + '15' }}>
              <Icon size={18} style={{ color }} />
            </div>
            <p className="text-xs font-semibold text-gray-700">{label}</p>
          </Link>
        ))}
      </div>

      {/* ── Recent orders table ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div>
            <h2 className="font-bold text-gray-900">Recent Orders</h2>
            <p className="text-xs text-gray-400 mt-0.5">Latest incoming orders</p>
          </div>
          <Link href="/orders"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-orange-600 hover:bg-orange-50 transition-colors">
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-2">📦</p>
            <p className="font-medium text-gray-400">No orders yet</p>
            <p className="text-sm text-gray-300 mt-1">Orders from customers will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide"
                  style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <th className="text-left px-5 py-3">Order ID</th>
                  <th className="text-left px-5 py-3">Customer</th>
                  <th className="text-left px-5 py-3">Amount</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order, idx) => (
                  <tr key={order.id} className="hover:bg-orange-50/30 transition-colors"
                    style={{ borderBottom: idx < recentOrders.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                    <td className="px-5 py-3.5">
                      <Link href={`/orders/${order.id}`}
                        className="font-bold text-orange-500 hover:text-orange-600 hover:underline">
                        #{order.orderNumber || order.id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-800">{order.customerName || '—'}</p>
                      <p className="text-xs text-gray-400">{order.phone}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-gray-900">₹{order.total?.toLocaleString('en-IN') || 0}</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">{formatTimestamp(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
