'use client';
import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORDER_STATUS, STATUS_LABELS, effectiveStatus, needsRider, needsVendor } from '@/lib/orderStatus';

// Watches Firestore in real-time and raises an instant alert (browser
// notification + a short beep) when something needs the admin:
//   • a new order arrives (extra text if it has no vendor yet)
//   • an order becomes Ready for Pickup with no rider  → "assign a rider"
//   • a rider moves an order (going to pickup / picked up / out / delivered)
//   • an order is cancelled by the shop or the rider
// It also publishes the "needs rider / needs vendor" counts for the sidebar
// badge. Alerts only work while an admin tab is open.
// The first snapshot is always skipped (it's the current data, not new).

export const ATTENTION_EVENT = 'tk-attention';

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

    // Orders: new / ready-without-rider / rider progress / cancelled, + sidebar counts.
    let ordersReady = false;
    const alerted = new Set();
    const ordersQ = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(150));
    const unsubOrders = onSnapshot(ordersQ, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.__tkAttention = {
        needsRider: all.filter(needsRider).length,
        needsVendor: all.filter(needsVendor).length,
      };
      window.dispatchEvent(new CustomEvent(ATTENTION_EVENT, { detail: window.__tkAttention }));

      if (!ordersReady) { ordersReady = true; return; } // skip initial load
      snap.docChanges().forEach(change => {
        if (change.doc.metadata.hasPendingWrites) return; // our own optimistic write
        const o = change.doc.data();
        const id = change.doc.id;
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
        } else if (actor === 'rider' && RIDER_STATUSES.has(status)) {
          alerted.add(key);
          show(`🛵 ${STATUS_LABELS[status]}`, `${orderNo(o, id)}${o.riderName ? ` · ${o.riderName}` : ''}`, { tag: key, url: `/orders/${id}` });
        } else if (status === ORDER_STATUS.CANCELLED && actor !== 'admin') {
          alerted.add(key);
          show('❌ Order cancelled', `${orderNo(o, id)} was cancelled by the ${actor || 'shop'}${o.rejectReason ? `: ${o.rejectReason}` : ''}`, { urgent: true, tag: key, url: `/orders/${id}` });
        }
      });
    });

    const unsubs = [
      unsubOrders,
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
