'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import {
  Phone, Image as ImageIcon, CheckCircle, XCircle, Clock,
  ShoppingBag, CreditCard, Bug, HelpCircle, AlertCircle, Flag, MessageCircle,
} from 'lucide-react';
import Image from 'next/image';

// ── Ask TheekKart requests ────────────────────────────────────────────────────
const REQ_STATUS = {
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-700' },
  contacted: { label: 'Contacted', color: 'bg-blue-100 text-blue-700'    },
  resolved:  { label: 'Resolved',  color: 'bg-green-100 text-green-700'  },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700'      },
};

// ── Issue Reports ─────────────────────────────────────────────────────────────
const TYPE_META = {
  order:   { label: 'Order Issue',   icon: ShoppingBag, color: 'bg-blue-100 text-blue-700'     },
  payment: { label: 'Payment Issue', icon: CreditCard,  color: 'bg-purple-100 text-purple-700' },
  app:     { label: 'App Bug',       icon: Bug,         color: 'bg-red-100 text-red-700'       },
  other:   { label: 'Other',         icon: HelpCircle,  color: 'bg-gray-100 text-gray-600'     },
};

const ISSUE_STATUS = {
  pending:     { label: 'Pending',     color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700'    },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700'  },
};

function fmt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [issues,   setIssues]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [section,  setSection]  = useState('all');   // 'all' | 'ask' | 'issues'
  const [filter,   setFilter]   = useState('all');   // status filter within section
  const [preview,  setPreview]  = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [rSnap, iSnap] = await Promise.all([
        getDocs(query(collection(db, 'requests'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'issues'),   orderBy('createdAt', 'desc'))).catch(() =>
          getDocs(collection(db, 'issues'))
        ),
      ]);
      setRequests(rSnap.docs.map(d => ({ id: d.id, _kind: 'ask',   ...d.data() })));
      setIssues(  iSnap.docs.map(d => ({ id: d.id, _kind: 'issue', ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Reset status filter when switching sections
  function switchSection(s) { setSection(s); setFilter('all'); }

  // ── Ask TheekKart actions ─────────────────────────────────────────────────
  async function reqStatus(id, status) {
    await updateDoc(doc(db, 'requests', id), { status, updatedAt: serverTimestamp() });
    toast.success('Status updated');
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  // ── Issue actions ─────────────────────────────────────────────────────────
  async function issueStatus(id, status) {
    await updateDoc(doc(db, 'issues', id), { status });
    toast.success('Status updated');
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  }

  // ── Combined + filtered list ──────────────────────────────────────────────
  const allItems = [
    ...(section !== 'issues' ? requests : []),
    ...(section !== 'ask'    ? issues   : []),
  ].sort((a, b) => {
    const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return tb - ta;
  });

  const displayed = filter === 'all' ? allItems : allItems.filter(x => x.status === filter);

  const askCount   = requests.length;
  const issueCount = issues.length;

  // Unique status values present in the current section
  const statusOptions = [...new Set(allItems.map(x => x.status).filter(Boolean))];

  return (
    <>
      <Toaster position="top-right" />

      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}>
          <Image src={preview} alt="Photo" width={600} height={600} sizes="90vw" className="rounded-xl max-h-[80vh] object-contain" />
        </div>
      )}

      <div className="space-y-4">
        {/* Section tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all',    label: 'All',             icon: null,          count: askCount + issueCount },
            { key: 'ask',    label: 'Ask TheekKart',   icon: MessageCircle, count: askCount              },
            { key: 'issues', label: 'Issue Reports',   icon: Flag,          count: issueCount            },
          ].map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => switchSection(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                section === key ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
              }`}>
              {Icon && <Icon size={14} />}
              {label}
              <span className="opacity-70">({count})</span>
            </button>
          ))}
        </div>

        {/* Status filter (only when items exist) */}
        {!loading && allItems.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                filter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
              }`}>
              All statuses ({allItems.length})
            </button>
            {statusOptions.map(s => {
              const meta = REQ_STATUS[s] || ISSUE_STATUS[s];
              const cnt = allItems.filter(x => x.status === s).length;
              return (
                <button key={s} onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    filter === s ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
                  }`}>
                  {meta?.label || s} ({cnt})
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            {allItems.length === 0 ? 'Nothing here yet.' : 'No items match this filter.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayed.map(item =>
              item._kind === 'ask'
                ? <AskCard key={item.id} req={item} onStatus={reqStatus} onPreview={setPreview} />
                : <IssueCard key={item.id} issue={item} onStatus={issueStatus} onPreview={setPreview} />
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Ask TheekKart card ────────────────────────────────────────────────────────
function AskCard({ req, onStatus, onPreview }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
              <MessageCircle size={10} /> Ask TheekKart
            </span>
          </div>
          <p className="font-semibold text-gray-800">{req.customerName || 'Customer'}</p>
          <a href={`tel:${req.phone}`}
            className="text-sm text-orange-500 flex items-center gap-1 hover:underline">
            <Phone size={12} /> {req.phone}
          </a>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${REQ_STATUS[req.status]?.color || 'bg-gray-100 text-gray-500'}`}>
          {REQ_STATUS[req.status]?.label || req.status}
        </span>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <p className="text-sm text-gray-700">{req.description || 'No description'}</p>
      </div>

      {req.imageUrl && (
        <div className="relative h-40 bg-gray-50 rounded-xl overflow-hidden mb-3 cursor-pointer"
          onClick={() => onPreview(req.imageUrl)}>
          <Image src={req.imageUrl} alt="Request" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
            <ImageIcon size={24} className="text-white" />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
        <Clock size={12} /> {fmt(req.createdAt)}
      </p>

      <div className="flex gap-2 flex-wrap">
        {req.status === 'pending' && (
          <button onClick={() => onStatus(req.id, 'contacted')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">
            <Phone size={12} /> Mark Contacted
          </button>
        )}
        {['pending', 'contacted'].includes(req.status) && (
          <button onClick={() => onStatus(req.id, 'resolved')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100">
            <CheckCircle size={12} /> Resolve
          </button>
        )}
        {req.status !== 'cancelled' && req.status !== 'resolved' && (
          <button onClick={() => onStatus(req.id, 'cancelled')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100">
            <XCircle size={12} /> Cancel
          </button>
        )}
        {req.phone && (
          <a href={`https://wa.me/91${req.phone.replace(/\D/g, '')}?text=Hi, regarding your TheekKart request: "${(req.description || '').slice(0, 50)}..."`}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100">
            💬 WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

// ── Issue Report card ─────────────────────────────────────────────────────────
function IssueCard({ issue, onStatus, onPreview }) {
  const type   = TYPE_META[issue.type]  || TYPE_META.other;
  const status = ISSUE_STATUS[issue.status] || ISSUE_STATUS.pending;
  const TypeIcon = type.icon;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <Flag size={10} /> Issue Report
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${type.color}`}>
            <TypeIcon size={11} /> {type.label}
          </span>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="mb-3">
        <p className="font-semibold text-gray-800 text-sm">{issue.customerName || 'Customer'}</p>
        {issue.phone && (
          <a href={`tel:${issue.phone}`} className="flex items-center gap-1 text-xs text-orange-500 hover:underline mt-0.5">
            <Phone size={11} /> {issue.phone}
          </a>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <p className="text-sm text-gray-700">{issue.description || '—'}</p>
      </div>

      {issue.imageUrl && (
        <div className="relative h-36 bg-gray-50 rounded-xl overflow-hidden mb-3 cursor-pointer"
          onClick={() => onPreview(issue.imageUrl)}>
          <Image src={issue.imageUrl} alt="Screenshot" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
            <ImageIcon size={22} className="text-white" />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
        <Clock size={11} /> {fmt(issue.createdAt)}
      </p>

      <div className="flex gap-2 flex-wrap">
        {issue.status === 'pending' && (
          <button onClick={() => onStatus(issue.id, 'in_progress')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">
            <AlertCircle size={12} /> Mark In Progress
          </button>
        )}
        {issue.status !== 'resolved' && (
          <button onClick={() => onStatus(issue.id, 'resolved')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100">
            <CheckCircle size={12} /> Resolve
          </button>
        )}
        {issue.phone && (
          <a href={`https://wa.me/${issue.phone.replace(/\D/g, '')}?text=Hi, regarding your reported issue on TheekKart.`}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100">
            💬 WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
