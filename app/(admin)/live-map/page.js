'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listenToOrders, listenToPartnersByRole, listenToRiderLocations } from '@/lib/firestore';
import { isActiveOrder, statusLabel } from '@/lib/orderStatus';
import { agoText, isPoint, STALE_AFTER_MS, toMillis } from '@/lib/geo';
import LiveMap from '@/components/LiveMap';
import { Bike, LocateFixed } from 'lucide-react';

// Live riders map (Leaflet + OpenStreetMap). Markers MOVE as riders' phones
// write rider_locations/{riderId}; a rider with no update for 2 minutes turns grey.
export default function LiveMapPage() {
  const [riders, setRiders] = useState([]);
  const [locs, setLocs] = useState({});
  const [orders, setOrders] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [fitCount, setFitCount] = useState(0);

  useEffect(() => {
    const unsubR = listenToPartnersByRole('rider', list => setRiders(list.filter(r => r.status === 'approved')));
    const unsubL = listenToRiderLocations(setLocs);
    const unsubO = listenToOrders(setOrders);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => { unsubR(); unsubL(); unsubO(); clearInterval(tick); };
  }, []);

  const rows = useMemo(() => {
    return riders.map(r => {
      const loc = locs[r.id];
      const point = loc && isPoint({ lat: Number(loc.lat), lng: Number(loc.lng) }) ? { lat: Number(loc.lat), lng: Number(loc.lng) } : null;
      const order = orders.find(o => o.riderId === r.id && isActiveOrder(o)) || null;
      const stale = !loc || now - toMillis(loc.updatedAt) > STALE_AFTER_MS;
      return { rider: r, loc, point, order, stale, online: r.available !== false };
    });
  }, [riders, locs, orders, now]);

  const markers = useMemo(() => rows.filter(r => r.point).map(r => ({
    id: r.rider.id,
    kind: r.stale ? 'rider-stale' : 'rider',
    ...r.point,
    label: r.rider.name,
    popup: [
      r.rider.name,
      r.order ? `Order #${r.order.orderNumber || r.order.id.slice(-6).toUpperCase()} · ${statusLabel(r.order)}` : 'No active order',
      `Updated ${agoText(r.loc.updatedAt, now)}`,
    ],
  })), [rows, now]);

  const live = rows.filter(r => r.point && !r.stale).length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Bike size={16} className="text-blue-500" /> Riders on the map</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {live} live · {rows.length} rider{rows.length !== 1 ? 's' : ''} · grey = no update for over 2 minutes
            </p>
          </div>
          <button onClick={() => setFitCount(c => c + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
            <LocateFixed size={14} /> Show all
          </button>
        </div>
        <LiveMap markers={markers} height={460} fitKey={`riders:${fitCount}`} />
        {markers.length === 0 && (
          <p className="text-sm text-gray-400 mt-3">No rider has shared a location yet. A rider appears here once they go Online in the Partner app and allow location.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3">Rider</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">Current order</th>
              <th className="text-left px-5 py-3">Last location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No approved riders yet</td></tr>
            )}
            {rows.map(({ rider, loc, order, stale, online }) => (
              <tr key={rider.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-800">{rider.name}<div className="text-xs text-gray-400 font-normal">{rider.area || ''}</div></td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {online ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs">
                  {order
                    ? <Link href={`/orders/${order.id}`} className="text-orange-500 hover:underline">#{order.orderNumber || order.id.slice(-6).toUpperCase()} · {statusLabel(order)}</Link>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-5 py-3 text-xs ${loc && !stale ? 'text-green-600' : 'text-gray-400'}`}>
                  {loc ? agoText(loc.updatedAt, now) : 'No location yet'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
