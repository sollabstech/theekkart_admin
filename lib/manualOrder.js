// Admin "Add Manual Order": an order is always from ONE store (the customer —
// or the admin on the customer's behalf — chooses the store; the admin only ever
// assigns a rider). Pure helpers (tested), used by the modal.
import { vendorCategoryMatches } from './vendorCategory.js';

/** Stores an order can be placed with: approved shops. */
export function orderableStores(vendors = []) {
  return vendors.filter(v => v?.role !== 'rider' && v?.status === 'approved' && v.shopOpen !== false);
}

/** The products that belong to [vendorId]'s shop and can be ordered. */
export function productsOfStore(products = [], vendorId) {
  if (!vendorId) return [];
  return products.filter(p => p.vendorId === vendorId && p.available !== false);
}

export function storeName(vendor) {
  return vendor?.shopName || vendor?.name || '';
}

/**
 * Validate the form and build the `orders` document.
 * @returns {{ok:boolean, error?:string, order?:object}}
 */
export function buildManualOrder({ vendor, products, quantities, customer, payment = 'cod', notes = '', now = Date.now() }) {
  if (!vendor?.id) return { ok: false, error: 'Choose the store this order is from' };
  const c = k => String(customer?.[k] ?? '').trim();
  if (!c('name')) return { ok: false, error: 'Customer name is required' };
  if (!c('phone')) return { ok: false, error: 'Phone number is required' };
  if (!c('address')) return { ok: false, error: 'Delivery address is required' };

  const own = productsOfStore(products, vendor.id);
  const ids = Object.keys(quantities || {}).filter(id => quantities[id] > 0);
  if (ids.length === 0) return { ok: false, error: 'Select at least one product' };
  const items = [];
  for (const id of ids) {
    const p = own.find(x => x.id === id);
    if (!p) return { ok: false, error: 'Every product must belong to the chosen store' };
    items.push({ productId: id, name: p.name, price: p.price, quantity: quantities[id], unit: p.unit || '' });
  }
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const min = Number(vendor.minOrder ?? vendor.minimumOrder ?? 0);
  if (min > 0 && total < min) return { ok: false, error: `${storeName(vendor)} needs a minimum order of ₹${min} (this one is ₹${total})` };

  return {
    ok: true,
    order: {
      orderNumber: `TK${String(now).substring(7)}`,
      customerId: '',
      customerEmail: '',
      customerName: c('name'),
      phone: c('phone'),
      address: { address: c('address'), landmark: c('landmark'), pincode: c('pincode') },
      vendorId: vendor.id,
      vendorName: storeName(vendor),
      items,
      total,
      paymentMethod: payment,
      notes: String(notes).trim(),
      status: 'received',
      source: 'admin',
    },
  };
}

/** Products of [vendor] that are outside the shop's one category (for the warning on the vendor page). */
export function productsOutsideCategory(products = [], vendor, categories = []) {
  const cat = categories.find(c => vendorCategoryMatches(vendor?.businessCategory || vendor?.shopCategory || '', c));
  if (!cat) return [];
  return products.filter(p => p.vendorId === vendor.id && !(p.categoryId === cat.id || String(p.category || '').toLowerCase() === cat.name.toLowerCase()));
}
