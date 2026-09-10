'use client';
import { useEffect, useState } from 'react';
import { listenToOrders, ORDER_STATUS } from '@/lib/firestore';
import { TrendingUp, ShoppingBag, CheckCircle, XCircle, IndianRupee } from 'lucide-react';

function groupByDate(orders) {
  const map = {};
  orders.forEach(o => {
    if (!o.createdAt) return;
    const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
    const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (!map[key]) map[key] = { date: key, orders: 0, revenue: 0 };
    map[key].orders++;
    if (o.status === ORDER_STATUS.DELIVERED) map[key].revenue += (o.total || 0);
  });
  return Object.values(map).slice(-14).reverse();
}

export default function ReportsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(7);

  useEffect(() => {
    const unsub = listenToOrders(data => { setOrders(data); setLoading(false); });
    return () => unsub();
  }, []);

  const now = new Date();
  const cutoff = new Date(now - range * 24 * 60 * 60 * 1000);
  const rangeOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
    return d >= cutoff;
  });

  const totalRevenue = rangeOrders.filter(o => o.status === ORDER_STATUS.DELIVERED).reduce((s, o) => s + (o.total || 0), 0);
  const delivered = rangeOrders.filter(o => o.status === ORDER_STATUS.DELIVERED).length;
  const cancelled = rangeOrders.filter(o => o.status === ORDER_STATUS.CANCELLED).length;
  const avgOrder = delivered > 0 ? totalRevenue / delivered : 0;

  const daily = groupByDate(orders);
  const maxRevenue = Math.max(...daily.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex gap-2">
        {[7, 14, 30].map(d => (
          <button
            key={d}
            onClick={() => setRange(d)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${range === d ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'}`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: rangeOrders.length, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Delivered', value: delivered, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Cancelled', value: cancelled, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '…' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Avg order value */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} />
          <span className="font-semibold">Average Order Value</span>
        </div>
        <p className="text-4xl font-bold">₹{avgOrder.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        <p className="text-orange-100 text-sm mt-1">Last {range} days</p>
      </div>

      {/* Daily chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-5">Daily Revenue (Last 14 days)</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading…</div>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {daily.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-xs text-gray-500 font-semibold">₹{d.revenue > 999 ? `${(d.revenue/1000).toFixed(1)}k` : d.revenue}</p>
                <div
                  className="w-full bg-orange-400 rounded-t-lg transition-all"
                  style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: d.revenue > 0 ? '4px' : '2px', opacity: d.revenue > 0 ? 1 : 0.2 }}
                />
                <p className="text-[10px] text-gray-400 text-center leading-tight">{d.date}</p>
              </div>
            ))}
            {daily.length === 0 && <p className="text-gray-400 text-sm m-auto">No data yet</p>}
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Order Status Breakdown</h2>
        {[
          { status: ORDER_STATUS.DELIVERED, label: 'Delivered', color: 'bg-green-400' },
          { status: ORDER_STATUS.CANCELLED, label: 'Cancelled', color: 'bg-red-400' },
          { status: ORDER_STATUS.RECEIVED, label: 'Pending/New', color: 'bg-blue-400' },
          { status: ORDER_STATUS.OUT_FOR_DELIVERY, label: 'Out for Delivery', color: 'bg-purple-400' },
        ].map(s => {
          const count = rangeOrders.filter(o => o.status === s.status).length;
          const pct = rangeOrders.length > 0 ? (count / rangeOrders.length) * 100 : 0;
          return (
            <div key={s.status} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{s.label}</span>
                <span className="font-semibold text-gray-800">{count} ({pct.toFixed(0)}%)</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`${s.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
