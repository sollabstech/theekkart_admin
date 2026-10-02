import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getAdminApp } from '@/lib/firebaseAdmin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// POST /api/order-event
// Body: { orderId, event } ONLY — title/body/token are never accepted from
// the caller. This route re-reads the order from Firestore itself and
// decides who gets notified and what they're told, mirroring the recipient
// logic and message copy that used to live in functions/index.js's
// onOrderWrite trigger (kept in the repo, no longer deployed — see
// VERCEL_DEPLOY.md). Every app calls this in the background right after it
// successfully changes an order; a failed call here must never surface to
// the end user, so apps treat this as fire-and-forget.
//
// Auth: requires header `x-notify-secret` to match ORDER_EVENT_SECRET
// (server-only env var, set in Vercel, never NEXT_PUBLIC_).

const KNOWN_EVENTS = new Set([
  'order_created',
  'vendor_assigned',
  'status_changed',
  'rider_assigned',
]);

// Tokens FCM reports as dead — we remove them from Firestore so the next
// send doesn't retry a token that will never deliver.
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// Same short, clear copy the Cloud Function used — keyed by the order's
// actual current status.
const CUSTOMER_STATUS_MESSAGES = {
  confirmed: { title: '✅ Order Accepted', body: 'Your order was accepted' },
  preparing: { title: '👨‍🍳 Preparing', body: 'Your order is being prepared' },
  out_for_delivery: { title: '🚴 Out for Delivery', body: 'Your order is out for delivery' },
  picked_up: { title: '📦 Picked Up', body: 'Your order has been picked up' },
  delivered: { title: '🎉 Delivered', body: 'Delivered. Thank you!' },
  cancelled: { title: '❌ Order Cancelled', body: 'Your order was cancelled' },
};

function orderLabel(data, orderId) {
  return data.orderNumber || orderId.slice(-6).toUpperCase();
}

function secretsMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request) {
  const secret = request.headers.get('x-notify-secret');
  if (!secretsMatch(secret, process.env.ORDER_EVENT_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const app = getAdminApp();
  if (!app) {
    return NextResponse.json(
      { error: 'FIREBASE_SERVICE_ACCOUNT_KEY not configured (or invalid JSON)' },
      { status: 500 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { orderId, event } = payload || {};
  if (!orderId || typeof orderId !== 'string' || !event || typeof event !== 'string') {
    return NextResponse.json({ error: 'orderId and event are required strings' }, { status: 400 });
  }
  if (!KNOWN_EVENTS.has(event)) {
    return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 });
  }

  const db = getFirestore(app);
  const messaging = getMessaging(app);
  const orderRef = db.collection('orders').doc(orderId);

  const snap = await orderRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  const order = snap.data();

  // Dedup key includes the piece of data the event actually acted on, so a
  // later genuinely-new transition of the same event type (e.g. another
  // status_changed call once the status moves from preparing to delivered)
  // is never suppressed by an earlier one.
  let dedupKey;
  if (event === 'status_changed') dedupKey = `status_changed:${order.status}`;
  else if (event === 'vendor_assigned') dedupKey = `vendor_assigned:${order.vendorId}`;
  else if (event === 'rider_assigned') dedupKey = `rider_assigned:${order.riderId}`;
  else dedupKey = event; // order_created

  const alreadyNotified = Array.isArray(order.notifiedEvents) && order.notifiedEvents.includes(dedupKey);
  if (alreadyNotified) {
    return NextResponse.json({ ok: true, skipped: 'already notified' });
  }

  async function clearCustomerToken(uid) {
    if (!uid) return;
    try {
      await db.collection('users').doc(uid).set({ fcmToken: FieldValue.delete() }, { merge: true });
    } catch (e) {
      console.error('clearCustomerToken failed', e.message);
    }
  }
  async function clearPartnerToken(id) {
    if (!id) return;
    try {
      await db.collection('partner_requests').doc(id).set({ fcmToken: FieldValue.delete() }, { merge: true });
    } catch (e) {
      console.error('clearPartnerToken failed', e.message);
    }
  }
  async function getCustomerToken(uid) {
    if (!uid) return null;
    try {
      const s = await db.collection('users').doc(uid).get();
      return s.exists ? s.data().fcmToken || null : null;
    } catch (e) {
      console.error('getCustomerToken failed', e.message);
      return null;
    }
  }
  async function getPartnerToken(id) {
    if (!id) return null;
    try {
      const s = await db.collection('partner_requests').doc(id).get();
      return s.exists ? s.data().fcmToken || null : null;
    } catch (e) {
      console.error('getPartnerToken failed', e.message);
      return null;
    }
  }
  async function getOnlineRiderRecipients() {
    try {
      const s = await db.collection('partner_requests')
        .where('role', '==', 'rider')
        .where('available', '==', true)
        .get();
      return s.docs.map(d => ({ id: d.id, token: d.data().fcmToken || null }));
    } catch (e) {
      console.error('getOnlineRiderRecipients failed', e.message);
      return [];
    }
  }

  // Never throws — a missing/dead token is skipped, not an error.
  async function sendToToken(token, title, body, data, onInvalid) {
    if (!token) return;
    try {
      await messaging.send({
        token,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, String(v)])),
        android: { priority: 'high' },
      });
    } catch (e) {
      if (INVALID_TOKEN_CODES.has(e.code) && onInvalid) await onInvalid();
      console.error('sendToToken failed', e.code || e.message);
    }
  }

  async function sendToRecipients(recipients, title, body, data) {
    const valid = recipients.filter(r => r.token);
    if (valid.length === 0) return;
    try {
      const result = await messaging.sendEachForMulticast({
        tokens: valid.map(r => r.token),
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, String(v)])),
        android: { priority: 'high' },
      });
      await Promise.all(result.responses.map((resp, i) => {
        if (!resp.success && INVALID_TOKEN_CODES.has(resp.error?.code)) {
          return clearPartnerToken(valid[i].id);
        }
      }));
    } catch (e) {
      console.error('sendToRecipients failed', e.message);
    }
  }

  const label = orderLabel(order, orderId);
  const tasks = [];

  if (event === 'order_created' || event === 'vendor_assigned') {
    if (order.vendorId) {
      tasks.push((async () => {
        const token = await getPartnerToken(order.vendorId);
        await sendToToken(
          token,
          '🛒 New Order',
          `New order #${label} – ₹${order.total || 0}`,
          { orderId, type: 'order' },
          () => clearPartnerToken(order.vendorId)
        );
      })());
    }
  } else if (event === 'rider_assigned') {
    if (order.riderId) {
      tasks.push((async () => {
        const token = await getPartnerToken(order.riderId);
        await sendToToken(
          token,
          '📦 Delivery Assigned',
          `You've been assigned order #${label}`,
          { orderId, type: 'order' },
          () => clearPartnerToken(order.riderId)
        );
      })());
    }
  } else if (event === 'status_changed') {
    const msg = CUSTOMER_STATUS_MESSAGES[order.status];
    if (msg && order.customerId) {
      tasks.push((async () => {
        const token = await getCustomerToken(order.customerId);
        await sendToToken(token, msg.title, msg.body, { orderId, type: 'order' }, () => clearCustomerToken(order.customerId));
      })());
    }

    if (order.status === 'out_for_delivery') {
      if (order.riderId) {
        tasks.push((async () => {
          const token = await getPartnerToken(order.riderId);
          await sendToToken(
            token,
            '📦 Delivery Assigned',
            `You've been assigned order #${label}`,
            { orderId, type: 'order' },
            () => clearPartnerToken(order.riderId)
          );
        })());
      } else {
        tasks.push((async () => {
          const recipients = await getOnlineRiderRecipients();
          await sendToRecipients(recipients, '📦 New Delivery', 'Order ready for pickup near you', { orderId, type: 'order' });
        })());
      }
    }

    if (order.status === 'cancelled') {
      if (order.vendorId) {
        tasks.push((async () => {
          const token = await getPartnerToken(order.vendorId);
          await sendToToken(token, '❌ Order Cancelled', `Order #${label} was cancelled`, { orderId, type: 'order' }, () => clearPartnerToken(order.vendorId));
        })());
      }
      if (order.riderId) {
        tasks.push((async () => {
          const token = await getPartnerToken(order.riderId);
          await sendToToken(token, '❌ Order Cancelled', `Order #${label} was cancelled`, { orderId, type: 'order' }, () => clearPartnerToken(order.riderId));
        })());
      }
    }
  }

  await Promise.all(tasks);

  try {
    await orderRef.set({ notifiedEvents: FieldValue.arrayUnion(dedupKey) }, { merge: true });
  } catch (e) {
    console.error('Failed to record notifiedEvents', e.message);
  }

  return NextResponse.json({ ok: true });
}
