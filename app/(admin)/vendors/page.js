'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  listenToPartnersByRole, formatTimestamp,
  getAllProductsGrouped, getAllOrdersGrouped,
} from '@/lib/firestore';
import {
  Search, Store, Phone, Mail, MapPin, Package, ShoppingBag,
  TrendingUp, IndianRupee, CheckCircle, XCircle, PauseCircle,
  PlayCircle, Trash2, KeyRound, Eye, EyeOff, Copy, RefreshCw,
  ChevronRight, Filter,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const CATEGORIES = ['All','Grocery','Vegetables & Fruits','Dairy & Eggs','Bakery','Meat & Seafood','Snacks & Beverages','Pharmacy','Household','Other'];

// ─── Credential Modal ─────────────────────────────────────────────────────────
function CredModal({ vendor, onClose }) {
  const ex = vendor.credentials || {};
  const [u, setU] = useState(ex.username || '');
  const [p, setP] = useState(ex.password || '');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!u.trim() || !p.trim()) return toast.error('Both fields required');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'partner_requests', vendor.id), {
        credentials: { username: u.trim(), password: p.trim() },
        updatedAt: serverTimestamp(),
      });
      toast.success('Credentials saved');
      onClose();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-gray-900 text-lg">Login Credentials — {vendor.shopName || vendor.name}</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <div className="flex gap-2">
            <input value={u} onChange={e => setU(e.target.value)} placeholder="e.g. vendor_sharma"
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            {u && <button onClick={() => { navigator.clipboard.writeText(u); toast.success('Copied!'); }}
              className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50"><Copy size={15}/></button>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-orange-400">
              <input value={p} onChange={e => setP(e.target.value)} type={show ? 'text' : 'password'} placeholder="Set a password"
                className="flex-1 py-2.5 text-sm focus:outline-none" />
              <button onClick={() => setShow(!show)} className="ml-2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            {p && <button onClick={() => { navigator.clipboard.writeText(p); toast.success('Copied!'); }}
              className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50"><Copy size={15}/></button>}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Vendor Row ───────────────────────────────────────────────────────────────
function VendorRow({ v, productCount, orderCount, revenue, todayIncome, onApprove, onReject, onReset, onSuspend, onDelete, onSetCreds }) {
  const isPending  = !v.status || v.status === 'pending';
  const isApproved = v.status === 'approved';
  const isRejected = v.status === 'rejected';
  const isSusp     = !!v.suspended;

  const statusCfg = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100  text-green-700',
    rejected: 'bg-red-100    text-red-700',
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm ${isSusp ? 'border-orange-200' : 'border-gray-100'}`}>
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Store size={20} className="text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-bold text-gray-900">{v.shopName || v.name || '—'}</span>
              <span className="text-xs text-gray-400">(Owner: {v.name})</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg[v.status || 'pending']}`}>
                {v.status || 'pending'}
              </span>
              {isSusp && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Suspended</span>}
              {v.businessCategory && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{v.businessCategory}</span>}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {v.phone && <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-orange-500 font-medium"><Phone size={11}/>{v.phone}</a>}
              {v.email && <span className="flex items-center gap-1"><Mail size={11}/>{v.email}</span>}
              {(v.area || v.district) && <span className="flex items-center gap-1"><MapPin size={11}/>{v.area || v.district}</span>}
              <span className="text-gray-300">{formatTimestamp(v.createdAt)}</span>
            </div>
          </div>
          {/* Detail link */}
          {isApproved && (
            <Link href={`/vendors/${v.id}`}
              className="flex items-center gap-1 text-xs font-semibold text-orange-500 hover:text-orange-600 flex-shrink-0 px-3 py-2 border border-orange-200 rounded-xl hover:bg-orange-50">
              View <ChevronRight size={14}/>
            </Link>
          )}
        </div>

        {/* Stats row (approved only) */}
        {isApproved && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <StatPill icon={Package}     label="Products"      value={productCount} color="text-blue-500" />
            <StatPill icon={ShoppingBag} label="Orders"        value={orderCount}   color="text-purple-500" />
            <StatPill icon={IndianRupee} label="Revenue"       value={`₹${revenue.toLocaleString('en-IN')}`} color="text-green-600" />
            <StatPill icon={TrendingUp}  label="Today's Income" value={`₹${todayIncome.toLocaleString('en-IN')}`} color="text-orange-500" />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap mt-4">
          {isPending && <>
            <ActionBtn color="green" icon={CheckCircle} onClick={() => onApprove(v.id)}>Approve</ActionBtn>
            <ActionBtn color="red"   icon={XCircle}     onClick={() => onReject(v.id)}>Reject</ActionBtn>
          </>}
          {isApproved && <>
            <ActionBtn color="orange" icon={KeyRound} onClick={() => onSetCreds(v)}>
              {v.credentials ? 'Edit Credentials' : 'Set Credentials'}
            </ActionBtn>
            <ActionBtn color={isSusp ? 'green' : 'orange'} icon={isSusp ? PlayCircle : PauseCircle}
              onClick={() => onSuspend(v.id, !isSusp)}>
              {isSusp ? 'Unsuspend' : 'Suspend'}
            </ActionBtn>
          </>}
          {(isApproved || isRejected) &&
            <ActionBtn color="gray" icon={RefreshCw} onClick={() => onReset(v.id)}>Reset</ActionBtn>}
          <ActionBtn color="red" outline icon={Trash2} onClick={() => onDelete(v.id, v.name)} className="ml-auto">Delete</ActionBtn>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
      <Icon size={14} className={color} />
      <div>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function ActionBtn({ color, icon: Icon, onClick, outline, children, className = '' }) {
  const c = {
    green:  outline ? 'border-green-300  text-green-700  hover:bg-green-50'  : 'bg-green-500  hover:bg-green-600  text-white border-green-500',
    red:    outline ? 'border-red-300    text-red-600    hover:bg-red-50'    : 'bg-red-500    hover:bg-red-600    text-white border-red-500',
    orange: outline ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500',
    gray:   'border-gray-200 text-gray-500 hover:bg-gray-50',
  }[color];
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${c} ${className}`}>
      <Icon size={12}/>{children}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const [vendors,      setVendors]      = useState([]);
  const [productMap,   setProductMap]   = useState({});
  const [orderMap,     setOrderMap]     = useState({});
  const [revenueMap,   setRevenueMap]   = useState({});
  const [todayMap,     setTodayMap]     = useState({});
  const [loading,      setLoading]      = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter,    setCatFilter]    = useState('All');
  const [credModal,    setCredModal]    = useState(null);

  useEffect(() => {
    const unsub = listenToPartnersByRole(['vendor', 'shop'], data => {
      setVendors(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    Promise.all([getAllProductsGrouped(), getAllOrdersGrouped()]).then(([pMap, { countMap, revenueMap: rMap, todayMap: tMap }]) => {
      setProductMap(pMap);
      setOrderMap(countMap);
      setRevenueMap(rMap);
      setTodayMap(tMap);
      setStatsLoading(false);
    });
  }, []);

  async function approve(id)  { await updateDoc(doc(db,'partner_requests',id),{status:'approved', updatedAt:serverTimestamp()}); toast.success('Approved'); }
  async function reject(id)   { await updateDoc(doc(db,'partner_requests',id),{status:'rejected', updatedAt:serverTimestamp()}); toast.success('Rejected'); }
  async function reset(id)    { await updateDoc(doc(db,'partner_requests',id),{status:'pending',  updatedAt:serverTimestamp()}); toast.success('Reset to pending'); }
  async function suspend(id, val) {
    await updateDoc(doc(db,'partner_requests',id),{suspended:val, updatedAt:serverTimestamp()});
    toast.success(val ? 'Vendor suspended' : 'Vendor unsuspended');
  }
  async function del(id, name) {
    if (!confirm(`Delete vendor "${name}"?`)) return;
    await deleteDoc(doc(db,'partner_requests',id));
    toast.success('Deleted');
  }

  const counts = useMemo(() => ({
    total:    vendors.length,
    approved: vendors.filter(v => v.status === 'approved').length,
    pending:  vendors.filter(v => !v.status || v.status === 'pending').length,
    suspended:vendors.filter(v => v.suspended).length,
    totalProducts: Object.values(productMap).reduce((a, b) => a + b, 0),
    totalRevenue:  Object.values(revenueMap).reduce((a, b) => a + b, 0),
  }), [vendors, productMap, revenueMap]);

  const displayed = useMemo(() => vendors.filter(v => {
    const q = search.toLowerCase();
    const matchQ = !q || v.name?.toLowerCase().includes(q) || v.shopName?.toLowerCase().includes(q)
      || v.phone?.includes(q) || v.area?.toLowerCase().includes(q) || v.district?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' ? true : statusFilter === 'approved' ? v.status === 'approved' : statusFilter === 'pending' ? (!v.status || v.status === 'pending') : v.status === statusFilter;
    const matchC = catFilter === 'All' || v.businessCategory === catFilter;
    return matchQ && matchS && matchC;
  }), [vendors, search, statusFilter, catFilter]);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {credModal && <CredModal vendor={credModal} onClose={() => setCredModal(null)} />}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Vendors',    value: counts.total,          color: '#f97316' },
          { label: 'Approved',         value: counts.approved,       color: '#22c55e' },
          { label: 'Pending',          value: counts.pending,        color: '#f59e0b' },
          { label: 'Suspended',        value: counts.suspended,      color: '#ef4444' },
          { label: 'Total Products',   value: statsLoading ? '–' : counts.totalProducts, color: '#3b82f6' },
          { label: 'Platform Revenue', value: statsLoading ? '–' : `₹${counts.totalRevenue.toLocaleString('en-IN')}`, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-xl font-black truncate" style={{ color: s.color }}>{loading ? '–' : s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search by vendor name, shop, phone, area…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          </div>
          <div className="flex gap-2">
            {['all','pending','approved','rejected'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${statusFilter === f ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        {/* Category filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-400"/>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${catFilter === c ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Vendor list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-gray-100"/>)}</div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
          <Store size={40} className="mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-400 font-medium">No vendors found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(v => (
            <VendorRow key={v.id} v={v}
              productCount={productMap[v.id] ?? 0}
              orderCount={orderMap[v.id]   ?? 0}
              revenue={revenueMap[v.id]    ?? 0}
              todayIncome={todayMap[v.id]  ?? 0}
              onApprove={approve} onReject={reject} onReset={reset}
              onSuspend={suspend} onDelete={del} onSetCreds={setCredModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
