import { useEffect, useState, useCallback, useMemo } from 'react';
import { api, apiErrorMessage } from '../api.js';
import { formatMoney } from '../format.js';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [view, setView] = useState('items'); // 'items' | 'categories' | 'history'
  const [movements, setMovements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', category_id: '', unit: 'unit', quantity: '', reorder_level: '', cost_per_unit: '' });
  const [moveForm, setMoveForm] = useState({ change_qty: '', reason: 'purchase', note: '' });
  const [newCategory, setNewCategory] = useState('');

  const load = useCallback(() => {
    api.get('/inventory').then((res) => setItems(res.data));
    api.get('/inventory/categories').then((res) => setCategories(res.data));
    api.get('/inventory/movements').then((res) => setMovements(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredItems = activeCategory === 'all' ? items : items.filter((i) => i.category_id === activeCategory);

  const summary = useMemo(() => {
    const totalValue = items.reduce((s, i) => s + i.quantity * i.cost_per_unit, 0);
    const lowStockCount = items.filter((i) => i.quantity <= i.reorder_level).length;
    return { totalItems: items.length, totalValue, lowStockCount, totalCategories: categories.length };
  }, [items, categories]);

  async function addCategory() {
    if (!newCategory.trim()) return;
    setError('');
    try {
      const res = await api.post('/inventory/categories', { name: newCategory.trim() });
      setNewCategory('');
      if (showModal) setForm((f) => ({ ...f, category_id: res.data.id }));
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function createItem(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/inventory', {
        ...form,
        category_id: form.category_id || null,
        quantity: +form.quantity || 0,
        reorder_level: +form.reorder_level || 0,
        cost_per_unit: +form.cost_per_unit || 0,
      });
      setShowModal(false);
      setForm({ name: '', category_id: '', unit: 'unit', quantity: '', reorder_level: '', cost_per_unit: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitMovement(e) {
    e.preventDefault();
    setError('');
    try {
      const qty = moveForm.reason === 'purchase' ? Math.abs(+moveForm.change_qty) : -Math.abs(+moveForm.change_qty);
      await api.post(`/inventory/${showMoveModal.id}/movement`, { ...moveForm, change_qty: qty });
      setShowMoveModal(null);
      setMoveForm({ change_qty: '', reason: 'purchase', note: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Store Inventory</div>
          <div className="page-subtitle">Stock levels, categories, and full movement history for every item in the store.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Item</button>
      </div>

      {error && <div className="card" style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Items Tracked</div>
          <div className="stat-value">{summary.totalItems}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Categories</div>
          <div className="stat-value">{summary.totalCategories}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Stock Value</div>
          <div className="stat-value">{formatMoney(summary.totalValue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Items Below Reorder Level</div>
          <div className={`stat-value ${summary.lowStockCount > 0 ? 'warn' : ''}`}>{summary.lowStockCount}</div>
        </div>
      </div>

      <div className="tabs">
        <button className={'tab-btn' + (view === 'items' ? ' active' : '')} onClick={() => setView('items')}>Stock Items</button>
        <button className={'tab-btn' + (view === 'categories' ? ' active' : '')} onClick={() => setView('categories')}>Categories</button>
        <button className={'tab-btn' + (view === 'history' ? ' active' : '')} onClick={() => setView('history')}>Movement History</button>
      </div>

      {view === 'items' && (
        <>
          <div className="tabs">
            <button className={'tab-btn' + (activeCategory === 'all' ? ' active' : '')} onClick={() => setActiveCategory('all')}>
              All Items
            </button>
            {categories.map((c) => (
              <button key={c.id} className={'tab-btn' + (activeCategory === c.id ? ' active' : '')} onClick={() => setActiveCategory(c.id)}>
                {c.name}
              </button>
            ))}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th><th>Category</th><th>Quantity</th><th>Reorder Level</th>
                <th>Unit Cost (ETB)</th><th>Stock Value (ETB)</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const low = item.quantity <= item.reorder_level;
                const stockValue = item.quantity * item.cost_per_unit;
                return (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.category_name || <span style={{ color: 'var(--text-muted)' }}>Uncategorized</span>}</td>
                    <td>{item.quantity.toFixed(2)} {item.unit}</td>
                    <td>{item.reorder_level} {item.unit}</td>
                    <td>{formatMoney(item.cost_per_unit)}</td>
                    <td>{formatMoney(stockValue)}</td>
                    <td>{low ? <span className="badge badge-cancelled">low stock</span> : <span className="badge badge-ready">in stock</span>}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowMoveModal(item)}>Adjust Stock</button>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    {items.length === 0
                      ? 'No stock items yet. Add your first item to start tracking inventory.'
                      : 'No items in this category yet.'}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {view === 'categories' && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Manage Categories</div>
          <div className="flex-row" style={{ flexWrap: 'wrap', marginBottom: 16, gap: 8 }}>
            {categories.map((c) => (
              <span key={c.id} className="badge badge-open">
                {c.name} · {items.filter((i) => i.category_id === c.id).length} item{items.filter((i) => i.category_id === c.id).length === 1 ? '' : 's'}
              </span>
            ))}
            {categories.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No categories yet — create one below (e.g. Fruits, Vegetables, Drinks, Dairy).</span>}
          </div>
          <div className="flex-row">
            <input className="form-input flex-1" placeholder="New category name" value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
            <button className="btn btn-primary" onClick={addCategory}>Add Category</button>
          </div>
        </div>
      )}

      {view === 'history' && (
        <table className="data-table">
          <thead>
            <tr><th>Date</th><th>Item</th><th>Quantity Change</th><th>Reason</th><th>Note</th><th>Recorded By</th></tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.created_at).toLocaleString()}</td>
                <td>{m.item_name}</td>
                <td style={{ color: m.change_qty >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                  {m.change_qty >= 0 ? '+' : ''}{m.change_qty} {m.unit}
                </td>
                <td style={{ textTransform: 'capitalize' }}>{m.reason}</td>
                <td>{m.note || '—'}</td>
                <td>{m.user_name || '—'}</td>
              </tr>
            ))}
            {movements.length === 0 && <tr><td colSpan={6}><div className="empty-state">No stock movements recorded yet.</div></td></tr>}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <div className="modal-title">Add Store Item</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, marginTop: -8 }}>
              Fill in each field below. Required fields are marked with *.
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={createItem}>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                Basic Details
              </div>
              <div className="form-group">
                <label className="form-label">Item Name *</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bananas, Bottled Water, Coffee Beans" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Uncategorized</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex-row" style={{ marginTop: 8 }}>
                  <input
                    className="form-input flex-1"
                    placeholder="Or type a new category and add it here"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addCategory}>Add</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  e.g. Fruits, Vegetables, Drinks, Dairy — new categories appear in the dropdown above immediately.
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '18px 0 10px' }}>
                Measurement Unit
              </div>
              <div className="form-group">
                <label className="form-label">How is this item measured? *</label>
                <select className="form-select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="l">Liters (l)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="unit">Pieces / Units</option>
                  <option value="box">Box</option>
                  <option value="pack">Pack</option>
                  <option value="bottle">Bottle</option>
                  <option value="bag">Bag</option>
                </select>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Example: fruits and vegetables are usually tracked in kg, bottled drinks in "Bottle" or "unit."
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '18px 0 10px' }}>
                Stock & Pricing
              </div>
              <div className="flex-row">
                <div className="form-group flex-1">
                  <label className="form-label">Starting Quantity</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>How much is in the store right now.</div>
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Reorder Level</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} placeholder="0" />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Alert when stock falls to or below this.</div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Unit Cost (ETB)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} placeholder="0.00" />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  Cost per {form.unit || 'unit'} — used to calculate total stock value and dish costing.
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Adjust Stock — {showMoveModal.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              Current: {showMoveModal.quantity.toFixed(2)} {showMoveModal.unit} · {formatMoney(showMoveModal.quantity * showMoveModal.cost_per_unit)} in stock
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={submitMovement}>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <select className="form-select" value={moveForm.reason} onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })}>
                  <option value="purchase">Purchase (add stock)</option>
                  <option value="waste">Waste (remove stock)</option>
                  <option value="adjustment">Adjustment (remove stock)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity ({showMoveModal.unit})</label>
                <input className="form-input" type="number" step="0.01" required value={moveForm.change_qty}
                  onChange={(e) => setMoveForm({ ...moveForm, change_qty: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input className="form-input" value={moveForm.note} onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })} placeholder="e.g. Supplier delivery, spoilage, count correction..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMoveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
