'use client';
import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatTimestamp } from '@/lib/firestore';
import {
  Phone, MapPin, MessageSquare, Bike, Store,
  CheckCircle, XCircle, RefreshCw, Trash2,
  PauseCircle, PlayCircle, KeyRound, Eye, EyeOff, Copy,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const ROLE_META = {
  rider:  { label: 'Delivery Rider', icon: Bike,  color: 'bg-blue-100 text-blue-700',   dot: '#3b82f6' },
  vendor: { label: 'Vendor',         icon: Store, color: 'bg-purple-100 text-purple-700', dot: '#8b5cf6' },
};

const STATUS_META = {
  pending:  { label: 'Pending',   color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved',  color: 'bg-green-100 text-green-700'  },
  rejected: { label: 'Rejected',  color: 'bg-red-100 text-red-700'      },
};

// ─── Credentials Modal ────────────────────────────────────────────────────────
function CredentialsModal({ partner, onClose }) {
  const existing = partner.credentials || {};
  const [username, setUsername] = useState(existing.username || '');
  const [password, setPassword] = useState(existing.password || '');
  const [showPass, setShowPass] = useState(false);
  const [saving,   setSaving]   = useState(false);

  async function save() {
    if (!username.trim() || !password.trim()) return toast.error('Both fields required');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'partner_requests', partner.id), {
        credentials: { username: username.trim(), password: password.trim() },
        updatedAt: serverTimestamp(),
      });
      toast.success('Credentials saved & visible to partner in app');
      onClose();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  }

  function copy(val) {
    navigator.clipboard.writeText(val);
    toast.success('Copied!');
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-gray-900 text-lg">Set Login Credentials</h3>
        <p className="text-sm text-gray-500">
          These will be shown to <span className="font-semibold text-gray-700">{partner.name}</span> inside the app once approved.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <div className="flex gap-2">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. rider_bala"
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            {username && <button onClick={() => copy(username)} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50"><Copy size={15} /></button>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-orange-400">
              <input value={password} onChange={e => setPassword(e.target.value)} type={showPass ? 'text' : 'password'} placeholder="Set a password"
                className="flex-1 py-2.5 text-sm focus:outline-none" />
              <button onClick={() => setShowPass(!showPass)} className="ml-2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {password && <button onClick={() => copy(password)} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50"><Copy size={15} /></button>}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Credentials'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Partner Card ─────────────────────────────────────────────────────────────
function PartnerCard({ p, onApprove, onReject, onReset, onSuspend, onDelete, onSetCredentials }) {
  const role      = ROLE_META[p.role] || ROLE_META.rider;
  const status    = STATUS_META[p.status] || STATUS_META.pending;
  const RoleIcon  = role.icon;
  const isPending  = !p.status || p.status === 'pending';
  const isApproved = p.status === 'approved';
  const isRejected = p.status === 'rejected';
  const isSuspended = !!p.suspended;
  const creds = p.credentials;

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${isSuspended ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'} ${isRejected ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: role.dot + '18' }}>
          <RoleIcon size={22} style={{ color: role.dot }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-gray-900 text-sm">{p.name || '—'}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${role.color}`}>{role.label}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
            {isSuspended && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Suspended</span>}
          </div>

          {/* Contact */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
            {p.phone && (
              <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-orange-500 hover:text-orange-600 font-medium">
                <Phone size={11} /> {p.phone}
              </a>
            )}
            {p.area && <span className="flex items-center gap-1"><MapPin size={11} /> {p.area}</span>}
            <span className="text-gray-400">{formatTimestamp(p.createdAt)}</span>
          </div>

          {p.message && (
            <p className="text-sm text-gray-600 mt-2 flex items-start gap-1.5">
              <MessageSquare size={13} className="mt-0.5 flex-shrink-0 text-gray-400" />
              <span>{p.message}</span>
            </p>
          )}

          {/* Credentials display */}
          {isApproved && creds && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
              <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1"><KeyRound size={11} /> Login Credentials</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20">Username</span>
                <code className="text-xs font-mono bg-white border border-gray-200 px-2 py-0.5 rounded-lg">{creds.username}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20">Password</span>
                <code className="text-xs font-mono bg-white border border-gray-200 px-2 py-0.5 rounded-lg">{creds.password}</code>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {isPending && (
              <>
                <button onClick={() => onApprove(p.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors">
                  <CheckCircle size={12} /> Approve
                </button>
                <button onClick={() => onReject(p.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors">
                  <XCircle size={12} /> Reject
                </button>
              </>
            )}
            {isApproved && (
              <>
                <button onClick={() => onSetCredentials(p)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                  <KeyRound size={12} /> {creds ? 'Edit Credentials' : 'Set Credentials'}
                </button>
                <button onClick={() => onSuspend(p.id, !isSuspended)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                    isSuspended
                      ? 'border-green-300 text-green-700 hover:bg-green-50'
                      : 'border-orange-300 text-orange-700 hover:bg-orange-50'
                  }`}>
                  {isSuspended ? <><PlayCircle size={12} /> Unsuspend</> : <><PauseCircle size={12} /> Suspend</>}
                </button>
              </>
            )}
            {(isApproved || isRejected) && (
              <button onClick={() => onReset(p.id)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                <RefreshCw size={11} /> Reset
              </button>
            )}
            <button onClick={() => onDelete(p.id, p.name)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors ml-auto">
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PartnersPage() {
  const [applications,  setApplications]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [roleFilter,    setRoleFilter]    = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [credModal,     setCredModal]     = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'partner_requests'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  async function approve(id)   { await updateDoc(doc(db, 'partner_requests', id), { status: 'approved', updatedAt: serverTimestamp() }); toast.success('Approved'); }
  async function reject(id)    { await updateDoc(doc(db, 'partner_requests', id), { status: 'rejected', updatedAt: serverTimestamp() }); toast.success('Rejected'); }
  async function reset(id)     { await updateDoc(doc(db, 'partner_requests', id), { status: 'pending',  updatedAt: serverTimestamp() }); toast.success('Reset to pending'); }

  async function suspend(id, val) {
    await updateDoc(doc(db, 'partner_requests', id), { suspended: val, updatedAt: serverTimestamp() });
    toast.success(val ? 'Partner suspended' : 'Partner unsuspended');
  }

  async function deletePartner(id, name) {
    if (!confirm(`Delete application from "${name}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'partner_requests', id));
    toast.success('Deleted');
  }

  const riders   = applications.filter(a => a.role === 'rider');
  const vendors  = applications.filter(a => a.role === 'vendor');
  const pending  = applications.filter(a => !a.status || a.status === 'pending');
  const approved = applications.filter(a => a.status === 'approved');
  const rejected = applications.filter(a => a.status === 'rejected');

  const displayed = applications.filter(a => {
    const roleOk   = roleFilter   === 'all'    || a.role   === roleFilter;
    const statusOk = statusFilter === 'all'    || (!a.status && statusFilter === 'pending') || a.status === statusFilter;
    return roleOk && statusOk;
  });

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {credModal && <CredentialsModal partner={credModal} onClose={() => setCredModal(null)} />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: applications.length, color: '#3b82f6' },
          { label: 'Pending',  value: pending.length,      color: '#f97316' },
          { label: 'Approved', value: approved.length,     color: '#22c55e' },
          { label: 'Riders',   value: riders.length,       color: '#06b6d4' },
          { label: 'Vendors',  value: vendors.length,      color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{loading ? '–' : s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Role filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {[
            { v: 'all',    l: `All (${applications.length})` },
            { v: 'rider',  l: `Riders (${riders.length})`   },
            { v: 'vendor', l: `Vendors (${vendors.length})`  },
          ].map(f => (
            <button key={f.v} onClick={() => setRoleFilter(f.v)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${roleFilter === f.v ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'}`}>
              {f.l}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { v: 'all',      l: 'All statuses' },
            { v: 'pending',  l: `Pending (${pending.length})` },
            { v: 'approved', l: `Approved (${approved.length})` },
            { v: 'rejected', l: `Rejected (${rejected.length})` },
          ].map(f => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${statusFilter === f.v ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'}`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
          <p className="text-4xl mb-2">🤝</p>
          <p className="text-gray-400 font-medium">No partner applications yet</p>
          <p className="text-sm text-gray-300 mt-1">Applications from the app will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(p => (
            <PartnerCard key={p.id} p={p}
              onApprove={approve}
              onReject={reject}
              onReset={reset}
              onSuspend={suspend}
              onDelete={deletePartner}
              onSetCredentials={setCredModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
