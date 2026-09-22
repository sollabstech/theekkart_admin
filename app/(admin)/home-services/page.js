'use client';
import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, deleteDoc, addDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatTimestamp } from '@/lib/firestore';
import { Phone, Clock, CheckCircle, RefreshCw, Plus, Pencil, Trash2, EyeOff, Eye, XCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const ICON_OPTIONS = [
  { value: 'plumbing',              label: 'Plumbing',     emoji: '🔧' },
  { value: 'electrical_services',   label: 'Electrical',   emoji: '⚡' },
  { value: 'handyman',              label: 'Handyman',     emoji: '🪚' },
  { value: 'cleaning_services',     label: 'Cleaning',     emoji: '🧹' },
  { value: 'format_paint',          label: 'Painting',     emoji: '🎨' },
  { value: 'ac_unit',               label: 'AC Repair',    emoji: '❄️' },
  { value: 'pest_control',          label: 'Pest Control', emoji: '🐛' },
  { value: 'home_repair_service',   label: 'Home Repair',  emoji: '🏠' },
  { value: 'local_laundry_service', label: 'Laundry',      emoji: '👕' },
  { value: 'kitchen',               label: 'Kitchen',      emoji: '🍳' },
  { value: 'yard',                  label: 'Garden',       emoji: '🌿' },
  { value: 'security',              label: 'Security',     emoji: '🔒' },
  { value: 'water_drop',            label: 'Water',        emoji: '💧' },
  { value: 'build',                 label: 'General',      emoji: '🔨' },
  { value: 'chair',                 label: 'Furniture',    emoji: '🪑' },
  { value: 'carpenter',             label: 'Carpenter',    emoji: '🪵' },
];

const COLOR_OPTIONS = [
  '#3B82F6','#F59E0B','#92400E','#10B981',
  '#8B5CF6','#06B6D4','#6B7280','#EF4444',
  '#F97316','#EC4899','#14B8A6','#84CC16',
];

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(o => [o.value, o.emoji]));

const DEFAULT_SERVICES = [
  { label: 'Plumbing',     icon: 'plumbing',           color: '#3B82F6' },
  { label: 'Electrician',  icon: 'electrical_services', color: '#F59E0B' },
  { label: 'Carpenter',    icon: 'handyman',            color: '#92400E' },
  { label: 'Cleaning',     icon: 'cleaning_services',  color: '#10B981' },
  { label: 'Painting',     icon: 'format_paint',       color: '#8B5CF6' },
  { label: 'AC Repair',    icon: 'ac_unit',            color: '#06B6D4' },
  { label: 'Pest Control', icon: 'pest_control',       color: '#6B7280' },
  { label: 'Other',        icon: 'home_repair_service',color: '#9CA3AF' },
];

