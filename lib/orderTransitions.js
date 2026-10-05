// Every write that changes who/where/what-state an order is goes through here.
// Each function runs in a Firestore TRANSACTION that re-reads the order, so
// two people acting at once (or a stale screen) can never corrupt it.
//
// Imports use explicit ".js" extensions and no "@/" alias so the Node test
// runner can load this file exactly as the Admin site does.
import { deleteField, doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
  ROLES, ORDER_STATUS, STATUS_LABELS, assignmentState, canChangeStatus, canRejectAssignment, effectiveStatus, isBackward, isTerminal, normalizeStatus,
} from './orderStatus.js';

export class StatusChangeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StatusChangeError';
    this.code = code; // not_found | not_yours | invalid_move | needs_confirm | reason_required | order_closed | nothing_to_accept | too_late
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

// Old orders may store a legacy spelling whose real meaning depends on there
// being no rider and no history (an old `out_for_delivery` = "ready, waiting
// for a rider"). Assigning a rider/vendor or sharing a location adds a history
// entry (and a rider), which would silently flip that meaning — so on the
// first such write the stored value is re-spelled to what it really meant.
function respelledStatus(order) {
  const effective = effectiveStatus(order);
  return effective && effective !== order.status ? { status: effective } : {};
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

    // A rider who starts working an order has accepted it.
    const implicitAccept = role === ROLES.RIDER && assignmentState(order) === 'pending';
    tx.update(ref, {
      ...extra,
      ...(implicitAccept ? { riderAcceptedSeq: Number(order.riderAssignSeq) } : {}),
      status: target,
      updatedAt: serverTimestamp(),
      statusHistory: [...historyOf(order), historyEntry(target, role, actorId)],
    });
    return { from, to: target };
  });
}

/** Admin: assign or reassign the rider. Never moves `status` (only re-spells a legacy value). */
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
      ...respelledStatus(order),
      riderId,
      riderName,
      previousRiderId: previous === riderId ? (order.previousRiderId || '') : previous,
      riderAssignSeq: seq,
      // Shop name/address (and coordinates when the shop has them) so the rider
      // app needs no lookup of the vendor's own profile.
      ...(pickup ? {
        pickupName: pickup.name || '',
        pickupAddress: pickup.address || '',
        ...(Number.isFinite(Number(pickup.lat)) && Number.isFinite(Number(pickup.lng)) && pickup.lat !== null && pickup.lng !== null
          ? { shopLat: Number(pickup.lat), shopLng: Number(pickup.lng) } : {}),
      } : {}),
      updatedAt: serverTimestamp(),
      statusHistory: [...historyOf(order), historyEntry(effectiveStatus(order) || order.status, ROLES.ADMIN, adminId, note)],
    });
    return { previousRiderId: previous, riderAssignSeq: seq };
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
      ...respelledStatus(order),
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

/** The rider says yes to an order the admin assigned (status does not change). Mirrors the Partner app. */
export async function acceptAssignment(db, { orderId, riderId }) {
  const ref = doc(db, 'orders', orderId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new StatusChangeError('not_found', 'Order not found');
    const order = snap.data();
    if ((order.riderId || '') !== riderId) throw new StatusChangeError('not_yours', 'This order is no longer assigned to you');
    const s = effectiveStatus(order);
    if (!s || isTerminal(s)) throw new StatusChangeError('order_closed', 'This order is already closed');
    if (assignmentState(order) !== 'pending') throw new StatusChangeError('nothing_to_accept', 'You have already accepted this order');
    tx.update(ref, {
      riderAcceptedSeq: Number(order.riderAssignSeq),
      riderAcceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      statusHistory: [...historyOf(order), historyEntry(s, ROLES.RIDER, riderId, 'Rider accepted')],
    });
  });
}

/** The rider turns an order down (until the pickup starts): it goes back to the admin with no rider. Mirrors the Partner app. */
export async function rejectAssignment(db, { orderId, riderId, reason }) {
  const ref = doc(db, 'orders', orderId);
  const why = String(reason ?? '').trim();
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new StatusChangeError('not_found', 'Order not found');
    const order = snap.data();
    if ((order.riderId || '') !== riderId) throw new StatusChangeError('not_yours', 'This order is no longer assigned to you');
    if (!why) throw new StatusChangeError('reason_required', 'Please give a reason for rejecting this order');
    const s = effectiveStatus(order);
    if (!s || isTerminal(s)) throw new StatusChangeError('order_closed', 'This order is already closed');
    if (!canRejectAssignment(order)) throw new StatusChangeError('too_late', 'The pickup has already started');
    const rejections = Array.isArray(order.riderRejections) ? order.riderRejections : [];
    tx.update(ref, {
      riderId: deleteField(),
      riderName: deleteField(),
      riderRejections: [...rejections, { riderId, riderName: order.riderName || '', reason: why, seq: Number(order.riderAssignSeq) || 0, at: Timestamp.now() }],
      updatedAt: serverTimestamp(),
      statusHistory: [...historyOf(order), historyEntry(s, ROLES.RIDER, riderId, `Rider rejected: ${why}`)],
    });
  });
}
