// The delivery area: a centre point + a radius in km, set by the admin
// (Firestore `settings/delivery_area`). Customers whose location is outside it
// see "delivery is not available". Pure (tested); the Customer app has the
// same rule in lib/models/delivery_area.dart, checked against
// tests/fixtures/delivery_area_cases.json.

export const DEFAULT_MESSAGE = "Sorry, we don't deliver to your location yet.";
export const MAX_RADIUS_KM = 5000;
const EARTH_KM = 6371;
const rad = d => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const validLat = v => Number.isFinite(v) && v >= -90 && v <= 90;
const validLng = v => Number.isFinite(v) && v >= -180 && v <= 180;

/** Normalise a stored/entered area; null when it is not a usable area. */
export function parseArea(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const centerLat = Number(raw.centerLat);
  const centerLng = Number(raw.centerLng);
  const radiusKm = Number(raw.radiusKm);
  if (!validLat(centerLat) || !validLng(centerLng)) return null;
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return null;
  return {
    enabled: raw.enabled === true,
    centerLat, centerLng, radiusKm,
    message: String(raw.message ?? '').trim() || DEFAULT_MESSAGE,
  };
}

/** Is the limit actually switched on and usable? */
export function isActive(area) {
  return !!area && area.enabled === true;
}

/** km from the area's centre to a point. */
export function distanceToCenterKm(area, lat, lng) {
  return haversineKm(area.centerLat, area.centerLng, Number(lat), Number(lng));
}

/**
 * Can we deliver to this point? Always true when the limit is off. A point
 * with no/invalid coordinates cannot be judged and is allowed.
 */
export function isInsideArea(area, lat, lng) {
  if (!isActive(area)) return true;
  if (!validLat(Number(lat)) || !validLng(Number(lng)) || (Number(lat) === 0 && Number(lng) === 0)) return true;
  return distanceToCenterKm(area, lat, lng) <= area.radiusKm;
}

/**
 * Validate what the admin typed and build the document to save.
 * @returns {{ok:boolean, error?:string, data?:object}}
 */
export function buildAreaDoc(form) {
  const centerLat = Number(form.centerLat);
  const centerLng = Number(form.centerLng);
  const radiusKm = Number(form.radiusKm);
  if (String(form.centerLat ?? '').trim() === '' || !validLat(centerLat)) return { ok: false, error: 'Latitude must be a number between -90 and 90' };
  if (String(form.centerLng ?? '').trim() === '' || !validLng(centerLng)) return { ok: false, error: 'Longitude must be a number between -180 and 180' };
  if (centerLat === 0 && centerLng === 0) return { ok: false, error: 'Choose the centre of your delivery area on the map' };
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return { ok: false, error: 'Radius must be more than 0 km' };
  if (radiusKm > MAX_RADIUS_KM) return { ok: false, error: `Radius cannot be more than ${MAX_RADIUS_KM} km` };
  return {
    ok: true,
    data: {
      enabled: form.enabled === true,
      centerLat, centerLng,
      radiusKm: Math.round(radiusKm * 100) / 100,
      message: String(form.message ?? '').trim() || DEFAULT_MESSAGE,
    },
  };
}
