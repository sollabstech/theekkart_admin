'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { getProducts, addProduct, updateProduct, deleteProduct, getCategories } from '@/lib/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight, ImagePlus, X, Star } from 'lucide-react';
import Image from 'next/image';

/* ── Recommended image size hint ────────────────────────────────
   Best performance: 800 × 800 px, JPG/WebP, < 200 KB
   Thumbnail shown in lists: first image (index 0) = Main image
─────────────────────────────────────────────────────────────── */
const MAX_IMAGES = 7;
const EMPTY = { name: '', description: '', price: '', originalPrice: '', unit: '', category: '', available: true, images: [] };


export default function ProductsPage() {
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [modal,      setModal]      = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(null); // slot index being uploaded
  const fileRef   = useRef();
  const slotRef   = useRef(null); // which slot index triggered the picker

  async function load() {
    const [p, c] = await Promise.all([getProducts(), getCategories()]);
    // Normalise legacy `image` string → `images` array
    setProducts(p.map(pr => ({
      ...pr,
      images: pr.images?.length ? pr.images : (pr.image ? [pr.image] : []),
    })));
    setCategories(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd()   { setEditing(null); setForm(EMPTY); setModal(true); }
  function openEdit(p) {
    const images = p.images?.length ? p.images : (p.image ? [p.image] : []);
    setEditing(p.id);
    setForm({ ...p, images });
    setModal(true);
  }

  /* ── Upload one image to a specific slot ── */
  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const slot = slotRef.current ?? form.images.length;

    // Validate size (<5MB) & type
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }

    setUploading(slot);
    try {
      const path = `products/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);

      setForm(f => {
        const imgs = [...f.images];
        imgs[slot] = url;           // replace or append at slot
        return { ...f, images: imgs };
      });
      toast.success(slot === 0 ? 'Main image uploaded ✓' : `Image ${slot + 1} uploaded ✓`);
    } catch (err) {
      console.error(err);
      toast.error(`Upload failed: ${err.message || 'Check Firebase Storage rules'}`);
    }
    setUploading(null);
    e.target.value = '';
  }

  function triggerPicker(slot) {
    slotRef.current = slot;
    fileRef.current.click();
  }

  function removeImage(slot) {
    setForm(f => {
      const imgs = f.images.filter((_, i) => i !== slot);
      return { ...f, images: imgs };
    });
  }

  function setMain(slot) {
    setForm(f => {
      const imgs = [...f.images];
      const [main] = imgs.splice(slot, 1);
      imgs.unshift(main);
      return { ...f, images: imgs };
    });
    toast.success('Main image updated');
  }

  /* ── Save product ── */
  async function handleSave() {
    if (!form.name || !form.price) return toast.error('Name and price are required');
    setSaving(true);
    try {
      const data = {
        ...form,
        price:         parseFloat(form.price) || 0,
        originalPrice: form.originalPrice !== '' ? parseFloat(form.originalPrice) || null : null,
        image:         form.images[0] || '',
        images:        form.images,
      };
      if (data.originalPrice === null) delete data.originalPrice;
      if (editing) {
        await updateProduct(editing, data);
        setProducts(prev => prev.map(x => x.id === editing ? { ...x, ...data, id: editing } : x));
        toast.success('Product updated');
      } else {
        const docRef = await addProduct(data);
        setProducts(prev => [{ ...data, id: docRef.id }, ...prev]);
        toast.success('Product added');
      }
      setModal(false);
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this product?')) return;
    setProducts(prev => prev.filter(x => x.id !== id));
    try {
      await deleteProduct(id);
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
      load(); // revert on error
    }
  }

  async function toggleAvailability(p) {
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, available: !x.available } : x));
    try {
      await updateProduct(p.id, { available: !p.available });
    } catch {
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, available: p.available } : x));
      toast.error('Update failed');
    }
  }

  const filtered = useMemo(
    () => products.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );

  /* ── Image slots for the modal ── */
  const slots = Array.from({ length: MAX_IMAGES }, (_, i) => ({
    url:   form.images[i] || null,
    index: i,
    isMain: i === 0,
  }));

  return (
    <>
      <Toaster position="top-right" />
      <div className="space-y-4">

        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text" placeholder="Search products…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl">
            <Plus size={16} /> Add Product
          </button>
        </div>

        {/* ── Image size hint banner ── */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          <ImagePlus size={14} className="shrink-0" />
          <span><strong>Best image size:</strong> 800 × 800 px · JPG or WebP · under 200 KB · square crop for best display in app</span>
        </div>

        {/* ── Product grid ── */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => {
              const mainImg = p.images?.[0] || p.image || '';
              const extraCount = (p.images?.length || 0) - 1;
              return (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="relative h-40 bg-gray-50">
                    {mainImg ? (
                      <Image src={mainImg} alt={p.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-200">
                        <ImagePlus size={40} />
                      </div>
                    )}
                    {/* Extra images count badge */}
                    {extraCount > 0 && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                        +{extraCount} more
                      </div>
                    )}
                    <button
                      onClick={() => toggleAvailability(p)}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"
                    >
                      {p.available
                        ? <ToggleRight size={20} className="text-green-500" />
                        : <ToggleLeft  size={20} className="text-gray-300"  />}
                    </button>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category}{p.unit ? ` · ${p.unit}` : ''}</p>
                    <p className="text-lg font-bold text-orange-500 mt-1">₹{p.price}</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">No products found</div>
        )}
      </div>

      {/* ── Add / Edit modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-1">
                {editing ? 'Edit Product' : 'Add Product'}
              </h2>
              <p className="text-xs text-gray-400 mb-5">Upload up to {MAX_IMAGES} images · First image is the <strong>main image</strong> shown in cart &amp; orders</p>

              <div className="space-y-5">

                {/* ── Multi-image grid ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Product Images <span className="text-gray-400 font-normal">({form.images.length}/{MAX_IMAGES})</span>
                    </label>
                    <span className="text-xs text-orange-500 font-medium flex items-center gap-1">
                      <Star size={11} fill="currentColor" /> First = Main image
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {slots.map(({ url, index, isMain }) => (
                      <div
                        key={index}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
                          isMain && url
                            ? 'border-orange-400 ring-2 ring-orange-200'
                            : url
                            ? 'border-gray-200'
                            : 'border-dashed border-gray-200 bg-gray-50'
                        }`}
                      >
                        {url ? (
                          <>
                            <Image src={url} alt={`img ${index + 1}`} fill className="object-cover" unoptimized />
                            {/* Main badge */}
                            {isMain && (
                              <div className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <Star size={8} fill="white" /> Main
                              </div>
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 hover:opacity-100">
                              {!isMain && (
                                <button
                                  onClick={() => setMain(index)}
                                  title="Set as main"
                                  className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center hover:bg-orange-600"
                                >
                                  <Star size={12} fill="white" />
                                </button>
                              )}
                              <button
                                onClick={() => removeImage(index)}
                                title="Remove"
                                className="w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </>
                        ) : (
                          /* Empty slot — only show if we haven't hit max AND previous slots are filled */
                          index <= form.images.length && form.images.length < MAX_IMAGES ? (
                            <button
                              onClick={() => triggerPicker(index)}
                              disabled={uploading !== null}
                              className="w-full h-full flex flex-col items-center justify-center text-gray-300 hover:text-orange-400 hover:border-orange-300 transition-colors"
                            >
                              {uploading === index ? (
                                <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <ImagePlus size={18} />
                                  <span className="text-[10px] mt-0.5">{index === 0 ? 'Main' : `#${index + 1}`}</span>
                                </>
                              )}
                            </button>
                          ) : null
                        )}
                      </div>
                    ))}
                  </div>
                  <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
                  <p className="text-xs text-gray-400 mt-2">💡 Best: 800×800 px, JPG/WebP, &lt;200 KB · Hover image to set as main or remove</p>
                </div>

                {/* ── Text fields ── */}
                {[
                  { label: 'Product Name *', key: 'name',          type: 'text'   },
                  { label: 'Description',    key: 'description',   type: 'text'   },
                  { label: 'Price (₹) *',   key: 'price',         type: 'number' },
                  { label: 'Original Price (₹) — leave blank if no discount', key: 'originalPrice', type: 'number' },
                  { label: 'Unit (e.g. 1kg, 500ml)', key: 'unit',  type: 'text'   },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox" checked={form.available}
                    onChange={e => setForm(p => ({ ...p, available: e.target.checked }))}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Available for ordering</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving || uploading !== null} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                  {saving ? 'Saving…' : editing ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
