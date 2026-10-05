'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAdminUser } from '@/lib/auth';
import { buildAreaDoc, DEFAULT_MESSAGE, haversineKm, MAX_RADIUS_KM } from '@/lib/deliveryArea';
import LiveMap from '@/components/LiveMap';
import toast, { Toaster } from 'react-hot-toast';
import { MapPinned, LocateFixed, Save, CheckCircle2, XCircle } from 'lucide-react';

const QUICK_RADII = [5, 10, 25, 50, 100, 250, 500];
const REF = doc(db, 'settings', 'delivery_area');

export default function DeliveryAreaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);       // what is in Firestore now
  const [enabled, setEnabled] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('50');
  const [message, setMessage] = useState('');
  const [testLat, setTestLat] = useState('');
  const [testLng, setTestLng] = useState('');
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false); // true once the admin starts editing (stops live updates overwriting the form)
  const markDirty = () => { dirtyRef.current = true; setDirty(true); };

  useEffect(() => {
    return onSnapshot(REF, snap => {
      const d = snap.exists() ? snap.data() : null;
      setSaved(d);
      // load the form from Firestore until the admin starts editing
      if (!dirtyRef.current && d) {
        setEnabled(d.enabled === true);
        setLat(String(d.centerLat ?? ''));
        setLng(String(d.centerLng ?? ''));
        setRadius(String(d.radiusKm ?? '50'));
        setMessage(d.message || '');
      }
      setLoading(false);
    }, () => { setLoading(false); toast.error('Could not load the delivery area'); });
  }, []);

  const edit = setter => value => { markDirty(); setter(value); };

  const circle = useMemo(() => {
    const a = Number(lat), o = Number(lng), r = Number(radius);
    return lat !== '' && lng !== '' && Number.isFinite(a) && Number.isFinite(o) && r > 0 ? { lat: a, lng: o, radiusKm: r } : null;
  }, [lat, lng, radius]);

  const markers = useMemo(() => circle ? [{
    id: 'center', kind: 'center', lat: circle.lat, lng: circle.lng, label: 'Centre',
    popup: ['Delivery area centre', `${circle.lat.toFixed(5)}, ${circle.lng.toFixed(5)}`],
  }] : [], [circle]);

  function pickOnMap(la, lo) {
    markDirty();
    setLat(la.toFixed(6));
    setLng(lo.toFixed(6));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error('Location is not available in this browser');
    navigator.geolocation.getCurrentPosition(
      pos => pickOnMap(pos.coords.latitude, pos.coords.longitude),
      () => toast.error("Couldn't get this device's location — allow location in the browser, or click the map"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function save() {
    const built = buildAreaDoc({ enabled, centerLat: lat, centerLng: lng, radiusKm: radius, message });
    if (!built.ok) return toast.error(built.error);
    setSaving(true);
    try {
      await setDoc(REF, { ...built.data, updatedAt: serverTimestamp(), updatedBy: getAdminUser() }, { merge: true });
      dirtyRef.current = false;
      setDirty(false);
      toast.success(built.data.enabled ? 'Delivery area saved — the limit is ON' : 'Delivery area saved — the limit is OFF (delivering everywhere)');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  }

  // "Would a customer here be able to order?"
  const test = useMemo(() => {
    const a = Number(testLat), o = Number(testLng);
    if (testLat === '' || testLng === '' || !circle || !Number.isFinite(a) || !Number.isFinite(o)) return null;
    const km = haversineKm(circle.lat, circle.lng, a, o);
    return { km, inside: km <= circle.radiusKm };
  }, [testLat, testLng, circle]);

  const field = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400';

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Toaster position="top-right" />

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><MapPinned size={16} className="text-orange-500" /> Delivery area</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              Choose the centre of the town you deliver in and how far (km) you deliver from it. A customer who opens the app
              outside this circle sees &ldquo;delivery is not available&rdquo; and cannot order.
            </p>
          </div>
          <button type="button" onClick={() => edit(setEnabled)(!enabled)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${enabled ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
            <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
            {enabled ? 'Limit is ON' : 'Limit is OFF (deliver everywhere)'}
          </button>
        </div>
        {!enabled && saved?.centerLat != null && (
          <p className="text-xs text-amber-600 mt-3">The limit is switched off, so customers anywhere can order. Switch it on and save to enforce the radius.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h3 className="font-semibold text-gray-800 text-sm">Click the map to set the centre</h3>
            <button onClick={useMyLocation}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
              <LocateFixed size={14} /> Use my location
            </button>
          </div>
          <LiveMap markers={markers} circle={circle} onMapClick={pickOnMap} height={420}
            fitKey={`${saved ? 'saved' : 'new'}`} />
          <p className="text-xs text-gray-400 mt-2">The orange circle is where you deliver. Zoom out to see a large radius.</p>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Centre latitude</label>
                <input value={lat} onChange={e => edit(setLat)(e.target.value)} inputMode="decimal" placeholder="9.925200" className={field} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Centre longitude</label>
                <input value={lng} onChange={e => edit(setLng)(e.target.value)} inputMode="decimal" placeholder="78.119800" className={field} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery limit (radius in km)</label>
              <input value={radius} onChange={e => edit(setRadius)(e.target.value)} type="number" min="1" max={MAX_RADIUS_KM} className={field} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {QUICK_RADII.map(r => (
                  <button key={r} type="button" onClick={() => edit(setRadius)(String(r))}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${String(r) === String(radius) ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {r} km
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Message shown to customers outside</label>
              <textarea value={message} onChange={e => edit(setMessage)(e.target.value)} rows={2} placeholder={DEFAULT_MESSAGE} className={`${field} resize-none`} />
            </div>

            <button onClick={save} disabled={saving || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-60">
              <Save size={15} /> {saving ? 'Saving…' : 'Save delivery area'}
            </button>
            {dirty && <p className="text-xs text-amber-600 text-center">You have unsaved changes</p>}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">Try a location</h3>
            <p className="text-xs text-gray-400">Enter a customer&apos;s coordinates to see whether they could order (uses the circle above).</p>
            <div className="grid grid-cols-2 gap-3">
              <input value={testLat} onChange={e => setTestLat(e.target.value)} placeholder="Latitude" inputMode="decimal" className={field} />
              <input value={testLng} onChange={e => setTestLng(e.target.value)} placeholder="Longitude" inputMode="decimal" className={field} />
            </div>
            {test && (
              <div className={`flex items-center gap-2 text-sm font-medium rounded-xl px-3 py-2 ${test.inside ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {test.inside ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {test.inside ? 'Inside — delivery available' : 'Outside — delivery not available'}
                <span className="ml-auto text-xs font-normal">{test.km.toFixed(1)} km from the centre</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
