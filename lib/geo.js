// Small map/location helpers shared by the Admin pages. Pure functions only.

const EARTH_KM = 6371;
const rad = d => (d * Math.PI) / 180;

/** Straight-line distance in km between two {lat,lng} points, or null. */
export function distanceKm(a, b) {
  if (!isPoint(a) || !isPoint(b)) return null;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export function isPoint(p) {
  return !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && !(Number(p.lat) === 0 && Number(p.lng) === 0);
}

export function formatDistance(km) {
  if (km === null || km === undefined) return '';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * A shop's coordinates. New data is `shopLat`/`shopLng`; older vendor docs
 * carried `shopLocation: {lat, lng}`.
 */
export function shopCoords(partner) {
  if (!partner) return null;
  const direct = { lat: Number(partner.shopLat), lng: Number(partner.shopLng) };
  if (isPoint(direct)) return direct;
  const nested = partner.shopLocation && { lat: Number(partner.shopLocation.lat), lng: Number(partner.shopLocation.lng) };
  return isPoint(nested) ? nested : null;
}

/** Customer's delivery point saved on the order at checkout (when known). */
export function customerCoords(order) {
  const p = { lat: Number(order?.deliveryLat), lng: Number(order?.deliveryLng) };
  return isPoint(p) ? p : null;
}

/** Shop pickup point of an order: what the admin shared, else null. */
export function pickupCoords(order) {
  const p = order?.pickupLocation;
  const c = p && { lat: Number(p.lat), lng: Number(p.lng) };
  return isPoint(c) ? c : null;
}

export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** "12 sec ago", "3 min ago", "2 h ago" for a timestamp. */
export function agoText(ts, now = Date.now()) {
  const ms = toMillis(ts);
  if (!ms) return 'never';
  const sec = Math.max(0, Math.round((now - ms) / 1000));
  if (sec < 60) return `${sec} sec ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  return `${Math.floor(sec / 3600)} h ago`;
}

/** A rider marker goes grey when its last update is older than this. */
export const STALE_AFTER_MS = 2 * 60 * 1000;

/**
 * The customer's delivery address of an order, whichever way it was written:
 * the Customer app saves `address` (a map {address, landmark, pincode}, or a
 * plain string in older data); some writers used `deliveryAddress`.
 */
export function addressParts(order) {
  const raw = order?.address ?? order?.deliveryAddress;
  if (!raw) return { text: '', landmark: '', pincode: '' };
  if (typeof raw === 'string') return { text: raw, landmark: '', pincode: '' };
  const text = raw.address || raw.line1 || raw.fullAddress || '';
  return { text: String(text), landmark: raw.landmark || '', pincode: raw.pincode || '' };
}
