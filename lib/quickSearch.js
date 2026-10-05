// Quick search (⌘K): one pure function that searches the admin's data and
// returns results grouped for display. Pure so it can be tested directly.

const norm = v => String(v ?? '').toLowerCase().trim();

function matches(fields, tokens) {
  const hay = fields.map(norm).join(' ');
  return tokens.every(t => hay.includes(t));
}

const orderNo = o => o.orderNumber || String(o.id || '').slice(-6).toUpperCase();

/**
 * @param {string} text what the admin typed
 * @param {{orders?:[], users?:[], partners?:[], products?:[], pages?:[{href,label,keywords?}]}} data
 * @param {number} perGroup max results per group
 * @returns {{key:string,label:string,items:{id:string,title:string,subtitle:string,href:string}[]}[]}
 */
export function quickSearch(text, data = {}, perGroup = 5) {
  const tokens = norm(text).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const groups = [];
  const add = (key, label, items) => { if (items.length) groups.push({ key, label, items: items.slice(0, perGroup) }); };

  add('pages', 'Pages', (data.pages || [])
    .filter(p => matches([p.label, p.keywords], tokens))
    .map(p => ({ id: p.href, title: p.label, subtitle: 'Open page', href: p.href })));

  add('orders', 'Orders', (data.orders || [])
    .filter(o => matches([orderNo(o), o.id, o.customerName, o.phone, o.customerEmail, o.vendorName, o.riderName, o.status], tokens))
    .map(o => ({
      id: o.id,
      title: `#${orderNo(o)} · ${o.customerName || 'Customer'}`,
      subtitle: [o.phone, o.vendorName, o.status && String(o.status).replace(/_/g, ' ')].filter(Boolean).join(' · '),
      href: `/orders/${o.id}`,
    })));

  add('customers', 'Customers', (data.users || [])
    .filter(u => matches([u.name, u.phone, u.email, u.city], tokens))
    .map(u => ({
      id: u.id,
      title: u.name || 'Customer',
      subtitle: [u.phone, u.email].filter(Boolean).join(' · '),
      href: `/orders?customerId=${encodeURIComponent(u.id)}&customerName=${encodeURIComponent(u.name || '')}`,
    })));

  const partners = data.partners || [];
  add('vendors', 'Vendors', partners
    .filter(p => p.role === 'vendor' && matches([p.shopName, p.name, p.phone, p.area, p.district, p.businessCategory], tokens))
    .map(p => ({ id: p.id, title: p.shopName || p.name, subtitle: [p.name, p.phone, p.area].filter(Boolean).join(' · '), href: `/vendors/${p.id}` })));

  add('riders', 'Riders', partners
    .filter(p => p.role === 'rider' && matches([p.name, p.phone, p.area], tokens))
    .map(p => ({ id: p.id, title: p.name, subtitle: [p.phone, p.area].filter(Boolean).join(' · '), href: '/riders' })));

  add('products', 'Products', (data.products || [])
    .filter(p => matches([p.name, p.category], tokens))
    .map(p => ({ id: p.id, title: p.name, subtitle: [p.category, p.price != null && `₹${p.price}`].filter(Boolean).join(' · '), href: '/products' })));

  return groups;
}
