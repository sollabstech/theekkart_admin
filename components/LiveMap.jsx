'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

// Leaflet + OpenStreetMap map that keeps one marker per `markers[].id` and
// MOVES it when its lat/lng change (no re-render flicker, no re-centering
// while the admin is panning). Leaflet touches `window`, so it is imported
// inside an effect.
//
// circle (optional): { lat, lng, radiusKm } drawn as a translucent area.
// onMapClick (optional): called with (lat, lng) when the map is clicked.
// markers: [{ id, lat, lng, kind: 'shop'|'customer'|'rider'|'rider-stale',
//             label, popup: ['line 1', 'line 2', …] (plain text) }]
const ICONS = {
  shop:         { emoji: '🏪', bg: '#f97316' },
  customer:     { emoji: '🏠', bg: '#16a34a' },
  rider:        { emoji: '🛵', bg: '#2563eb' },
  center:       { emoji: '📍', bg: '#dc2626' },
  'rider-stale':{ emoji: '🛵', bg: '#9ca3af' },
};

export default function LiveMap({ markers, height = 380, fitKey = '', circle = null, onMapClick = null }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const layerRef = useRef({}); // id -> marker
  const fittedFor = useRef(null);
  const circleRef = useRef(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  // create the map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(elRef.current, { zoomControl: true }).setView([9.9252, 78.1198], 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      mapRef.current = map;
      map.on('click', e => clickRef.current && clickRef.current(e.latlng.lat, e.latlng.lng));
      sync();
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      layerRef.current = {};
      circleRef.current = null;
      fittedFor.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const popupHtml = lines => (lines || []).map((l, i) => (i === 0 ? `<b>${esc(l)}</b>` : esc(l))).join('<br/>');

  function iconFor(kind, label) {
    const L = leafletRef.current;
    const cfg = ICONS[kind] || ICONS.shop;
    const safe = String(label || '').replace(/[<>&"]/g, '');
    return L.divIcon({
      className: '',
      iconSize: [38, 46],
      iconAnchor: [19, 42],
      popupAnchor: [0, -38],
      html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:34px;height:34px;border-radius:50%;background:${cfg.bg};display:flex;align-items:center;justify-content:center;font-size:17px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${cfg.emoji}</div>
        ${safe ? `<div style="margin-top:2px;font-size:10px;font-weight:700;background:#fff;padding:0 4px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3)">${safe}</div>` : ''}
      </div>`,
    });
  }

  function sync() {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const wanted = new Map((markers || []).filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lng)).map(m => [m.id, m]));

    for (const [id, mk] of Object.entries(layerRef.current)) {
      if (!wanted.has(id)) { mk.remove(); delete layerRef.current[id]; }
    }
    for (const [id, m] of wanted) {
      const existing = layerRef.current[id];
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        if (existing._kind !== m.kind || existing._label !== m.label) {
          existing.setIcon(iconFor(m.kind, m.label));
          existing._kind = m.kind;
          existing._label = m.label;
        }
        if (m.popup) existing.setPopupContent(popupHtml(m.popup));
      } else {
        const mk = L.marker([m.lat, m.lng], { icon: iconFor(m.kind, m.label) }).addTo(map);
        mk._kind = m.kind;
        mk._label = m.label;
        if (m.popup) mk.bindPopup(popupHtml(m.popup));
        layerRef.current[id] = mk;
      }
    }

    // Translucent area (e.g. the delivery radius)
    const validCircle = circle && Number.isFinite(circle.lat) && Number.isFinite(circle.lng) && circle.radiusKm > 0;
    if (!validCircle && circleRef.current) { circleRef.current.remove(); circleRef.current = null; }
    if (validCircle) {
      if (circleRef.current) {
        circleRef.current.setLatLng([circle.lat, circle.lng]);
        circleRef.current.setRadius(circle.radiusKm * 1000);
      } else {
        circleRef.current = L.circle([circle.lat, circle.lng], {
          radius: circle.radiusKm * 1000, color: '#f97316', weight: 2, fillColor: '#f97316', fillOpacity: 0.12,
        }).addTo(map);
      }
    }

    // Frame everything once per `fitKey`, then leave the view to the admin.
    if (fittedFor.current !== fitKey) {
      if (validCircle) {
        fittedFor.current = fitKey;
        map.fitBounds(circleRef.current.getBounds(), { padding: [30, 30] });
      } else {
        const pts = [...wanted.values()].map(m => [m.lat, m.lng]);
        if (pts.length) {
          fittedFor.current = fitKey;
          if (pts.length === 1) map.setView(pts[0], 15);
          else map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
        }
      }
    }
  }

  useEffect(sync, [markers, fitKey, circle?.lat, circle?.lng, circle?.radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={elRef} style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden', zIndex: 0 }} />;
}
