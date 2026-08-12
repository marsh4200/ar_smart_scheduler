import { useState, useEffect, useCallback } from 'react';
import Login from './Login.jsx';
import { api, money, getToken, clearToken } from './lib.js';

const LAST_ORDER_KEY = 'scanner_shop_last_order';
const NAME_KEY = 'scanner_shop_name';

// ============================================================
// The online shop: browse what's on the shelves, build a list,
// send it to the till. A grown-up there loads it on, rings it up
// and takes the money the same way as any other basket.
// ============================================================
export default function ShopApp() {
  const [pub, setPub] = useState(null);
  const [authed, setAuthed] = useState(!!getToken());
  const [settings, setSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [screen, setScreen] = useState('shop'); // shop | cart | placed
  const [order, setOrder] = useState(null);
  const [toast, setToast] = useState(null);

  const sym = settings?.currencySymbol || 'R';

  useEffect(() => {
    api('/public').then(setPub).catch(() => setPub({ shopName: 'Scanner' }));
  }, []);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([api('/settings'), api('/products')]);
    setSettings(s);
    setProducts(p);
  }, []);

  useEffect(() => {
    if (!authed) { setSettings(null); return; }
    load().catch((e) => {
      if (e.status === 401) { clearToken(); setAuthed(false); }
      else setToast(e.message);
    });
  }, [authed, load]);

  // Keep the shelves in step with the till — a grown-up may switch an
  // item off, or the price may change, while someone is browsing.
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(() => { load().catch(() => {}); }, 15000);
    return () => clearInterval(t);
  }, [authed, load]);

  useEffect(() => {
    const name = settings?.shopName || pub?.shopName;
    if (name) document.title = `${name} — Online shop`;
  }, [settings?.shopName, pub?.shopName]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Picks straight back up on an order still being tracked from before.
  useEffect(() => {
    if (!authed) return;
    const saved = localStorage.getItem(LAST_ORDER_KEY);
    if (!saved) return;
    api('/orders/' + saved).then((o) => {
      if (['pending', 'claimed'].includes(o.status)) { setOrder(o); setScreen('placed'); }
      else localStorage.removeItem(LAST_ORDER_KEY);
    }).catch(() => localStorage.removeItem(LAST_ORDER_KEY));
  }, [authed]);

  // Track the order's progress once it is placed.
  useEffect(() => {
    if (screen !== 'placed' || !order?.id) return;
    if (order.status === 'completed' || order.status === 'cancelled') return;
    const t = setInterval(() => {
      api('/orders/' + order.id).then(setOrder).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [screen, order?.id, order?.status]);

  const signOut = async () => {
    try { await api('/logout', { method: 'POST' }); } catch {}
    clearToken();
    setSettings(null);
    setAuthed(false);
    setCart([]);
  };

  const addToCart = (p) => {
    setCart((c) => {
      const found = c.find((i) => i.id === p.id);
      if (found) return c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { id: p.id, name: p.name, emoji: p.emoji, photo: p.photo, price: p.price, qty: 1 }];
    });
  };
  const setQty = (id, qty) =>
    setCart((c) => (qty <= 0 ? c.filter((i) => i.id !== id) : c.map((i) => (i.id === id ? { ...i, qty } : i))));

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  const startNewOrder = () => {
    localStorage.removeItem(LAST_ORDER_KEY);
    setOrder(null);
    setCart([]);
    setScreen('shop');
  };

  if (!authed) {
    if (!pub) return <Boot />;
    return <Login pub={pub} onIn={() => setAuthed(true)} />;
  }
  if (!settings) return <Boot />;

  if (!settings.onlineOn) {
    return (
      <div className="app">
        <ShopHeader settings={settings} onSignOut={signOut} count={0} onCart={() => {}} />
        <main style={{ padding: 24, textAlign: 'center' }}>
          <div className="big" style={{ fontSize: '3rem' }}>🚧</div>
          <p><strong>Online ordering is switched off right now.</strong></p>
          <p className="sub">Ask a grown-up to turn it back on under ⚙️ → Shop setup.</p>
        </main>
      </div>
    );
  }

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
  const shown = category === 'All' ? products : products.filter((p) => p.category === category);

  return (
    <div className="app">
      <ShopHeader settings={settings} onSignOut={signOut} count={count} onCart={() => setScreen('cart')} />

      {screen === 'shop' && (
        <>
          <div className="topbar" style={{ padding: '0 16px 12px', boxShadow: 'none' }}>
            <p className="sub" style={{ margin: 0 }}>Fill your basket, then send the order to the till.</p>
          </div>
          <nav className="rail">
            {categories.map((c) => (
              <button key={c} className={'chip' + (c === category ? ' active' : '')} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </nav>
          <main className="shelf">
            {shown.map((p) => {
              const inCart = cart.find((i) => i.id === p.id);
              return (
                <button key={p.id} className="tile" onClick={() => addToCart(p)}>
                  {inCart && <span className="tile-count">{inCart.qty}</span>}
                  <span className="tile-art">
                    {p.photo ? <img src={'/photos/' + p.photo} alt="" /> : p.emoji || '🛒'}
                  </span>
                  <span className="tile-name">{p.name}</span>
                  {settings.showPrices && <span className="tile-price">{money(p.price, sym)}</span>}
                </button>
              );
            })}
            {!shown.length && (
              <div className="empty" style={{ gridColumn: '1 / -1' }}>
                <div className="big">🥫</div>
                <p>Nothing on the shelves yet.</p>
              </div>
            )}
          </main>

          <div className="till">
            <div className="till-info">
              <div className="label">{count} {count === 1 ? 'item' : 'items'} in your basket</div>
              <div className="total">{money(total, sym)}</div>
            </div>
            <button className="big-btn" disabled={!count} onClick={() => setScreen('cart')}>
              Review order →
            </button>
          </div>
        </>
      )}

      {screen === 'cart' && (
        <CartSheet
          cart={cart} total={total} sym={sym} settings={settings}
          onQty={setQty}
          onBack={() => setScreen('shop')}
          onPlaced={(o) => {
            localStorage.setItem(LAST_ORDER_KEY, o.id);
            setOrder(o);
            setCart([]);
            setScreen('placed');
          }}
        />
      )}

      {screen === 'placed' && order && (
        <TrackSheet order={order} sym={sym} shopName={settings.shopName} onNewOrder={startNewOrder} />
      )}

      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          <div className="banner warn">{toast}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
function ShopHeader({ settings, onSignOut, count, onCart }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">🛍️</div>
        <div className="brand-text">
          <h1>{settings.shopName}</h1>
          <p>Online shop</p>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="icon-btn" title="Your basket" onClick={onCart} style={{ position: 'relative' }}>
          🧺
          {count > 0 && <span className="tile-count" style={{ position: 'absolute', top: -8, right: -8 }}>{count}</span>}
        </button>
        <button className="icon-btn" title="Sign out" onClick={onSignOut}>🚪</button>
      </div>
    </header>
  );
}

// ============================================================
function CartSheet({ cart, total, sym, settings, onQty, onBack, onPlaced }) {
  const [name, setName] = useState(localStorage.getItem(NAME_KEY) || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const place = async () => {
    if (busy || !cart.length) return;
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem(NAME_KEY, name.trim());
      const o = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: name.trim(),
          note: note.trim(),
          items: cart.map((i) => ({ id: i.id, qty: i.qty })),
        }),
      });
      onPlaced(o);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="sheet-bg">
      <div className="sheet">
        <div className="sheet-head">
          <button className="icon-btn" onClick={onBack}>←</button>
          <h2>Your order</h2>
        </div>

        {error && <div className="banner bad">{error}</div>}

        {cart.length === 0 ? (
          <div className="list-empty">
            <div className="big">🧺</div>
            <p>Your basket is empty.</p>
          </div>
        ) : (
          <ul className="list">
            {cart.map((i) => (
              <li key={i.id} className="row">
                <span className="row-art">
                  {i.photo ? <img src={'/photos/' + i.photo} alt="" /> : (i.emoji || '🛒')}
                </span>
                <div className="row-text">
                  <div className="row-name">{i.name}</div>
                  {settings.showPrices && <div className="row-each">{money(i.price, sym)} each</div>}
                </div>
                <div className="qty">
                  <button onClick={() => onQty(i.id, i.qty - 1)} aria-label={'One less ' + i.name}>−</button>
                  <span>{i.qty}</span>
                  <button onClick={() => onQty(i.id, i.qty + 1)} aria-label={'One more ' + i.name}>+</button>
                </div>
                {settings.showPrices && <span className="row-total">{money(i.price * i.qty, sym)}</span>}
              </li>
            ))}
          </ul>
        )}

        {cart.length > 0 && (
          <>
            <div className="line" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <span className="line-name" style={{ fontWeight: 800 }}>Total</span>
              <span className="line-total" style={{ fontWeight: 800 }}>{money(total, sym)}</span>
            </div>

            <div className="field" style={{ marginTop: 16 }}>
              <label>Who is this for?</label>
              <input
                value={name}
                autoComplete="off"
                placeholder="Your name"
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="field">
              <label>Anything else? (optional)</label>
              <input
                value={note}
                autoComplete="off"
                placeholder="e.g. no strawberries please"
                onChange={(e) => setNote(e.target.value)}
                maxLength={140}
              />
            </div>

            <button className="big-btn wide" disabled={busy || !name.trim()} onClick={place}>
              {busy ? 'Sending…' : 'Send order to the till →'}
            </button>
            <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
              Nothing is paid for yet — pay in person when the order is ready.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
const STATUS = {
  pending:   { label: 'Waiting for the till',      icon: '⏳', cls: 'warn' },
  claimed:   { label: 'Being packed at the till',  icon: '🧑‍🍳', cls: 'warn' },
  completed: { label: 'Paid — all done!',          icon: '✅', cls: 'ok' },
  cancelled: { label: 'Cancelled at the till',      icon: '✋', cls: 'bad' },
};

function TrackSheet({ order, sym, shopName, onNewOrder }) {
  const s = STATUS[order.status] || STATUS.pending;
  return (
    <div className="sheet-bg">
      <div className="sheet">
        <h2>Order sent 🎉</h2>
        <p className="sub">Show this code at the till if they ask which order is yours.</p>

        <div className="tally ready" style={{ marginBottom: 14 }}>
          <span className="k">Pickup code</span>
          <span className="v">{order.pickupCode}</span>
        </div>

        <div className={'banner ' + s.cls}>{s.icon} {s.label}</div>

        <div className="receipt" style={{ margin: '18px 0' }}>
          <h3>{shopName}</h3>
          <div className="r-sub">{order.customerName || 'Online order'}</div>
          <hr />
          {order.items.map((i) => (
            <div className="r-line" key={i.id}>
              <span>{i.qty} × {i.name}</span>
              <span>{money(i.price * i.qty, sym)}</span>
            </div>
          ))}
          <hr />
          <div className="r-line r-big"><span>TOTAL</span><span>{money(order.total, sym)}</span></div>
          {order.note && <div className="r-sub" style={{ marginTop: 8 }}>Note: {order.note}</div>}
        </div>

        {(order.status === 'completed' || order.status === 'cancelled') && (
          <button className="big-btn wide" onClick={onNewOrder}>Start a new order 🛍️</button>
        )}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <button className="big-btn wide ghost" onClick={onNewOrder}>Start another order instead</button>
        )}
      </div>
    </div>
  );
}

function Boot() {
  return (
    <div className="boot">
      <div className="boot-mark">🛍️</div>
      <p>Opening the shop…</p>
    </div>
  );
}
