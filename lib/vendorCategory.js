// A store belongs to ONE category (a medical shop is in Medical and cannot list
// vegetables). The store's category is kept on its profile as `businessCategory`
// (text). Older stores used other wording (Pharmacy, Vegetables & Fruits …), so
// those words are understood too. The Partner and Customer apps have the same
// rule (lib/models/vendor_category.dart); all are checked against
// tests/fixtures/vendor_category_cases.json. Pure (tested).

const norm = s => String(s ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

// Words that mean the same category as a default one.
const SYNONYMS = {
  'medical': ['medical', 'medicine', 'medicines', 'pharmacy', 'pharmacies', 'medical shop', 'chemist', 'health'],
  'fruits and vegetables': ['fruits and vegetables', 'vegetables and fruits', 'fruits and veg', 'vegetables', 'fruits', 'fruit', 'veg'],
  'dairy': ['dairy', 'dairy and eggs', 'milk', 'eggs'],
  'grocery': ['grocery', 'groceries', 'kirana', 'supermarket'],
  'food': ['food', 'restaurant', 'restaurants', 'hotel', 'foods'],
  'bakery': ['bakery', 'bakeries', 'cakes'],
  'other': ['other', 'other shops', 'other local shops', 'others', 'household', 'general'],
};

function canonical(raw) {
  const n = norm(raw);
  if (!n) return null;
  for (const [key, words] of Object.entries(SYNONYMS)) if (words.includes(n)) return key;
  return null;
}

/** Does a store whose businessCategory is [raw] belong to [category] ({id, name})? */
export function vendorCategoryMatches(raw, category) {
  const n = norm(raw);
  if (!n || !category) return false;
  if (n === norm(category.name) || n === norm(category.id)) return true;
  const canon = canonical(raw);
  if (!canon) return false;
  const categoryCanon = canonical(category.name) ?? canonical(category.id) ?? norm(category.name);
  return canon === categoryCanon;
}

/** The one category (of [categories]) a store belongs to, or null. */
export function resolveVendorCategory(raw, categories) {
  return (categories || []).find(c => vendorCategoryMatches(raw, c)) || null;
}

/** The default categories (used when the admin has not created any in the Categories page). */
export const DEFAULT_CATEGORIES = [
  { id: 'grocery', name: 'Grocery' }, { id: 'food', name: 'Food' }, { id: 'medical', name: 'Medical' },
  { id: 'fruits', name: 'Fruits & Vegetables' }, { id: 'dairy', name: 'Dairy' }, { id: 'bakery', name: 'Bakery' }, { id: 'other', name: 'Other Shops' },
];

/**
 * Which category does a product get? A store has ONE category, so a product always
 * takes it — a medical shop's form cannot ask for Fruits & Vegetables.
 *  - the store already has a category → the product gets it; asking for another is refused
 *  - the store has none yet (or the old text matches no category) → the form must choose one,
 *    and that choice becomes the store's category (setShop: true) — one time
 * @returns {{ok:boolean, category?:string, setShop?:boolean, error?:string}}
 */
export function decideProductCategory(shopRaw, chosen, categories) {
  const mine = resolveVendorCategory(shopRaw, categories);
  const asked = String(chosen ?? '').trim();
  if (mine) {
    if (asked && !vendorCategoryMatches(asked, mine)) {
      return { ok: false, error: `Your shop sells only ${mine.name}. A product can't be added under ${asked}.` };
    }
    return { ok: true, category: mine.name, setShop: false };
  }
  if (!asked) return { ok: false, error: 'Choose your shop category first — a shop belongs to one category only.' };
  const picked = (categories || []).find(c => norm(c.name) === norm(asked) || norm(c.id) === norm(asked));
  if (!picked) return { ok: false, error: `"${asked}" is not one of the categories.` };
  return { ok: true, category: picked.name, setShop: true };
}

/** The name to show for a store's category: the category it resolves to, else the raw text. */
export function shopCategoryName(vendor, categories) {
  const raw = String(vendor?.businessCategory || vendor?.shopCategory || '').trim();
  return resolveVendorCategory(raw, categories)?.name || raw;
}

/** Use the admin's categories when there are some, else the defaults. */
export function categoryList(categories) {
  const real = (categories || []).filter(c => String(c?.name || '').trim());
  return real.length ? real : DEFAULT_CATEGORIES;
}
