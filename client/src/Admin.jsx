import { useState, useEffect, useRef } from 'react';
import { api, money } from './lib.js';
import Cards from './Cards.jsx';

const CATEGORIES = ['Fruit & Veg', 'Dairy', 'Bakery', 'Meat', 'Pantry', 'Snacks', 'Drinks', 'Household'];
const EMOJI = ['🛒','🥛','🍞','🥚','🧀','🧈','🍨','🍌','🍎','🍅','🥕','🥔','🧅','🍊','🍇','🍓','🥦','🌽','🍗','🥩','🐟','🥓','🍚','🍝','🥣','🍬','☕','🫖','🥜','🍯','🍟','🍫','🍪','🍿','🍦','🧃','🥤','💧','🧻','🧼','🪥','🧺','🦴','💡','🥫','🧂','🍕','🍔'];

const toCents = (r) => Math.round(parseFloat(String(r).replace(',', '.') || 0) * 100);
const toRand = (c) => (c / 100).toFixed(2);

export default function Admin({ settings, onClose, onSettings, onSignOut }) {
  // Signed in is not the same as unlocked: the PIN is a second door,
  // so a tablet left on the till cannot wander into the settings.
  const [unlocked, setUnlocked] = useState(!!settings.grownUp);
  const [tab, setTab] = useState('shelves');

  // The 8-hour unlock may have run out while the app was closed.
  useEffect(() => {
    if (!unlocked) return;
    api('/settings')
      .then((s) => { if (!s.grownUp) setUnlocked(false); })
      .catch(() => {});
  }, [unlocked]);

  if (!unlocked) return <PinGate onOpen={() => setUnlocked(true)} onClose={onClose} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">⚙️</div>
          <div className="brand-text">
            <h1>Grown-up area</h1>
            <p>v{settings.version}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" title="Back to the shop" onClick={onClose}>🛒</button>
        </div>
      </header>

      <div style={{ padding: 16, paddingBottom: 60, maxWidth: 760, width: '100%', margin: '0 auto' }}>
        <div className="tabs">
          {[['shelves', 'Items'], ...(settings.cardsOn ? [['cards', 'Cards']] : []),
            ['shop', 'Shop setup'], ['sales', 'Sales'], ['updates', 'Updates']].map(([k, l]) => (
            <button key={k} className={'chip' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'shelves' && <Items sym={settings.currencySymbol} />}
        {tab === 'cards' && <Cards sym={settings.currencySymbol} />}
        {tab === 'shop' && <ShopSetup settings={settings} onSettings={onSettings} onSignOut={onSignOut} />}
        {tab === 'sales' && <Sales sym={settings.currencySymbol} />}
        {tab === 'updates' && <Updates />}
      </div>
    </div>
  );
}

// ============================================================
function PinGate({ onOpen, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);

  const submit = async (value) => {
    try {
      await api('/grownup/login', { method: 'POST', body: JSON.stringify({ pin: value }) });
      onOpen();
    } catch (e) {
      setError(e.message);
      setPin('');
    }
  };

  const press = (d) => {
    const next = (pin + d).slice(0, 8);
    setPin(next);
    setError(null);
    if (next.length === 4) submit(next);
  };

  return (
    <div className="sheet-bg" style={{ alignItems: 'center' }}>
      <div className="sheet" style={{ borderRadius: 28, maxWidth: 380 }}>
        <div className="sheet-head">
          <h2>Grown-ups only</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <p className="sub">Enter the PIN to change items and settings.</p>

        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => <i key={i} className={pin.length > i ? 'on' : ''} />)}
        </div>

        {error && <div className="banner bad">{error}</div>}
      {status.state === 'failed' && (
        <div className="banner bad">
          The last update did not start. The log below says why.
          <button className="mini-btn" style={{ marginLeft: 10 }} onClick={clearStuck}>Clear</button>
        </div>
      )}

        <div className="pinpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button key={d} onClick={() => press(String(d))}>{d}</button>
          ))}
          <button onClick={() => setPin('')}>C</button>
          <button onClick={() => press('0')}>0</button>
          <button onClick={() => submit(pin)}>→</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
