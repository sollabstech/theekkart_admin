'use client';
import { useEffect, useState } from 'react';
import { getCategories, addCategory, updateCategory, deleteCategory } from '@/lib/firestore';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

const DEFAULT_CATEGORIES = [
  { name: 'Grocery',              icon: '🛒', order: 1, hidden: false },
  { name: 'Food',                 icon: '🍱', order: 2, hidden: false },
  { name: 'Medical',              icon: '💊', order: 3, hidden: false },
  { name: 'Fruits & Vegetables',  icon: '🥦', order: 4, hidden: false },
  { name: 'Dairy',                icon: '🥛', order: 5, hidden: false },
  { name: 'Bakery',               icon: '🍞', order: 6, hidden: false },
  { name: 'Other Local Shops',    icon: '🏪', order: 7, hidden: false },
];

const EMPTY = { name: '', icon: '🛒', order: 1, hidden: false };

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await getCategories();
    setCategories(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function seedDefaults() {
    if (!confirm('Add default categories? This will add the 7 standard TheekKart categories.')) return;
    for (const cat of DEFAULT_CATEGORIES) {
      await addCategory(cat);
    }
    toast.success('Default categories added!');
    load();
  }

  function openAdd() { setEditing(null); setForm(EMPTY); setModal(true); }
  function openEdit(c) { setEditing(c.id); setForm({ ...c }); setModal(true); }

  async function handleSave() {
    if (!form.name) return toast.error('Name is required');
    setSaving(true);
    try {
      const data = { ...form, order: parseInt(form.order) || 1 };
      if (editing) { await updateCategory(editing, data); toast.success('Updated'); }
      else { await addCategory(data); toast.success('Category added'); }
      setModal(false); load();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this category?')) return;
    await deleteCategory(id);
    toast.success('Deleted');
    load();
  }

  async function toggleHidden(c) {
    await updateCategory(c.id, { hidden: !c.hidden });
    load();
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> Add Category
          </button>
          {categories.length === 0 && (
            <button onClick={seedDefaults} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Seed Default Categories
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No categories yet. Click "Seed Default Categories" to add the standard TheekKart categories.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3">Icon</th>
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Order</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categories.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-2xl">{c.icon}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-5 py-3 text-gray-500">{c.order}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${c.hidden ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                        {c.hidden ? 'Hidden' : 'Visible'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => toggleHidden(c)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                          {c.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">{editing ? 'Edit Category' : 'Add Category'}</h2>
            <div className="space-y-4">
              {[
                { label: 'Category Name *', key: 'name', type: 'text' },
                { label: 'Icon (emoji)', key: 'icon', type: 'text' },
                { label: 'Display Order', key: 'order', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input
                    type={f.type} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              ))}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox" checked={form.hidden}
                  onChange={e => setForm(p => ({ ...p, hidden: e.target.checked }))}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">Hide this category</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {saving ? 'Saving…' : editing ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
