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
