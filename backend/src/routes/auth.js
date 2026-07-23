import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, logActivity } from '../db.js';
import { signToken, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user) {
    logActivity(null, 'login_failed', `Failed login attempt for ${email}`, 'auth');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    logActivity(user.id, 'login_failed', `Failed login attempt for ${email}`, 'auth');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  logActivity(user.id, 'login_success', `${user.name} (${user.role}) logged in`, 'auth');
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// User management - owner/manager only
// Lightweight staff list (no email) — any authenticated user can see this,
// used for things like transferring an order to another cashier at shift change
router.get('/staff-list', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, name, role FROM users WHERE active = 1 ORDER BY name').all();
  res.json(users);
});

router.get('/users', requireAuth, requireRole('manager'), (req, res) => {
  const cols = req.user.role === 'owner'
    ? 'id, name, email, role, active, current_password, created_at'
    : 'id, name, email, role, active, created_at';
  const users = db.prepare(`SELECT ${cols} FROM users ORDER BY id`).all();
  res.json(users);
});

router.post('/users', requireAuth, requireRole('manager'), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, role are required' });
  }
  const validRoles = ['owner', 'manager', 'cashier', 'finance', 'chef', 'storekeeper', 'fnb'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  // Only owner can create another owner or manager
  if ((role === 'owner' || role === 'manager') && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can create owner/manager accounts' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, current_password, role) VALUES (?,?,?,?,?)')
      .run(name, email, hash, password, role);
    logActivity(req.user.id, 'staff_account_created', `${name} (${email}) as ${role}`);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/users/:id', requireAuth, requireRole('manager'), (req, res) => {
  const { name, role, active, password } = req.body;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  if (name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
  if (role !== undefined) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  if (active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, current_password = ? WHERE id = ?').run(hash, password, id);
  }
  res.json({ ok: true });
});

export default router;
