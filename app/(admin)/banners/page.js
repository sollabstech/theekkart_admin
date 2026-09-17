'use client';
import { useEffect, useState, useRef } from 'react';
import { getBanners, addBanner, updateBanner, deleteBanner } from '@/lib/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Plus, Trash2, ToggleLeft, ToggleRight, ImagePlus } from 'lucide-react';
import Image from 'next/image';

export default function BannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', imageUrl: '', active: true, order: 1 });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  async function load() {
    const data = await getBanners();
    setBanners(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = storageRef(storage, `banners/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      setForm(f => ({ ...f, imageUrl: url }));
      toast.success('Image uploaded');
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  }

  async function handleSave() {
    if (!form.imageUrl) return toast.error('Please upload a banner image');
    setSaving(true);
    try {
      const data = { ...form, order: parseInt(form.order) || 1 };
      const docRef = await addBanner(data);
      setBanners(prev => [...prev, { ...data, id: docRef.id }].sort((a, b) => a.order - b.order));
      toast.success('Banner added');
      setModal(false);
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this banner?')) return;
    setBanners(prev => prev.filter(x => x.id !== id));
    try {
      await deleteBanner(id);
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
      load();
    }
  }

  async function toggleActive(b) {
    setBanners(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x));
    try {
      await updateBanner(b.id, { active: !b.active });
    } catch {
      setBanners(prev => prev.map(x => x.id === b.id ? { ...x, active: b.active } : x));
      toast.error('Update failed');
    }
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="space-y-4">
        <button
          onClick={() => { setForm({ title: '', imageUrl: '', active: true, order: banners.length + 1 }); setModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl"
        >
          <Plus size={16} /> Add Banner
        </button>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading banners…</div>
        ) : banners.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No banners yet. Add your first banner!</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {banners.map(b => (
              <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="relative h-48">
                  {b.imageUrl ? (
                    <Image src={b.imageUrl} alt={b.title || 'Banner'} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-50 text-gray-300">
                      <ImagePlus size={40} />
                    </div>
                  )}
                  {!b.active && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">Hidden</span>
                    </div>
                  )}
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{b.title || 'Untitled Banner'}</p>
                    <p className="text-xs text-gray-400">Order: {b.order}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(b)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                      {b.active ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">Add Banner</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image *</label>
                <div
                  onClick={() => fileRef.current.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl h-40 flex items-center justify-center cursor-pointer hover:border-orange-300 relative overflow-hidden"
                >
                  {form.imageUrl ? (
                    <Image src={form.imageUrl} alt="preview" fill className="object-cover" />
                  ) : (
                    <div className="text-center text-gray-400">
                      <ImagePlus size={28} className="mx-auto mb-2" />
                      <p className="text-sm">{uploading ? 'Uploading…' : 'Click to upload banner image'}</p>
                      <p className="text-xs text-gray-300">Recommended: 1200×400px</p>
                    </div>
                  )}
                </div>
                <input type="file" ref={fileRef} accept="image/*" onChange={handleUpload} className="hidden" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
                <input
                  type="text" value={form.title} placeholder="e.g. Summer Sale"
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input
                  type="number" value={form.order}
                  onChange={e => setForm(f => ({ ...f, order: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox" checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">Show on app immediately</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving || uploading} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {saving ? 'Saving…' : 'Add Banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
