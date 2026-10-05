// Creating a vendor / rider directly in the Admin (without them sending a
// request first). Pure helpers (tested). The document written is the same
// shape an approved sign-up request has, so the Partner app (login, shop name,
// area, address), the Customer app (shop listing) and the Admin lists all work
// with it unchanged.

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/l/I)

/** A random 8-character password the admin can read out over the phone. */
export function generatePassword(random = Math.random) {
  let out = '';
  for (let i = 0; i < 8; i++) out += PASSWORD_ALPHABET[Math.floor(random() * PASSWORD_ALPHABET.length)];
  return out;
}

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** A free username like `vendor_hari_biryani` / `rider_ravi` (adds a number if taken). */
export function suggestUsername(role, name, takenUsernames = []) {
  const taken = new Set(takenUsernames.map(u => String(u).toLowerCase()));
  // up to 26 characters so a number can still be added within the 30-character username limit
  const base = `${role === 'rider' ? 'rider' : 'vendor'}_${slug(name) || 'partner'}`.slice(0, 26).replace(/_+$/, '');
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  return `${base}${Date.now() % 100000}`;
}

const PHONE_RE = /^\+?[0-9]{10,13}$/;
const USERNAME_RE = /^[a-z0-9][a-z0-9_.-]{2,29}$/;

/**
 * Validate the form and build the `partner_requests` document.
 * @param role 'vendor' | 'rider'
 * @param form raw strings
 * @param takenUsernames usernames already used by ANY partner (a username must be unique: the app logs in by it)
 * @returns {{ok:boolean, error?:string, data?:object}}
 */
export function buildPartnerDoc(role, form, takenUsernames = []) {
  if (role !== 'vendor' && role !== 'rider') return { ok: false, error: 'Unknown partner type' };
  const t = k => String(form[k] ?? '').trim();

  if (!t('name')) return { ok: false, error: role === 'vendor' ? 'Owner name is required' : 'Rider name is required' };
  if (role === 'vendor' && !t('shopName')) return { ok: false, error: 'Shop name is required' };
  const phone = t('phone').replace(/[\s-]/g, '');
  if (!phone) return { ok: false, error: 'Phone number is required' };
  if (!PHONE_RE.test(phone)) return { ok: false, error: 'Enter a valid phone number (10 digits, optional +91)' };
  if (t('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t('email'))) return { ok: false, error: 'Enter a valid email address or leave it empty' };
  if (!t('area')) return { ok: false, error: 'Area is required' };

  const username = t('username').toLowerCase();
  const password = t('password');
  if (!USERNAME_RE.test(username)) return { ok: false, error: 'Username must be 3–30 letters/numbers (a–z, 0–9, _ . -), no spaces' };
  if (takenUsernames.map(u => String(u).toLowerCase()).includes(username)) return { ok: false, error: `The username "${username}" is already taken` };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters' };

  const lat = t('shopLat') === '' ? null : Number(form.shopLat);
  const lng = t('shopLng') === '' ? null : Number(form.shopLng);
  if (role === 'vendor' && (lat !== null || lng !== null)) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { ok: false, error: 'Shop latitude/longitude are not valid' };
    }
  }

  const common = {
    role,
    name: t('name'),
    phone,
    email: t('email'),
    area: t('area'),
    address: t('address'),
    status: 'approved',          // created by the admin, so no approval step
    suspended: false,
    credentials: { username, password },
    source: 'admin',
  };

  const data = role === 'vendor'
    ? {
        ...common,
        shopName: t('shopName'),
        shopAddress: t('address'),
        businessCategory: t('businessCategory'),
        ...(lat !== null ? { shopLat: lat, shopLng: lng } : {}),
      }
    : {
        ...common,
        available: true,
        vehicleType: t('vehicleType'),
        vehicleNumber: t('vehicleNumber'),
        drivingLicence: t('drivingLicence'),
      };
  return { ok: true, data };
}
