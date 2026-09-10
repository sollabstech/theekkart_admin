'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { listenToOrders, ORDER_STATUS, formatTimestamp } from '@/lib/firestore';
import { downloadExcel, downloadPDF } from '@/lib/download';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import { Search, Eye, X, FileSpreadsheet, FileText } from 'lucide-react';

const STATUS_TABS = [
  { key: 'all',                           label: 'All' },
  { key: ORDER_STATUS.RECEIVED,           label: 'New' },
  { key: ORDER_STATUS.CONFIRMED,          label: 'Confirmed' },
  { key: ORDER_STATUS.PREPARING,          label: 'Preparing' },
  { key: ORDER_STATUS.OUT_FOR_DELIVERY,   label: 'Out for Delivery' },
  { key: ORDER_STATUS.DELIVERED,          label: 'Delivered' },
  { key: ORDER_STATUS.CANCELLED,          label: 'Cancelled' },
];

// PDF column definitions
const PDF_COLS = [
  { header: 'Order #',   key: 'orderNumber' },
  { header: 'Customer',  key: 'customerName' },
  { header: 'Phone',     key: 'phone' },
  { header: 'Items',     key: 'itemCount' },
  { header: 'Amount',    key: 'amount' },
  { header: 'Payment',   key: 'payment' },
  { header: 'Status',    key: 'status' },
  { header: 'Time',      key: 'time' },
];

function ordersToRows(orders) {
  return orders.map(o => ({
    'Order #':       `#${o.orderNumber || o.id.slice(-6).toUpperCase()}`,
    'Customer':      o.customerName || '—',
    'Phone':         o.phone || '—',
    'Email':         o.customerEmail || '—',
    'Items':         (o.items || []).length,
    'Amount (₹)':    o.total || 0,
    'Payment':       o.paymentMethod === 'upi' ? 'UPI' : 'COD',
    'Status':        o.status || '—',
    'Time':          formatTimestamp(o.createdAt) || '—',
  }));
}

function ordersToExcelRows(orders) { return ordersToRows(orders); }

function ordersToPDFRows(orders) {
  return orders.map(o => ({
    orderNumber:  `#${o.orderNumber || o.id.slice(-6).toUpperCase()}`,
    customerName: o.customerName || '—',
    phone:        o.phone || '—',
    itemCount:    `${(o.items || []).length} item${(o.items||[]).length !== 1 ? 's' : ''}`,
    amount:       `₹${(o.total || 0).toLocaleString('en-IN')}`,
    payment:      o.paymentMethod === 'upi' ? 'UPI' : 'COD',
    status:       o.status || '—',
    time:         formatTimestamp(o.createdAt) || '—',
  }));
}

function DownloadButtons({ data, filename, title, disabled }) {
  const [busy, setBusy] = useState(false);

  async function handleExcel() {
    if (busy || disabled) return;
    setBusy(true);
    try { await downloadExcel(ordersToExcelRows(data), filename); } finally { setBusy(false); }
  }

  async function handlePDF() {
    if (busy || disabled) return;
    setBusy(true);
    try { await downloadPDF(PDF_COLS, ordersToPDFRows(data), filename, title); } finally { setBusy(false); }
  }

  return (
    <div className="flex gap-2">
      <button onClick={handleExcel} disabled={busy || disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
          border border-green-200 text-green-700 bg-green-50 hover:bg-green-100
          disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <FileSpreadsheet size={14} />
        Excel
      </button>
      <button onClick={handlePDF} disabled={busy || disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
          border border-red-200 text-red-600 bg-red-50 hover:bg-red-100
          disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <FileText size={14} />
        PDF
      </button>
    </div>
  );
}

function OrdersContent() {
  const params        = useSearchParams();
  const router        = useRouter();
  const filterEmail   = (params.get('customerEmail') || '').trim().toLowerCase() || null;
  const filterUid     = !filterEmail ? (params.get('customerId')   || null) : null;
  const filterName    = (!filterEmail && !filterUid) ? (params.get('customerName') || null) : null;

  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('all');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    const unsub = listenToOrders(data => { setOrders(data); setLoading(false); });
    return () => unsub();
  }, []);

  function matchesCustomer(o) {
    if (filterEmail) return (o.customerEmail || '').trim().toLowerCase() === filterEmail;
    if (filterUid)   return o.customerId === filterUid;
    if (filterName)  return (o.customerName || '').trim().toLowerCase() === filterName.toLowerCase();
    return true;
  }

  const filtered = orders.filter(o => {
    const matchTab    = tab === 'all' || o.status === tab;
    const matchCust   = matchesCustomer(o);
    const q           = search.toLowerCase();
    const matchSearch = !q || (
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.phone        || '').includes(q) ||
      (o.orderNumber  || o.id || '').toLowerCase().includes(q)
    );
    return matchTab && matchSearch && matchCust;
  });

  const isFiltered   = filterEmail || filterUid || filterName;
  const customerName = isFiltered
    ? (orders.find(o => matchesCustomer(o))?.customerName || filterName || filterEmail || 'Customer')
    : null;

  // Filename & title for download
  const tabLabel  = STATUS_TABS.find(t => t.key === tab)?.label || 'All';
  const dlName    = `orders-${tabLabel.toLowerCase().replace(/ /g, '-')}-${new Date().toISOString().slice(0,10)}`;
  const dlTitle   = `TheekKart Orders — ${tabLabel}${customerName ? ` · ${customerName}` : ''}`;

  return (
    <div className="space-y-4">

      {/* Customer filter banner */}
      {isFiltered && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-orange-700">
              Orders for <span className="font-black">{customerName}</span>
            </p>
            {filterEmail && <p className="text-xs text-orange-500 mt-0.5">{filterEmail}</p>}
          </div>
          <button onClick={() => router.replace('/orders')}
            className="flex items-center gap-1 text-xs text-orange-500 font-semibold hover:text-orange-700">
            <X size={14} /> Clear filter
          </button>
        </div>
      )}

      {/* Search + download */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, phone, order ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <DownloadButtons
            data={filtered}
            filename={dlName}
            title={dlTitle}
            disabled={loading || filtered.length === 0}
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => {
          const count = t.key === 'all'
            ? orders.filter(o => matchesCustomer(o)).length
            : orders.filter(o => o.status === t.key && matchesCustomer(o)).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
              }`}>
              {t.label} <span className="ml-1 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading orders…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No orders found</div>
        ) : (
          <>
            {/* Second download row above table */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <span className="text-xs text-gray-400">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
              <DownloadButtons
                data={filtered}
                filename={dlName}
                title={dlTitle}
                disabled={false}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3">Order #</th>
                    <th className="text-left px-5 py-3">Customer</th>
                    <th className="text-left px-5 py-3">Items</th>
                    <th className="text-left px-5 py-3">Amount</th>
                    <th className="text-left px-5 py-3">Payment</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Time</th>
                    <th className="text-left px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        #{order.orderNumber || order.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-800">{order.customerName || '—'}</div>
                        <div className="text-xs text-gray-400">{order.phone}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {(order.items || []).length} item{(order.items || []).length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-800">
                        ₹{order.total?.toLocaleString('en-IN') || 0}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          order.paymentMethod === 'upi'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {order.paymentMethod === 'upi' ? 'UPI' : 'COD'}
                        </span>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatTimestamp(order.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/orders/${order.id}`}
                          className="inline-flex items-center gap-1 text-orange-500 hover:text-orange-600 text-xs font-medium">
                          <Eye size={14} /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-400">Loading…</div>}>
      <OrdersContent />
    </Suspense>
  );
}
