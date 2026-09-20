'use client';
import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Watches Firestore in real-time and fires browser notifications when
// new orders, requests, issues, or home-service requests arrive.
// The first snapshot is always skipped (it's the current data, not new).
export default function NotificationWatcher() {
  const ready = useRef({});

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    function show(title, body) {
      if (Notification.permission !== 'granted') return;
      try { new Notification(title, { body, icon: '/favicon.ico' }); } catch (_) {}
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

    const unsubs = [
      watch('orders', d =>
        show('🛒 New Order!', `${d.customerName || 'Customer'} placed an order — ₹${d.total || 0}`)
      ),
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
