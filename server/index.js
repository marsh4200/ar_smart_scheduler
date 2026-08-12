// ============================================================
// MACORDER'S SCANNER — Kids' Grocery Shop Server
// Play shop: scan/tap groceries, fill a basket, pay, count change.
// ============================================================
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import { createAuth } from './auth.js';
import { ensureCert, localAddresses } from './certs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'scanner.db');
const UPLOAD_DIR = path.join(DATA_DIR, 'photos');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
const SHOP_HTML = path.join(CLIENT_DIST, 'shop.html');
const CERT_DIR = path.join(DATA_DIR, 'certs');
const PORT = Number(process.env.PORT || 3010);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || PORT + 1);
const HTTPS_ON = process.env.HTTPS !== '0';
// The online ordering side-app — same server, same data, its own port so it
// can be bookmarked on its own (e.g. a shared family tablet or laptop).
const ONLINE_PORT = Number(process.env.ONLINE_PORT || PORT + 2);
const ONLINE_ON = process.env.ONLINE !== '0';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ---------- Database ----------
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT,
    photo TEXT,
    price INTEGER NOT NULL DEFAULT 0,   -- stored in cents
    category TEXT,
    barcode TEXT,
    sortOrder INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    total INTEGER NOT NULL,
    paid INTEGER NOT NULL,
    change INTEGER NOT NULL,
    itemCount INTEGER NOT NULL,
    shopper TEXT,
    changeCorrect INTEGER,
    payment TEXT,
    cardId TEXT
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    saleId TEXT NOT NULL,
    productId TEXT,
    name TEXT,
    emoji TEXT,
    price INTEGER,
    qty INTEGER
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    barcode TEXT NOT NULL UNIQUE,
    emoji TEXT,
    colour TEXT,
    balance INTEGER NOT NULL DEFAULT 0,   -- cents, never allowed below zero
    active INTEGER DEFAULT 1,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS card_txns (
    id TEXT PRIMARY KEY,
    cardId TEXT NOT NULL,
    at TEXT NOT NULL,
    kind TEXT NOT NULL,                   -- topup | spend | adjust
    amount INTEGER NOT NULL,              -- signed, in cents
    balanceAfter INTEGER NOT NULL,
    saleId TEXT,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',   -- pending | claimed | completed | cancelled
    customerName TEXT,
    note TEXT,
    pickupCode TEXT,
    total INTEGER NOT NULL,
    itemCount INTEGER NOT NULL,
    claimedAt TEXT,
    completedAt TEXT,
    cancelledAt TEXT,
    saleId TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    orderId TEXT NOT NULL,
    productId TEXT,
    name TEXT,
    emoji TEXT,
    photo TEXT,
    price INTEGER,
    qty INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_barcode ON products(barcode);
  CREATE INDEX IF NOT EXISTS idx_card_barcode ON cards(barcode);
  CREATE INDEX IF NOT EXISTS idx_card_txns ON card_txns(cardId, at);
  CREATE INDEX IF NOT EXISTS idx_sale_items ON sale_items(saleId);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, createdAt);
  CREATE INDEX IF NOT EXISTS idx_order_items ON order_items(orderId);
