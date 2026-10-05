'use client';
import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORDER_STATUS, STATUS_LABELS, effectiveStatus, needsRider } from '@/lib/orderStatus';
import { computeAttention } from '@/lib/attention';
import { setCounts, pushAlert } from '@/lib/alertStore';

// Watches Firestore in real-time and raises an instant alert (browser
// notification + a short beep) when something needs the admin:
//   • a new order arrives (extra text if it has no vendor yet)
//   • an order becomes Ready for Pickup with no rider  → "assign a rider"
//   • a rider (or the shop) moves an order (going to pickup / picked up / out / delivered)
//   • an order is cancelled by the shop or the rider
// It also publishes the live counts (orders / requests / home services) to
// lib/alertStore.js for the sidebar badges and the header bell, and keeps the
// bell's "recent alerts" feed. Alerts only work while an admin tab is open.
// The first snapshot is always skipped (it's the current data, not new).


const RIDER_STATUSES = new Set([
  ORDER_STATUS.GOING_TO_PICKUP, ORDER_STATUS.PICKED_UP, ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED,
]);

let audioCtx = null;
function beep(urgent) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const tones = urgent ? [880, 660, 880] : [740, 990];
    tones.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = audioCtx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.22);
    });
  } catch (_) { /* audio is best-effort */ }
}

function orderNo(o, id) {
  return `#${o.orderNumber || id.slice(-6).toUpperCase()}`;
}

function lastActor(o) {
  const h = Array.isArray(o.statusHistory) ? o.statusHistory : [];
  return h.length ? h[h.length - 1].by : '';
}

export default function NotificationWatcher() {
  const ready = useRef({});

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    function show(title, body, { urgent = false, tag, url } = {}) {
      pushAlert({ title, body, url });
      beep(urgent);
      if (Notification.permission !== 'granted') return;
      try {
        const n = new Notification(title, { body, icon: '/favicon.ico', tag });
        // Tapping an order alert opens that order.
        if (url) n.onclick = () => { window.focus(); window.location.assign(url); n.close(); };
      } catch (_) {}
    }

    function watch(collectionName, handler) {
      ready.current[collectionName] = false;
      const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'), limit(30));
      return onSnapshot(q, snap => {
        if (!ready.current[collectionName]) {
          ready.current[collectionName] = true;
          return; // skip initial load
        }
        snap.docChanges().forEach(change => {
          if (change.type === 'added') handler(change.doc.data());
        });
      });
    }

    // Live counts for the sidebar badges and the bell
    const latest = { orders: [], requests: [], issues: [], serviceRequests: [] };
    const publishCounts = () => setCounts(computeAttention(latest));
    const countPending = (name, key) => onSnapshot(
      query(collection(db, name), where('status', '==', 'pending')),
      snap => { latest[key] = snap.docs.map(d => ({ id: d.id, ...d.data() })); publishCounts(); },
      () => {} // a failed count must never break the page
    );

    // Orders: new / ready-without-rider / rider progress / cancelled, + counts.
    let ordersReady = false;
    const alerted = new Set();
    const known = new Map(); // order id → "status|rider|vendor" as last seen
    const signature = o => `${effectiveStatus(o)}|${o.riderId || ''}|${o.vendorId || ''}`;
    const ordersQ = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(300));
    const unsubOrders = onSnapshot(ordersQ, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      latest.orders = all;
      publishCounts();

      if (!ordersReady) { // skip initial load, but remember what each order looked like
        ordersReady = true;
        all.forEach(o => known.set(o.id, signature(o)));
        return;
      }
      snap.docChanges().forEach(change => {
        const o = change.doc.data();
        const id = change.doc.id;
        const before = known.get(id);
        if (change.type === 'removed') { known.delete(id); return; }
        const now = signature(o);
        known.set(id, now);
        if (change.doc.metadata.hasPendingWrites) return; // our own optimistic write
        // Only housekeeping fields changed (server "notifiedEvents", settlement stamp …): not news.
        if (change.type === 'modified' && before === now) return;
        const status = effectiveStatus(o);
        const key = `${id}:${change.type}:${status}:${o.riderId || ''}`;
        if (alerted.has(key)) return;

        if (change.type === 'added') {
          alerted.add(key);
          show('🛒 New Order!',
            `${o.customerName || 'Customer'} placed ${orderNo(o, id)} — ₹${o.total || 0}${o.vendorId ? '' : ' (needs a vendor)'}`,
            { urgent: !o.vendorId, tag: key, url: `/orders/${id}` });
          return;
        }
        if (change.type !== 'modified') return;
        const actor = lastActor(o);

        if (needsRider(o)) {
          alerted.add(key);
          show('📦 Ready for pickup — assign a rider',
            `${orderNo(o, id)}${o.vendorName ? ` from ${o.vendorName}` : ''} is ready and has no rider`,
            { urgent: true, tag: key, url: `/orders/${id}` });
        } else if ((actor === 'rider' || actor === 'vendor') && RIDER_STATUSES.has(status)) {
          // delivery steps are normally the rider's; the shop can carry the order on too
          alerted.add(key);
          const byShop = actor === 'vendor';
          show(`${byShop ? '🏪' : '🛵'} ${STATUS_LABELS[status]}`,
            `${orderNo(o, id)}${byShop ? (o.vendorName ? ` · by ${o.vendorName}` : ' · by the shop') : (o.riderName ? ` · ${o.riderName}` : '')}`,
            { tag: key, url: `/orders/${id}` });
        } else if (status === ORDER_STATUS.CANCELLED && actor !== 'admin') {
          alerted.add(key);
          show('❌ Order cancelled', `${orderNo(o, id)} was cancelled by the ${actor || 'shop'}${o.rejectReason ? `: ${o.rejectReason}` : ''}`, { urgent: true, tag: key, url: `/orders/${id}` });
        }
      });
    });

    const unsubs = [
      unsubOrders,
      countPending('requests', 'requests'),
      countPending('issues', 'issues'),
      countPending('service_requests', 'serviceRequests'),
      watch('requests', d =>
        show('💬 Ask TheekKart', `${d.customerName || 'Someone'}: ${(d.message || d.description || '').slice(0, 80)}`)
      ),
      watch('issues', d =>
        show('⚠️ Issue Report', `${d.customerName || 'Someone'} reported: ${(d.description || '').slice(0, 80)}`)
      ),
      watch('service_requests', d =>
        show('🔧 Home Service', `${d.customerName || 'Someone'} needs ${d.serviceLabel || d.service}`)
      ),
    ];

    return () => unsubs.forEach(u => u());
  }, []);

  return null;
}
