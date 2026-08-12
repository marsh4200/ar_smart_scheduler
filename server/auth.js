// ============================================================
// Scanner — accounts, passwords and sessions
// Sessions live in SQLite so a restart (or an update) does not
// sign the tablet out mid-game.
// ============================================================
import crypto from 'crypto';

const SESSION_SHORT_MS = 12 * 60 * 60 * 1000;      // 12 hours
const SESSION_LONG_MS = 60 * 24 * 60 * 60 * 1000;  // 60 days ("keep me signed in")
const GROWNUP_MS = 8 * 60 * 60 * 1000;             // PIN unlock lasts 8 hours

const LOCK_AFTER = 8;                // failed sign-ins before a cool-off
const LOCK_MS = 5 * 60 * 1000;       // length of the cool-off

export function createAuth(db, getSetting, setSetting) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token        TEXT PRIMARY KEY,
      createdAt    INTEGER NOT NULL,
      expiresAt    INTEGER NOT NULL,
      grownUpUntil INTEGER NOT NULL DEFAULT 0,
      ttl          INTEGER NOT NULL,
      agent        TEXT
    );
  `);

  const q = {
    get: db.prepare('SELECT * FROM sessions WHERE token = ?'),
    ins: db.prepare('INSERT INTO sessions (token,createdAt,expiresAt,grownUpUntil,ttl,agent) VALUES (?,?,?,0,?,?)'),
    touch: db.prepare('UPDATE sessions SET expiresAt = ? WHERE token = ?'),
    grown: db.prepare('UPDATE sessions SET grownUpUntil = ? WHERE token = ?'),
    del: db.prepare('DELETE FROM sessions WHERE token = ?'),
    clear: db.prepare('DELETE FROM sessions'),
    sweep: db.prepare('DELETE FROM sessions WHERE expiresAt < ?'),
    count: db.prepare('SELECT COUNT(*) n FROM sessions WHERE expiresAt > ?'),
  };

  // ---------- passwords ----------
  const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');

  function setPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    setSetting('authSalt', salt);
    setSetting('authHash', hash(password, salt));
  }

  function checkPassword(password) {
    const salt = getSetting('authSalt');
    const want = getSetting('authHash');
    if (!salt || !want) return false;
    const got = hash(password, salt);
    const a = Buffer.from(got, 'hex');
    const b = Buffer.from(want, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // First boot: admin / scanner, flagged so the app can nag until it changes.
  if (!getSetting('authHash')) {
    setSetting('authUser', 'admin');
    setPassword('scanner');
    setSetting('authDefault', '1');
  }

  // ---------- sign-in throttle ----------
  const misses = new Map(); // ip -> { n, until }

  function lockedFor(ip) {
    const m = misses.get(ip);
    if (!m || !m.until) return 0;
    const left = m.until - Date.now();
    if (left <= 0) { misses.delete(ip); return 0; }
    return Math.ceil(left / 1000);
  }
  function noteMiss(ip) {
    const m = misses.get(ip) || { n: 0, until: 0 };
    m.n += 1;
    if (m.n >= LOCK_AFTER) { m.until = Date.now() + LOCK_MS; m.n = 0; }
    misses.set(ip, m);
  }
  const clearMisses = (ip) => misses.delete(ip);

  // ---------- sessions ----------
  const newToken = () => crypto.randomBytes(24).toString('hex');

  function createSession(remember, agent) {
    const ttl = remember ? SESSION_LONG_MS : SESSION_SHORT_MS;
    const token = newToken();
    const now = Date.now();
    q.ins.run(token, now, now + ttl, ttl, String(agent || '').slice(0, 120));
    return { token, expiresAt: now + ttl };
  }

  function tokenFrom(req) {
    const h = req.headers.authorization || '';
    return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  }

  // Reads the session and slides its expiry forward. Returns null when
  // there is no session, or it has run out.
  function sessionFor(req) {
    const t = tokenFrom(req);
    if (!t) return null;
    const row = q.get.get(t);
    if (!row) return null;
    const now = Date.now();
    if (row.expiresAt < now) { q.del.run(t); return null; }
    if (row.expiresAt - now < row.ttl - 60_000) q.touch.run(now + row.ttl, t); // slide, but not on every call
    return row;
  }

  const isAuthed = (req) => !!sessionFor(req);

  function isGrownUp(req) {
    const s = sessionFor(req);
    return !!s && s.grownUpUntil > Date.now();
  }

  function elevate(req) {
    const s = sessionFor(req);
    if (!s) return false;
    q.grown.run(Date.now() + GROWNUP_MS, s.token);
    return true;
  }

  function dropSession(req) {
    const t = tokenFrom(req);
    if (t) q.del.run(t);
  }

  const signOutEverywhere = () => q.clear.run();
  const activeSessions = () => q.count.get(Date.now()).n;

  // ---------- middleware ----------
  function requireAuth(req, res, next) {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Please sign in' });
    next();
  }
  function requireGrownUp(req, res, next) {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Please sign in' });
    if (!isGrownUp(req)) return res.status(403).json({ error: 'Grown-up PIN needed' });
    next();
  }

  // Housekeeping every hour.
  setInterval(() => { try { q.sweep.run(Date.now()); } catch {} }, 60 * 60 * 1000).unref?.();
  q.sweep.run(Date.now());

  return {
    setPassword, checkPassword,
    createSession, sessionFor, isAuthed, isGrownUp, elevate, dropSession,
    signOutEverywhere, activeSessions,
    requireAuth, requireGrownUp,
    lockedFor, noteMiss, clearMisses,
  };
}