`);

// Older installs predate card payments — add the columns if they are missing.
for (const [table, col, type] of [['sales', 'payment', 'TEXT'], ['sales', 'cardId', 'TEXT']]) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
}

const uid = () => crypto.randomBytes(6).toString('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');

function getSetting(key, def = null) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : def;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? null : String(value));
}

// ---------- Defaults ----------
const DEFAULTS = {
  shopName: "Scanner",
  shopTagline: 'Fill your basket and pay at the till',
  currencySymbol: 'R',
  pin: '1234',
  soundOn: '1',
  changeQuizOn: '1',
  showPrices: '1',
  tapToAddOn: '0',
  cardsOn: '1',
  onlineOn: '1',
};
for (const [k, v] of Object.entries(DEFAULTS)) {
  if (getSetting(k) === null) setSetting(k, v);
}

// ---------- Seed shelves ----------
const SEED = [
  ['Milk 2L', '🥛', 2299, 'Dairy'],
  ['Brown Bread', '🍞', 1850, 'Bakery'],
  ['Eggs (6)', '🥚', 2400, 'Dairy'],
  ['Cheese', '🧀', 4500, 'Dairy'],
  ['Butter', '🧈', 3899, 'Dairy'],
  ['Yoghurt', '🍨', 1499, 'Dairy'],
  ['Bananas', '🍌', 1599, 'Fruit & Veg'],
  ['Apples', '🍎', 1250, 'Fruit & Veg'],
  ['Tomatoes', '🍅', 1450, 'Fruit & Veg'],
  ['Carrots', '🥕', 1199, 'Fruit & Veg'],
  ['Potatoes 2kg', '🥔', 3200, 'Fruit & Veg'],
  ['Onions', '🧅', 1350, 'Fruit & Veg'],
  ['Oranges', '🍊', 1899, 'Fruit & Veg'],
  ['Chicken', '🍗', 7999, 'Meat'],
  ['Mince', '🥩', 8999, 'Meat'],
  ['Fish Fingers', '🐟', 4999, 'Meat'],
  ['Bacon', '🥓', 5499, 'Meat'],
  ['Rice 2kg', '🍚', 3999, 'Pantry'],
  ['Pasta', '🍝', 2150, 'Pantry'],
  ['Cereal', '🥣', 5499, 'Pantry'],
  ['Sugar 1kg', '🍬', 2499, 'Pantry'],
  ['Coffee', '☕', 6499, 'Pantry'],
  ['Tea Bags', '🫖', 3250, 'Pantry'],
  ['Peanut Butter', '🥜', 3799, 'Pantry'],
  ['Chips', '🍟', 1650, 'Snacks'],
  ['Chocolate', '🍫', 1299, 'Snacks'],
  ['Biscuits', '🍪', 1999, 'Snacks'],
  ['Popcorn', '🍿', 1450, 'Snacks'],
  ['Ice Cream', '🍦', 4200, 'Snacks'],
  ['Orange Juice', '🧃', 1899, 'Drinks'],
  ['Cooldrink 2L', '🥤', 2499, 'Drinks'],
  ['Water 5L', '💧', 1799, 'Drinks'],
  ['Toilet Paper', '🧻', 4999, 'Household'],
  ['Soap', '🧼', 1499, 'Household'],
  ['Toothpaste', '🪥', 2199, 'Household'],
  ['Washing Powder', '🧺', 5999, 'Household'],
  ['Dog Food', '🦴', 4500, 'Household'],
  ['Light Bulb', '💡', 3299, 'Household'],
];

if (db.prepare('SELECT COUNT(*) n FROM products').get().n === 0) {
  const ins = db.prepare(
    'INSERT INTO products (id,name,emoji,photo,price,category,barcode,sortOrder,active) VALUES (?,?,?,NULL,?,?,?,?,1)'
  );
  SEED.forEach(([name, emoji, price, category], i) => {
    ins.run(uid(), name, emoji, price, category, '600' + String(1000000 + i * 7).padStart(10, '0'), i);
  });
  console.log(`Seeded ${SEED.length} products.`);
}

// ---------- App ----------
let httpsListening = false;
let onlineListening = false;
const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use('/photos', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// The online-shop port opens straight into the ordering page rather than
// the till, so the tablet running it does not need to know a path — just
// the address. Everywhere else, /shop reaches the same page directly.
app.use((req, res, next) => {
  if (req.socket.localPort === ONLINE_PORT && (req.path === '/' || req.path === '/index.html')) {
    if (fs.existsSync(SHOP_HTML)) return res.sendFile(SHOP_HTML);
  }
  next();
});

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// ---------- Who is signed in ----------
const auth = createAuth(db, getSetting, setSetting);
const { requireAuth, requireGrownUp, isGrownUp } = auth;

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

// Everything the login page needs before anyone has signed in.
app.get('/api/public', (req, res) => {
  res.json({
    shopName: getSetting('shopName'),
    shopTagline: getSetting('shopTagline'),
    version: readLocalVersion(),
    defaultLogin: getSetting('authDefault') === '1',
    httpsPort: httpsListening ? HTTPS_PORT : null,
    secureUrlHint: httpsListening,
    onlineOn: getSetting('onlineOn') === '1',
  });
});

app.post('/api/login', (req, res) => {
  const ip = clientIp(req);
  const wait = auth.lockedFor(ip);
  if (wait) {
    return res.status(429).json({ error: `Too many tries. Wait ${Math.ceil(wait / 60)} min and try again.` });
  }
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const wantUser = (getSetting('authUser', 'admin') || 'admin').toLowerCase();

  if (username.toLowerCase() !== wantUser || !auth.checkPassword(password)) {
    auth.noteMiss(ip);
    return res.status(401).json({ error: 'That username or password is not right' });
  }
  auth.clearMisses(ip);
  const { token } = auth.createSession(!!req.body?.remember, req.headers['user-agent']);
  res.json({ token, username: getSetting('authUser') });
});

app.post('/api/logout', (req, res) => {
  auth.dropSession(req);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    username: getSetting('authUser'),
    grownUp: isGrownUp(req),
    defaultLogin: getSetting('authDefault') === '1',
  });
});

// Change the sign-in details (needs the grown-up PIN as well as being signed in).
app.post('/api/account', requireGrownUp, (req, res) => {
  const b = req.body || {};
  const username = String(b.username || '').trim();
  const password = String(b.password || '');

  if (username) {
    if (!/^[A-Za-z0-9._-]{3,24}$/.test(username)) {
      return res.status(400).json({ error: 'Username: 3-24 letters, numbers, dot, dash or underscore' });
    }
    setSetting('authUser', username);
  }
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    auth.setPassword(password);
  }
  if (!username && !password) return res.status(400).json({ error: 'Nothing to change' });

  if (getSetting('authUser') !== 'admin' || password) setSetting('authDefault', '0');
  res.json({ ok: true, username: getSetting('authUser') });
});

app.post('/api/sessions/clear', requireGrownUp, (req, res) => {
  auth.signOutEverywhere();
  res.json({ ok: true });
});

app.get('/api/sessions', requireGrownUp, (req, res) => {
  res.json({ active: auth.activeSessions() });
});

// ---------- Grown-up (PIN) unlock, on top of being signed in ----------
app.post('/api/grownup/login', requireAuth, (req, res) => {
  const ip = clientIp(req);
  const wait = auth.lockedFor(ip);
  if (wait) return res.status(429).json({ error: `Too many tries. Wait ${Math.ceil(wait / 60)} min.` });

  const pin = String(req.body?.pin || '');
  if (pin !== getSetting('pin', '1234')) {
    auth.noteMiss(ip);
    return res.status(401).json({ error: 'That PIN is not right' });
  }
  auth.clearMisses(ip);
  auth.elevate(req);
  res.json({ ok: true });
});

app.post('/api/grownup/logout', requireAuth, (req, res) => {
  // Step back down to the shop, but stay signed in.
  const s = auth.sessionFor(req);
  if (s) db.prepare('UPDATE sessions SET grownUpUntil = 0 WHERE token = ?').run(s.token);
  res.json({ ok: true });
});

app.post('/api/grownup/pin', requireGrownUp, (req, res) => {
  const pin = String(req.body?.pin || '');
  if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 to 8 digits' });
  setSetting('pin', pin);
  res.json({ ok: true });
});

// ---------- Settings ----------
app.get('/api/settings', requireAuth, (req, res) => {
  res.json({
    shopName: getSetting('shopName'),
    shopTagline: getSetting('shopTagline'),
    currencySymbol: getSetting('currencySymbol'),
    soundOn: getSetting('soundOn') === '1',
    changeQuizOn: getSetting('changeQuizOn') === '1',
    showPrices: getSetting('showPrices') === '1',
    tapToAddOn: getSetting('tapToAddOn') === '1',
    cardsOn: getSetting('cardsOn') === '1',
    onlineOn: getSetting('onlineOn') === '1',
    onlinePort: onlineListening ? ONLINE_PORT : null,
    version: readLocalVersion(),
    grownUp: isGrownUp(req),
    username: getSetting('authUser'),
    defaultLogin: getSetting('authDefault') === '1',
    httpsPort: httpsListening ? HTTPS_PORT : null,
    secure: !!req.secure || req.headers['x-forwarded-proto'] === 'https',
  });
});

app.put('/api/settings', requireGrownUp, (req, res) => {
  const b = req.body || {};
  if (typeof b.shopName === 'string') setSetting('shopName', b.shopName.slice(0, 40));
  if (typeof b.shopTagline === 'string') setSetting('shopTagline', b.shopTagline.slice(0, 80));
  if (typeof b.currencySymbol === 'string') setSetting('currencySymbol', b.currencySymbol.slice(0, 3));
  if ('soundOn' in b) setSetting('soundOn', b.soundOn ? '1' : '0');
  if ('changeQuizOn' in b) setSetting('changeQuizOn', b.changeQuizOn ? '1' : '0');
  if ('showPrices' in b) setSetting('showPrices', b.showPrices ? '1' : '0');
  if ('tapToAddOn' in b) setSetting('tapToAddOn', b.tapToAddOn ? '1' : '0');
  if ('cardsOn' in b) setSetting('cardsOn', b.cardsOn ? '1' : '0');
  if ('onlineOn' in b) setSetting('onlineOn', b.onlineOn ? '1' : '0');
  res.json({ ok: true });
});

// ---------- Products ----------
const mapProduct = (r) => ({ ...r, active: !!r.active });

app.get('/api/products', requireAuth, (req, res) => {
  const all = req.query.all === '1' && isGrownUp(req);
  const rows = db
    .prepare(`SELECT * FROM products ${all ? '' : 'WHERE active = 1'} ORDER BY sortOrder, name`)
    .all();
  res.json(rows.map(mapProduct));
});

app.post('/api/products', requireGrownUp, (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Give the item a name' });
  const id = uid();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sortOrder),0) m FROM products').get().m;
  db.prepare(
    'INSERT INTO products (id,name,emoji,photo,price,category,barcode,sortOrder,active) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(
    id,
    String(b.name).slice(0, 40),
    b.emoji || '🛒',
    null,
    Math.max(0, Math.round(Number(b.price) || 0)),
    b.category || 'Pantry',
    b.barcode ? String(b.barcode).trim() : null,
    maxOrder + 1,
    b.active === false ? 0 : 1
  );
  res.json(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
});

app.put('/api/products/:id', requireGrownUp, (req, res) => {
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Item not found' });
  const b = req.body || {};
  db.prepare(
    'UPDATE products SET name=?, emoji=?, price=?, category=?, barcode=?, active=? WHERE id=?'
  ).run(
    b.name !== undefined ? String(b.name).slice(0, 40) : cur.name,
    b.emoji !== undefined ? b.emoji : cur.emoji,
    b.price !== undefined ? Math.max(0, Math.round(Number(b.price) || 0)) : cur.price,
    b.category !== undefined ? b.category : cur.category,
    b.barcode !== undefined ? (b.barcode ? String(b.barcode).trim() : null) : cur.barcode,
    b.active !== undefined ? (b.active ? 1 : 0) : cur.active,
    cur.id
  );
  res.json(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(cur.id)));
});

app.delete('/api/products/:id', requireGrownUp, (req, res) => {
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (cur?.photo) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, cur.photo)); } catch {}
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/products/:id/photo', requireGrownUp, photoUpload.single('photo'), (req, res) => {
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Item not found' });
  if (!req.file) return res.status(400).json({ error: 'No photo received' });
  const ext = (req.file.originalname.match(/\.(png|jpe?g|webp|gif)$/i)?.[0] || '.jpg').toLowerCase();
  const filename = `${cur.id}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
  if (cur.photo && cur.photo !== filename) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, cur.photo)); } catch {}
  }
  db.prepare('UPDATE products SET photo = ? WHERE id = ?').run(filename, cur.id);
  res.json({ ok: true, photo: filename });
});

