'use client';
import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAdminUser } from '@/lib/auth';
import { buildPartnerDoc, generatePassword, suggestUsername } from '@/lib/partners';
import toast from 'react-hot-toast';
import { X, Copy, RefreshCw, Eye, EyeOff, CheckCircle2, LocateFixed } from 'lucide-react';

const CATEGORIES = ['Grocery', 'Food', 'Vegetables & Fruits', 'Dairy & Eggs', 'Bakery', 'Meat & Seafood', 'Snacks & Beverages', 'Pharmacy', 'Household', 'Other'];
const VEHICLES = ['Bike', 'Scooter', 'Cycle'];

const input = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400';

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Admin creates a vendor or rider profile directly (no sign-up request),
 * with login credentials, ready to use in the Partner app.
 */
export default function AddPartnerModal({ role, onClose }) {
  const isVendor = role === 'vendor';
  const [taken, setTaken] = useState([]);
  const [form, setForm] = useState({
    name: '', shopName: '', phone: '', email: '', area: '', address: '', businessCategory: '',
    vehicleType: 'Bike', vehicleNumber: '', drivingLicence: '', shopLat: '', shopLng: '',
    username: '', password: generatePassword(),
  });
  const [userEdited, setUserEdited] = useState(false);
  const [showPass, setShowPass] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // { name, username, password } after saving

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Existing usernames, so the suggestion and the check are accurate
  useEffect(() => {
    getDocs(collection(db, 'partner_requests')).then(snap => {
      setTaken(snap.docs.map(d => d.data().credentials?.username).filter(Boolean));
    }).catch(() => {});
  }, []);

  // Suggest a username from the shop / person name until the admin types their own
  const suggested = useMemo(() => suggestUsername(role, isVendor ? (form.shopName || form.name) : form.name, taken), [role, isVendor, form.shopName, form.name, taken]);
  useEffect(() => { if (!userEdited) set('username', suggested); }, [suggested, userEdited]);

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error('Location is not available in this browser');
    navigator.geolocation.getCurrentPosition(
      pos => { set('shopLat', pos.coords.latitude.toFixed(6)); set('shopLng', pos.coords.longitude.toFixed(6)); },
      () => toast.error("Couldn't get this device's location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function save() {
    const built = buildPartnerDoc(role, form, taken);
    if (!built.ok) return toast.error(built.error);
    setSaving(true);
    try {
      // re-check right before saving (someone else may have just taken the username)
      const fresh = (await getDocs(collection(db, 'partner_requests'))).docs.map(d => d.data().credentials?.username).filter(Boolean);
      const again = buildPartnerDoc(role, form, fresh);
      if (!again.ok) { setTaken(fresh); setSaving(false); return toast.error(again.error); }
      await addDoc(collection(db, 'partner_requests'), {
        ...again.data, createdBy: getAdminUser(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setCreated({ name: isVendor ? form.shopName : form.name, username: again.data.credentials.username, password: again.data.credentials.password });
    } catch { toast.error('Failed to create the profile'); }
    setSaving(false);
  }

  const copy = text => { navigator.clipboard?.writeText(text); toast.success('Copied!'); };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && !created && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{created ? 'Profile created' : isVendor ? 'Add vendor' : 'Add rider'}</h2>
            {!created && <p className="text-xs text-gray-400 mt-0.5">Creates an approved profile with login details — no request needed.</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X size={20} /></button>
        </div>

        {created ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-green-700 font-semibold"><CheckCircle2 size={18} /> {created.name} can now sign in to the Partner app</div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
              {[['Username', created.username], ['Password', created.password]].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between gap-3">
                  <div><p className="text-xs text-gray-400">{l}</p><p className="font-mono font-semibold text-gray-800">{v}</p></div>
                  <button onClick={() => copy(v)} className="p-2 border border-gray-200 rounded-xl hover:bg-white"><Copy size={14} /></button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">Share these with them now. You can see or change them later from their card (Login Credentials).</p>
            <button onClick={onClose} className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">Done</button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {isVendor && <div className="col-span-2"><Field label="Shop name *"><input className={input} value={form.shopName} onChange={e => set('shopName', e.target.value)} placeholder="e.g. Hari Biryani House" /></Field></div>}
                <Field label={isVendor ? 'Owner name *' : 'Full name *'}><input className={input} value={form.name} onChange={e => set('name', e.target.value)} /></Field>
                <Field label="Phone *"><input className={input} value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" placeholder="9876543210" /></Field>
                <Field label="Email"><input className={input} value={form.email} onChange={e => set('email', e.target.value)} type="email" /></Field>
                <Field label="Area *"><input className={input} value={form.area} onChange={e => set('area', e.target.value)} placeholder="e.g. Anna Nagar" /></Field>
                <div className="col-span-2"><Field label={isVendor ? 'Shop address' : 'Home address'}><input className={input} value={form.address} onChange={e => set('address', e.target.value)} /></Field></div>
              </div>

              {isVendor ? (
                <>
                  <Field label="Business category">
                    <select className={input} value={form.businessCategory} onChange={e => set('businessCategory', e.target.value)}>
                      <option value="">— select —</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-600">Shop location (optional — used for rider distance &amp; navigation)</label>
                      <button type="button" onClick={useMyLocation} className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600"><LocateFixed size={12} /> Use my location</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input className={input} value={form.shopLat} onChange={e => set('shopLat', e.target.value)} placeholder="Latitude" inputMode="decimal" />
                      <input className={input} value={form.shopLng} onChange={e => set('shopLng', e.target.value)} placeholder="Longitude" inputMode="decimal" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Vehicle">
                    <select className={input} value={form.vehicleType} onChange={e => set('vehicleType', e.target.value)}>{VEHICLES.map(v => <option key={v}>{v}</option>)}</select>
                  </Field>
                  <Field label="Vehicle number"><input className={input} value={form.vehicleNumber} onChange={e => set('vehicleNumber', e.target.value)} placeholder="TN 58 AB 1234" /></Field>
                  <div className="col-span-2"><Field label="Driving licence no."><input className={input} value={form.drivingLicence} onChange={e => set('drivingLicence', e.target.value)} /></Field></div>
                </div>
              )}

              <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">Login details for the Partner app</p>
                <Field label="Username *" hint={taken.map(u => u.toLowerCase()).includes(form.username.toLowerCase()) ? '⚠️ Already taken — change it' : 'Suggested from the name; you can edit it'}>
                  <input className={input} value={form.username} onChange={e => { setUserEdited(true); set('username', e.target.value); }} />
                </Field>
                <Field label="Password *">
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-3 bg-white focus-within:ring-2 focus-within:ring-orange-400">
                      <input className="flex-1 py-2.5 text-sm focus:outline-none font-mono" type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="ml-2 text-gray-400 hover:text-gray-600">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                    </div>
                    <button type="button" onClick={() => set('password', generatePassword())} title="Generate a new password" className="p-2.5 border border-gray-200 rounded-xl bg-white hover:bg-gray-50"><RefreshCw size={15} /></button>
                  </div>
                </Field>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {saving ? 'Creating…' : isVendor ? 'Create vendor' : 'Create rider'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
