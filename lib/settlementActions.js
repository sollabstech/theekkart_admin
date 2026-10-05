// Writing a settlement: ONE Firestore transaction that re-reads every order,
// refuses anything already settled / not delivered / not this vendor's, creates
// the settlement record and stamps the orders with its id. Two admins clicking
// "Mark settled" at once can never pay the same orders twice.
import { collection, doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { buildSettlement, isDelivered, isSettled, MAX_ORDERS_PER_SETTLEMENT, parsePercent } from './settlement.js';

export class SettlementError extends Error {
  constructor(code, message) { super(message); this.name = 'SettlementError'; this.code = code; } // nothing_to_settle | too_many | bad_percent | vendor_missing
}

/**
 * @returns {{settlementId:string, settlement:object, skipped:string[]}} `skipped` = orders that were already settled/changed and left out
 */
export async function settleVendor(db, { vendor, orderIds, percent, adminId = '', note = '', reference = '' }) {
  const pct = parsePercent(percent);
  if (pct === null) throw new SettlementError('bad_percent', 'Commission % must be between 0 and 100');
  if (!vendor?.id) throw new SettlementError('vendor_missing', 'Vendor not found');
  const ids = [...new Set(orderIds)];
  if (ids.length === 0) throw new SettlementError('nothing_to_settle', 'There are no orders to settle');
  if (ids.length > MAX_ORDERS_PER_SETTLEMENT) {
    throw new SettlementError('too_many', `Settle at most ${MAX_ORDERS_PER_SETTLEMENT} orders at a time — choose a shorter period`);
  }

  const settlementRef = doc(collection(db, 'settlements'));
  return runTransaction(db, async tx => {
    const snaps = await Promise.all(ids.map(id => tx.get(doc(db, 'orders', id))));
    const good = [];
    const skipped = [];
    snaps.forEach((s, i) => {
      const o = s.exists() ? { id: ids[i], ...s.data() } : null;
      if (o && o.vendorId === vendor.id && isDelivered(o) && !isSettled(o)) good.push(o); else skipped.push(ids[i]);
    });
    if (good.length === 0) throw new SettlementError('nothing_to_settle', 'These orders were already settled');

    const s = buildSettlement({ vendor, orders: good, percent: pct, adminId, note, reference });
    const { periodFromMs, periodToMs, ...rest } = s;
    tx.set(settlementRef, {
      ...rest,
      periodFrom: Timestamp.fromMillis(periodFromMs || Date.now()),
      periodTo: Timestamp.fromMillis(periodToMs || Date.now()),
      settledAt: serverTimestamp(),
    });
    for (const o of good) {
      tx.update(doc(db, 'orders', o.id), { settlementId: settlementRef.id, settledAt: serverTimestamp() });
    }
    return { settlementId: settlementRef.id, settlement: s, skipped };
  });
}
