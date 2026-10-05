// ONE shared list of order statuses for the Admin site and the order-event
// route (the Customer and Partner apps mirror it in their own
// order_status.dart). Keep values/labels/transition rules ONLY here — screens
// and API code import from this file.
//
// Pure module: no imports, safe to load in the browser, on the server and in
// the Node test runner.

export const ORDER_STATUS = {
  RECEIVED: 'received',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  GOING_TO_PICKUP: 'going_to_pickup',
  PICKED_UP: 'picked_up',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

/** Forward order of the delivery flow (cancelled sits outside it). */
export const STATUS_FLOW = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY_FOR_PICKUP,
  ORDER_STATUS.GOING_TO_PICKUP,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

export const STATUS_LABELS = {
  received: 'Order Received',
  confirmed: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  going_to_pickup: 'Pickup in Progress',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS = {
  received: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-yellow-100 text-yellow-700',
  preparing: 'bg-orange-100 text-orange-700',
  ready_for_pickup: 'bg-teal-100 text-teal-700',
  going_to_pickup: 'bg-cyan-100 text-cyan-700',
  picked_up: 'bg-indigo-100 text-indigo-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const ROLES = { VENDOR: 'vendor', RIDER: 'rider', ADMIN: 'admin' };

// Other spellings that may exist in old data, mapped to the nearest value.
const LEGACY_ALIASES = {
  new: 'received',
  pending: 'received',
  placed: 'received',
  accepted: 'confirmed',
  ready: 'ready_for_pickup',
  pickup_in_progress: 'going_to_pickup',
  on_the_way: 'out_for_delivery',
  ontheway: 'out_for_delivery',
  shipped: 'out_for_delivery',
  completed: 'delivered',
  complete: 'delivered',
  canceled: 'cancelled',
  rejected: 'cancelled',
};

/** A known status value for [raw], or null if it can't be recognised. */
export function normalizeStatus(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (STATUS_LABELS[s]) return s;
  return LEGACY_ALIASES[s] || null;
}

function hasHistory(order) {
  return Array.isArray(order?.statusHistory) && order.statusHistory.length > 0;
}

/**
 * The status to treat an order as being in. Old orders used
 * `out_for_delivery` for "shop marked ready, waiting for a rider": with no
 * rider and no statusHistory (i.e. written before the new flow) that is shown
 * as Ready for Pickup. Everything else keeps its own value. Null if unknown.
 */
export function effectiveStatus(order) {
  const s = normalizeStatus(order?.status);
  if (!s) return null;
  if (s === ORDER_STATUS.OUT_FOR_DELIVERY && !order?.riderId && !hasHistory(order)) {
    return ORDER_STATUS.READY_FOR_PICKUP;
  }
  return s;
}

/** Label to show for [order] — never blank, even for unrecognised values. */
export function statusLabel(order) {
  const s = effectiveStatus(order);
  if (s) return STATUS_LABELS[s];
  const raw = String(order?.status ?? '').trim();
  return raw ? raw.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : 'Unknown';
}

export function statusColor(order) {
  const s = effectiveStatus(order);
  return (s && STATUS_COLORS[s]) || 'bg-gray-100 text-gray-600';
}

/** Position in the forward flow, or -1 for cancelled / unknown. */
export function statusRank(status) {
  return STATUS_FLOW.indexOf(normalizeStatus(status));
}

export function isTerminal(status) {
  const s = normalizeStatus(status);
  return s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.CANCELLED;
}

export function isBackward(from, to) {
  const f = statusRank(from);
  const t = statusRank(to);
  return f >= 0 && t >= 0 && t < f;
}

/**
 * THE transition rule — every status button in the Admin site uses this (the
 * Partner app has the identical function; tests prove they agree).
 *
 *  - Nobody can "change" to the same status.
 *  - Admin: any status, including cancel (the UI asks to confirm a backward
 *    move).
 *  - Vendor: forward steps only up to Ready for Pickup (Accepted → Preparing →
 *    Ready for Pickup); can reject/cancel only before Ready. Picked Up, Out
 *    for Delivery and Delivered are the rider's (or the admin's) job.
 *  - Rider: forward steps going_to_pickup → picked_up → out_for_delivery →
 *    delivered, and only once the order is Ready for Pickup or later.
 */
export function canChangeStatus(role, from, to) {
  const f = normalizeStatus(from);
  const t = normalizeStatus(to);
  if (!t || f === t) return false;
  if (role === ROLES.ADMIN) return true;
  if (!f || isTerminal(f)) return false;
  const fromRank = STATUS_FLOW.indexOf(f);
  const readyRank = STATUS_FLOW.indexOf(ORDER_STATUS.READY_FOR_PICKUP);
  if (role === ROLES.VENDOR) {
    if (t === ORDER_STATUS.CANCELLED) return fromRank < readyRank;
    const toRank = STATUS_FLOW.indexOf(t);
    return toRank > fromRank && toRank <= readyRank;
  }
  if (role === ROLES.RIDER) {
    const riderSteps = [ORDER_STATUS.GOING_TO_PICKUP, ORDER_STATUS.PICKED_UP, ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED];
    return riderSteps.includes(t) && STATUS_FLOW.indexOf(t) > fromRank && fromRank >= readyRank;
  }
  return false;
}

/** Statuses [role] may move an order in [from] to, in flow order. */
export function allowedNextStatuses(role, from) {
  return [...STATUS_FLOW, ORDER_STATUS.CANCELLED].filter(s => canChangeStatus(role, from, s));
}

/** True while an order is still being worked on (not delivered/cancelled). */
export function isActiveOrder(order) {
  const s = effectiveStatus(order);
  return !!s && s !== ORDER_STATUS.DELIVERED && s !== ORDER_STATUS.CANCELLED;
}

/** Ready for pickup and nobody assigned to deliver it yet. */
export function needsRider(order) {
  return effectiveStatus(order) === ORDER_STATUS.READY_FOR_PICKUP && !order?.riderId;
}

/** A live order that no shop has been attached to (manual / admin-created orders). */
export function needsVendor(order) {
  return isActiveOrder(order) && !order?.vendorId;
}

/**
 * Where a rider stands with the order the admin assigned to them (same rule as
 * the Partner app's assignmentState; tests/fixtures/assignment_cases.json).
 *  none     — no rider on the order
 *  pending  — assigned, the rider has not answered yet
 *  accepted — accepted, or started the pickup, or assigned before accepting existed
 */
export function assignmentState(order) {
  if (!order?.riderId) return 'none';
  const s = effectiveStatus(order);
  if (!s || isTerminal(s)) return 'accepted';
  if (STATUS_FLOW.indexOf(s) >= STATUS_FLOW.indexOf(ORDER_STATUS.GOING_TO_PICKUP)) return 'accepted';
  const seq = Number(order.riderAssignSeq);
  if (!(seq > 0)) return 'accepted';
  return Number(order.riderAcceptedSeq) >= seq ? 'accepted' : 'pending';
}

/** A rider may turn an order down until the pickup has started. */
export function canRejectAssignment(order) {
  if (!order?.riderId) return false;
  const s = effectiveStatus(order);
  if (!s || isTerminal(s)) return false;
  return STATUS_FLOW.indexOf(s) < STATUS_FLOW.indexOf(ORDER_STATUS.GOING_TO_PICKUP);
}
