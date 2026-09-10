'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { downloadExcel, downloadPDF } from '@/lib/download';
import { Search, Mail, User, FileSpreadsheet, FileText } from 'lucide-react';

const PDF_COLS = [
  { header: 'Name',     key: 'name' },
  { header: 'Gmail ID', key: 'email' },
  { header: 'Phone',    key: 'phone' },
  { header: 'Joined',   key: 'joined' },
];

export default function UsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [busy,    setBusy]    = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, 'users'), orderBy('createdAt', 'desc'))
        );
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        try {
          const snap = await getDocs(collection(db, 'users'));
          setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e2) { console.error('Users load error:', e2); }
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  // ── helpers ──────────────────────────────────────────────
  function fmt(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function toRows(list) {
    return list.map(u => ({
      'Name':     u.name  || '—',
      'Gmail ID': u.email || '—',
      'Phone':    u.phone || '—',
      'Joined':   fmt(u.createdAt),
    }));
  }

  function toPDFRows(list) {
    return list.map(u => ({
      name:   u.name  || '—',
      email:  u.email || '—',
      phone:  u.phone || '—',
      joined: fmt(u.createdAt),
    }));
  }

  const dlName  = `app-users-${new Date().toISOString().slice(0,10)}`;
  const dlTitle = 'TheekKart — App Users';

  async function handleExcel() {
    if (busy) return;
    setBusy(true);
    try { await downloadExcel(toRows(filtered), dlName); } finally { setBusy(false); }
  }

  async function handlePDF() {
    if (busy) return;
    setBusy(true);
    try { await downloadPDF(PDF_COLS, toPDFRows(filtered), dlName, dlTitle); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">

      {/* Search + download */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name or Gmail ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
              bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {/* Download buttons */}
        <button onClick={handleExcel} disabled={busy || loading || filtered.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
            border border-green-200 text-green-700 bg-green-50 hover:bg-green-100
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <FileSpreadsheet size={14} /> Excel
        </button>
        <button onClick={handlePDF} disabled={busy || loading || filtered.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
            border border-red-200 text-red-600 bg-red-50 hover:bg-red-100
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <FileText size={14} /> PDF
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {users.length === 0
              ? 'No users yet. Users appear here when they sign in to the app.'
              : 'No users match your search.'}
          </div>
        ) : (
          <>
            {/* Second download strip above list */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <span className="text-xs text-gray-400">
                {filtered.length} user{filtered.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button onClick={handleExcel} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    border border-green-200 text-green-700 bg-green-50 hover:bg-green-100
                    disabled:opacity-40 transition-colors">
                  <FileSpreadsheet size={13} /> Excel
                </button>
                <button onClick={handlePDF} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    border border-red-200 text-red-600 bg-red-50 hover:bg-red-100
                    disabled:opacity-40 transition-colors">
                  <FileText size={13} /> PDF
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">

                  {/* Avatar */}
                  {u.photo ? (
                    <img src={u.photo} alt={u.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-100"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center
                    text-orange-600 font-bold text-sm uppercase shrink-0"
                    style={{ display: u.photo ? 'none' : 'flex' }}>
                    {(u.name || u.email || '?').charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-gray-400 shrink-0" />
                      <span className="font-semibold text-gray-800 text-sm truncate">
                        {u.name || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Mail size={13} className="text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500 truncate">{u.email || '—'}</span>
                    </div>
                  </div>

                  {/* Badge */}
                  <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    <span className="text-xs font-semibold text-green-600">Signed in</span>
                  </div>

                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        {users.length} user{users.length !== 1 ? 's' : ''} registered
      </p>
    </div>
  );
}
