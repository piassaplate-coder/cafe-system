import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'cafe.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const isNew = !fs.existsSync(DB_PATH);

// Uses Node's built-in SQLite module (available Node 22.5+/24+) instead of
// better-sqlite3, so there is nothing to compile — no build tools, no
// prebuilt-binary lookups, works the same on Windows/Mac/Linux out of the box.
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// node:sqlite has no built-in .transaction() helper like better-sqlite3 did,
// so this wraps a block of statements in BEGIN/COMMIT with rollback on error.
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function logActivity(userId, action, details, logType = 'activity') {
  try {
    db.prepare('INSERT INTO activity_log (user_id, action, details, log_type) VALUES (?,?,?,?)')
      .run(userId || null, action, details || null, logType);
  } catch (e) {
    console.error('Failed to log activity:', e.message);
  }
}

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Seed initial data only once
if (isNew) {
  const seedUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, current_password, role) VALUES (?,?,?,?,?)`
  );
  const hash = (p) => bcrypt.hashSync(p, 10);
  seedUser.run('Owner Admin', 'owner@cafe.com', hash('Owner@2026'), 'Owner@2026', 'owner');
  seedUser.run('Manager Mike', 'manager@cafe.com', hash('Manager@2026'), 'Manager@2026', 'manager');
  seedUser.run('Cashier Cara', 'cashier@cafe.com', hash('Cashier@2026'), 'Cashier@2026', 'cashier');
  seedUser.run('Finance Fay', 'finance@cafe.com', hash('Finance@2026'), 'Finance@2026', 'finance');
  seedUser.run('Chef Charlie', 'chef@cafe.com', hash('Chef@2026'), 'Chef@2026', 'chef');
  seedUser.run('Storekeeper Sam', 'storekeeper@cafe.com', hash('Storekeeper@2026'), 'Storekeeper@2026', 'storekeeper');
  seedUser.run('F&B Fiona', 'fnb@cafe.com', hash('Fnb@2026'), 'Fnb@2026', 'fnb');

  const cat = db.prepare(`INSERT INTO categories (name) VALUES (?)`);
  const catHot = cat.run('Hot Drink').lastInsertRowid;
  const catSoft = cat.run('Soft Drink').lastInsertRowid;
  const catJuice = cat.run('Juice').lastInsertRowid;
  const catFastFood = cat.run('Fast Food').lastInsertRowid;
  const catFood = cat.run('Food').lastInsertRowid;

  const item = db.prepare(
    `INSERT INTO menu_items (name, category_id, price, cost, station) VALUES (?,?,?,?,?)`
  );
  const espresso = item.run('Espresso', catHot, 2.5, 0.6, 'bar').lastInsertRowid;
  const latte = item.run('Latte', catHot, 3.5, 0.9, 'bar').lastInsertRowid;
  const tea = item.run('Tea', catHot, 2.0, 0.4, 'bar').lastInsertRowid;
  const sandwich = item.run('Club Sandwich', catFastFood, 6.5, 2.4, 'kitchen').lastInsertRowid;
  const burger = item.run('Burger', catFastFood, 7.5, 3.0, 'kitchen').lastInsertRowid;
  const pasta = item.run('Pasta', catFood, 9.0, 3.5, 'kitchen').lastInsertRowid;
  const iceTea = item.run('Iced Tea', catSoft, 3.0, 0.5, 'bar').lastInsertRowid;
  const cola = item.run('Cola', catSoft, 2.5, 0.6, 'bar').lastInsertRowid;
  const mangoJuice = item.run('Mango Juice', catJuice, 3.5, 1.0, 'bar').lastInsertRowid;
  const orangeJuice = item.run('Orange Juice', catJuice, 3.5, 1.0, 'bar').lastInsertRowid;

  const tbl = db.prepare(`INSERT INTO store_tables (name, capacity) VALUES (?,?)`);
  for (let i = 1; i <= 31; i++) tbl.run(`Table ${i}`, i % 2 === 0 ? 4 : 2);

  console.log('Database seeded with demo data.');
  console.log('Demo logins (unique password per role):');
  console.log(' owner@cafe.com / Owner@2026');
  console.log(' manager@cafe.com / Manager@2026');
  console.log(' cashier@cafe.com / Cashier@2026');
  console.log(' finance@cafe.com / Finance@2026');
  console.log(' chef@cafe.com / Chef@2026');
  console.log(' storekeeper@cafe.com / Storekeeper@2026');
  console.log(' fnb@cafe.com / Fnb@2026');
  console.log('Inventory starts empty — add your own categories and stock items from the Inventory page.');
}
