// Who gets told what when an order changes. Server-only, but written with no
// "@/" alias and explicit ".js" imports so the Node test runner can load it
// with a mocked FCM `messaging` and a Firestore emulator.
//
// Two parts:
//   planNotifications(event, order, orderId)  — PURE: the recipient table.
//   handleOrderEvent({ db, messaging, ... })  — claims the event (no
//     duplicates), looks up tokens, sends.
//
// Recipient table (see FLOW_FIX_REPORT.md):
//   order_created            → vendor (if any) + admin
//   status_changed
//     received/confirmed/preparing/ready_for_pickup
//     going_to_pickup/picked_up/out_for_delivery/delivered → customer + admin
//     cancelled              → customer + vendor + rider + admin
//   vendor_assigned          → that vendor ("New order")
//   rider_assigned           → the new rider; the previous rider is told "reassigned"
//   pickup_location_shared   → the assigned rider
//   rider_accepted           → admin only ("Ravi accepted order #X")
//   rider_rejected           → admin only ("Ravi rejected order #X — assign another rider" + the reason)
// The admin is not told about a change the admin made themselves.
import { FieldValue } from 'firebase-admin/firestore';
import { ORDER_STATUS, STATUS_LABELS, effectiveStatus } from './orderStatus.js';

export const KNOWN_EVENTS = new Set([
  'order_created',
  'vendor_assigned',
  'status_changed',
  'rider_assigned',
  'pickup_location_shared',
  'rider_accepted',
  'rider_rejected',
]);

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

const CUSTOMER_MESSAGES = {
  received: { title: '🧾 Order Received', body: 'We received your order' },
  confirmed: { title: '✅ Order Accepted', body: 'Your order was accepted' },
  preparing: { title: '👨‍🍳 Preparing', body: 'Your order is being prepared' },
  ready_for_pickup: { title: '📦 Ready for Pickup', body: 'Your order is ready and waiting for a delivery partner' },
  going_to_pickup: { title: '🛵 Pickup in Progress', body: 'The delivery partner is on the way to pick up your order' },
  picked_up: { title: '🛍️ Picked Up', body: 'Your order has been picked up' },
  out_for_delivery: { title: '🚴 Out for Delivery', body: 'Your order is on the way' },
  delivered: { title: '🎉 Delivered', body: 'Delivered. Thank you!' },
  cancelled: { title: '❌ Order Cancelled', body: 'Your order was cancelled' },
};

export function orderLabel(order, orderId) {
  return order.orderNumber || String(orderId).slice(-6).toUpperCase();
}

function lastActor(order) {
  const h = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  return h.length ? h[h.length - 1].by : '';
}

function millis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/**
 * Key that identifies "this particular change", so retries and the several
 * callers of one change (Admin action, Partner app, Customer app) notify once,
 * while a genuinely new change (even back to an earlier status) still does.
 */
export function dedupKeyFor(event, order) {
  switch (event) {
    case 'status_changed': {
      const n = Array.isArray(order.statusHistory) ? order.statusHistory.length : 0;
      return `status_changed:${effectiveStatus(order) || order.status}:${n}`;
    }
    case 'vendor_assigned': return `vendor_assigned:${order.vendorId || ''}`;
    case 'rider_assigned': return `rider_assigned:${order.riderAssignSeq || 0}:${order.riderId || ''}`;
    case 'pickup_location_shared': return `pickup_location_shared:${millis(order.pickupLocation?.sharedAt)}`;
    case 'rider_accepted': return `rider_accepted:${order.riderAcceptedSeq || 0}:${order.riderId || ''}`;
    case 'rider_rejected': return `rider_rejected:${Array.isArray(order.riderRejections) ? order.riderRejections.length : 0}`;
    default: return event; // order_created
  }
}

