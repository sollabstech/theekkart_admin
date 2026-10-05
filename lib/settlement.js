// Vendor settlement: what a shop sold, the platform's commission, and what is
// paid out. Pure functions (tested) — the Admin page and the end-to-end tests
// run the same code.
//
//   sales      = the items' value of DELIVERED orders (delivery fee is not the shop's money)
//   commission = sales × commission %   (global default, or the vendor's own %)
//   payable    = sales − commission     (what the admin pays the vendor)
import { ORDER_STATUS, effectiveStatus } from './orderStatus.js';

export const DEFAULT_COMMISSION_PERCENT = 10;
export const MAX_ORDERS_PER_SETTLEMENT = 450; // one Firestore transaction (500 writes) minus headroom

export const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const toMs = ts => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** What the shop earned from this order: the items, not the delivery fee. */
export function orderSales(order) {
  if (Number.isFinite(Number(order?.subtotal)) && order.subtotal !== null && order.subtotal !== '') return round2(order.subtotal);
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length) {
    const sum = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity ?? i.qty) || 1), 0);
    if (sum > 0) return round2(sum);
  }
  const fee = Number.isFinite(Number(order?.deliveryFee)) ? Number(order.deliveryFee) : 0;
  return round2(Math.max(0, (Number(order?.total) || 0) - fee + (Number(order?.discount) || 0)));
}

/** When the order was delivered: the history entry, else updatedAt, else createdAt. */
export function deliveredAtMs(order) {
  const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.status === ORDER_STATUS.DELIVERED) {
      const ms = toMs(history[i].at);
      if (ms) return ms;
    }
  }
  return toMs(order?.updatedAt) || toMs(order?.createdAt);
}

export const isDelivered = order => effectiveStatus(order) === ORDER_STATUS.DELIVERED;
export const isSettled = order => !!order?.settlementId;

/** A commission % from user input: 0–100, or null if invalid. */
export function parsePercent(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? round2(n) : null;
}

/** The % that applies to a vendor: their own if set, else the default. */
export function percentFor(vendor, defaultPercent = DEFAULT_COMMISSION_PERCENT) {
  const own = parsePercent(vendor?.commissionPercent);
  return own !== null ? own : (parsePercent(defaultPercent) ?? DEFAULT_COMMISSION_PERCENT);
}

/** commission and payable for a sales total. Rounded to paise; they always add up to the sales. */
export function split(sales, percent) {
  const gross = round2(sales);
  const commission = round2(gross * (Number(percent) / 100));
  return { gross, commission, payable: round2(gross - commission) };
}

/**
 * [startMs, endMs) for a named period, in the viewer's local time.
 * kinds: today | yesterday | week (last 7 days incl. today) | month (this calendar month) | all | custom
 */
export function periodRange(kind, now = new Date(), custom = {}) {
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const day = 86400000;
  const today = startOfDay(now);
  switch (kind) {
    case 'today': return [today, today + day];
    case 'yesterday': return [today - day, today];
    case 'week': return [today - 6 * day, today + day];
    case 'month': return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];
    case 'custom': {
      const parse = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
      const from = parse(custom.from);
      const to = parse(custom.to);
      return [from ?? 0, to != null ? to + day : Infinity];
    }
    default: return [0, Infinity]; // all
  }
}

/**
 * One row per vendor with unsettled delivered orders in [range].
 * Orders without a vendor (or an unknown vendor) are not settled to anyone.
 */
export function summarizeSettlements({ orders = [], vendors = [], defaultPercent = DEFAULT_COMMISSION_PERCENT, range = [0, Infinity] }) {
  const byVendor = new Map(vendors.map(v => [v.id, v]));
  const rows = new Map();
  for (const o of orders) {
    if (!o.vendorId || !isDelivered(o) || isSettled(o)) continue;
    const at = deliveredAtMs(o);
    if (at < range[0] || at >= range[1]) continue;
    const vendor = byVendor.get(o.vendorId) || { id: o.vendorId, name: o.vendorName || 'Unknown vendor' };
    if (!rows.has(o.vendorId)) rows.set(o.vendorId, { vendor, orders: [], sales: 0 });
    const r = rows.get(o.vendorId);
    r.orders.push(o);
    r.sales += orderSales(o);
  }
  const out = [...rows.values()].map(r => {
    const percent = percentFor(r.vendor, defaultPercent);
    return { ...r, count: r.orders.length, percent, ...split(r.sales, percent) };
  });
  out.sort((a, b) => b.payable - a.payable);
  const totals = out.reduce((t, r) => ({
    orders: t.orders + r.count, gross: round2(t.gross + r.gross), commission: round2(t.commission + r.commission), payable: round2(t.payable + r.payable),
  }), { orders: 0, gross: 0, commission: 0, payable: 0 });
  return { rows: out, totals };
}

/** The settlement document for a set of orders (numbers recomputed from the orders themselves). */
export function buildSettlement({ vendor, orders, percent, adminId = '', note = '', reference = '' }) {
  const sales = orders.reduce((s, o) => s + orderSales(o), 0);
  const parts = split(sales, percent);
  const times = orders.map(deliveredAtMs).filter(Boolean);
  return {
    vendorId: vendor.id,
    vendorName: vendor.shopName || vendor.name || '',
    orderIds: orders.map(o => o.id),
    orderCount: orders.length,
    gross: parts.gross,
    commissionPercent: round2(percent),
    commission: parts.commission,
    payable: parts.payable,
    periodFromMs: times.length ? Math.min(...times) : 0,
    periodToMs: times.length ? Math.max(...times) : 0,
    note: String(note).trim(),
    reference: String(reference).trim(),
    settledBy: adminId,
    status: 'paid',
  };
}