app.delete('/api/products/:id/photo', requireGrownUp, (req, res) => {
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (cur?.photo) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, cur.photo)); } catch {}
  }
  db.prepare('UPDATE products SET photo = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Barcode lookup — used by the scanner
app.get('/api/scan/:code', requireAuth, (req, res) => {
  const code = String(req.params.code).trim();
  const row = db.prepare('SELECT * FROM products WHERE barcode = ? AND active = 1').get(code);
  if (row) return res.json({ ...mapProduct(row), type: 'product' });

  // Not on the shelves — it might be a bank card.
  const card = findCardByBarcode(code);
  if (card) return res.json({ type: 'card', card: mapCard(card) });

  res.status(404).json({ error: 'Unknown barcode', code });
});


// ============================================================
// BANK CARDS
// A card is a barcode with money behind it. Grown-ups load it,
// kids scan it to pay. The balance can never go below zero.
// ============================================================
const CARD_COLOURS = ['blue', 'grape', 'leaf', 'tomato', 'sunshine', 'ocean'];

const mapCard = (r) => r && ({
  id: r.id,
  name: r.name,
  barcode: r.barcode,
  emoji: r.emoji || '💳',
  colour: r.colour || 'blue',
  balance: r.balance,
  active: !!r.active,
});

const findCardByBarcode = (code) =>
  db.prepare('SELECT * FROM cards WHERE barcode = ?').get(String(code).trim());

function logTxn(cardId, kind, amount, balanceAfter, saleId, note) {
  db.prepare(
    'INSERT INTO card_txns (id,cardId,at,kind,amount,balanceAfter,saleId,note) VALUES (?,?,?,?,?,?,?,?)'
  ).run(uid(), cardId, new Date().toISOString(), kind, amount, balanceAfter, saleId || null, note || null);
}

// A barcode may only mean one thing in the shop.
function barcodeClash(code, ignoreCardId = null) {
  if (!code) return null;
  const p = db.prepare('SELECT name FROM products WHERE barcode = ?').get(code);
  if (p) return `That barcode already belongs to ${p.name} on the shelves`;
  const c = db.prepare('SELECT id,name FROM cards WHERE barcode = ?').get(code);
  if (c && c.id !== ignoreCardId) return `That barcode already belongs to ${c.name}`;
  return null;
}

app.get('/api/cards', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM cards ORDER BY active DESC, name COLLATE NOCASE').all();
  res.json(rows.map(mapCard));
});

