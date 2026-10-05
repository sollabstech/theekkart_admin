// Promo-code rules for the Admin form and the status badge. Pure (tested).
// The Customer app applies a code by looking up `code` (upper case) and
// checking active / expiresAt / maxUses+usedCount / minOrder — the data written
// here must always satisfy that.

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,19}$/; // 3–20 letters/digits, - and _ allowed inside

export const toMillis = ts => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** active | disabled | expired | exhausted */
export function promoStatus(p, now = Date.now()) {
  if (!p.active) return 'disabled';
  if (p.expiresAt && toMillis(p.expiresAt) < now) return 'expired';
  if (p.maxUses != null && (p.usedCount || 0) >= p.maxUses) return 'exhausted';
  return 'active';
}

/** "2026-10-31" in the admin's LOCAL time zone (toISOString would shift the day). */
export function toDateInput(ts) {
  const ms = toMillis(ts);
  if (!ms) return '';
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** End of that local day, as a Date. */
export function endOfDay(dateInput) {
  if (!dateInput) return null;
  const [y, m, d] = dateInput.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59);
}

const isBlank = v => v === '' || v === null || v === undefined;

/**
 * Validate the form and build the document to save.
 * @param form  raw strings from the form
 * @param otherCodes codes of the OTHER promo documents (upper case) — a code must be unique
 * @returns {{ok:boolean, error?:string, data?:object}}
 */
export function buildPromo(form, otherCodes = []) {
  const code = String(form.code ?? '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'Code is required' };
  if (!CODE_RE.test(code)) return { ok: false, error: 'Code must be 3–20 letters or numbers (no spaces)' };
  if (otherCodes.map(c => String(c).toUpperCase()).includes(code)) return { ok: false, error: `The code ${code} already exists` };

  const type = form.type === 'flat' ? 'flat' : 'percentage';
  const value = Number(form.value);
  if (isBlank(form.value) || !Number.isFinite(value) || value <= 0) return { ok: false, error: 'Discount value must be greater than 0' };
  if (type === 'percentage' && value > 100) return { ok: false, error: 'A percentage discount cannot be more than 100%' };

  const minOrder = isBlank(form.minOrder) ? 0 : Number(form.minOrder);
  if (!Number.isFinite(minOrder) || minOrder < 0) return { ok: false, error: 'Minimum order cannot be negative' };

  let maxUses = null;
  if (!isBlank(form.maxUses)) {
    maxUses = Number(form.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1) return { ok: false, error: 'Max uses must be a whole number, 1 or more' };
  }

  let maxDiscount = null;
  if (type === 'percentage' && !isBlank(form.maxDiscount)) {
    maxDiscount = Number(form.maxDiscount);
    if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) return { ok: false, error: 'Max discount must be more than 0' };
  }
  if (type === 'flat' && minOrder > 0 && value > minOrder) {
    return { ok: false, error: 'A flat discount cannot be more than the minimum order' };
  }

  const expiresAt = endOfDay(form.expiresAt);
  if (expiresAt && !form.keepExpired && expiresAt.getTime() < Date.now()) return { ok: false, error: 'Expiry date is in the past' };

  return {
    ok: true,
    data: {
      code, type, value, minOrder, maxUses, maxDiscount, expiresAt,
      description: String(form.description ?? '').trim(),
    },
  };
}
