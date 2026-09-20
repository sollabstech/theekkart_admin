'use client';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatTimestamp } from '@/lib/firestore';
import { Phone, Clock, Wrench, CheckCircle, RefreshCw } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const SERVICE_ICONS = {
  plumbing:     '🔧',
  electrician:  '⚡',
  carpenter:    '🪚',
  cleaning:     '🧹',
  painting:     '🖌️',
  ac_repair:    '❄️',
  pest_control: '🐛',
  other:        '🏠',
};

const SERVICE_COLORS = {
  plumbing:     'bg-blue-100 text-blue-700',
  electrician:  'bg-yellow-100 text-yellow-700',
  carpenter:    'bg-amber-100 text-amber-700',
  cleaning:     'bg-green-100 text-green-700',
  painting:     'bg-purple-100 text-purple-700',
  ac_repair:    'bg-cyan-100 text-cyan-700',
  pest_control: 'bg-gray-100 text-gray-700',
  other:        'bg-gray-100 text-gray-700',
};

export default function HomeServicesPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'service_requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function markDone(id) {
    try {
      await updateDoc(doc(db, 'service_requests', id), { status: 'done' });
      toast.success('Marked as done');
    } catch {
      toast.error('Failed to update');
    }
  }

  async function markPending(id) {
    try {
      await updateDoc(doc(db, 'service_requests', id), { status: 'pending' });
      toast.success('Marked as pending');
    } catch {
      toast.error('Failed to update');
    }
  }

  const filtered = filter === 'all'
    ? requests
    : requests.filter(r => r.status === filter);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      <Toaster position="top-right" />

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Requests', value: requests.length, color: '#3b82f6' },
          { label: 'Pending',        value: pendingCount,    color: '#f97316' },
          { label: 'Done',           value: requests.length - pendingCount, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{loading ? '–' : s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'pending', 'done'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            }`}>
            {f === 'all' ? `All (${requests.length})` : f === 'pending' ? `Pending (${pendingCount})` : `Done (${requests.length - pendingCount})`}
          </button>
        ))}
      </div>

      {/* Request cards */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
          <p className="text-4xl mb-2">🔧</p>
          <p className="text-gray-400 font-medium">No service requests yet</p>
          <p className="text-sm text-gray-300 mt-1">Requests from the app will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const icon  = SERVICE_ICONS[r.service] || '🏠';
            const color = SERVICE_COLORS[r.service] || 'bg-gray-100 text-gray-700';
            const done  = r.status === 'done';
            return (
              <div key={r.id}
                className={`bg-white rounded-2xl p-5 shadow-sm border transition-opacity ${done ? 'border-gray-100 opacity-70' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Service badge */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${color.split(' ')[0]}`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
                          {r.serviceLabel || r.service}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          done ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {done ? '✓ Done' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2 leading-relaxed">{r.description}</p>
                      {r.preferredTime && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock size={11} /> {r.preferredTime}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: customer + action */}
                  <div className="flex-shrink-0 text-right space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{r.customerName || '—'}</p>
                      {r.phone && (
                        <a href={`tel:${r.phone}`}
                          className="inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium mt-0.5">
                          <Phone size={11} /> {r.phone}
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{formatTimestamp(r.createdAt)}</p>
                    <button
                      onClick={() => done ? markPending(r.id) : markDone(r.id)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${
                        done
                          ? 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}>
                      {done ? <><RefreshCw size={11} /> Undo</> : <><CheckCircle size={11} /> Mark Done</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