app.get('/api/cards/by-barcode/:code', requireAuth, (req, res) => {
  const row = findCardByBarcode(req.params.code);
  if (!row) return res.status(404).json({ error: 'No card has that barcode' });
  res.json(mapCard(row));
});

app.get('/api/cards/:id/history', requireAuth, (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const rows = db.prepare('SELECT * FROM card_txns WHERE cardId = ? ORDER BY at DESC LIMIT ?')
    .all(req.params.id, limit);
  res.json(rows);
});

app.post('/api/cards', requireGrownUp, (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const barcode = String(b.barcode || '').trim();
  if (!name) return res.status(400).json({ error: 'Give the card a name' });
  if (!barcode) return res.status(400).json({ error: 'Scan or type the card barcode' });
  const clash = barcodeClash(barcode);
  if (clash) return res.status(409).json({ error: clash });

  const id = uid();
  const opening = Math.min(1_000_000_00, Math.max(0, Math.round(Number(b.balance) || 0)));
  db.prepare(
    'INSERT INTO cards (id,name,barcode,emoji,colour,balance,active,createdAt) VALUES (?,?,?,?,?,?,1,?)'
  ).run(id, name.slice(0, 40), barcode, b.emoji || '💳',
        CARD_COLOURS.includes(b.colour) ? b.colour : 'blue', opening, new Date().toISOString());
  if (opening > 0) logTxn(id, 'topup', opening, opening, null, 'Opening balance');
  res.json(mapCard(db.prepare('SELECT * FROM cards WHERE id = ?').get(id)));
});

app.put('/api/cards/:id', requireGrownUp, (req, res) => {
  const cur = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Card not found' });
  const b = req.body || {};
  const barcode = b.barcode === undefined ? cur.barcode : String(b.barcode).trim();
  if (!barcode) return res.status(400).json({ error: 'A card needs a barcode' });
  const clash = barcodeClash(barcode, cur.id);
  if (clash) return res.status(409).json({ error: clash });

  db.prepare('UPDATE cards SET name=?, barcode=?, emoji=?, colour=?, active=? WHERE id=?').run(
    String(b.name ?? cur.name).trim().slice(0, 40) || cur.name,
    barcode,
    b.emoji ?? cur.emoji,
    CARD_COLOURS.includes(b.colour) ? b.colour : cur.colour,
    b.active === undefined ? cur.active : (b.active ? 1 : 0),
    cur.id
  );
  res.json(mapCard(db.prepare('SELECT * FROM cards WHERE id = ?').get(cur.id)));
});

app.delete('/api/cards/:id', requireGrownUp, (req, res) => {
  db.prepare('DELETE FROM card_txns WHERE cardId = ?').run(req.params.id);
  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Load money on. Grown-ups only, so pocket money stays finite.
app.post('/api/cards/:id/topup', requireGrownUp, (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  const amount = Math.round(Number(req.body?.amount) || 0);
  if (!amount) return res.status(400).json({ error: 'How much should go on?' });
  // Play money, so the ceiling is only here to catch a slipped keyboard.
  if (Math.abs(amount) > 1_000_000_00) {
    return res.status(400).json({ error: 'One load at a time, please — that is over a million' });
  }

  const next = card.balance + amount;
  if (next < 0) return res.status(400).json({ error: 'That would take the card below zero' });

  db.prepare('UPDATE cards SET balance = ? WHERE id = ?').run(next, card.id);
  logTxn(card.id, amount > 0 ? 'topup' : 'adjust', amount, next, null,
         String(req.body?.note || '').slice(0, 60) || null);
  res.json(mapCard(db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id)));
});

// ============================================================
// ONLINE ORDERS
// A customer on the ordering page (same sign-in as the till, its own
// port) builds a list and submits it here. It waits as "pending" until
// someone at the till claims it, loads it onto the scanner and takes
// payment as normal — completing that sale links back to this order.
// ============================================================
const genPickupCode = () => String(Math.floor(1000 + Math.random() * 9000));

const mapOrder = (r, items) => r && ({
  id: r.id,
  createdAt: r.createdAt,
  status: r.status,
  customerName: r.customerName,
  note: r.note,
  pickupCode: r.pickupCode,
  total: r.total,
  itemCount: r.itemCount,
  claimedAt: r.claimedAt,
  completedAt: r.completedAt,
  cancelledAt: r.cancelledAt,
  saleId: r.saleId,
  items: items || [],
});

const orderItemsFor = (id) => db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(id);
const orderWithItems = (id) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return row ? mapOrder(row, orderItemsFor(id)) : null;
};

