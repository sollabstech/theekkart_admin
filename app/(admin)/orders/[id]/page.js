'use client';
import { useEffect, useMemo, useState } from 'react';
import { use } from 'react';
import { listenToOrder, listenToPartnersByRole, listenToRiderLocations, formatTimestamp } from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { getAdminUser } from '@/lib/auth';
import {
  ORDER_STATUS, STATUS_FLOW, STATUS_LABELS, ROLES, assignmentState, effectiveStatus, isBackward, isTerminal, needsRider,
} from '@/lib/orderStatus';
import { changeOrderStatus, assignRider as assignRiderTx, sharePickupLocation } from '@/lib/orderTransitions';
import {
  agoText, customerCoords, distanceKm, formatDistance, pickupCoords, shopCoords, STALE_AFTER_MS, toMillis, addressParts,
} from '@/lib/geo';
import { triggerOrderEvent } from '@/app/actions/orderEvents';
import StatusBadge from '@/components/StatusBadge';
import LiveMap from '@/components/LiveMap';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, MapPin, Clock, Package, CreditCard, MessageSquare, Store, Bike, ChevronDown, Navigation, History } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

export default function OrderDetailPage({ params }) {
  const { id } = use(params);
  const [order,    setOrder]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState(false);
  const [vendors,  setVendors]  = useState([]);
  const [riders,   setRiders]   = useState([]);
  const [riderLocs, setRiderLocs] = useState({});
  const [assigningRider,  setAssigningRider]  = useState(false);
  const [sharing,  setSharing]  = useState(false);
  const [now,      setNow]      = useState(() => Date.now());

  // Everything on this page is LIVE: the order, the partner lists (rider
  // Online/Offline) and rider GPS — a status change made on a phone shows up
  // here without a refresh.
  useEffect(() => {
    const unsubOrder = listenToOrder(
      id,
      data => { setOrder(data); setLoading(false); },
      () => { setLoading(false); toast.error('Lost connection to the order — retrying…'); }
    );
    const unsubV = listenToPartnersByRole('vendor', list => setVendors(list.filter(p => p.status === 'approved')));
    const unsubR = listenToPartnersByRole('rider',  list => setRiders(list.filter(p => p.status === 'approved')));
    const unsubL = listenToRiderLocations(setRiderLocs);
    const tick = setInterval(() => setNow(Date.now()), 10000);
    return () => { unsubOrder(); unsubV(); unsubR(); unsubL(); clearInterval(tick); };
  }, [id]);

  const adminId = getAdminUser();
  const rejections = Array.isArray(order?.riderRejections) ? order.riderRejections : [];
  const rejectedBy = new Set(rejections.map(r => r.riderId));
  const answer = assignmentState(order);
  const vendorDoc = useMemo(() => vendors.find(v => v.id === order?.vendorId) || null, [vendors, order?.vendorId]);
  const vendorLabel = order?.vendorName || vendorDoc?.shopName || vendorDoc?.name || '';
  const shopPoint = shopCoords(vendorDoc) || pickupCoords(order);

  // Riders sorted: online first, then nearest to the shop.
  const riderOptions = useMemo(() => {
    return riders.map(r => {
      const loc = riderLocs[r.id];
      const km = loc && shopPoint ? distanceKm(shopPoint, { lat: Number(loc.lat), lng: Number(loc.lng) }) : null;
      return { ...r, km, online: r.available !== false, rejected: rejectedBy.has(r.id) };
    }).sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (a.km !== null && b.km !== null) return a.km - b.km;
      if (a.km !== null) return -1;
      if (b.km !== null) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [riders, riderLocs, shopPoint, order?.riderRejections]);

  const nameFor = (role, byId) => {
    if (role === ROLES.ADMIN) return byId || 'Admin';
    const list = role === ROLES.VENDOR ? vendors : riders;
    const p = list.find(x => x.id === byId);
    return p ? (p.shopName || p.name) : '';
  };

  async function afterChange(events) {
    // Notifications run in the background; they never block or fail the change.
    events.forEach(ev => triggerOrderEvent(id, ev).catch(() => {}));
  }

  async function changeStatus(newStatus) {
    const from = effectiveStatus(order);
    let extra = {};
    if (newStatus === ORDER_STATUS.CANCELLED) {
      const reason = window.prompt('Cancel this order? Enter a reason (optional) and press OK.', '');
      if (reason === null) return;
      if (reason.trim()) extra = { rejectReason: reason.trim() };
    } else if (isBackward(from, newStatus)) {
      const ok = window.confirm(`Move this order BACK from "${STATUS_LABELS[from]}" to "${STATUS_LABELS[newStatus]}"?\n\nThe customer, shop and rider will see the earlier status.`);
      if (!ok) return;
    }
    setUpdating(true);
    try {
      await changeOrderStatus(db, { orderId: id, to: newStatus, role: ROLES.ADMIN, actorId: adminId, extra, allowBackward: true });
      afterChange(['status_changed']);
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      toast.error(err?.message || 'Failed to update status');
    }
    setUpdating(false);
  }

  async function assignRider(riderId) {
    const rider = riders.find(r => r.id === riderId);
    if (!rider) return;
    setAssigningRider(true);
    try {
      const pickup = vendorLabel
        ? { name: vendorLabel, address: vendorDoc?.shopAddress || vendorDoc?.address || order.pickupAddress || '', lat: shopPoint?.lat ?? null, lng: shopPoint?.lng ?? null }
        : null;
      await assignRiderTx(db, { orderId: id, riderId, riderName: rider.name, adminId, pickup });
      afterChange(['rider_assigned']);
      toast.success(`Assigned to rider: ${rider.name}`);
    } catch (err) { toast.error(err?.message || 'Failed to assign rider'); }
    setAssigningRider(false);
  }

  async function sendShopLocation() {
    if (!shopPoint) return;
    setSharing(true);
    try {
      await sharePickupLocation(db, {
        orderId: id,
        location: { lat: shopPoint.lat, lng: shopPoint.lng, address: vendorDoc?.shopAddress || vendorDoc?.address || order.pickupAddress || '', name: vendorLabel },
        adminId,
      });
      afterChange(['pickup_location_shared']);
      toast.success('Shop location sent to the rider');
    } catch (err) { toast.error(err?.message || 'Failed to send location'); }
    setSharing(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading order…</div>
  );
  if (!order) return (
    <div className="text-center py-16 text-gray-400">Order not found</div>
  );

  const current = effectiveStatus(order);
  const currentIdx = STATUS_FLOW.indexOf(current);
  const closed = isTerminal(order.status);
  const addr = addressParts(order);

  // History timeline (oldest → newest). Orders placed before the new flow have
  // no first "received" entry, so one is synthesised from createdAt.
  const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const timeline = [
    ...(history[0]?.status === ORDER_STATUS.RECEIVED ? [] : [{ status: ORDER_STATUS.RECEIVED, by: 'customer', at: order.createdAt, note: 'Order placed' }]),
    ...history,
  ];

  // Map markers: shop, customer, and the assigned rider's live position.
  const loc = order.riderId ? riderLocs[order.riderId] : null;
  const riderStale = loc ? now - toMillis(loc.updatedAt) > STALE_AFTER_MS : false;
  const customerPoint = customerCoords(order);
  const markers = [];
  if (shopPoint) markers.push({ id: 'shop', kind: 'shop', ...shopPoint, label: vendorLabel || 'Shop', popup: [vendorLabel || 'Shop', order.pickupAddress || vendorDoc?.shopAddress || ''] });
  if (customerPoint) markers.push({ id: 'customer', kind: 'customer', ...customerPoint, label: 'Customer', popup: [order.customerName || 'Customer', addr.text] });
  if (loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng))) {
    markers.push({
      id: 'rider', kind: riderStale ? 'rider-stale' : 'rider', lat: Number(loc.lat), lng: Number(loc.lng),
      label: order.riderName || 'Rider',
      popup: [order.riderName || 'Rider', `Updated ${agoText(loc.updatedAt, now)}`],
    });
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Back */}
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={16} /> Back to Orders
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Order #{order.orderNumber || id.slice(-6).toUpperCase()}
              </h2>
              <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                <Clock size={13} /> {formatTimestamp(order.createdAt)}
                <span className="mx-1">·</span> Updated {agoText(order.updatedAt || order.createdAt, now)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {needsRider(order) && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">Needs rider</span>}
              <StatusBadge order={order} />
            </div>
          </div>
          {order.status === ORDER_STATUS.CANCELLED && order.rejectReason && (
            <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-700 mb-0.5">Reason</p>
              <p className="text-sm text-red-600">{order.rejectReason}</p>
            </div>
          )}
        </div>

        {/* Status stepper */}
        {order.status !== ORDER_STATUS.CANCELLED && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">Update Status</h3>
            <div className="flex gap-2 flex-wrap">
              {STATUS_FLOW.map((s, i) => (
                <button
                  key={s}
                  disabled={updating || i === currentIdx}
                  onClick={() => changeStatus(s)}
                  title={i < currentIdx ? 'Move the order back (asks to confirm)' : undefined}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                    i < currentIdx
                      ? 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                      : i === currentIdx
                        ? 'bg-orange-500 text-white border-orange-500 cursor-default'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
              <button
                disabled={updating || closed}
                onClick={() => changeStatus(ORDER_STATUS.CANCELLED)}
                className="px-4 py-2 rounded-xl text-sm font-medium border bg-white text-red-500 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-default"
              >
                Cancel Order
              </button>
            </div>
          </div>
        )}

        {/* Store (chosen by the customer) & Rider assignment (the admin's only assignment) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Vendor */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Store size={16} className="text-orange-500" />
              <h3 className="font-semibold text-gray-800">Vendor</h3>
            </div>
            {vendorLabel ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{vendorLabel}</p>
                  <p className="text-xs text-gray-400">Chosen by the customer</p>
                </div>
                {vendorDoc?.rating > 0 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">★ {Number(vendorDoc.rating).toFixed(1)}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No shop recorded on this order</p>
            )}
          </div>

          {/* Rider */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Bike size={16} className="text-blue-500" />
              <h3 className="font-semibold text-gray-800">Delivery Rider</h3>
            </div>
            {order.riderName ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{order.riderName}</p>
                  <p className="text-xs text-gray-400">
                    {answer === 'pending' ? 'Waiting for the rider to accept' : 'Assigned for delivery'}{loc ? ` · location ${agoText(loc.updatedAt, now)}` : ''}
                  </p>
                </div>
                {answer === 'pending'
                  ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">Awaiting answer</span>
                  : <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">Accepted</span>}
              </div>
            ) : (
              <p className={`text-sm mb-3 ${needsRider(order) ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                {needsRider(order) ? 'Needs rider — order is ready for pickup' : 'No rider assigned yet'}
              </p>
            )}
            {rejections.length > 0 && (
              <div className="mt-2 space-y-1">
                {rejections.map((r, i) => (
                  <p key={i} className="text-xs text-red-500">
                    ✖ {r.riderName || 'A rider'} rejected{r.reason ? `: ${r.reason}` : ''}{r.at ? ` · ${agoText(r.at, now)}` : ''}
                  </p>
                ))}
              </div>
            )}
            {riderOptions.length > 0 && !closed && (
              <div className="relative mt-3">
                <select
                  disabled={assigningRider}
                  value=""
                  onChange={e => e.target.value && assignRider(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">— {order.riderName ? 'Reassign rider' : 'Assign rider'} —</option>
                  {riderOptions.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.online ? '🟢 Online' : '⚪ Offline'} · {r.name} · {r.area || 'No area'}
                      {r.km !== null ? ` · ${formatDistance(r.km)} from shop` : ''}
                      {r.rejected ? ' · rejected this order' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Send the shop's location to the assigned rider */}
            {order.riderId && !closed && (
              <div className="mt-3">
                <button
                  onClick={sendShopLocation}
                  disabled={sharing || !shopPoint}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Navigation size={14} /> {sharing ? 'Sending…' : 'Send shop location to rider'}
                </button>
                {!shopPoint && (
                  <p className="text-xs text-gray-400 mt-1.5">This shop has no saved location yet — add it on the vendor&apos;s page.</p>
                )}
                {order.pickupLocation?.sharedAt && (
                  <p className="text-xs text-green-600 mt-1.5">Shared with the rider {agoText(order.pickupLocation.sharedAt, now)}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live map: shop, customer and the rider */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <MapPin size={16} className="text-orange-500" /> Live Map
          </h3>
          {markers.length > 0 ? (
            <>
              <LiveMap markers={markers} height={320} fitKey={`${id}:${markers.map(m => m.id).join(',')}`} />
              <p className="text-xs text-gray-400 mt-2">
                🏪 shop · 🏠 customer · 🛵 rider{riderStale ? ' (grey = no update for over 2 minutes)' : ''}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">No locations to show yet — the shop location, the customer&apos;s pin and the rider&apos;s GPS appear here once they are known.</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Customer info */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-semibold text-gray-800">Customer Details</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">{order.customerName || '—'}</p>
                  <p className="text-sm text-gray-500">{order.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-700">{addr.text}</p>
                  {addr.landmark && (
                    <p className="text-xs text-gray-400">Landmark: {addr.landmark}</p>
                  )}
                  {addr.pincode && (
                    <p className="text-xs text-gray-400">PIN: {addr.pincode}</p>
                  )}
                </div>
              </div>
              {order.notes && (
                <div className="flex items-start gap-3">
                  <MessageSquare size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-600 italic">"{order.notes}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-semibold text-gray-800">Payment</h3>
            <div className="flex items-center gap-3">
              <CreditCard size={16} className="text-orange-500" />
              <span className="font-medium text-gray-800">
                {order.paymentMethod === 'upi' ? 'UPI / Manual Payment' : 'Cash on Delivery'}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>₹{(order.subtotal ?? (order.total - (order.deliveryFee ?? 30) + (order.discount ?? 0)))?.toLocaleString('en-IN') || 0}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Delivery Fee</span>
                <span>₹{(order.deliveryFee ?? 30).toLocaleString('en-IN')}</span>
              </div>
              {(order.discount > 0) && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-₹{order.discount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span>₹{order.total?.toLocaleString('en-IN') || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order items */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Package size={18} className="text-orange-500" />
            Order Items ({(order.items || []).length})
          </h3>
          <div className="space-y-3">
            {(order.items || []).map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.unit} × {item.quantity}</p>
                </div>
                <p className="font-semibold text-gray-800">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Status history */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <History size={18} className="text-orange-500" /> Status History
          </h3>
          <ol className="relative border-l border-gray-200 ml-2 space-y-4">
            {timeline.map((h, i) => {
              const who = h.by === 'customer' ? 'Customer' : [h.by, nameFor(h.by, h.byId)].filter(Boolean).join(' · ');
              return (
                <li key={i} className="ml-4">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-orange-400 border-2 border-white" />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={h.status} />
                    <span className="text-xs text-gray-400">{formatTimestamp(h.at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {who}{h.note ? ` — ${h.note}` : ''}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </>
  );
}
