// Firestore helpers for all collections

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

// ── Collections ──────────────────────────────────────────────
export const COLLECTIONS = {
  ORDERS: 'orders',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  USERS: 'users',
  REQUESTS: 'requests',
  BANNERS: 'banners',
};

// ── Order Status ──────────────────────────────────────────────
export const ORDER_STATUS = {
  RECEIVED: 'received',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const STATUS_LABELS = {
  received: 'Received',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS = {
  received: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-yellow-100 text-yellow-700',
  preparing: 'bg-orange-100 text-orange-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

// ── Orders ────────────────────────────────────────────────────
export async function getOrders(statusFilter = null) {
  // Avoid composite index: filter client-side when statusFilter is set
  let q = statusFilter
    ? query(collection(db, COLLECTIONS.ORDERS), where('status', '==', statusFilter))
    : query(collection(db, COLLECTIONS.ORDERS), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (statusFilter) {
    // sort newest first client-side
    docs.sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return tb - ta;
    });
  }
  return docs;
}

export async function getOrder(id) {
  const snap = await getDoc(doc(db, COLLECTIONS.ORDERS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateOrderStatus(id, status) {
  await updateDoc(doc(db, COLLECTIONS.ORDERS, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function addOrder(data) {
  return addDoc(collection(db, COLLECTIONS.ORDERS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function listenToOrders(callback) {
  const q = query(
    collection(db, COLLECTIONS.ORDERS),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── Products ──────────────────────────────────────────────────
export async function getProducts() {
  const snap = await getDocs(collection(db, COLLECTIONS.PRODUCTS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addProduct(data) {
  return addDoc(collection(db, COLLECTIONS.PRODUCTS), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateProduct(id, data) {
  await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id));
}

// ── Categories ────────────────────────────────────────────────
export async function getCategories() {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.CATEGORIES), orderBy('order', 'asc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addCategory(data) {
  return addDoc(collection(db, COLLECTIONS.CATEGORIES), data);
}

export async function updateCategory(id, data) {
  await updateDoc(doc(db, COLLECTIONS.CATEGORIES, id), data);
}

export async function deleteCategory(id) {
  await deleteDoc(doc(db, COLLECTIONS.CATEGORIES, id));
}

// ── Customers ─────────────────────────────────────────────────
export async function getCustomers() {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.USERS), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Requests (Ask TheekKart) ──────────────────────────────────
export async function getRequests() {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.REQUESTS), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateRequest(id, data) {
  await updateDoc(doc(db, COLLECTIONS.REQUESTS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ── Banners ───────────────────────────────────────────────────
export async function getBanners() {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.BANNERS), orderBy('order', 'asc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addBanner(data) {
  return addDoc(collection(db, COLLECTIONS.BANNERS), data);
}

export async function updateBanner(id, data) {
  await updateDoc(doc(db, COLLECTIONS.BANNERS, id), data);
}

export async function deleteBanner(id) {
  await deleteDoc(doc(db, COLLECTIONS.BANNERS, id));
}

// ── Storage helpers ───────────────────────────────────────────
export function formatTimestamp(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