// Placing an order. Prices and names are taken fresh from the shelves,
// never from what the browser sent, so a stale page cannot under-charge —
// and anything switched off or deleted since the page loaded is refused.
app.post('/api/orders', requireAuth, (req, res) => {
  if (getSetting('onlineOn') !== '1') {
    return res.status(403).json({ error: 'Online ordering is switched off right now' });
  }
  const b = req.body || {};
  const wanted = Array.isArray(b.items) ? b.items : [];
  if (!wanted.length) return res.status(400).json({ error: 'Your basket is empty' });

  const lines = [];
  for (const w of wanted) {
    const qty = Math.max(0, Math.min(99, Math.round(Number(w.qty) || 0)));
    if (!qty) continue;
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(w.id);
    if (!p) return res.status(400).json({ error: 'An item in your basket is no longer on the shelves — take another look.' });
    lines.push({ productId: p.id, name: p.name, emoji: p.emoji, photo: p.photo, price: p.price, qty });
  }
  if (!lines.length) return res.status(400).json({ error: 'Your basket is empty' });

  const total = lines.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = lines.reduce((s, i) => s + i.qty, 0);
  const id = uid();
  const pickupCode = genPickupCode();

  db.transaction(() => {
    db.prepare(
      'INSERT INTO orders (id,createdAt,status,customerName,note,pickupCode,total,itemCount) VALUES (?,?,?,?,?,?,?,?)'
    ).run(
      id, new Date().toISOString(), 'pending',
      String(b.customerName || '').trim().slice(0, 30) || null,
      String(b.note || '').trim().slice(0, 140) || null,
      pickupCode, total, itemCount
    );
    const ins = db.prepare(
      'INSERT INTO order_items (id,orderId,productId,name,emoji,photo,price,qty) VALUES (?,?,?,?,?,?,?,?)'
    );
    for (const l of lines) ins.run(uid(), id, l.productId, l.name, l.emoji, l.photo, l.price, l.qty);
  })();

  res.json(orderWithItems(id));
});

// Staff-side list — defaults to what still needs doing at the till.
app.get('/api/orders', requireAuth, (req, res) => {
  const status = String(req.query.status || 'pending');
  const rows = status === 'all'
    ? db.prepare('SELECT * FROM orders ORDER BY createdAt DESC LIMIT 200').all()
    : db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY createdAt ASC LIMIT 200').all(status);
  res.json(rows.map((r) => mapOrder(r, orderItemsFor(r.id))));
});

// Used both for the till's order detail and the customer's own tracking page.
app.get('/api/orders/:id', requireAuth, (req, res) => {
  const row = orderWithItems(req.params.id);
  if (!row) return res.status(404).json({ error: 'Order not found' });
  res.json(row);
});

// Picked up at the till to be processed. Guarded so two tablets tapping
// the same order at once cannot both win it.
app.post('/api/orders/:id/claim', requireAuth, (req, res) => {
  const info = db.prepare("UPDATE orders SET status = 'claimed', claimedAt = ? WHERE id = ? AND status = 'pending'")
    .run(new Date().toISOString(), req.params.id);
  if (!info.changes) {
    const row = db.prepare('SELECT status FROM orders WHERE id = ?').get(req.params.id);
    return res.status(409).json({ error: row ? `That order is already ${row.status}` : 'Order not found' });
  }
  res.json(orderWithItems(req.params.id));
});

// Puts a claimed order back in the queue — the till changed its mind
// before paying (basket cleared, wrong order picked up, and so on).
app.post('/api/orders/:id/release', requireAuth, (req, res) => {
  const info = db.prepare("UPDATE orders SET status = 'pending', claimedAt = NULL WHERE id = ? AND status = 'claimed'")
    .run(req.params.id);
  if (!info.changes) return res.status(409).json({ error: 'That order cannot be put back' });
  res.json(orderWithItems(req.params.id));
});

app.post('/api/orders/:id/cancel', requireAuth, (req, res) => {
  const info = db.prepare(
    "UPDATE orders SET status = 'cancelled', cancelledAt = ? WHERE id = ? AND status IN ('pending','claimed')"
  ).run(new Date().toISOString(), req.params.id);
  if (!info.changes) return res.status(409).json({ error: 'That order cannot be cancelled' });
  res.json(orderWithItems(req.params.id));
});

