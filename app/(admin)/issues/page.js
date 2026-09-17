'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { Phone, ShoppingBag, CreditCard, Bug, HelpCircle, Clock, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

const TYPE_META = {
  order:   { label: 'Order Issue',   icon: ShoppingBag,  color: 'bg-blue-100 text-blue-700'   },
  payment: { label: 'Payment Issue',  icon: CreditCard,   color: 'bg-purple-100 text-purple-700' },
  app:     { label: 'App Bug',        icon: Bug,          color: 'bg-red-100 text-red-700'     },
  other:   { label: 'Other',          icon: HelpCircle,   color: 'bg-gray-100 text-gray-600'   },
};

const STATUS_META = {
  pending:     { label: 'Pending',     color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700'    },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700'  },
};

function fmt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function IssuesPage() {
  const [issues,   setIssues]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [preview,  setPreview]  = useState(null);

  async function load() {
    try {
      const snap = await getDocs(query(collection(db, 'issues'), orderBy('createdAt', 'desc')));
      setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const snap = await getDocs(collection(db, 'issues'));
        setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id, status) {
    await updateDoc(doc(db, 'issues', id), { status });
    toast.success('Status updated');
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  }

  const displayed = filter === 'all' ? issues : issues.filter(i => i.status === filter);
  const counts = {
    all:         issues.length,
    pending:     issues.filter(i => i.status === 'pending').length,
    in_progress: issues.filter(i => i.status === 'in_progress').length,
    resolved:    issues.filter(i => i.status === 'resolved').length,
  };

  return (
    <>
      <Toaster position="top-right" />

      {/* Image preview */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <Image src={preview} alt="Screenshot" width={600} height={600} className="rounded-xl max-h-[80vh] object-contain" />
        </div>
      )}

      <div className="space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all',         label: 'All' },
            { key: 'pending',     label: 'Pending' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'resolved',    label: 'Resolved' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f.key ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
              }`}>
              {f.label}
              <span className="ml-1.5 opacity-70">({counts[f.key]})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading reports…</div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            {issues.length === 0 ? 'No issue reports yet.' : 'No reports match this filter.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayed.map(issue => {
              const type   = TYPE_META[issue.type]   || TYPE_META.other;
              const status = STATUS_META[issue.status] || STATUS_META.pending;
              const TypeIcon = type.icon;
              return (
                <div key={issue.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${type.color}`}>
                        <TypeIcon size={11} /> {type.label}
                      </span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Customer */}
                  <div className="mb-3">
                    <p className="font-semibold text-gray-800 text-sm">{issue.customerName || 'Customer'}</p>
                    {issue.phone && (
                      <a href={`tel:${issue.phone}`} className="flex items-center gap-1 text-xs text-orange-500 hover:underline mt-0.5">
                        <Phone size={11} /> {issue.phone}
                      </a>
                    )}
                  </div>

                  {/* Description */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-3">
                    <p className="text-sm text-gray-700">{issue.description || '—'}</p>
                  </div>

                  {/* Screenshot */}
                  {issue.imageUrl && (
                    <div className="relative h-36 bg-gray-50 rounded-xl overflow-hidden mb-3 cursor-pointer"
                      onClick={() => setPreview(issue.imageUrl)}>
                      <Image src={issue.imageUrl} alt="Screenshot" fill className="object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                        <ImageIcon size={22} className="text-white" />
                      </div>
                    </div>
                  )}

                  {/* Time */}
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
                    <Clock size={11} /> {fmt(issue.createdAt)}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {issue.status === 'pending' && (
                      <button onClick={() => setStatus(issue.id, 'in_progress')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">
                        <AlertCircle size={12} /> Mark In Progress
                      </button>
                    )}
                    {issue.status !== 'resolved' && (
                      <button onClick={() => setStatus(issue.id, 'resolved')}
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
            })}
          </div>
        )}
      </div>
    </>
  );
}
