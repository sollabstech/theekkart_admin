'use client';
import { useEffect, useState, useMemo } from 'react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { listenToPartnersByRole, formatTimestamp } from '@/lib/firestore';
import {
  Search, Phone, Mail, MapPin, Bike, ShieldCheck, Car,
  CheckCircle, XCircle, PauseCircle, PlayCircle, Trash2,
  KeyRound, Eye, EyeOff, Copy, RefreshCw, ChevronDown, ChevronUp,
  User, AlertCircle,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// ─── Credential Modal ─────────────────────────────────────────────────────────
function CredModal({ rider, onClose }) {
  const ex = rider.credentials || {};
  const [u, setU] = useState(ex.username || '');
  const [p, setP] = useState(ex.password || '');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!u.trim() || !p.trim()) return toast.error('Both fields required');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'partner_requests', rider.id), {
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
        <h3 className="font-bold text-gray-900 text-lg">Login Credentials — {rider.name}</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <div className="flex gap-2">
            <input value={u} onChange={e => setU(e.target.value)} placeholder="e.g. rider_rahul"
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            {u && <button onClick={() => { navigator.clipboard.writeText(u); toast.success('Copied!'); }}
              className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50"><Copy size={15} /></button>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-blue-400">
              <input value={p} onChange={e => setP(e.target.value)} type={show ? 'text' : 'password'} placeholder="Set a password"
                className="flex-1 py-2.5 text-sm focus:outline-none" />
              <button onClick={() => setShow(!show)} className="ml-2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {p && <button onClick={() => { navigator.clipboard.writeText(p); toast.success('Copied!'); }}
              className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50"><Copy size={15} /></button>}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rider Card ───────────────────────────────────────────────────────────────
function RiderCard({ r, onApprove, onReject, onReset, onSuspend, onDelete, onSetCreds }) {
  const [expanded, setExpanded] = useState(false);
  const isPending  = !r.status || r.status === 'pending';
  const isApproved = r.status === 'approved';
  const isRejected = r.status === 'rejected';
  const isSusp     = !!r.suspended;

  const statusCfg = {
    pending:  { label: 'Pending',  bg: 'bg-yellow-100 text-yellow-700' },
    approved: { label: 'Approved', bg: 'bg-green-100  text-green-700'  },
    rejected: { label: 'Rejected', bg: 'bg-red-100    text-red-700'    },
  };
  const sc = statusCfg[r.status || 'pending'];

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${isSusp ? 'border-orange-200' : 'border-gray-100'}`}>
      {/* ── Header ── */}
      <div className="flex items-start gap-4 p-5">
        <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Bike size={20} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-bold text-gray-900">{r.name || '—'}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg}`}>{sc.label}</span>
            {isSusp && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Suspended</span>}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {r.phone && <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-blue-500 font-medium"><Phone size={11}/> {r.phone}</a>}
            {r.email && <span className="flex items-center gap-1"><Mail size={11}/> {r.email}</span>}
            {r.area  && <span className="flex items-center gap-1"><MapPin size={11}/> {r.area}</span>}
            <span className="text-gray-300">{formatTimestamp(r.createdAt)}</span>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          {expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
        </button>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mt-4">
            <Detail icon={User}        label="Full Name"        value={r.name} />
            <Detail icon={Phone}       label="Phone"            value={r.phone} />
            <Detail icon={Mail}        label="Email"            value={r.email} />
            <Detail icon={User}        label="Age"              value={r.age ? `${r.age} years` : null} />
            <Detail icon={MapPin}      label="Area / City"      value={r.area} />
            <Detail icon={Car}         label="Vehicle Type"     value={r.vehicleType} />
            <Detail icon={ShieldCheck} label="Vehicle No."      value={r.vehicleNumber} />
            <Detail icon={ShieldCheck} label="ID Proof Type"    value={r.idProofType} />
            <Detail icon={ShieldCheck} label="ID Proof No."     value={r.idProofNumber} />
            {r.emergencyContact?.name && (
              <Detail icon={AlertCircle} label="Emergency Contact"
                value={`${r.emergencyContact.name} — ${r.emergencyContact.phone || ''}`} />
            )}
          </div>

          {/* Rider ID */}
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <span className="font-semibold">Rider ID:</span>
            <code className="bg-gray-100 px-2 py-0.5 rounded-lg font-mono text-gray-600">{r.id}</code>
          </div>

          {/* Credentials */}
          {isApproved && r.credentials && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1.5">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-1"><KeyRound size={11}/> Login Credentials</p>
              <div className="flex gap-4 text-xs">
                <span>User: <code className="font-mono bg-white border border-blue-100 px-1.5 py-0.5 rounded">{r.credentials.username}</code></span>
                <span>Pass: <code className="font-mono bg-white border border-blue-100 px-1.5 py-0.5 rounded">{r.credentials.password}</code></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-2 flex-wrap px-5 pb-5">
        {isPending && <>
          <Btn color="green"  icon={CheckCircle} onClick={() => onApprove(r.id)}>Approve</Btn>
          <Btn color="red"    icon={XCircle}     onClick={() => onReject(r.id)}>Reject</Btn>
        </>}
        {isApproved && <>
          <Btn color="blue" icon={KeyRound} onClick={() => onSetCreds(r)}>
            {r.credentials ? 'Edit Credentials' : 'Set Credentials'}
          </Btn>
          <Btn color={isSusp ? 'green' : 'orange'} icon={isSusp ? PlayCircle : PauseCircle}
            onClick={() => onSuspend(r.id, !isSusp)}>
            {isSusp ? 'Unsuspend' : 'Suspend'}
          </Btn>
        </>}
        {(isApproved || isRejected) &&
          <Btn color="gray" icon={RefreshCw} onClick={() => onReset(r.id)}>Reset</Btn>}
        <Btn color="red" icon={Trash2} outline onClick={() => onDelete(r.id, r.name)} className="ml-auto">Delete</Btn>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
      <span className="text-gray-400 w-32 flex-shrink-0 text-xs">{label}</span>
      <span className="font-medium text-gray-800 text-xs">{value}</span>
    </div>
  );
}

function Btn({ color, icon: Icon, onClick, outline, children, className = '' }) {
  const colors = {
    green:  outline ? 'border-green-300  text-green-700  hover:bg-green-50'  : 'bg-green-500  hover:bg-green-600  text-white',
    red:    outline ? 'border-red-300    text-red-700    hover:bg-red-50'    : 'bg-red-500    hover:bg-red-600    text-white',
    blue:   outline ? 'border-blue-300   text-blue-700   hover:bg-blue-50'   : 'bg-blue-500   hover:bg-blue-600   text-white',
    orange: outline ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'bg-orange-500 hover:bg-orange-600 text-white',
    gray:   'border-gray-200 text-gray-500 hover:bg-gray-50',
  };
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${colors[color]} ${className}`}>
      <Icon size={12} />{children}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RidersPage() {
  const [riders,  setRiders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [credModal, setCredModal] = useState(null);

  useEffect(() => {
    return listenToPartnersByRole('rider', data => {
      setRiders(data);
      setLoading(false);
    });
  }, []);

  async function approve(id)  { await updateDoc(doc(db,'partner_requests',id),{status:'approved', updatedAt:serverTimestamp()}); toast.success('Approved'); }
  async function reject(id)   { await updateDoc(doc(db,'partner_requests',id),{status:'rejected', updatedAt:serverTimestamp()}); toast.success('Rejected'); }
  async function reset(id)    { await updateDoc(doc(db,'partner_requests',id),{status:'pending',  updatedAt:serverTimestamp()}); toast.success('Reset to pending'); }
  async function suspend(id, val) {
    await updateDoc(doc(db,'partner_requests',id),{suspended:val, updatedAt:serverTimestamp()});
    toast.success(val ? 'Rider suspended' : 'Rider unsuspended');
  }
  async function del(id, name) {
    if (!confirm(`Delete rider "${name}"?`)) return;
    await deleteDoc(doc(db,'partner_requests',id));
    toast.success('Deleted');
  }

  const counts = useMemo(() => ({
    total:    riders.length,
    approved: riders.filter(r => r.status === 'approved').length,
    pending:  riders.filter(r => !r.status || r.status === 'pending').length,
    rejected: riders.filter(r => r.status === 'rejected').length,
    suspended:riders.filter(r => r.suspended).length,
  }), [riders]);

  const displayed = useMemo(() => riders.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.name?.toLowerCase().includes(q) || r.phone?.includes(q) || r.area?.toLowerCase().includes(q) || r.vehicleNumber?.toLowerCase().includes(q);
    const matchFilter =
      filter === 'all'       ? true :
      filter === 'approved'  ? r.status === 'approved' :
      filter === 'pending'   ? (!r.status || r.status === 'pending') :
      filter === 'rejected'  ? r.status === 'rejected' :
      filter === 'suspended' ? !!r.suspended : true;
    return matchSearch && matchFilter;
  }), [riders, search, filter]);

  const statCards = [
    { label: 'Total Riders',  value: counts.total,     color: '#3b82f6' },
    { label: 'Approved',      value: counts.approved,  color: '#22c55e' },
    { label: 'Pending',       value: counts.pending,   color: '#f97316' },
    { label: 'Rejected',      value: counts.rejected,  color: '#ef4444' },
    { label: 'Suspended',     value: counts.suspended, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {credModal && <CredModal rider={credModal} onClose={() => setCredModal(null)} />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{loading ? '–' : s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name, phone, area, vehicle no…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all','pending','approved','rejected','suspended'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${filter === f ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f} {f !== 'all' ? `(${counts[f] ?? 0})` : `(${counts.total})`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
          <Bike size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-medium">No riders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(r => (
            <RiderCard key={r.id} r={r}
              onApprove={approve} onReject={reject} onReset={reset}
              onSuspend={suspend} onDelete={del} onSetCreds={setCredModal} />
          ))}
        </div>
      )}
    </div>
  );
}