// ---------- Sales ----------
app.post('/api/sales', requireAuth, (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return res.status(400).json({ error: 'Basket is empty' });

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const byCard = b.payment === 'card';
  const orderId = b.orderId ? String(b.orderId) : null;

  // Card payments settle in one transaction: re-read the balance, check it,
  // debit it and write the sale together. A double-tap cannot overdraw.
  const settle = db.transaction(() => {
    let card = null;
    let paid;

    if (byCard) {
      card = b.cardId
        ? db.prepare('SELECT * FROM cards WHERE id = ?').get(b.cardId)
        : findCardByBarcode(b.cardBarcode || '');
      if (!card) throw Object.assign(new Error('That card is not in the shop'), { http: 404 });
      if (!card.active) throw Object.assign(new Error(`${card.name} is switched off`), { http: 403 });
      if (card.balance < total) {
        throw Object.assign(new Error('Not enough money on the card'), {
          http: 402,
          short: total - card.balance,
          balance: card.balance,
          card: mapCard(card),
        });
      }
      paid = total; // a card pays the exact amount, so there is no change
    } else {
      paid = Math.round(Number(b.paid) || 0);
    }

    const id = uid();
    db.prepare(
      'INSERT INTO sales (id,createdAt,total,paid,change,itemCount,shopper,changeCorrect,payment,cardId) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(
      id,
      new Date().toISOString(),
      total,
      paid,
      byCard ? 0 : Math.max(0, paid - total),
      itemCount,
      (b.shopper || '').slice(0, 30) || null,
      b.changeCorrect === null || b.changeCorrect === undefined ? null : b.changeCorrect ? 1 : 0,
      byCard ? 'card' : 'cash',
      card ? card.id : null
    );

    const ins = db.prepare(
      'INSERT INTO sale_items (id,saleId,productId,name,emoji,price,qty) VALUES (?,?,?,?,?,?,?)'
    );
    for (const i of items) ins.run(uid(), id, i.id || null, i.name, i.emoji || null, i.price, i.qty);

    // Paying an online order off — link it to this sale so the customer's
    // tracking page and the till's order queue both see it as done.
    let order = null;
    if (orderId) {
      const upd = db.prepare(
        "UPDATE orders SET status = 'completed', completedAt = ?, saleId = ? WHERE id = ? AND status IN ('pending','claimed')"
      ).run(new Date().toISOString(), id, orderId);
      if (upd.changes) order = orderWithItems(orderId);
    }

    if (byCard) {
      const after = card.balance - total;
      db.prepare('UPDATE cards SET balance = ? WHERE id = ?').run(after, card.id);
      logTxn(card.id, 'spend', -total, after, id, `${itemCount} item${itemCount === 1 ? '' : 's'}`);
      return { ok: true, id, total, change: 0, payment: 'card',
               card: { ...mapCard(card), balance: after }, order };
    }
    return { ok: true, id, total, change: Math.max(0, paid - total), payment: 'cash', order };
  });

  try {
    res.json(settle());
  } catch (e) {
    const status = e.http || 500;
    res.status(status).json({
      error: e.message,
      ...(e.short !== undefined ? { short: e.short, balance: e.balance, card: e.card } : {}),
    });
  }
});

app.get('/api/sales', requireGrownUp, (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const rows = db.prepare('SELECT * FROM sales ORDER BY createdAt DESC LIMIT ?').all(limit);
  const items = db.prepare('SELECT * FROM sale_items WHERE saleId = ?');
  res.json(rows.map((s) => ({ ...s, items: items.all(s.id) })));
});

app.get('/api/stats', requireGrownUp, (req, res) => {
  const s = db.prepare(
    'SELECT COUNT(*) sales, COALESCE(SUM(total),0) revenue, COALESCE(SUM(itemCount),0) items FROM sales'
  ).get();
  const quiz = db.prepare(
    'SELECT COUNT(*) asked, COALESCE(SUM(changeCorrect),0) correct FROM sales WHERE changeCorrect IS NOT NULL'
  ).get();
  const top = db.prepare(
    'SELECT name, emoji, SUM(qty) qty FROM sale_items GROUP BY name ORDER BY qty DESC LIMIT 8'
  ).all();
  res.json({ ...s, quizAsked: quiz.asked, quizRight: quiz.correct, top });
});

app.post('/api/sales/clear', requireGrownUp, (req, res) => {
  db.exec('DELETE FROM sale_items; DELETE FROM sales;');
  res.json({ ok: true });
});

// ---------- Backup / restore ----------
app.get('/api/backup', requireGrownUp, (req, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: readLocalVersion(),
    settings: db.prepare('SELECT * FROM settings')
      .all().filter((r) => !['pin', 'authHash', 'authSalt'].includes(r.key)),
    products: db.prepare('SELECT * FROM products').all(),
    cards: db.prepare('SELECT * FROM cards').all(),
  };
  res.setHeader('Content-Disposition', `attachment; filename="scanner-backup-${Date.now()}.json"`);
  res.json(payload);
});

app.post('/api/restore', requireGrownUp, (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.products)) return res.status(400).json({ error: 'That file has no products in it' });
  const tx = db.transaction(() => {
    db.exec('DELETE FROM products');
    const ins = db.prepare(
      'INSERT INTO products (id,name,emoji,photo,price,category,barcode,sortOrder,active) VALUES (?,?,?,?,?,?,?,?,?)'
    );
    b.products.forEach((p, i) =>
      ins.run(p.id || uid(), p.name, p.emoji || '🛒', p.photo || null, p.price || 0, p.category || 'Pantry', p.barcode || null, p.sortOrder ?? i, p.active === 0 ? 0 : 1)
    );
    if (Array.isArray(b.cards)) {
      db.exec('DELETE FROM cards');
      const insC = db.prepare(
        'INSERT INTO cards (id,name,barcode,emoji,colour,balance,active,createdAt) VALUES (?,?,?,?,?,?,?,?)'
      );
      for (const c of b.cards) {
        if (!c.barcode) continue;
        insC.run(c.id || uid(), c.name || 'Card', c.barcode, c.emoji || '💳',
                 c.colour || 'blue', Math.max(0, c.balance || 0),
                 c.active === 0 ? 0 : 1, c.createdAt || new Date().toISOString());
      }
    }
    if (Array.isArray(b.settings)) {
      for (const s of b.settings) if (s.key !== 'pin') setSetting(s.key, s.value);
    }
  });
  tx();
  res.json({ ok: true, products: b.products.length });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: readLocalVersion(), uptime: Math.round(process.uptime()) });
});


