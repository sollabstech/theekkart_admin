'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, deleteField, doc, onSnapshot, query, setDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAdminUser } from '@/lib/auth';
import { listenToPartnersByRole, formatTimestamp } from '@/lib/firestore';
import {
  DEFAULT_COMMISSION_PERCENT, MAX_ORDERS_PER_SETTLEMENT, deliveredAtMs, orderSales, parsePercent, periodRange, percentFor, summarizeSettlements,
} from '@/lib/settlement';
import { settleVendor, SettlementError } from '@/lib/settlementActions';
import { downloadExcel, downloadPDF } from '@/lib/download';
import toast, { Toaster } from 'react-hot-toast';
import { Wallet, ChevronDown, ChevronUp, Percent, Check, X, FileSpreadsheet, FileText, Store } from 'lucide-react';

const PERIODS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 days'], ['month', 'This month'], ['all', 'All pending'], ['custom', 'Custom'],
];
const inr = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const COMMISSION_REF = doc(db, 'settings', 'commission');

// ─── Settle confirmation ─────────────────────────────────────────────────────
function SettleModal({ row, periodLabel, onClose, onDone }) {
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const tooMany = row.count > MAX_ORDERS_PER_SETTLEMENT;
  const ids = row.orders.slice(0, MAX_ORDERS_PER_SETTLEMENT).map(o => o.id);

  async function confirm() {
    setSaving(true);
    try {
      const res = await settleVendor(db, { vendor: row.vendor, orderIds: ids, percent: row.percent, adminId: getAdminUser(), note, reference });
      toast.success(`Settled ${res.settlement.orderCount} order${res.settlement.orderCount !== 1 ? 's' : ''} — pay ${inr(res.settlement.payable)}`);
      if (res.skipped.length) toast(`${res.skipped.length} order(s) were already settled and were left out`, { icon: 'ℹ️' });
      onDone();
    } catch (e) {
      toast.error(e instanceof SettlementError ? e.message : 'Could not record the settlement');
      setSaving(false);
    }
  }

  const name = row.vendor.shopName || row.vendor.name;
  const field = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400';
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-bold text-gray-900 text-lg">Settle with {name}</h3>
        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
          <div className="flex justify-between text-gray-500"><span>Period</span><span>{periodLabel}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Delivered orders</span><span className="font-medium">{Math.min(row.count, MAX_ORDERS_PER_SETTLEMENT)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Sales (items)</span><span className="font-medium">{inr(row.gross)}</span></div>
          <div className="flex justify-between text-red-600"><span>Commission ({row.percent}%)</span><span>− {inr(row.commission)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900"><span>Pay the vendor</span><span className="text-green-700">{inr(row.payable)}</span></div>
        </div>
        {tooMany && <p className="text-xs text-amber-600">This period has {row.count} orders. The first {MAX_ORDERS_PER_SETTLEMENT} will be settled now — settle again for the rest.</p>}
        <input className={field} value={reference} onChange={e => setReference(e.target.value)} placeholder="Payment reference (UPI / bank transaction no.) — optional" />
        <input className={field} value={note} onChange={e => setNote(e.target.value)} placeholder="Note — optional" />
        <p className="text-xs text-gray-400">Marking as settled records that you have paid this amount. These orders will no longer appear as pending.</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={confirm} disabled={saving} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {saving ? 'Recording…' : `Mark ${inr(row.payable)} as paid`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Commission % editor for one vendor ──────────────────────────────────────
function RateCell({ row, defaultPercent }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.percent));
  const own = parsePercent(row.vendor.commissionPercent) !== null;

  async function save() {
    const n = parsePercent(value);
    if (n === null) return toast.error('Enter a percentage between 0 and 100');
    try {
      await updateDoc(doc(db, 'partner_requests', row.vendor.id), { commissionPercent: n, updatedAt: serverTimestamp() });
      toast.success(`Commission for ${row.vendor.shopName || row.vendor.name} set to ${n}%`);
      setEditing(false);
    } catch { toast.error('Failed to save'); }
  }
  async function useDefault() {
    try {
      await updateDoc(doc(db, 'partner_requests', row.vendor.id), { commissionPercent: deleteField(), updatedAt: serverTimestamp() });
      toast.success(`Now using the default ${defaultPercent}%`);
      setEditing(false);
    } catch { toast.error('Failed to save'); }
  }

  if (!editing) {
    return (
      <button onClick={() => { setValue(String(row.percent)); setEditing(true); }} title="Change this vendor's commission"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 text-sm">
        <span className="font-semibold text-gray-800">{row.percent}%</span>
        {own && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 rounded-full font-semibold">custom</span>}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input value={value} onChange={e => setValue(e.target.value)} type="number" min="0" max="100" step="0.5" autoFocus
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      <button onClick={save} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save"><Check size={15} /></button>
      {own && <button onClick={useDefault} className="text-[10px] text-gray-500 hover:text-gray-800 underline">default</button>}
      <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancel"><X size={15} /></button>
    </div>
  );
}

export default function SettlementsPage() {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [defaultPercent, setDefaultPercent] = useState(DEFAULT_COMMISSION_PERCENT);
  const [defaultInput, setDefaultInput] = useState(String(DEFAULT_COMMISSION_PERCENT));
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [open, setOpen] = useState(null);       // vendor id with orders shown
  const [settling, setSettling] = useState(null); // row being settled
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), where('status', 'in', ['delivered', 'completed', 'complete'])),
      snap => { setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => { setLoading(false); toast.error('Could not load orders'); }
    );
    const unsubVendors = listenToPartnersByRole('vendor', setVendors);
    const unsubSettlements = onSnapshot(collection(db, 'settlements'), snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.settledAt?.toMillis?.() || 0) - (a.settledAt?.toMillis?.() || 0));
      setSettlements(rows);
    }, () => {});
    const unsubDefault = onSnapshot(COMMISSION_REF, snap => {
      const p = parsePercent(snap.data()?.defaultPercent);
      if (p !== null) { setDefaultPercent(p); setDefaultInput(String(p)); }
    }, () => {});
    return () => { unsubOrders(); unsubVendors(); unsubSettlements(); unsubDefault(); };
  }, []);

  const range = useMemo(() => periodRange(period, new Date(), custom), [period, custom]);
  const periodLabel = period === 'custom'
    ? `${custom.from || 'start'} → ${custom.to || 'today'}`
    : PERIODS.find(p => p[0] === period)[1];

  const { rows, totals } = useMemo(
    () => summarizeSettlements({ orders, vendors, defaultPercent, range }),
    [orders, vendors, defaultPercent, range]
  );

  async function saveDefault() {
    const n = parsePercent(defaultInput);
    if (n === null) return toast.error('Enter a percentage between 0 and 100');
    try {
      await setDoc(COMMISSION_REF, { defaultPercent: n, updatedAt: serverTimestamp(), updatedBy: getAdminUser() }, { merge: true });
      toast.success(`Default commission set to ${n}%`);
    } catch { toast.error('Failed to save'); }
  }

  const historyRows = () => settlements.map(s => ({
    'Settled on': formatTimestamp(s.settledAt), Vendor: s.vendorName, Orders: s.orderCount, 'Sales (₹)': s.gross,
    'Commission %': s.commissionPercent, 'Commission (₹)': s.commission, 'Paid (₹)': s.payable, Reference: s.reference || '', Note: s.note || '', 'By': s.settledBy || '',
  }));
  async function exportExcel() { setBusy(true); try { await downloadExcel(historyRows(), `settlements-${new Date().toISOString().slice(0, 10)}`); } finally { setBusy(false); } }
  async function exportPDF() {
    setBusy(true);
    try {
      const cols = [
        { header: 'Date', key: 'date' }, { header: 'Vendor', key: 'vendor' }, { header: 'Orders', key: 'orders' },
        { header: 'Sales', key: 'sales' }, { header: 'Comm.', key: 'comm' }, { header: 'Paid', key: 'paid' }, { header: 'Ref', key: 'ref' },
      ];
      const data = settlements.map(s => ({
        date: formatTimestamp(s.settledAt), vendor: s.vendorName, orders: s.orderCount, sales: inr(s.gross), comm: `${s.commissionPercent}% ${inr(s.commission)}`, paid: inr(s.payable), ref: s.reference || '',
      }));
      await downloadPDF(cols, data, `settlements-${new Date().toISOString().slice(0, 10)}`, 'TheekKart — Vendor Settlements');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <Toaster position="top-right" />
      {settling && <SettleModal row={settling} periodLabel={periodLabel} onClose={() => setSettling(null)} onDone={() => setSettling(null)} />}

      {/* Period + default commission */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Wallet size={16} className="text-orange-500" /> Vendor settlements</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              Each vendor&apos;s <b>sales</b> are the items of their <b>delivered</b> orders (the delivery fee is not theirs). TheekKart keeps the commission and you pay the rest.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1"><Percent size={13} /> Default commission</label>
            <input value={defaultInput} onChange={e => setDefaultInput(e.target.value)} type="number" min="0" max="100" step="0.5"
              onKeyDown={e => e.key === 'Enter' && saveDefault()}
              className="w-20 px-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <button onClick={saveDefault} disabled={String(defaultPercent) === String(parsePercent(defaultInput))}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl disabled:opacity-40">Save</button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {PERIODS.map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === key ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}>
              {label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm" />
              <span className="text-gray-400 text-sm">to</span>
              <input type="date" value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-xl text-sm" />
            </div>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Delivered orders', value: totals.orders, color: '#3b82f6', plain: true },
          { label: 'Vendor sales', value: inr(totals.gross), color: '#8b5cf6' },
          { label: 'Your commission', value: inr(totals.commission), color: '#f97316' },
          { label: 'To pay vendors', value: inr(totals.payable), color: '#16a34a' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-xl font-black truncate" style={{ color: s.color }}>{loading ? '–' : s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label} · {periodLabel}</p>
          </div>
        ))}
      </div>

      {/* Per-vendor table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50 text-xs text-gray-400">
          Pending (not yet paid) — {rows.length} vendor{rows.length !== 1 ? 's' : ''}
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Store size={36} className="mx-auto text-gray-200 mb-2" />
            Nothing to settle for {periodLabel.toLowerCase()}. Delivered orders appear here until you mark them as paid.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3">Vendor</th>
                  <th className="text-right px-4 py-3">Orders</th>
                  <th className="text-right px-4 py-3">Sales</th>
                  <th className="text-center px-4 py-3">Commission %</th>
                  <th className="text-right px-4 py-3">Commission</th>
                  <th className="text-right px-4 py-3">To pay</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <Fragment key={r.vendor.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <button onClick={() => setOpen(open === r.vendor.id ? null : r.vendor.id)} className="flex items-center gap-2 text-left">
                          {open === r.vendor.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                          <span className="font-medium text-gray-800">{r.vendor.shopName || r.vendor.name}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.count}</td>
                      <td className="px-4 py-3 text-right text-gray-800">{inr(r.gross)}</td>
                      <td className="px-4 py-3 text-center"><RateCell row={r} defaultPercent={defaultPercent} /></td>
                      <td className="px-4 py-3 text-right text-red-600">− {inr(r.commission)}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">{inr(r.payable)}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setSettling(r)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg">Mark settled</button>
                      </td>
                    </tr>
                    {open === r.vendor.id && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={7} className="px-5 py-3">
                          <div className="grid gap-1 text-xs">
                            {r.orders.slice().sort((a, b) => deliveredAtMs(b) - deliveredAtMs(a)).map(o => (
                              <div key={o.id} className="flex items-center gap-4 text-gray-600">
                                <Link href={`/orders/${o.id}`} className="font-mono text-orange-500 hover:underline w-28">#{o.orderNumber || o.id.slice(-6).toUpperCase()}</Link>
                                <span className="w-44">{new Date(deliveredAtMs(o)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="flex-1 truncate">{o.customerName || '—'}</span>
                                <span className="font-medium text-gray-800">{inr(orderSales(o))}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
          <span className="text-xs text-gray-400">Settlement history — {settlements.length} payout{settlements.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={busy || settlements.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40"><FileSpreadsheet size={13} /> Excel</button>
            <button onClick={exportPDF} disabled={busy || settlements.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40"><FileText size={13} /> PDF</button>
          </div>
        </div>
        {settlements.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No settlements recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3">Settled on</th>
                  <th className="text-left px-4 py-3">Vendor</th>
                  <th className="text-right px-4 py-3">Orders</th>
                  <th className="text-right px-4 py-3">Sales</th>
                  <th className="text-right px-4 py-3">Commission</th>
                  <th className="text-right px-4 py-3">Paid</th>
                  <th className="text-left px-5 py-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {settlements.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{formatTimestamp(s.settledAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.vendorName}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{s.orderCount}</td>
                    <td className="px-4 py-3 text-right">{inr(s.gross)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{s.commissionPercent}% · {inr(s.commission)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">{inr(s.payable)}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{s.reference || '—'}{s.note ? ` · ${s.note}` : ''}</td>
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
