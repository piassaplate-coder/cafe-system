import { Router } from 'express';
import { db, transaction, logActivity } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/categories', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM inventory_categories ORDER BY name').all());
});

router.post('/categories', requireAuth, requireRole('manager', 'storekeeper'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = db.prepare('INSERT INTO inventory_categories (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Category already exists' });
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.get('/', requireAuth, (req, res) => {
  const { category_id } = req.query;
  let query = `
    SELECT ii.*, ic.name as category_name
    FROM inventory_items ii LEFT JOIN inventory_categories ic ON ic.id = ii.category_id
  `;
  const params = [];
  if (category_id) {
    query += ' WHERE ii.category_id = ?';
    params.push(category_id);
  }
  query += ' ORDER BY ii.name';
  res.json(db.prepare(query).all(...params));
});

router.get('/low-stock', requireAuth, (req, res) => {
  res.json(
    db.prepare('SELECT * FROM inventory_items WHERE quantity <= reorder_level ORDER BY name').all()
  );
});

router.post('/', requireAuth, requireRole('manager', 'storekeeper'), (req, res) => {
  const { name, category_id, unit, quantity, reorder_level, cost_per_unit } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db.prepare(
    'INSERT INTO inventory_items (name, category_id, unit, quantity, reorder_level, cost_per_unit) VALUES (?,?,?,?,?,?)'
  ).run(name, category_id || null, unit || 'unit', quantity || 0, reorder_level || 0, cost_per_unit || 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.patch('/:id', requireAuth, requireRole('manager', 'storekeeper'), (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });
  const fields = ['name', 'category_id', 'unit', 'reorder_level', 'cost_per_unit'];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      db.prepare(`UPDATE inventory_items SET ${f} = ? WHERE id = ?`).run(req.body[f], id);
    }
  }
  db.prepare("UPDATE inventory_items SET updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true });
});

// Stock movement: purchase / waste / adjustment (usage is auto-deducted by orders)
router.post('/:id/movement', requireAuth, requireRole('manager', 'chef', 'storekeeper'), (req, res) => {
  const { change_qty, reason, note } = req.body;
  if (change_qty === undefined || !reason) return res.status(400).json({ error: 'change_qty and reason required' });
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  transaction(() => {
    db.prepare(
      'INSERT INTO stock_movements (inventory_item_id, change_qty, reason, note, created_by) VALUES (?,?,?,?,?)'
    ).run(req.params.id, change_qty, reason, note || null, req.user.id);
    db.prepare("UPDATE inventory_items SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?")
      .run(change_qty, req.params.id);
  });
  logActivity(req.user.id, 'stock_adjusted', `${item.name}: ${change_qty >= 0 ? '+' : ''}${change_qty} ${item.unit} (${reason})`);
  res.status(201).json({ ok: true });
});

router.get('/movements', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT sm.*, ii.name as item_name, ii.unit, u.name as user_name
    FROM stock_movements sm
    JOIN inventory_items ii ON ii.id = sm.inventory_item_id
    LEFT JOIN users u ON u.id = sm.created_by
    ORDER BY sm.created_at DESC
    LIMIT 300
  `).all();
  res.json(rows);
});

router.get('/:id/movements', requireAuth, (req, res) => {
  res.json(
    db.prepare('SELECT * FROM stock_movements WHERE inventory_item_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(req.params.id)
  );
});

export default router;