// ============================================================
// IN-APP UPDATER
// ============================================================
const REPO_DIR = process.env.REPO_DIR || '/opt/scanner-src';
const INSTALL_DIR = process.env.INSTALL_DIR || '/opt/scanner';
const UPDATER_LOG = path.join(DATA_DIR, 'updater.log');
const UPDATER_STATE = path.join(DATA_DIR, 'updater.state');

function readLocalVersion() {
  for (const p of [path.join(INSTALL_DIR, 'VERSION'), path.join(__dirname, '..', 'VERSION')]) {
    try { return fs.readFileSync(p, 'utf8').trim(); } catch {}
  }
  return 'unknown';
}
function readChangelog() {
  for (const p of [path.join(INSTALL_DIR, 'CHANGELOG.md'), path.join(__dirname, '..', 'CHANGELOG.md')]) {
    try { return fs.readFileSync(p, 'utf8'); } catch {}
  }
  return '';
}
function readUpdaterState() {
  try { return fs.readFileSync(UPDATER_STATE, 'utf8').trim(); } catch { return 'idle'; }
}
function readUpdaterLog(maxLines = 200) {
  try {
    return fs.readFileSync(UPDATER_LOG, 'utf8').split('\n').slice(-maxLines).join('\n');
  } catch { return ''; }
}

