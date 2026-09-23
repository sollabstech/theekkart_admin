'use client';
import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
  getPartnerById, getVendorProducts, getVendorOrders,
  addProduct, updateProduct, deleteProduct, getCategories,
  updatePartner, formatTimestamp,
} from '@/lib/firestore';
import {
  ArrowLeft, Store, Phone, Mail, MapPin, Package, ShoppingBag,
  IndianRupee, TrendingUp, Calendar, Globe, CreditCard, Clock,
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search,
  ImagePlus, X, Star, CheckCircle, XCircle, PauseCircle,
  PlayCircle, Tag, Building, FileText, User,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const TABS = ['Overview', 'Products', 'Orders', 'Profile'];
const CATEGORIES = ['Grocery','Vegetables & Fruits','Dairy & Eggs','Bakery','Meat & Seafood','Snacks & Beverages','Pharmacy','Household','Other'];
const MAX_IMG = 7;
const EMPTY_PRODUCT = { name:'', description:'', price:'', originalPrice:'', unit:'', category:'', available:true, images:[] };

// ─── Product Modal ─────────────────────────────────────────────────────────────
function ProductModal({ editing, form, setForm, saving, onSave, onClose, uploading, onUpload, onRemoveImg, onSetMain, fileRef, onTriggerPicker, categories }) {
  const slots = Array.from({ length: MAX_IMG }, (_, i) => ({ url: form.images[i] || null, index: i }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-bold text-gray-900 text-lg">{editing ? 'Edit Product' : 'Add Product'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Images */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Product Images <span className="text-gray-400 font-normal">(first = main)</span></label>
            <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={onUpload} />
            <div className="flex flex-wrap gap-2">
              {slots.map(s => (
                <div key={s.index} className="relative w-20 h-20">
                  {s.url ? (
                    <>
                      <Image src={s.url} alt="" fill className="object-cover rounded-xl border border-gray-200" sizes="80px"/>
                      {s.index === 0 && <span className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] px-1 rounded font-bold">MAIN</span>}
                      <button onClick={() => onRemoveImg(s.index)}
                        className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-white">
                        <X size={10}/>
                      </button>
                      {s.index > 0 && (
                        <button onClick={() => onSetMain(s.index)} title="Set as main"
                          className="absolute bottom-1 left-1 bg-white border border-gray-200 rounded-full p-0.5 hover:bg-orange-50">
                          <Star size={10} className="text-orange-400"/>
                        </button>
                      )}
                    </>
                  ) : (
                    <button onClick={() => onTriggerPicker(s.index)}
                      disabled={uploading === s.index}
                      className="w-full h-full border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-orange-400 hover:bg-orange-50 transition-colors disabled:opacity-50">
                      {uploading === s.index
                        ? <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/>
                        : <><ImagePlus size={16} className="text-gray-300"/><span className="text-[9px] text-gray-300">Add</span></>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Fresh Tomatoes"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Original Price (₹)</label>
              <input type="number" value={form.originalPrice} onChange={e => setForm(f => ({...f, originalPrice: e.target.value}))} placeholder="MRP / strikethrough"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))} placeholder="e.g. 500g, 1kg, 1L"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Select…</option>
                {(categories.length ? categories.map(c=>c.name) : CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3} placeholder="Optional product description…"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"/>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Available</span>
              <button onClick={() => setForm(f => ({...f, available: !f.available}))}>
                {form.available
                  ? <ToggleRight size={28} className="text-orange-500"/>
                  : <ToggleLeft  size={28} className="text-gray-300"/>}
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : editing ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function VendorDetailPage({ params }) {
  const { id } = use(params);

  const [vendor,     setVendor]     = useState(null);
  const [products,   setProducts]   = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState('Overview');

  // Product modal state
  const [modal,      setModal]      = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(EMPTY_PRODUCT);
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(null);
  const [pSearch,    setPSearch]    = useState('');
  const fileRef = useState(() => ({ current: null }))[0];
  const slotRef = useState(0);

  useEffect(() => {
    Promise.all([getPartnerById(id), getVendorProducts(id), getVendorOrders(id), getCategories()]).then(([v, p, o, c]) => {
      setVendor(v);
      setProducts(p);
      setOrders(o);
      setCategories(c);
      setLoading(false);
    });
  }, [id]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const delivered = orders.filter(o => o.status === 'delivered');
    const todayStr  = new Date().toDateString();
    const totalRev  = delivered.reduce((s, o) => s + (o.total || 0), 0);
    const todayInc  = delivered.filter(o => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
      return d.toDateString() === todayStr;
    }).reduce((s, o) => s + (o.total || 0), 0);
    const totalSold = delivered.reduce((s, o) => s + (o.items?.reduce((a, i) => a + (i.qty || i.quantity || 0), 0) || 0), 0);
    return { products: products.length, orders: orders.length, revenue: totalRev, todayIncome: todayInc, itemsSold: totalSold };
  }, [products, orders]);

  // ── Product CRUD ───────────────────────────────────────────────────────────
  function openAdd()   { setEditing(null); setForm({ ...EMPTY_PRODUCT }); setModal(true); }
  function openEdit(p) { setEditing(p.id); setForm({ ...p, originalPrice: p.originalPrice ?? '' }); setModal(true); }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const slot = slotRef.current ?? form.images.length;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setUploading(slot);
    try {
      const path  = `products/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      const sRef  = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url   = await getDownloadURL(sRef);
      setForm(f => { const imgs = [...f.images]; imgs[slot] = url; return { ...f, images: imgs }; });
      toast.success('Image uploaded');
    } catch (err) { toast.error(`Upload failed: ${err.message}`); }
    setUploading(null);
    e.target.value = '';
  }

  function triggerPicker(slot) { slotRef.current = slot; fileRef.current?.click(); }
  function removeImg(slot)   { setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== slot) })); }
  function setMain(slot)     { setForm(f => { const imgs = [...f.images]; const [m] = imgs.splice(slot, 1); imgs.unshift(m); return { ...f, images: imgs }; }); }

  async function handleSave() {
    if (!form.name || !form.price) return toast.error('Name and price are required');
    setSaving(true);
    try {
      const data = {
        ...form,
        vendorId:      id,
        price:         parseFloat(form.price) || 0,
        originalPrice: form.originalPrice !== '' ? parseFloat(form.originalPrice) || null : null,
        image:         form.images[0] || '',
        images:        form.images,
      };
      if (data.originalPrice === null) delete data.originalPrice;
      if (editing) {
        await updateProduct(editing, data);
        setProducts(prev => prev.map(x => x.id === editing ? { ...x, ...data } : x));
        toast.success('Product updated');
      } else {
        const ref = await addProduct(data);
        setProducts(prev => [{ ...data, id: ref.id }, ...prev]);
        toast.success('Product added');
      }
      setModal(false);
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  }

  async function handleDelete(pid) {
    if (!confirm('Delete this product?')) return;
    setProducts(prev => prev.filter(x => x.id !== pid));
    try { await deleteProduct(pid); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); getVendorProducts(id).then(setProducts); }
  }

  async function toggleAvail(p) {
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, available: !x.available } : x));
    try { await updateProduct(p.id, { available: !p.available }); }
    catch { setProducts(prev => prev.map(x => x.id === p.id ? { ...x, available: p.available } : x)); }
  }

  // ── Vendor actions ──────────────────────────────────────────────────────────
  async function suspend(val) {
    await updatePartner(id, { suspended: val });
    setVendor(v => ({ ...v, suspended: val }));
    toast.success(val ? 'Vendor suspended' : 'Unsuspended');
  }

  const filteredProducts = useMemo(() =>
    products.filter(p => !pSearch || p.name?.toLowerCase().includes(pSearch.toLowerCase())),
    [products, pSearch]
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading vendor…</div>
  );
  if (!vendor) return (
    <div className="text-center py-16 text-gray-400">Vendor not found</div>
  );

  const isSusp = !!vendor.suspended;

  return (
    <>
      <Toaster position="top-right"/>
      {modal && (
        <ProductModal
          editing={editing} form={form} setForm={setForm} saving={saving}
          onSave={handleSave} onClose={() => setModal(false)}
          uploading={uploading} onUpload={handleUpload}
          onRemoveImg={removeImg} onSetMain={setMain}
          fileRef={fileRef} onTriggerPicker={triggerPicker}
          categories={categories}
        />
      )}
      {/* Hidden file input */}
      <input type="file" ref={el => fileRef.current = el} accept="image/*" className="hidden" onChange={handleUpload}/>

      <div className="space-y-5">
        {/* Breadcrumb */}
        <Link href="/vendors" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={16}/> Back to Vendors
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
                <Store size={28} className="text-orange-500"/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{vendor.shopName || vendor.name}</h2>
                <p className="text-sm text-gray-400">Owner: {vendor.name} · {vendor.businessCategory || vendor.role}</p>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${vendor.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {vendor.status || 'pending'}
                  </span>
                  {isSusp && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Suspended</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => suspend(!isSusp)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${isSusp ? 'border-green-300 text-green-700 hover:bg-green-50' : 'border-orange-300 text-orange-700 hover:bg-orange-50'}`}>
                {isSusp ? <><PlayCircle size={14}/> Unsuspend</> : <><PauseCircle size={14}/> Suspend</>}
              </button>
            </div>
          </div>
        </div>

        {/* Performance stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Products',      value: stats.products,                                           icon: Package,     color: '#3b82f6' },
            { label: 'Total Orders',  value: stats.orders,                                             icon: ShoppingBag, color: '#8b5cf6' },
            { label: 'Items Sold',    value: stats.itemsSold,                                          icon: Tag,         color: '#f97316' },
            { label: "Today's Income",value: `₹${stats.todayIncome.toLocaleString('en-IN')}`,          icon: TrendingUp,  color: '#22c55e' },
            { label: 'Total Revenue', value: `₹${stats.revenue.toLocaleString('en-IN')}`,             icon: IndianRupee, color: '#ec4899' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <s.icon size={20} style={{ color: s.color }}/>
              <div>
                <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white p-1 rounded-2xl shadow-sm border border-gray-100 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
              {t}
              {t === 'Products' && <span className="ml-1.5 text-xs">({products.length})</span>}
              {t === 'Orders'   && <span className="ml-1.5 text-xs">({orders.length})</span>}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {tab === 'Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Contact */}
            <InfoCard title="Contact Details" icon={Phone}>
              <InfoRow icon={User}      label="Owner"   value={vendor.name} />
              <InfoRow icon={Phone}     label="Phone"   value={vendor.phone} link={`tel:${vendor.phone}`} />
              <InfoRow icon={Mail}      label="Email"   value={vendor.email} link={`mailto:${vendor.email}`} />
            </InfoCard>
            {/* Location */}
            <InfoCard title="Location" icon={MapPin}>
              <InfoRow icon={Store}    label="Shop"     value={vendor.shopName} />
              <InfoRow icon={MapPin}   label="Address"  value={vendor.shopAddress || vendor.address} />
              <InfoRow icon={MapPin}   label="Area"     value={vendor.area || vendor.district} />
              {vendor.state && <InfoRow icon={Globe}   label="State"    value={vendor.state} />}
              {vendor.pincode && <InfoRow icon={MapPin} label="Pincode" value={vendor.pincode} />}
              {vendor.shopLocation?.lat && (
                <InfoRow icon={Globe} label="GPS" value={`${vendor.shopLocation.lat.toFixed(5)}, ${vendor.shopLocation.lng.toFixed(5)}`} />
              )}
            </InfoCard>
            {/* Business */}
            <InfoCard title="Business Details" icon={Building}>
              <InfoRow icon={Tag}      label="Category" value={vendor.businessCategory} />
              <InfoRow icon={Building} label="Type"     value={vendor.shopType} />
              <InfoRow icon={FileText} label="GST"      value={vendor.gstNumber} />
              <InfoRow icon={FileText} label="Reg. No." value={vendor.businessRegistrationNumber} />
              {vendor.openingTime && <InfoRow icon={Clock} label="Opens"  value={vendor.openingTime} />}
              {vendor.closingTime && <InfoRow icon={Clock} label="Closes" value={vendor.closingTime} />}
            </InfoCard>
            {/* Bank */}
            {(vendor.bankDetails?.bankName || vendor.bankDetails?.accountNumber) && (
              <InfoCard title="Bank / Payment" icon={CreditCard}>
                <InfoRow icon={Building}    label="Bank"    value={vendor.bankDetails?.bankName} />
                <InfoRow icon={CreditCard}  label="Account" value={vendor.bankDetails?.accountNumber} />
                <InfoRow icon={FileText}    label="IFSC"    value={vendor.bankDetails?.ifsc} />
              </InfoCard>
            )}
            {/* Credentials */}
            {vendor.credentials && (
              <InfoCard title="Login Credentials" icon={CheckCircle}>
                <InfoRow icon={User}     label="Username" value={vendor.credentials.username} mono />
                <InfoRow icon={FileText} label="Password" value={vendor.credentials.password} mono />
              </InfoCard>
            )}
          </div>
        )}

        {/* ── Products Tab ── */}
        {tab === 'Products' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={pSearch} onChange={e => setPSearch(e.target.value)} placeholder="Search products…"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
              <button onClick={openAdd}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl">
                <Plus size={16}/> Add Product
              </button>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
                <Package size={40} className="mx-auto text-gray-200 mb-3"/>
                <p className="text-gray-400">No products yet</p>
                <button onClick={openAdd} className="mt-3 text-sm text-orange-500 font-semibold hover:underline">Add first product</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(p => {
                  const img = p.images?.[0] || p.image || '';
                  return (
                    <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="relative h-40 bg-gray-50">
                        {img ? <Image src={img} alt={p.name} fill sizes="(max-width:640px) 100vw, 25vw" className="object-cover"/>
                          : <div className="h-full flex items-center justify-center"><ImagePlus size={36} className="text-gray-200"/></div>}
                        <button onClick={() => toggleAvail(p)} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow">
                          {p.available
                            ? <ToggleRight size={20} className="text-orange-500"/>
                            : <ToggleLeft  size={20} className="text-gray-300"/>}
                        </button>
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.unit} · {p.category || 'Uncategorised'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-bold text-orange-500">₹{p.price}</span>
                          {p.originalPrice && <span className="text-xs text-gray-400 line-through">₹{p.originalPrice}</span>}
                        </div>
                        <p className={`text-xs mt-1 font-medium ${p.available ? 'text-green-600' : 'text-gray-400'}`}>
                          {p.available ? 'Available' : 'Unavailable'}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => openEdit(p)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-orange-500 border border-orange-200 rounded-xl hover:bg-orange-50">
                            <Pencil size={12}/> Edit
                          </button>
                          <button onClick={() => handleDelete(p.id)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50">
                            <Trash2 size={12}/> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Orders Tab ── */}
        {tab === 'Orders' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {orders.length === 0 ? (
              <div className="p-16 text-center">
                <ShoppingBag size={40} className="mx-auto text-gray-200 mb-3"/>
                <p className="text-gray-400">No orders yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-semibold">Order</th>
                      <th className="text-left px-4 py-3 font-semibold">Customer</th>
                      <th className="text-left px-4 py-3 font-semibold">Items</th>
                      <th className="text-left px-4 py-3 font-semibold">Total</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const statusColors = {
                        received:'bg-blue-100 text-blue-700', confirmed:'bg-yellow-100 text-yellow-700',
                        preparing:'bg-orange-100 text-orange-700', out_for_delivery:'bg-purple-100 text-purple-700',
                        delivered:'bg-green-100 text-green-700', cancelled:'bg-red-100 text-red-700',
                      };
                      return (
                        <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/orders/${o.id}`} className="font-mono text-xs text-orange-500 hover:underline">
                              #{(o.orderNumber || o.id.slice(-6)).toUpperCase()}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{o.customerName || '—'}</td>
                          <td className="px-4 py-3 text-gray-500">{o.items?.length || 0} items</td>
                          <td className="px-4 py-3 font-semibold">₹{o.total?.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[o.status] || 'bg-gray-100 text-gray-500'}`}>
                              {o.status?.replace('_',' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{formatTimestamp(o.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Profile Tab ── */}
        {tab === 'Profile' && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-500 flex items-center gap-2">
              <User size={14}/>
              <span>Vendor ID: <code className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">{id}</code></span>
              <span className="ml-4">Registered: {formatTimestamp(vendor.createdAt)}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <InfoCard title="Personal Information" icon={User}>
                <InfoRow icon={User}  label="Full Name"   value={vendor.name} />
                <InfoRow icon={Phone} label="Mobile"      value={vendor.phone} />
                <InfoRow icon={Mail}  label="Email"       value={vendor.email} />
              </InfoCard>
              <InfoCard title="Shop Information" icon={Store}>
                <InfoRow icon={Store}    label="Shop Name"  value={vendor.shopName} />
                <InfoRow icon={Tag}      label="Category"   value={vendor.businessCategory} />
                <InfoRow icon={Building} label="Type"       value={vendor.shopType} />
                <InfoRow icon={MapPin}   label="Address"    value={vendor.shopAddress || vendor.address} />
                <InfoRow icon={MapPin}   label="Area"       value={vendor.area || vendor.district} />
                {vendor.state  && <InfoRow icon={Globe}   label="State"    value={vendor.state} />}
                {vendor.pincode && <InfoRow icon={MapPin} label="Pincode"  value={vendor.pincode} />}
              </InfoCard>
              <InfoCard title="Registration & Compliance" icon={FileText}>
                <InfoRow icon={FileText} label="GST Number"   value={vendor.gstNumber   || 'Not provided'} />
                <InfoRow icon={FileText} label="Reg. Number"  value={vendor.businessRegistrationNumber || 'Not provided'} />
                {vendor.openingTime && <InfoRow icon={Clock} label="Opens"  value={vendor.openingTime} />}
                {vendor.closingTime && <InfoRow icon={Clock} label="Closes" value={vendor.closingTime} />}
              </InfoCard>
              {vendor.bankDetails && (
                <InfoCard title="Bank Details" icon={CreditCard}>
                  <InfoRow icon={Building}   label="Bank"    value={vendor.bankDetails.bankName} />
                  <InfoRow icon={CreditCard} label="Account" value={vendor.bankDetails.accountNumber} />
                  <InfoRow icon={FileText}   label="IFSC"    value={vendor.bankDetails.ifsc} />
                </InfoCard>
              )}
              {vendor.shopLocation?.lat && (
                <InfoCard title="Geolocation" icon={MapPin}>
                  <InfoRow icon={MapPin} label="Latitude"  value={String(vendor.shopLocation.lat)} />
                  <InfoRow icon={MapPin} label="Longitude" value={String(vendor.shopLocation.lng)} />
                </InfoCard>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────
function InfoCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-4">
        <Icon size={15} className="text-orange-500"/>{title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, link, mono }) {
  if (!value) return null;
  const cls = `text-sm font-medium ${mono ? 'font-mono' : ''} text-gray-800 break-all`;
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 mt-0.5">{label}</span>
      {link ? <a href={link} className={`${cls} text-orange-500 hover:underline`}>{value}</a>
             : <span className={cls}>{value}</span>}
    </div>
  );
}
