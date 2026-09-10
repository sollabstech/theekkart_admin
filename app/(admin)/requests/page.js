'use client';
import { useEffect, useState } from 'react';
import { getRequests, updateRequest, formatTimestamp } from '@/lib/firestore';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Phone, Image as ImageIcon, CheckCircle, XCircle, Clock } from 'lucide-react';
import Image from 'next/image';

const REQUEST_STATUS = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  contacted: { label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [previewImg, setPreviewImg] = useState(null);

  async function load() {
    const data = await getRequests();
    setRequests(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function changeStatus(id, status) {
    await updateRequest(id, { status });
    toast.success('Status updated');
    load();
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <>
      <Toaster position="top-right" />

      {/* Image preview overlay */}
      {previewImg && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <Image src={previewImg} alt="Request" width={600} height={600} className="rounded-xl max-h-[80vh] object-contain" />
        </div>
      )}

      <div className="space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'contacted', 'resolved', 'cancelled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'All Requests' : REQUEST_STATUS[f]?.label}
              <span className="ml-1 opacity-70">
                ({f === 'all' ? requests.length : requests.filter(r => r.status === f).length})
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading requests…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No requests found</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(req => (
              <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">{req.customerName || 'Customer'}</p>
                    <a
                      href={`tel:${req.phone}`}
                      className="text-sm text-orange-500 flex items-center gap-1 hover:underline"
                    >
                      <Phone size={12} /> {req.phone}
                    </a>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${REQUEST_STATUS[req.status]?.color || 'bg-gray-100 text-gray-500'}`}>
                    {REQUEST_STATUS[req.status]?.label || req.status}
                  </span>
                </div>

                {/* Description */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-sm text-gray-700">{req.description || 'No description provided'}</p>
                </div>

                {/* Image */}
                {req.imageUrl && (
                  <div
                    className="relative h-40 bg-gray-50 rounded-xl overflow-hidden mb-3 cursor-pointer"
                    onClick={() => setPreviewImg(req.imageUrl)}
                  >
                    <Image src={req.imageUrl} alt="Request image" fill className="object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                      <ImageIcon size={24} className="text-white" />
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                  <Clock size={12} /> {formatTimestamp(req.createdAt)}
                </p>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {req.status === 'pending' && (
                    <button
                      onClick={() => changeStatus(req.id, 'contacted')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
                    >
                      <Phone size={12} /> Mark Contacted
                    </button>
                  )}
                  {['pending', 'contacted'].includes(req.status) && (
                    <button
                      onClick={() => changeStatus(req.id, 'resolved')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100"
                    >
                      <CheckCircle size={12} /> Resolve
                    </button>
                  )}
                  {req.status !== 'cancelled' && req.status !== 'resolved' && (
                    <button
                      onClick={() => changeStatus(req.id, 'cancelled')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100"
                    >
                      <XCircle size={12} /> Cancel
                    </button>
                  )}
                  {req.phone && (
                    <a
                      href={`https://wa.me/91${req.phone.replace(/\D/g, '')}?text=Hi, regarding your TheekKart request: "${req.description?.slice(0, 50)}..."`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
