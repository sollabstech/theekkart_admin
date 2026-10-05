// What needs the admin's attention, computed from the live collections.
// Pure (no Firebase / React) so the automatic tests run the exact same code.
import { ORDER_STATUS, effectiveStatus, needsRider } from './orderStatus.js';

const isPending = x => !x?.status || x.status === 'pending';

/**
 * Counts for the sidebar badges and the bell.
 *  - newOrders:   orders still at "Order Received" (nobody has accepted yet)
 *  - needsRider:  ready for pickup with no rider
 *  - ordersTotal: orders needing a look = distinct orders that are new OR need a rider
 *  - requests:    pending "Ask TheekKart" requests + pending issue reports
 *  - services:    pending home-service requests
 */
export function computeAttention({ orders = [], requests = [], issues = [], serviceRequests = [] } = {}) {
  let newOrders = 0, rider = 0, total = 0;
  for (const o of orders) {
    const isNew = effectiveStatus(o) === ORDER_STATUS.RECEIVED;
    const nr = needsRider(o);
    if (isNew) newOrders++;
    if (nr) rider++;
    if (isNew || nr) total++;
  }
  return {
    ordersTotal: total,
    newOrders,
    needsRider: rider,
    requests: requests.filter(isPending).length + issues.filter(isPending).length,
    services: serviceRequests.filter(isPending).length,
  };
}
