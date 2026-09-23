'use client';
import { useEffect, useState } from 'react';
import { use } from 'react';
import { getOrder, updateOrderStatus, updateOrderFields, getApprovedPartners, ORDER_STATUS, STATUS_LABELS, formatTimestamp } from '@/lib/firestore';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, MapPin, Clock, Package, CreditCard, MessageSquare, Store, Bike, ChevronDown } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

const STATUS_FLOW = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

export default function OrderDetailPage({ params }) {
  const { id } = use(params);
  const [order,    setOrder]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState(false);
  const [partners, setPartners] = useState([]);
  const [assigningVendor, setAssigningVendor] = useState(false);
  const [assigningRider,  setAssigningRider]  = useState(false);

  useEffect(() => {
    getApprovedPartners().then(setPartners);
  }, []);

  const vendors = partners.filter(p => p.role === 'vendor');
  const riders  = partners.filter(p => p.role === 'rider');

  useEffect(() => {
    getOrder(id).then(data => {
      setOrder(data);
      setLoading(false);
    });
  }, [id]);

  async function assignVendor(vendorId) {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return;
    setAssigningVendor(true);
    try {
      await updateOrderFields(id, { vendorId, vendorName: vendor.name, status: 'confirmed' });
      setOrder(prev => ({ ...prev, vendorId, vendorName: vendor.name, status: 'confirmed' }));
      toast.success(`Assigned to vendor: ${vendor.name}`);
    } catch { toast.error('Failed to assign vendor'); }
    setAssigningVendor(false);
  }

  async function assignRider(riderId) {
    const rider = riders.find(r => r.id === riderId);
    if (!rider) return;
    setAssigningRider(true);
    try {
      await updateOrderFields(id, { riderId, riderName: rider.name });
      setOrder(prev => ({ ...prev, riderId, riderName: rider.name }));
      toast.success(`Assigned to rider: ${rider.name}`);
    } catch { toast.error('Failed to assign rider'); }
    setAssigningRider(false);
  }

  async function changeStatus(newStatus) {
    setUpdating(true);
    try {
      await updateOrderStatus(id, newStatus);
      setOrder(prev => ({ ...prev, status: newStatus }));
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);

      // Push FCM notification to customer
      if (order.customerId) {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          const userSnap = await getDoc(doc(db, 'users', order.customerId));
          const fcmToken = userSnap.data()?.fcmToken;
          if (fcmToken) {
            const msgMap = {
              confirmed:        { title: '✅ Order Confirmed!',       body: 'Your order is confirmed and being prepared.' },
              preparing:        { title: '👨‍🍳 Preparing Your Order',  body: 'Our team is preparing your order.' },
              out_for_delivery: { title: '🚴 Out for Delivery!',      body: 'Your order is on the way! Get ready.' },
              delivered:        { title: '🎉 Order Delivered!',       body: 'Your order has been delivered. Enjoy!' },
              cancelled:        { title: '❌ Order Cancelled',         body: 'Your order has been cancelled. Contact us for help.' },
            };
            const msg = msgMap[newStatus];
            if (msg) {
              await fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: fcmToken, ...msg }),
              });
            }
          }
        } catch (_) {}
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
    setUpdating(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading order…</div>
  );
  if (!order) return (
    <div className="text-center py-16 text-gray-400">Order not found</div>
  );

  const currentStatusIdx = STATUS_FLOW.indexOf(order.status);

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
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>
        </div>

        {/* Status stepper */}
        {order.status !== ORDER_STATUS.CANCELLED && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">Update Status</h3>
            <div className="flex gap-2 flex-wrap">
              {STATUS_FLOW.map((s, i) => (
                <button
                  key={s}
                  disabled={updating || i <= currentStatusIdx}
                  onClick={() => changeStatus(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                    i < currentStatusIdx
                      ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-default'
                      : i === currentStatusIdx
                        ? 'bg-orange-500 text-white border-orange-500 cursor-default'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
              <button
                disabled={updating || order.status === ORDER_STATUS.CANCELLED || order.status === ORDER_STATUS.DELIVERED}
                onClick={() => changeStatus(ORDER_STATUS.CANCELLED)}
                className="px-4 py-2 rounded-xl text-sm font-medium border bg-white text-red-500 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-default"
              >
                Cancel Order
              </button>
            </div>
          </div>
        )}

        {/* Vendor & Rider assignment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Vendor */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Store size={16} className="text-orange-500" />
              <h3 className="font-semibold text-gray-800">Vendor</h3>
            </div>
            {order.vendorName ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{order.vendorName}</p>
                  <p className="text-xs text-gray-400">Handling this order</p>
                </div>
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-semibold">Assigned</span>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mb-3">No vendor assigned yet</p>
            )}
            {vendors.length > 0 && (
              <div className="relative mt-3">
                <select
                  disabled={assigningVendor}
                  defaultValue=""
                  onChange={e => e.target.value && assignVendor(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">— {order.vendorName ? 'Reassign vendor' : 'Assign vendor'} —</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} · {v.area || 'No area'}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
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
                  <p className="text-xs text-gray-400">Assigned for delivery</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-semibold">Assigned</span>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mb-3">No rider assigned yet</p>
            )}
            {riders.length > 0 && (
              <div className="relative mt-3">
                <select
                  disabled={assigningRider}
                  defaultValue=""
                  onChange={e => e.target.value && assignRider(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">— {order.riderName ? 'Reassign rider' : 'Assign rider'} —</option>
                  {riders.map(r => (
                    <option key={r.id} value={r.id}>{r.name} · {r.area || 'No area'}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>
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
                  <p className="text-sm text-gray-700">{order.address?.address}</p>
                  {order.address?.landmark && (
                    <p className="text-xs text-gray-400">Landmark: {order.address.landmark}</p>
                  )}
                  {order.address?.pincode && (
                    <p className="text-xs text-gray-400">PIN: {order.address.pincode}</p>
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
      </div>
    </>
  );
}
