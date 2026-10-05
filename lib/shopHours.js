// Is a shop open right now? The shop's on/off switch (`shopOpen`) AND its
// timings (`openingTime` / `closingTime`) decide; `suspended` (set by the
// admin) beats both. The Partner and Customer apps have the same rule in
// lib/models/shop_hours.dart; all three are checked against
// tests/fixtures/shop_hours_cases.json. Pure (tested).

/** Minutes since midnight for "09:00", "9:05", "9:00 AM", "9pm" …, or null. */
export function parseClockMinutes(raw) {
  if (raw === null || raw === undefined) return null;
  const m = String(raw).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  const ampm = m[3];
  if (min > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'am') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23) return null;
  return h * 60 + min;
}

/** 540 → "9:00 AM" */
export function formatClock(minutes) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** Both timings as minutes, or null when either is missing/unreadable (= no timings). */
export function shopHours(shop) {
  const open = parseClockMinutes(shop?.openingTime);
  const close = parseClockMinutes(shop?.closingTime);
  return open === null || close === null ? null : { open, close };
}

/** Is [nowMinutes] inside the hours? Equal times mean open all day; close < open means past midnight. */
export function withinHours(hours, nowMinutes) {
  if (!hours) return true;
  const { open, close } = hours;
  if (open === close) return true;
  return open < close ? nowMinutes >= open && nowMinutes < close : nowMinutes >= open || nowMinutes < close;
}

/** open | closed_switch | outside_hours | suspended */
export function shopState(shop, now = new Date()) {
  if (shop?.suspended === true) return 'suspended';
  if (shop?.shopOpen === false) return 'closed_switch';
  return withinHours(shopHours(shop), now.getHours() * 60 + now.getMinutes()) ? 'open' : 'outside_hours';
}

export const isShopOpen = (shop, now = new Date()) => shopState(shop, now) === 'open';

/** "9:00 AM – 9:00 PM", or '' when the shop has no timings. */
export function hoursLabel(shop) {
  const h = shopHours(shop);
  return h ? `${formatClock(h.open)} – ${formatClock(h.close)}` : '';
}
