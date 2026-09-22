'use client';
import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, deleteDoc, addDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plus, Pencil, Trash2, Tag, ToggleLeft, ToggleRight, Copy, Check } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

function getStatus(p) {
  if (!p.active) return 'disabled';
  if (p.expiresAt && p.expiresAt.toDate() < new Date()) return 'expired';
  if (p.maxUses != null && (p.usedCount || 0) >= p.maxUses) return 'exhausted';
  return 'active';
}

const STATUS_STYLE = {
  active:    'bg-green-100 text-green-700',
  disabled:  'bg-gray-100 text-gray-500',
  expired:   'bg-red-100 text-red-600',
  exhausted: 'bg-orange-100 text-orange-600',
};

const STATUS_LABEL = {
  active:    'Active',
  disabled:  'Disabled',
  expired:   'Expired',
  exhausted: 'Limit Reached',
};

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function PromoModal({ promo, onClose }) {
  const isEdit = !!promo?.id;
  const [code,        setCode]        = useState(promo?.code        || '');
  const [type,        setType]        = useState(promo?.type        || 'percentage');
  const [value,       setValue]       = useState(promo?.value       ?? '');
  const [minOrder,    setMinOrder]    = useState(promo?.minOrder    ?? '');
  const [maxUses,     setMaxUses]     = useState(promo?.maxUses     ?? '');
  const [maxDiscount, setMaxDiscount] = useState(promo?.maxDiscount ?? '');
  const [expiresAt,   setExpiresAt]   = useState(
    promo?.expiresAt ? promo.expiresAt.toDate().toISOString().split('T')[0] : ''
  );
  const [description, setDescription] = useState(promo?.description || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimCode = code.trim().toUpperCase();
    if (!trimCode) return toast.error('Code is required');
    if (!value || isNaN(Number(value)) || Number(value) <= 0) return toast.error('Discount value must be greater than 0');
    setSaving(true);
    try {
      const data = {
        code:        trimCode,
        type,
        value:       Number(value),
        minOrder:    minOrder    !== '' ? Number(minOrder)    : 0,
        maxUses:     maxUses     !== '' ? Number(maxUses)     : null,
        maxDiscount: (type === 'percentage' && maxDiscount !== '') ? Number(maxDiscount) : null,
        expiresAt:   expiresAt   ? new Date(expiresAt + 'T23:59:59') : null,
        description: description.trim(),
        active:      promo?.active ?? true,
      };
      if (isEdit) {
        await updateDoc(doc(db, 'promo_codes', promo.id), data);
        toast.success('Promo code updated');
      } else {
        await addDoc(collection(db, 'promo_codes'), { ...data, usedCount: 0, createdAt: serverTimestamp() });
        toast.success('Promo code created');
      }
      onClose();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit Promo Code' : 'New Promo Code'}</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. SAVE10"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
          <div className="flex gap-2">
            {[['percentage', '% Percentage'], ['flat', '₹ Flat Amount']].map(([v, l]) => (
              <button key={v} onClick={() => setType(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  type === v ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === 'percentage' ? 'Discount %' : 'Discount ₹'} *
            </label>
            <input type="number" min="0" value={value} onChange={e => setValue(e.target.value)}
              placeholder={type === 'percentage' ? '10' : '50'}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          {type === 'percentage' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Discount ₹</label>
              <input type="number" min="0" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)}
                placeholder="Optional cap"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Order ₹</label>
            <input type="number" min="0" value={minOrder} onChange={e => setMinOrder(e.target.value)}
              placeholder="0 = any amount"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
            <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <p className="text-xs text-gray-400 mt-1">Leave blank for no expiry</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="e.g. 10% off on all orders above ₹200"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Code'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Promo Row ────────────────────────────────────────────────────────────────
function PromoRow({ promo, onEdit, onToggle, onDelete }) {
  const [copied, setCopied] = useState(false);
  const status = getStatus(promo);

  function copyCode() {
    navigator.clipboard?.writeText(promo.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`flex items-center gap-3 p-4 transition-opacity ${status !== 'active' ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
          <Tag size={15} className="text-orange-500" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-gray-900 text-sm tracking-wider">{promo.code}</span>
            <button onClick={copyCode} className="text-gray-400 hover:text-gray-600 transition-colors" title="Copy code">
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          </div>
          {promo.description && <p className="text-xs text-gray-400 truncate max-w-[180px]">{promo.description}</p>}
        </div>
      </div>

      <div className="text-center hidden sm:block w-16 flex-shrink-0">
        <p className="font-bold text-gray-800 text-sm">
          {promo.type === 'percentage' ? `${promo.value}%` : `₹${promo.value}`}
        </p>
        <p className="text-xs text-gray-400">off</p>
      </div>

      <div className="text-center hidden md:block w-20 flex-shrink-0">
        <p className="text-sm text-gray-600">₹{promo.minOrder || 0}+</p>
        <p className="text-xs text-gray-400">min</p>
      </div>

      <div className="text-center hidden sm:block w-16 flex-shrink-0">
        <p className="text-sm text-gray-600">{promo.usedCount || 0}{promo.maxUses ? `/${promo.maxUses}` : ''}</p>
        <p className="text-xs text-gray-400">used</p>
      </div>

      <div className="text-center hidden lg:block w-24 flex-shrink-0">
        {promo.expiresAt ? (
          <>
            <p className="text-xs text-gray-600">{promo.expiresAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <p className="text-xs text-gray-400">expires</p>
          </>
        ) : (
          <p className="text-xs text-gray-400">No expiry</p>
        )}
      </div>

      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLE[status]}`}>
        {STATUS_LABEL[status]}
      </span>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button onClick={() => onToggle(promo)} title={promo.active ? 'Disable' : 'Enable'}
          className="p-2 rounded-lg transition-colors hover:bg-gray-100">
          {promo.active
            ? <ToggleRight size={18} className="text-green-500" />
            : <ToggleLeft size={18} className="text-gray-400" />}
        </button>
        <button onClick={() => onEdit(promo)} title="Edit"
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(promo)} title="Delete"
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PromoCodesPage() {
  const [promos, setPromos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'promo_codes'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  async function toggleActive(promo) {
    await updateDoc(doc(db, 'promo_codes', promo.id), { active: !promo.active });
    toast.success(promo.active ? 'Code disabled' : 'Code enabled');
  }

  async function remove(promo) {
    if (!window.confirm(`Delete "${promo.code}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'promo_codes', promo.id));
    toast.success('Deleted');
  }

  const activeCount   = promos.filter(p => getStatus(p) === 'active').length;
  const disabledCount = promos.filter(p => getStatus(p) === 'disabled').length;
  const expiredCount  = promos.filter(p => ['expired', 'exhausted'].includes(getStatus(p))).length;

  return (
    <div className="space-y-4">
      <Toaster position="top-right" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',    value: promos.length, color: '#3b82f6' },
          { label: 'Active',   value: activeCount,   color: '#22c55e' },
          { label: 'Disabled', value: disabledCount, color: '#6b7280' },
          { label: 'Expired',  value: expiredCount,  color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{loading ? '–' : s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Discount codes customers can enter at checkout.</p>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus size={16} /> New Code
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
      ) : promos.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
          <p className="text-4xl mb-2">🏷️</p>
          <p className="text-gray-500 font-semibold">No promo codes yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first discount code above</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {promos.map(p => (
            <PromoRow key={p.id} promo={p} onEdit={setModal} onToggle={toggleActive} onDelete={remove} />
          ))}
        </div>
      )}

      {modal !== null && <PromoModal promo={modal?.id ? modal : null} onClose={() => setModal(null)} />}
    </div>
  );
}