/** The recipient table. Returns [{ to, id, title, body, data }]. */
export function planNotifications(event, order, orderId) {
  const label = orderLabel(order, orderId);
  const data = { orderId, type: 'order', event };
  const out = [];
  const add = (to, id, title, body, extra = {}) => out.push({ to, id, title, body, data: { ...data, ...extra } });

  if (event === 'order_created') {
    if (order.vendorId) add('vendor', order.vendorId, '🛒 New Order', `New order #${label} – ₹${order.total || 0}`);
    add('admin', 'admin', '🛒 New Order', `#${label} from ${order.customerName || 'a customer'} – ₹${order.total || 0}${order.vendorId ? '' : ' (needs a vendor)'}`);
  } else if (event === 'vendor_assigned') {
    if (order.vendorId) add('vendor', order.vendorId, '🛒 New Order', `New order #${label} – ₹${order.total || 0}`);
  } else if (event === 'rider_assigned') {
    if (order.riderId) add('rider', order.riderId, '📦 Delivery Assigned', `You've been assigned order #${label} — open the app to accept or reject it`);
    if (order.previousRiderId && order.previousRiderId !== order.riderId) {
      add('rider', order.previousRiderId, '🔁 Order reassigned', `Order #${label} was reassigned to another rider`);
    }
  } else if (event === 'rider_accepted') {
    const who = order.riderName || 'The rider';
    add('admin', 'admin', '✅ Rider accepted', `${who} accepted order #${label}`);
  } else if (event === 'rider_rejected') {
    const list = Array.isArray(order.riderRejections) ? order.riderRejections : [];
    const last = list[list.length - 1] || {};
    add('admin', 'admin', '🛵 Rider rejected — assign another', `${last.riderName || 'A rider'} rejected order #${label}${last.reason ? `: ${last.reason}` : ''}`);
  } else if (event === 'pickup_location_shared') {
    if (order.riderId) add('rider', order.riderId, '📍 Pickup location shared', `Shop location for order #${label} is ready — tap to navigate`);
  } else if (event === 'status_changed') {
    const status = effectiveStatus(order);
    const msg = status && CUSTOMER_MESSAGES[status];
    if (!msg) return out;
    const statusData = { status };
    if (order.customerId) add('customer', order.customerId, msg.title, msg.body, statusData);
    if (status === ORDER_STATUS.CANCELLED) {
      if (order.vendorId) add('vendor', order.vendorId, '❌ Order Cancelled', `Order #${label} was cancelled`, statusData);
      if (order.riderId) add('rider', order.riderId, '❌ Order Cancelled', `Order #${label} was cancelled`, statusData);
    }
    if (lastActor(order) !== 'admin') {
      const body = status === ORDER_STATUS.READY_FOR_PICKUP && !order.riderId
        ? `#${label} is Ready – assign a rider`
        : `#${label}: ${STATUS_LABELS[status]}${order.vendorName ? ` · ${order.vendorName}` : ''}`;
      add('admin', 'admin', status === ORDER_STATUS.READY_FOR_PICKUP && !order.riderId ? '📦 Ready – assign a rider' : `Order ${STATUS_LABELS[status]}`, body, statusData);
    }
  }
  return out;
}

/**
 * Process one event: validate, claim it (so it is sent once), build the plan,
 * deliver. `messaging` needs `send(message)`; `db` is a firebase-admin Firestore.
 * Never throws for a bad/missing token — that recipient is simply skipped.
 */
export async function handleOrderEvent({ db, messaging, orderId, event }) {
  if (!orderId || typeof orderId !== 'string' || !event || typeof event !== 'string') {
    return { error: 'orderId and event are required strings', status: 400 };
  }
  if (!KNOWN_EVENTS.has(event)) return { error: `Unknown event: ${event}`, status: 400 };

  const orderRef = db.collection('orders').doc(orderId);

  // Claim the event atomically BEFORE sending: two simultaneous calls for the
  // same change can never both pass.
  const claim = await db.runTransaction(async tx => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return { missing: true };
    const order = snap.data();
    const key = dedupKeyFor(event, order);
    if (Array.isArray(order.notifiedEvents) && order.notifiedEvents.includes(key)) return { duplicate: true };
    tx.update(orderRef, { notifiedEvents: FieldValue.arrayUnion(key) });
    return { order, key };
  });
  if (claim.missing) return { error: 'Order not found', status: 404 };
  if (claim.duplicate) return { ok: true, skipped: 'already notified' };

  const plan = planNotifications(event, claim.order, orderId);
  const deliveries = [];

  async function tokenFor(to, id) {
    try {
      const col = to === 'customer' ? 'users' : 'partner_requests';
      const s = await db.collection(col).doc(id).get();
      return s.exists ? s.data().fcmToken || null : null;
    } catch (e) {
      console.error('token lookup failed', to, e.message);
      return null;
    }
  }
  async function clearToken(to, id) {
    try {
      const col = to === 'customer' ? 'users' : 'partner_requests';
      await db.collection(col).doc(id).set({ fcmToken: FieldValue.delete() }, { merge: true });
    } catch (e) { console.error('clearToken failed', e.message); }
  }

  await Promise.all(plan.map(async n => {
    if (n.to === 'admin') {
      // The admin site shows live browser alerts while open; the server also
      // keeps a durable record of what the admin was told.
      try {
        await db.collection('admin_notifications').add({
          orderId, event, title: n.title, body: n.body, status: n.data.status || '', createdAt: FieldValue.serverTimestamp(),
        });
        deliveries.push({ to: 'admin', id: 'admin', result: 'logged' });
      } catch (e) {
        console.error('admin_notifications write failed', e.message);
        deliveries.push({ to: 'admin', id: 'admin', result: 'failed' });
      }
      return;
    }
    const token = await tokenFor(n.to, n.id);
    if (!token) { deliveries.push({ to: n.to, id: n.id, result: 'no_token' }); return; }
    try {
      await messaging.send({
        token,
        notification: { title: n.title, body: n.body },
        data: Object.fromEntries(Object.entries(n.data).map(([k, v]) => [k, String(v)])),
        android: { priority: 'high' },
      });
      deliveries.push({ to: n.to, id: n.id, result: 'sent' });
    } catch (e) {
      if (INVALID_TOKEN_CODES.has(e.code)) await clearToken(n.to, n.id);
      console.error('send failed', n.to, e.code || e.message);
      deliveries.push({ to: n.to, id: n.id, result: 'failed' });
    }
  }));

  return { ok: true, deliveries };
}
