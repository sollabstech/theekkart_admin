// How the Admin Orders list groups and labels orders. Pure (no React, no
// Firebase) so the automatic tests exercise the exact code the page runs.
import {
  ORDER_STATUS, STATUS_FLOW, STATUS_LABELS, effectiveStatus, isActiveOrder, needsRider, needsVendor,
} from './orderStatus.js';

/** One tab per status (shared labels), plus the two "needs attention" filters. */
export const STATUS_TABS = [
  { key: 'all',          label: 'All' },
  { key: 'needs_vendor', label: 'Needs vendor', alert: true },
  { key: 'needs_rider',  label: 'Needs rider',  alert: true },
  { key: 'active',       label: 'In Progress' },
  ...STATUS_FLOW.map(s => ({ key: s, label: STATUS_LABELS[s] })),
  { key: ORDER_STATUS.CANCELLED, label: STATUS_LABELS[ORDER_STATUS.CANCELLED] },
];

/** Does [order] belong under tab [tab]? Uses the effective status so legacy orders land correctly. */
export function matchesTab(order, tab) {
  if (tab === 'all') return true;
  if (tab === 'needs_vendor') return needsVendor(order);
  if (tab === 'needs_rider') return needsRider(order);
  if (tab === 'active') return isActiveOrder(order) && effectiveStatus(order) !== ORDER_STATUS.RECEIVED;
  return effectiveStatus(order) === tab;
}

/**
 * Every order is listed. The vendor name comes from the order when it has
 * one, else from the vendor's own profile (shop name, else owner name), so a
 * fresh customer order already shows its shop.
 */
export function withVendorNames(orders, vendors) {
  const nameById = Object.fromEntries(vendors.map(v => [v.id, v.shopName || v.name]));
  return orders.map(o => (o.vendorName || !o.vendorId ? o : { ...o, vendorName: nameById[o.vendorId] || '' }));
}