function Items({ sym }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api('/products?all=1').then(setItems).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  const blank = { name: '', emoji: '🛒', price: 0, category: 'Pantry', barcode: '', active: true };

  return (
    <>
      {msg && <div className="banner warn">{msg}</div>}

      <button className="big-btn wide grape" style={{ marginBottom: 14 }} onClick={() => setEditing(blank)}>
        + Add an item
      </button>

      <div className="card">
        <h3>{items.length} items on the shelves</h3>
        {items.map((p) => (
          <div className="admin-item" key={p.id}>
            <span className="a-art">{p.photo ? <img src={'/photos/' + p.photo} alt="" /> : p.emoji}</span>
            <div style={{ minWidth: 0 }}>
              <div className="a-name">{p.name}{!p.active && ' (hidden)'}</div>
              <div className="a-meta">{money(p.price, sym)} · {p.category}{p.barcode ? ' · ' + p.barcode : ''}</div>
            </div>
            <div className="a-actions">
              <button className="mini-btn" onClick={() => setEditing(p)}>Edit</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ItemEditor item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </>
  );
}

function ItemEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ ...item, priceR: toRand(item.price || 0) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [photo, setPhoto] = useState(item.photo);
  const fileRef = useRef(null);
  const isNew = !item.id;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = JSON.stringify({
        name: form.name, emoji: form.emoji, price: toCents(form.priceR),
        category: form.category, barcode: form.barcode, active: form.active,
      });
      const saved = isNew
        ? await api('/products', { method: 'POST', body })
        : await api('/products/' + item.id, { method: 'PUT', body });
      const file = fileRef.current?.files?.[0];
      if (file) {
        const fd = new FormData();
        fd.append('photo', file);
        await api(`/products/${saved.id}/photo`, { method: 'POST', body: fd });
      }
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${form.name} from the shop?`)) return;
    await api('/products/' + item.id, { method: 'DELETE' });
    onSaved();
  };

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{isNew ? 'New item' : 'Edit item'}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner bad">{error}</div>}
      {status.state === 'failed' && (
        <div className="banner bad">
          The last update did not start. The log below says why.
          <button className="mini-btn" style={{ marginLeft: 10 }} onClick={clearStuck}>Clear</button>
        </div>
      )}

        <div className="field">
          <label>Name</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Milk 2L" />
        </div>

        <div className="row">
          <div className="field">
            <label>Price</label>
            <input value={form.priceR} inputMode="decimal" onChange={(e) => set('priceR', e.target.value)} placeholder="22.99" />
          </div>
          <div className="field">
            <label>Shelf</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Barcode (scan into this box to fill it)</label>
          <input value={form.barcode || ''} onChange={(e) => set('barcode', e.target.value)} placeholder="6001234567890" />
        </div>

        <div className="field">
          <label>Picture</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <span className="a-art" style={{ fontSize: 40, width: 56, height: 56 }}>
              {photo ? <img src={'/photos/' + photo} alt="" /> : form.emoji}
            </span>
            <input type="file" accept="image/*" ref={fileRef} style={{ border: 'none', padding: 0 }} />
            {photo && !isNew && (
              <button className="mini-btn danger" onClick={async () => {
                await api(`/products/${item.id}/photo`, { method: 'DELETE' });
                setPhoto(null);
              }}>Remove photo</button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EMOJI.map((e) => (
              <button key={e} onClick={() => set('emoji', e)}
                style={{
                  fontSize: 22, padding: '4px 6px', borderRadius: 8,
                  border: form.emoji === e ? '3px solid var(--ink)' : '2px solid transparent',
                  background: form.emoji === e ? 'var(--sunshine)' : 'var(--shelf-deep)',
                }}>{e}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>
            <input type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }} />
            Show this item in the shop
          </label>
        </div>

        <button className="big-btn wide" onClick={save} disabled={busy || !form.name}>
          {busy ? 'Saving…' : 'Save item'}
        </button>
        {!isNew && (
          <button className="big-btn wide red" style={{ marginTop: 10 }} onClick={remove}>Delete item</button>
        )}
      </div>
    </div>
  );
}

// ============================================================
function ShopSetup({ settings, onSettings, onSignOut }) {
  const [form, setForm] = useState(settings);
  const [msg, setMsg] = useState(null);
  const [pin, setPin] = useState('');
  const [account, setAccount] = useState({ username: settings.username || '', password: '' });
  const [accountMsg, setAccountMsg] = useState(null);
  const [accountOk, setAccountOk] = useState(false);
  const restoreRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const saveAccount = async () => {
    try {
      const r = await api('/account', {
        method: 'POST',
        body: JSON.stringify({ username: account.username, password: account.password || undefined }),
      });
      localStorage.setItem('scanner_user', r.username);
      setAccount({ username: r.username, password: '' });
      setAccountOk(true);
      setAccountMsg('Sign-in details saved.');
    } catch (e) {
      setAccountOk(false);
      setAccountMsg(e.message);
    }
  };

  const signOutEverywhere = async () => {
    if (!confirm('Sign out every device, including this one?')) return;
    try { await api('/sessions/clear', { method: 'POST' }); } catch {}
    localStorage.removeItem('scanner_token');
    location.reload();
  };

  const save = async () => {
    await api('/settings', { method: 'PUT', body: JSON.stringify(form) });
    onSettings(form);
    setMsg('Shop settings saved.');
  };

  const savePin = async () => {
    try {
      await api('/grownup/pin', { method: 'POST', body: JSON.stringify({ pin }) });
      setPin('');
      setMsg('PIN changed.');
    } catch (e) { setMsg(e.message); }
  };

  const backup = async () => {
    const data = await api('/backup');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scanner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const restore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('This replaces every item in the shop. Carry on?')) return;
    const text = await file.text();
    try {
      const r = await api('/restore', { method: 'POST', body: text });
      setMsg(`Restored ${r.products} items.`);
    } catch (err) { setMsg(err.message); }
  };

  return (
    <>
      {msg && <div className="banner ok">{msg}</div>}

      <div className="card">
        <h3>Shop</h3>
        <div className="field">
          <label>Shop name</label>
          <input value={form.shopName} onChange={(e) => set('shopName', e.target.value)} />
        </div>
        <div className="field">
          <label>Line under the name</label>
          <input value={form.shopTagline} onChange={(e) => set('shopTagline', e.target.value)} />
        </div>
        <div className="field">
          <label>Money symbol</label>
          <input value={form.currencySymbol} onChange={(e) => set('currencySymbol', e.target.value)} style={{ maxWidth: 100 }} />
        </div>
        <div className="field">
          <label><input type="checkbox" checked={form.showPrices} onChange={(e) => set('showPrices', e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />Show prices</label>
        </div>
        <div className="field">
          <label><input type="checkbox" checked={!!form.tapToAddOn} onChange={(e) => set('tapToAddOn', e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />Let the shelves be tapped as well as scanned</label>
          <p className="sub" style={{ margin: '4px 0 0 26px' }}>Off by default, so items only reach the list by scanning. Turn on and a 🏪 button appears next to the camera.</p>
        </div>
        <div className="field">
          <label><input type="checkbox" checked={form.changeQuizOn} onChange={(e) => set('changeQuizOn', e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />Ask "how much change?" at the till</label>
        </div>
        <div className="field">
          <label><input type="checkbox" checked={form.soundOn} onChange={(e) => set('soundOn', e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />Beeps and sounds</label>
          <label><input type="checkbox" checked={!!form.cardsOn} onChange={(e) => set('cardsOn', e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />Let the kids pay with a bank card</label>
        </div>
        <div className="field">
          <label><input type="checkbox" checked={!!form.onlineOn} onChange={(e) => set('onlineOn', e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />Let people order from the online shop</label>
          <p className="sub" style={{ margin: '4px 0 0 26px' }}>
            Orders sent in show up under 🛍️ at the till, ready to load on and ring up.
          </p>
        </div>
        <button className="big-btn wide" onClick={save}>Save shop settings</button>
      </div>

      <div className="card">
        <h3>Online shop</h3>
        <p className="sub">
          Open this address on another phone, tablet or laptop on the same network to shop and place an
          order — it sends straight to the 🛍️ button at the till. Same sign-in as here.
        </p>
        {settings.onlinePort ? (
          <div className="banner ok" style={{ userSelect: 'all' }}>
            http://{typeof window !== 'undefined' ? window.location.hostname : 'server-ip'}:{settings.onlinePort}
          </div>
        ) : (
          <div className="banner warn">
            The online shop isn't running right now — restart the scanner service to switch it on.
          </div>
        )}
      </div>

      <div className="card">
        <h3>Sign-in for this shop</h3>
        <p className="sub">
          Everyone who opens the shop needs these. The PIN below is a separate, second door
          into this grown-up area.
        </p>
        {settings.defaultLogin && (
          <div className="banner warn">
            Still on the starter password. Change it so the shop is not open to anyone on the network.
          </div>
        )}
        {accountMsg && <div className={'banner ' + (accountOk ? 'ok' : 'bad')}>{accountMsg}</div>}
        <div className="field">
          <label>Username</label>
          <input
            value={account.username}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            onChange={(e) => setAccount({ ...account, username: e.target.value })}
          />
        </div>
        <div className="field">
          <label>New password (leave blank to keep the current one)</label>
          <input
            type="password"
            value={account.password}
            autoComplete="new-password"
            placeholder="at least 6 characters"
            onChange={(e) => setAccount({ ...account, password: e.target.value })}
          />
        </div>
        <button className="big-btn wide grape" onClick={saveAccount}>Save sign-in details</button>
        <button className="big-btn wide ghost" style={{ marginTop: 10 }} onClick={signOutEverywhere}>
          Sign out every other device
        </button>
      </div>

      <div className="card">
        <h3>Grown-up PIN</h3>
        <div className="field">
          <label>New PIN (4 to 8 numbers)</label>
          <input value={pin} inputMode="numeric" onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="1234" />
        </div>
        <button className="big-btn wide grape" onClick={savePin} disabled={pin.length < 4}>Change PIN</button>
      </div>

      <div className="card">
        <h3>Backup</h3>
        <p className="sub">Save the items and settings to a file, or load them back later.</p>
        <button className="big-btn wide ghost" onClick={backup}>Download backup</button>
        <input type="file" accept="application/json" ref={restoreRef} onChange={restore} style={{ display: 'none' }} />
        <button className="big-btn wide ghost" style={{ marginTop: 10 }} onClick={() => restoreRef.current.click()}>
          Restore from a file
        </button>
      </div>

      <div className="card">
        <h3>Leaving</h3>
        <button className="big-btn wide ghost" onClick={async () => {
          try { await api('/grownup/logout', { method: 'POST' }); } catch {}
          location.reload();
        }}>Lock the grown-up area</button>
        <p className="sub" style={{ margin: '8px 0 10px' }}>
          Locks the settings but leaves the shop open for the kids.
        </p>
        <button className="big-btn wide red" onClick={onSignOut}>Sign out of this tablet</button>
      </div>
    </>
  );
}

// ============================================================
function Sales({ sym }) {
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);

  const load = () => {
    api('/stats').then(setStats).catch(() => {});
    api('/sales?limit=30').then(setSales).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  return (
    <>
      {stats && (
        <div className="card">
          <h3>How the shop is doing</h3>
          <div className="admin-item"><div className="a-name">Sales rung up</div><div className="line-total">{stats.sales}</div></div>
          <div className="admin-item"><div className="a-name">Items sold</div><div className="line-total">{stats.items}</div></div>
          <div className="admin-item"><div className="a-name">Play money taken</div><div className="line-total">{money(stats.revenue, sym)}</div></div>
          {stats.quizAsked > 0 && (
            <div className="admin-item">
              <div className="a-name">Change questions right</div>
              <div className="line-total">{stats.quizRight} / {stats.quizAsked}</div>
            </div>
          )}
          {stats.top?.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}>Favourites</h3>
              {stats.top.map((t) => (
                <div className="admin-item" key={t.name}>
                  <span className="a-art">{t.emoji}</span>
                  <div className="a-name">{t.name}</div>
                  <div className="line-total">×{t.qty}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3>Recent tills</h3>
        {!sales.length && <p className="sub">No sales yet. Go and play shop!</p>}
        {sales.map((s) => (
          <div className="admin-item" key={s.id}>
            <div style={{ minWidth: 0 }}>
              <div className="a-name">{money(s.total, sym)} · {s.itemCount} items</div>
              <div className="a-meta">
                {new Date(s.createdAt).toLocaleString()}
                {s.changeCorrect !== null && (s.changeCorrect ? ' · change ✓' : ' · change ✗')}
              </div>
            </div>
          </div>
        ))}
        {sales.length > 0 && (
          <button className="big-btn wide red" style={{ marginTop: 12 }} onClick={async () => {
            if (!confirm('Clear all sales history?')) return;
            await api('/sales/clear', { method: 'POST' });
            load();
          }}>Clear sales history</button>
        )}
      </div>
    </>
  );
}

// ============================================================
function Updates() {
  const [info, setInfo] = useState(null);
  const [check, setCheck] = useState(null);
  const [status, setStatus] = useState({ state: 'idle', log: '', hasPrevious: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/updater/version').then(setInfo).catch(() => {});
    const poll = setInterval(() => {
      api('/updater/status').then(setStatus).catch(() => {});
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  const running = status.state === 'running' || status.state === 'rolling-back';

  const doCheck = async () => {
    setBusy(true); setError(null);
    try { setCheck(await api('/updater/check')); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };

  // Look before leaping: if the app cannot actually run the updater,
  // say so here rather than pretending an update started.
  const doUpdate = async (force = false) => {
    setBusy(true); setError(null);
    try {
      const pre = await api('/updater/preflight');
      if (!pre.canRunAsRoot) {
        setError(
          'The app is not allowed to run the updater on this server' +
          (pre.reason ? ` (${pre.reason})` : '') +
          '. Re-run install.sh, or update over SSH with: sudo scanner-update'
        );
        setBusy(false);
        return;
      }
      if (pre.state === 'running') {
        setError('An update looks stuck. Tap "Clear stuck update" below, then try again.');
        setBusy(false);
        return;
      }
      await api('/updater/update', { method: 'POST', body: JSON.stringify({ force }) });
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const clearStuck = async () => {
    try { await api('/updater/reset', { method: 'POST' }); setError(null); }
    catch (e) { setError(e.message); }
  };

  const doRollback = async () => {
    if (!confirm('Go back to the previous version?')) return;
    try { await api('/updater/rollback', { method: 'POST' }); }
    catch (e) { setError(e.message); }
  };

  return (
    <>
      {error && <div className="banner bad">{error}</div>}
      {status.state === 'failed' && (
        <div className="banner bad">
          The last update did not start. The log below says why.
          <button className="mini-btn" style={{ marginLeft: 10 }} onClick={clearStuck}>Clear</button>
        </div>
      )}
      {status.state === 'done' && (
        <div className="banner ok">
          Update finished. Reload the page to see the new version.
          <button className="mini-btn" style={{ marginLeft: 10 }} onClick={async () => {
            await api('/updater/dismiss', { method: 'POST' });
            location.reload();
          }}>Reload</button>
        </div>
      )}
      {status.state === 'failed' && (
        <div className="banner bad">
          The update failed. The log below says what happened.
          <button className="mini-btn" style={{ marginLeft: 10 }} onClick={() => api('/updater/dismiss', { method: 'POST' })}>Dismiss</button>
        </div>
      )}

      <div className="card">
        <h3>This install</h3>
        <div className="admin-item"><div className="a-name">Version</div><div className="line-total">v{info?.version || '…'}</div></div>
        {info?.sha && <div className="admin-item"><div className="a-name">Commit</div><div className="line-total">{info.sha}</div></div>}
        {info && !info.repoConfigured && (
          <div className="banner warn" style={{ marginTop: 10 }}>
            The updater is not wired up on this server. Re-run install.sh to set it up.
          </div>
        )}
      </div>

      <div className="card">
        <h3>Updates from GitHub</h3>
        {check && (
          <div className={'banner ' + (check.updateAvailable ? 'warn' : 'ok')}>
            {check.updateAvailable
              ? `v${check.latestVersion} is ready to install (you are on v${check.currentVersion}).`
              : `You are on the newest version, v${check.currentVersion}.`}
          </div>
        )}
        <button className="big-btn wide ghost" onClick={doCheck} disabled={busy || running}>
          {busy ? 'Checking…' : 'Check for updates'}
        </button>
        <button className="big-btn wide" style={{ marginTop: 10 }} onClick={() => doUpdate(false)} disabled={busy || running}>
          {running ? 'Updating…' : 'Update now'}
        </button>
        <button className="big-btn wide ghost" style={{ marginTop: 10 }}
          onClick={() => doUpdate(true)} disabled={busy || running}>
          Force rebuild
        </button>
        <p className="sub" style={{ margin: '6px 0 0' }}>
          Rebuilds and restarts even when GitHub has nothing new — useful when a build went wrong.
        </p>

        {status.state === 'running' && (
          <button className="big-btn wide ghost" style={{ marginTop: 10 }} onClick={clearStuck}>
            Clear stuck update
          </button>
        )}

        {status.hasPrevious && (
          <button className="big-btn wide red" style={{ marginTop: 10 }} onClick={doRollback} disabled={running}>
            Go back to previous version
          </button>
        )}
      </div>

      {status.log && (
        <div className="card">
          <h3>Update log</h3>
          <div className="log">{status.log}</div>
        </div>
      )}
    </>
  );
}
