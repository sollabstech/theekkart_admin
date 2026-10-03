// Every write that changes who/where/what-state an order is goes through here.
// Each function runs in a Firestore TRANSACTION that re-reads the order, so
// two people acting at once (or a stale screen) can never corrupt it.
//
// Imports use explicit ".js" extensions and no "@/" alias so the Node test
// runner can load this file exactly as the Admin site does.
import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
  ROLES, ORDER_STATUS, STATUS_LABELS, canChangeStatus, effectiveStatus, isBackward, isTerminal, normalizeStatus,
} from './orderStatus.js';

export class StatusChangeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StatusChangeError';
    this.code = code; // not_found | not_yours | invalid_move | needs_confirm | reason_required | order_closed
  }
}

// NOTE: Firestore forbids serverTimestamp() inside array elements, so history
// entries use a client Timestamp; only the top-level updatedAt is server time.
function historyEntry(status, by, byId, note) {
  const entry = { status, by, at: Timestamp.now() };
  if (byId) entry.byId = byId;
  if (note) entry.note = note;
  return entry;
}

function historyOf(order) {
  return Array.isArray(order.statusHistory) ? order.statusHistory : [];
}

/**
 * Move an order to [to]. Refuses invalid or backward moves, wrong owner, and
 * a vendor/rider touching an order that isn't theirs. Admin may move
 * backwards only with `allowBackward: true` (the UI asks first).
 */
export async function changeOrderStatus(db, { orderId, to, role, actorId = '', extra = {}, allowBackward = false }) {
  const ref = doc(db, 'orders', orderId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new StatusChangeError('not_found', 'Order not found');
    const order = snap.data();

    if (role === ROLES.VENDOR && order.vendorId !== actorId) throw new StatusChangeError('not_yours', 'This order belongs to another shop');
    if (role === ROLES.RIDER && order.riderId !== actorId) throw new StatusChangeError('not_yours', 'This order is not assigned to you');

    const target = normalizeStatus(to);
    const from = effectiveStatus(order);
    const fromLabel = from ? STATUS_LABELS[from] : String(order.status ?? 'unknown');
    if (!target) throw new StatusChangeError('invalid_move', `"${to}" is not a valid status`);
    if (target === ORDER_STATUS.CANCELLED && role === ROLES.VENDOR && !String(extra.rejectReason ?? '').trim()) {
      throw new StatusChangeError('reason_required', 'Please give a reason for rejecting this order');
    }
    if (!canChangeStatus(role, from, target)) {
      throw new StatusChangeError('invalid_move', `Can't change from ${fromLabel} to ${STATUS_LABELS[target]}`);
    }
    if (role === ROLES.ADMIN && isBackward(from, target) && !allowBackward) {
      throw new StatusChangeError('needs_confirm', `This moves the order back from ${fromLabel} to ${STATUS_LABELS[target]}`);
    }

    tx.update(ref, {
      ...extra,
      status: target,
      updatedAt: serverTimestamp(),
      statusHistory: [...historyOf(order), historyEntry(target, role, actorId)],
    });
    return { from, to: target };
  });
}

/** Admin: assign or reassign the rider. Never touches `status`. */
export async function assignRider(db, { orderId, riderId, riderName, adminId = '', pickup = null }) {
  const ref = doc(db, 'orders', orderId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new StatusChangeError('not_found', 'Order not found');
    const order = snap.data();
    if (isTerminal(order.status)) throw new StatusChangeError('order_closed', 'This order is already closed');
    const previous = order.riderId || '';
    const seq = (Number(order.riderAssignSeq) || 0) + 1;
    const note = previous && previous !== riderId ? `Rider reassigned to ${riderName}` : `Rider assigned: ${riderName}`;
    tx.update(ref, {
      riderId,
      riderName,
      previousRiderId: previous === riderId ? (order.previousRiderId || '') : previous,
      riderAssignSeq: seq,
      ...(pickup ? { pickupName: pickup.name || '', pickupAddress: pickup.address || '' } : {}),
      updatedAt: serverTimestamp(),
      statusHistory: [...historyOf(order), historyEntry(effectiveStatus(order) || order.status, ROLES.ADMIN, adminId, note)],
    });
    return { previousRiderId: previous, riderAssignSeq: seq };
  });
}

/** Admin: attach a vendor to an order. Never touches `status`. */
export async function assignVendor(db, { orderId, vendorId, vendorName, adminId = '' }) {
  const ref = doc(db, 'orders', orderId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new StatusChangeError('not_found', 'Order not found');
    const order = snap.data();
    if (isTerminal(order.status)) throw new StatusChangeError('order_closed', 'This order is already closed');
    tx.update(ref, {
      vendorId,
      vendorName,
      updatedAt: serverTimestamp(),
      statusHistory: [...historyOf(order), historyEntry(effectiveStatus(order) || order.status, ROLES.ADMIN, adminId, `Vendor assigned: ${vendorName}`)],
    });
    return { vendorId };
  });
}

/** Admin: save the shop's coordinates + address on the order for the rider. */
export async function sharePickupLocation(db, { orderId, location, adminId = '' }) {
  const ref = doc(db, 'orders', orderId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new StatusChangeError('not_found', 'Order not found');
    const order = snap.data();
    const sharedAt = Timestamp.now();
    tx.update(ref, {
      pickupLocation: {
        lat: Number(location.lat),
        lng: Number(location.lng),
        address: location.address || '',
        name: location.name || '',
        sharedAt,
      },
      updatedAt: serverTimestamp(),
      statusHistory: [...historyOf(order), historyEntry(effectiveStatus(order) || order.status, ROLES.ADMIN, adminId, `Pickup location shared: ${location.name || 'shop'}`)],
    });
    return { sharedAt };
  });
}