// ─── Service Request Card ─────────────────────────────────────────────────────
function RequestCard({ r, onMarkDone, onMarkPending, onReject }) {
  const emoji    = ICON_MAP[r.service] || '🏠';
  const pending  = r.status === 'pending' || !r.status;
  const done     = r.status === 'done';
  const rejected = r.status === 'rejected';

  const statusBadge = done
    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Done</span>
    : rejected
    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">✕ Rejected</span>
    : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Pending</span>;

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-opacity ${(done || rejected) ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-gray-50">{emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{r.serviceLabel || r.service}</span>
              {statusBadge}
            </div>
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">{r.description}</p>
            {r.preferredTime && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock size={11} /> {r.preferredTime}</p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right space-y-2">
          <div>
            <p className="text-sm font-semibold text-gray-800">{r.customerName || '—'}</p>
            {r.phone && (
              <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium mt-0.5">
                <Phone size={11} /> {r.phone}
              </a>
            )}
          </div>
          <p className="text-xs text-gray-400">{formatTimestamp(r.createdAt)}</p>
          <div className="flex gap-1.5 justify-end flex-wrap">
            {(done || rejected) && (
              <button
                onClick={() => onMarkPending(r.id)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                <RefreshCw size={11} /> Undo
              </button>
            )}
            {pending && (
              <>
                <button
                  onClick={() => onMarkDone(r.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors">
                  <CheckCircle size={11} /> Mark Done
                </button>
                <button
                  onClick={() => onReject(r.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors">
                  <XCircle size={11} /> Reject
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function ServiceModal({ service, onClose }) {
  const isEdit = !!service?.id;
  const [label,       setLabel]       = useState(service?.label || '');
  const [icon,        setIcon]        = useState(service?.icon  || 'home_repair_service');
  const [customEmoji, setCustomEmoji] = useState(() => {
    const v = service?.icon || '';
    return ICON_OPTIONS.find(o => o.value === v) ? '' : v;
  });
  const [color, setColor]   = useState(service?.color || '#3B82F6');
  const [saving, setSaving] = useState(false);

  function handleEmojiInput(val) {
    setCustomEmoji(val);
    if (val.trim()) setIcon(val.trim());
    else setIcon('home_repair_service');
  }

  function handlePresetPick(value) {
    setIcon(value);
    setCustomEmoji('');
  }

  const displayEmoji = ICON_MAP[icon] || icon || '🏠';

  async function save() {
    if (!label.trim()) return toast.error('Label is required');
    setSaving(true);
    try {
      const data = { label: label.trim(), icon, color, active: service?.active ?? true };
      if (isEdit) {
        await updateDoc(doc(db, 'home_service_categories', service.id), data);
        toast.success('Service updated');
      } else {
        const snap = await import('firebase/firestore').then(m =>
          m.getDocs(m.collection(db, 'home_service_categories'))
        );
        await addDoc(collection(db, 'home_service_categories'), {
          ...data, order: snap.size + 1, createdAt: serverTimestamp(),
        });
        toast.success('Service added');
      }
      onClose();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <h3 className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit Service' : 'Add New Service'}</h3>

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
          <input
            value={label} onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Plumbing"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Icon picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
          <div className="grid grid-cols-8 gap-1.5">
            {ICON_OPTIONS.map(o => (
              <button key={o.value} onClick={() => handlePresetPick(o.value)} title={o.label}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                  icon === o.value && !customEmoji ? 'ring-2 ring-orange-500 bg-orange-50 scale-110' : 'bg-gray-50 hover:bg-gray-100'
                }`}>
                {o.emoji}
              </button>
            ))}
          </div>
          {/* Custom emoji paste */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-500 whitespace-nowrap">Or paste any emoji:</span>
            <input
              value={customEmoji}
              onChange={e => handleEmojiInput(e.target.value)}
              placeholder="e.g. 🛒"
              maxLength={8}
              className={`w-20 text-center text-2xl border rounded-xl py-1 focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                customEmoji ? 'border-orange-400 bg-orange-50' : 'border-gray-200'
              }`}
            />
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: color + '22' }}>
            {displayEmoji}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{label || 'Service Name'}</p>
            <p className="text-xs text-gray-400">Tap to book</p>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Service'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'service_requests'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  async function markDone(id)     { await updateDoc(doc(db, 'service_requests', id), { status: 'done' });     toast.success('Marked as done'); }
  async function markPending(id)  { await updateDoc(doc(db, 'service_requests', id), { status: 'pending' });  toast.success('Marked as pending'); }
  async function markRejected(id) { await updateDoc(doc(db, 'service_requests', id), { status: 'rejected' }); toast.success('Request rejected'); }

  const pendingCount  = requests.filter(r => r.status === 'pending' || !r.status).length;
  const doneCount     = requests.filter(r => r.status === 'done').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;
  const filtered = filter === 'all' ? requests : requests.filter(r => {
    if (filter === 'pending') return r.status === 'pending' || !r.status;
    return r.status === filter;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: requests.length, color: '#3b82f6' },
          { label: 'Pending',  value: pendingCount,    color: '#f97316' },
          { label: 'Done',     value: doneCount,       color: '#22c55e' },
          { label: 'Rejected', value: rejectedCount,   color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{loading ? '–' : s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all','pending','done','rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            }`}>
            {f === 'all' ? `All (${requests.length})` : f === 'pending' ? `Pending (${pendingCount})` : f === 'done' ? `Done (${doneCount})` : `Rejected (${rejectedCount})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
          <p className="text-4xl mb-2">🔧</p>
          <p className="text-gray-400 font-medium">No service requests yet</p>
          <p className="text-sm text-gray-300 mt-1">Requests from the app will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => <RequestCard key={r.id} r={r} onMarkDone={markDone} onMarkPending={markPending} onReject={markRejected} />)}
        </div>
      )}
    </div>
  );
}

function ManageTab() {
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'home_service_categories'), orderBy('order'));
    return onSnapshot(q, snap => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  async function toggleActive(svc) {
    await updateDoc(doc(db, 'home_service_categories', svc.id), { active: !svc.active });
    toast.success(svc.active ? 'Hidden from app' : 'Visible in app');
  }

  async function remove(svc) {
    if (!window.confirm(`Delete "${svc.label}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'home_service_categories', svc.id));
    toast.success('Service deleted');
  }

  async function seedDefaults() {
    try {
      for (const [i, s] of DEFAULT_SERVICES.entries()) {
        await addDoc(collection(db, 'home_service_categories'), {
          ...s, order: i + 1, active: true, createdAt: serverTimestamp(),
        });
      }
      toast.success('Default services added!');
    } catch { toast.error('Failed to seed'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Changes reflect instantly in the app.</p>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus size={16} /> Add Service
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
      ) : services.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 space-y-4">
          <p className="text-4xl">🔧</p>
          <p className="font-medium text-gray-700">No services yet</p>
          <p className="text-sm text-gray-400">Add your first service or load the defaults.</p>
          <button onClick={seedDefaults}
            className="px-5 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-700">
            Add Default Services
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {services.map(svc => (
            <div key={svc.id} className={`flex items-center gap-4 p-4 transition-opacity ${!svc.active ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: (svc.color || '#9CA3AF') + '22' }}>
                {ICON_MAP[svc.icon] || '🏠'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{svc.label}</p>
                <p className="text-xs text-gray-400 capitalize">{svc.icon?.replace(/_/g, ' ')}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${svc.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {svc.active ? 'Visible' : 'Hidden'}
                </span>
                <button onClick={() => toggleActive(svc)} title={svc.active ? 'Hide' : 'Show'}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  {svc.active ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button onClick={() => setModal(svc)} title="Edit"
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Pencil size={15} />
                </button>
                <button onClick={() => remove(svc)} title="Delete"
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && <ServiceModal service={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomeServicesPage() {
  const [tab, setTab] = useState('requests');
  return (
    <div className="space-y-4">
      <Toaster position="top-right" />
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'requests', label: 'Service Requests' },
          { key: 'manage',   label: 'Manage Services'  },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'requests' ? <RequestsTab /> : <ManageTab />}
    </div>
  );
}
