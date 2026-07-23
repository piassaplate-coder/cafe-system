import { useEffect, useState, useCallback } from 'react';
import { api, apiErrorMessage } from '../api.js';
import { formatMoney } from '../format.js';

export default function Menu() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', category_id: '', price: '', cost: '', station: 'kitchen' });
  const [newCategory, setNewCategory] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', category_id: '', price: '', cost: '', station: 'kitchen' });

  const load = useCallback(() => {
    api.get('/menu/items').then((res) => setItems(res.data));
    api.get('/menu/categories').then((res) => setCategories(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(item) {
    setEditItem(item);
    setEditForm({
      name: item.name,
      category_id: item.category_id || '',
      price: item.price,
      cost: item.cost,
      station: item.station,
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.patch(`/menu/items/${editItem.id}`, {
        name: editForm.name,
        category_id: editForm.category_id || null,
        price: +editForm.price,
        cost: +editForm.cost,
        station: editForm.station,
      });
      setEditItem(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function createItem(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/menu/items', {
        ...form,
        category_id: form.category_id || null,
        price: +form.price,
        cost: +form.cost || 0,
      });
      setShowModal(false);
      setForm({ name: '', category_id: '', price: '', cost: '', station: 'kitchen' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    await api.post('/menu/categories', { name: newCategory.trim() });
    setNewCategory('');
    load();
  }

  async function toggleActive(item) {
    await api.patch(`/menu/items/${item.id}`, { is_active: item.is_active ? 0 : 1 });
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Menu Management</div>
          <div className="page-subtitle">Manage items, prices, and categories.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Item</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Categories</div>
        <div className="flex-row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          {categories.map((c) => (
            <span key={c.id} className="badge badge-open">{c.name}</span>
          ))}
        </div>
        <div className="flex-row">
          <input className="form-input flex-1" placeholder="New category name" value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)} />
          <button className="btn btn-secondary" onClick={addCategory}>Add</button>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Category</th><th>Price</th><th>Cost</th><th>Margin</th><th>Station</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.category_name || '—'}</td>
              <td>{formatMoney(item.price)}</td>
              <td>{formatMoney(item.cost)}</td>
              <td>{item.price > 0 ? `${(((item.price - item.cost) / item.price) * 100).toFixed(0)}%` : '—'}</td>
              <td style={{ textTransform: 'capitalize' }}>{item.station}</td>
              <td>{item.is_active ? <span className="badge badge-ready">active</span> : <span className="badge badge-cancelled">inactive</span>}</td>
              <td>
                <div className="flex-row">
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>Edit Item</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(item)}>
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Add Menu Item</div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={createItem}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-row">
                <div className="form-group flex-1">
                  <label className="form-label">Price (ETB)</label>
                  <input className="form-input" type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Cost (ETB)</label>
                  <input className="form-input" type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Station</label>
                <select className="form-select" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
                  <option value="kitchen">Kitchen</option>
                  <option value="bar">Bar</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Edit Item — {editItem.name}</div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={saveEdit}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" required value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={editForm.category_id}
                  onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}>
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Station</label>
                <select className="form-select" value={editForm.station}
                  onChange={(e) => setEditForm({ ...editForm, station: e.target.value })}>
                  <option value="kitchen">Kitchen</option>
                  <option value="bar">Bar</option>
                </select>
              </div>
              <div className="flex-row">
                <div className="form-group flex-1">
                  <label className="form-label">Price (ETB)</label>
                  <input className="form-input" type="number" step="0.01" required value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Cost (ETB)</label>
                  <input className="form-input" type="number" step="0.01" value={editForm.cost}
                    onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