app.get('/api/updater/version', requireAuth, (req, res) => {
  let sha = null, branch = null;
  try {
    sha = execSync(`git -C ${REPO_DIR} rev-parse HEAD`, { encoding: 'utf8' }).trim().slice(0, 8);
    branch = execSync(`git -C ${REPO_DIR} rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' }).trim();
  } catch {}
  res.json({
    version: readLocalVersion(),
    sha,
    branch,
    repoConfigured: fs.existsSync(REPO_DIR + '/.git'),
  });
});

app.get('/api/updater/check', requireGrownUp, (req, res) => {
  if (!fs.existsSync(REPO_DIR + '/.git')) {
    return res.status(400).json({ error: 'Updater not set up on this server.' });
  }
  try {
    execSync(`git -C ${REPO_DIR} fetch origin main`, { stdio: 'pipe', timeout: 30000 });
    const remoteVersion = execSync(`git -C ${REPO_DIR} show origin/main:VERSION`, { encoding: 'utf8' }).trim();
    const localSha = execSync(`git -C ${REPO_DIR} rev-parse HEAD`, { encoding: 'utf8' }).trim();
    const remoteSha = execSync(`git -C ${REPO_DIR} rev-parse origin/main`, { encoding: 'utf8' }).trim();
    res.json({
      currentVersion: readLocalVersion(),
      latestVersion: remoteVersion,
      updateAvailable: localSha !== remoteSha,
      currentSha: localSha.slice(0, 8),
      latestSha: remoteSha.slice(0, 8),
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: 'Check failed: ' + (e.message || 'unknown') });
  }
});

// Root-owned wrappers, outside the git tree so a pull can never break them.
// Falls back to calling the script through bash on older installs, which
// works even when git has stripped the executable bit.
const WRAPPER = { update: '/usr/local/sbin/scanner-update', rollback: '/usr/local/sbin/scanner-rollback' };

function launcherFor(kind) {
  const script = `${REPO_DIR}/scripts/${kind === 'update' ? 'updater' : 'rollback'}.sh`;
  if (fs.existsSync(WRAPPER[kind])) return { cmd: WRAPPER[kind], args: [], direct: WRAPPER[kind] };
  return { cmd: 'sudo', args: ['-n', '/bin/bash', script], direct: script };
}

function noteFailure(kind, why) {
  const line = `\n[${new Date().toLocaleTimeString()}] ${kind} could not start: ${why}\n`;
  try { fs.appendFileSync(UPDATER_LOG, line); } catch {}
  try { fs.writeFileSync(UPDATER_STATE, 'failed'); } catch {}
}

// Runs the real thing, but keeps hold of the outcome so a silent
// failure becomes something the Updates screen can actually show.
function runMaintenance(kind, extraArgs = []) {
  const l = launcherFor(kind);
  const argv = l.cmd === 'sudo'
    ? [...l.args, ...extraArgs]          // sudo -n /bin/bash <script> [args]
    : ['-n', l.cmd, ...extraArgs];       // sudo -n /usr/local/sbin/scanner-update [args]

  let stderr = '';
  const child = spawn('sudo', argv, { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });

  child.stderr?.on('data', (d) => { stderr += d.toString().slice(0, 2000); });
  child.on('error', (e) => noteFailure(kind, e.message));
  child.on('exit', (code) => {
    if (code === 0) return;
    const hint = /password|not allowed|may not run/i.test(stderr)
      ? 'the scanner user may not run it without a password — re-run install.sh'
      : /command not found|No such file/i.test(stderr)
        ? 'the script is missing or not executable — re-run install.sh'
        : stderr.trim() || `exit code ${code}`;
    noteFailure(kind, hint);
  });
  child.unref();
  return true;
}

app.post('/api/updater/update', requireGrownUp, (req, res) => {
  const state = readUpdaterState();
  if (state === 'running' || state === 'rolling-back') {
    return res.status(409).json({ error: 'An update is already running.' });
  }
  if (!fs.existsSync(REPO_DIR + '/scripts/updater.sh')) {
    return res.status(400).json({ error: 'Updater not set up on this server.' });
  }
  try { fs.writeFileSync(UPDATER_STATE, 'idle'); } catch {}
  runMaintenance('update', req.body?.force ? ['--force'] : []);
  res.json({ ok: true, message: 'Update started' });
});

app.post('/api/updater/rollback', requireGrownUp, (req, res) => {
  const state = readUpdaterState();
  if (state === 'running' || state === 'rolling-back') {
    return res.status(409).json({ error: 'An update is already running.' });
  }
  if (!fs.existsSync(path.join(DATA_DIR, 'previous-sha'))) {
    return res.status(400).json({ error: 'No previous version to go back to.' });
  }
  runMaintenance('rollback');
  res.json({ ok: true, message: 'Rollback started' });
});

// Clears a state file left stuck on "running" by an update that died
// before it could tidy up, which otherwise blocks every later attempt.
app.post('/api/updater/reset', requireGrownUp, (req, res) => {
  try { fs.writeFileSync(UPDATER_STATE, 'idle'); } catch {}
  res.json({ ok: true, state: 'idle' });
});

// Checks the plumbing without actually updating: can the app run the
// updater at all, and is anything jammed?
app.get('/api/updater/preflight', requireGrownUp, (req, res) => {
  const l = launcherFor('update');
  const checks = {
    repoPresent: fs.existsSync(REPO_DIR + '/.git'),
    scriptPresent: fs.existsSync(REPO_DIR + '/scripts/updater.sh'),
    wrapperPresent: fs.existsSync(WRAPPER.update),
    state: readUpdaterState(),
  };
  try {
    const probe = l.cmd === 'sudo' ? `/bin/bash ${l.direct}` : l.cmd;
    execSync(`sudo -n ${probe} --preflight`, { stdio: 'pipe', timeout: 15000 });
    checks.canRunAsRoot = true;
  } catch (e) {
    checks.canRunAsRoot = false;
    checks.reason = (e.stderr?.toString() || e.message || '').trim().slice(0, 300);
  }
  checks.ok = checks.repoPresent && checks.scriptPresent && checks.canRunAsRoot
              && checks.state !== 'running';
  res.json(checks);
});

app.get('/api/updater/status', requireAuth, (req, res) => {
  res.json({
    state: readUpdaterState(),
    log: readUpdaterLog(200),
    hasPrevious: fs.existsSync(path.join(DATA_DIR, 'previous-sha')),
  });
});

app.post('/api/updater/dismiss', requireGrownUp, (req, res) => {
  const state = readUpdaterState();
  if (state === 'running' || state === 'rolling-back') {
    return res.status(409).json({ error: 'An update is still running.' });
  }
  try { fs.writeFileSync(UPDATER_STATE, 'idle'); } catch {}
  res.json({ ok: true });
});

app.get('/api/updater/changelog', requireAuth, (req, res) => {
  res.type('text/markdown').send(readChangelog());
});

// Any /api path we did not match is a 404 in JSON, never the SPA shell.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// The online ordering page, reachable by path on any port (handy for
// testing, or if a device can only see the till's usual port) as well as
// straight off the root of ONLINE_PORT via the rewrite above.
app.get(['/shop', '/shop/'], (req, res) => {
  if (fs.existsSync(SHOP_HTML)) return res.sendFile(SHOP_HTML);
  res.status(404).send('The shop page has not been built yet — run `npm run build` in client/.');
});

// ---------- SPA ----------
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/photos/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// ============================================================
// LISTENERS — plain HTTP, plus HTTPS so tablet cameras work,
// plus the online-shop port (same app, same data, own address)
// ============================================================
http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`Scanner v${readLocalVersion()} — http  on port ${PORT}`);
  console.log(`Data: ${DATA_DIR}`);
  const ips = localAddresses();
  if (ips.length) console.log(`Open: http://${ips[0]}:${PORT}`);
});

if (HTTPS_ON) {
  const creds = ensureCert(CERT_DIR);
  if (creds) {
    https.createServer({ key: creds.key, cert: creds.cert }, app).listen(HTTPS_PORT, '0.0.0.0', () => {
      httpsListening = true;
      console.log(`Scanner v${readLocalVersion()} — https on port ${HTTPS_PORT}` +
        (creds.regenerated ? ' (new self-signed certificate)' : ''));
      const ips = localAddresses();
      if (ips.length) console.log(`Camera scanning: https://${ips[0]}:${HTTPS_PORT}`);
    }).on('error', (e) => {
      httpsListening = false;
      console.warn(`HTTPS could not start on ${HTTPS_PORT}: ${e.message}`);
    });
  } else {
    console.warn('HTTPS skipped — openssl not available, so no certificate could be made.');
    console.warn('The camera scanner will not work over plain http on a LAN address.');
  }
}

if (ONLINE_ON) {
  http.createServer(app).listen(ONLINE_PORT, '0.0.0.0', () => {
    onlineListening = true;
    console.log(`Scanner v${readLocalVersion()} — online shop on port ${ONLINE_PORT}`);
    const ips = localAddresses();
    if (ips.length) console.log(`Online shop: http://${ips[0]}:${ONLINE_PORT}`);
  }).on('error', (e) => {
    onlineListening = false;
    console.warn(`Online shop could not start on ${ONLINE_PORT}: ${e.message}`);
  });
}
