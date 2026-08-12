import { useState, useEffect, useRef, useCallback } from 'react';
import Admin from './Admin.jsx';
import Login from './Login.jsx';
import CameraScanner from './Camera.jsx';
import CardSheet, { CardFace } from './CardSheet.jsx';
import { api, money, DENOMS, breakChange, SOUND, getToken, clearToken } from './lib.js';

// ============================================================
export default function App() {
  const [pub, setPub] = useState(null);            // shop name etc, before sign-in
  const [authed, setAuthed] = useState(!!getToken());
  const [settings, setSettings] = useState(null);
  const [card, setCard] = useState(null);        // the card sheet, when one is scanned
  const [products, setProducts] = useState([]);
  const [basket, setBasket] = useState([]);
  const [category, setCategory] = useState('All');
  const [screen, setScreen] = useState('till'); // till | shelf | checkout | done | admin
  const [laser, setLaser] = useState(0);
  const [flash, setFlash] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [toast, setToast] = useState(null);
  const [camera, setCamera] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null); // an online order currently loaded on the till
  const [pendingCount, setPendingCount] = useState(0);
  const [ordersOpen, setOrdersOpen] = useState(false);

  const sym = settings?.currencySymbol || 'R';
  const soundOn = settings?.soundOn ?? true;
  const tapToAdd = settings?.tapToAddOn ?? false;

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([api('/settings'), api('/products')]);
    setSettings(s);
    setProducts(p);
  }, []);

  // The login screen needs the shop name before anyone has signed in.
  useEffect(() => {
    api('/public').then(setPub).catch(() => setPub({ shopName: 'Scanner' }));
  }, []);

  // A saved sign-in may have run out while the tablet was asleep.
  useEffect(() => {
    if (!authed) { setSettings(null); return; }
    load().catch((e) => {
      if (e.status === 401) { clearToken(); setAuthed(false); }
      else setToast(e.message);
    });
  }, [authed, load]);

  const signOut = async () => {
    try { await api('/logout', { method: 'POST' }); } catch {}
    clearToken();
    setSettings(null);
    setBasket([]);
    setScreen('till');
    setAuthed(false);
  };

  useEffect(() => {
    const name = settings?.shopName || pub?.shopName;
    if (name) document.title = name;
  }, [settings?.shopName, pub?.shopName]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Keeps the 🛍️ badge current so an order doesn't sit unnoticed.
  useEffect(() => {
    if (!authed || !settings?.onlineOn) { setPendingCount(0); return; }
    let stopped = false;
    const poll = () => api('/orders?status=pending')
      .then((rows) => { if (!stopped) setPendingCount(rows.length); })
      .catch(() => {});
    poll();
    const t = setInterval(poll, 12000);
    return () => { stopped = true; clearInterval(t); };
  }, [authed, settings?.onlineOn]);

  // the scanner window drops back to "ready" after a moment
  useEffect(() => {
    if (!lastScan) return;
    const t = setTimeout(() => setLastScan(null), 2600);
    return () => clearTimeout(t);
  }, [lastScan]);

  const play = (name) => { if (soundOn) SOUND[name](); };

  // ---------- the list ----------
  const addToBasket = useCallback((product) => {
    setBasket((b) => {
      const found = b.find((i) => i.id === product.id);
      if (found) return b.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      const line = {
        id: product.id, name: product.name, emoji: product.emoji,
        photo: product.photo, price: product.price, qty: 1,
      };
      return [line, ...b]; // newest at the top, where the eyes are
    });
    setLaser((n) => n + 1);
    setFlash(product.id);
    setTimeout(() => setFlash(null), 700);
    setLastScan({ product, n: Date.now() });
    play('beep');
  }, [soundOn]);

  const setQty = (id, qty) =>
    setBasket((b) => (qty <= 0 ? b.filter((i) => i.id !== id) : b.map((i) => (i.id === id ? { ...i, qty } : i))));

  const clearList = () => {
    if (!basket.length) return;
    if (basket.length > 2 && !confirm('Take everything off the list and start again?')) return;
    if (activeOrder) {
      api('/orders/' + activeOrder.id + '/release', { method: 'POST' }).catch(() => {});
      setActiveOrder(null);
    }
    setBasket([]);
    setLastScan(null);
    play('buzz');
  };

  // An online order, picked up from the 🛍️ list — its items land straight
  // on the till, ready to add to or take to Pay now.
  const loadOrder = (order) => {
    setBasket(order.items.map((i) => ({
      id: i.productId || i.id, name: i.name, emoji: i.emoji, photo: i.photo, price: i.price, qty: i.qty,
    })));
    setActiveOrder(order);
    setOrdersOpen(false);
    setLastScan(null);
    setScreen('till');
  };

  const releaseOrder = async () => {
    if (!activeOrder) return;
    try { await api('/orders/' + activeOrder.id + '/release', { method: 'POST' }); } catch {}
    setActiveOrder(null);
  };

  const total = basket.reduce((s, i) => s + i.price * i.qty, 0);
  const count = basket.reduce((s, i) => s + i.qty, 0);

  // ---------- barcode scanner (USB / keyboard wedge) ----------
  const buf = useRef({ str: '', at: 0 });
  useEffect(() => {
    if (screen !== 'till' && screen !== 'shelf') return;
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const now = Date.now();
      if (now - buf.current.at > 120) buf.current.str = '';
      buf.current.at = now;
      if (e.key === 'Enter') {
        const code = buf.current.str.trim();
        buf.current.str = '';
        if (code.length >= 4) handleCode(code);
        return;
      }
      if (e.key.length === 1) buf.current.str += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, products]);

  const handleCode = useCallback(async (code) => {
    const local = products.find((p) => p.barcode === code);
    if (local) { addToBasket(local); return { ok: true, product: local }; }
    try {
      const r = await api('/scan/' + encodeURIComponent(code));

      // A bank card rather than something off the shelves.
      if (r.type === 'card') {
        play('beep');
        setCamera(false);
        setCard(r.card);
        return { ok: true, card: r.card };
      }

      addToBasket(r);
      return { ok: true, product: r };
    } catch (e) {
      if (e.status === 401) { clearToken(); setAuthed(false); return { ok: false, code }; }
      play('buzz');
      setToast(`Nothing matches the barcode ${code}. A grown-up can add it under ⚙️.`);
      return { ok: false, code };
    }
  }, [products, addToBasket, soundOn]);

  // ---------- checkout ----------
  const finishSale = async (paid, changeCorrect) => {
    try {
      await api('/sales', {
        method: 'POST',
        body: JSON.stringify({ items: basket, paid, changeCorrect, orderId: activeOrder?.id }),
      });
    } catch { /* keep playing even if the save fails */ }
    setLastSale({ items: basket, total, paid, change: paid - total, at: new Date(), payment: 'cash' });
    setBasket([]);
    setLastScan(null);
    setActiveOrder(null);
    setScreen('done');
    play('cheer');
  };

  // Paying by card. The server checks the balance and debits it in one go,
  // so two quick taps can never take the card below zero.
  const payByCard = async (theCard) => {
    try {
      const r = await api('/sales', {
        method: 'POST',
        body: JSON.stringify({ items: basket, payment: 'card', cardId: theCard.id, orderId: activeOrder?.id }),
      });
      setLastSale({
        items: basket, total, paid: total, change: 0,
        at: new Date(), payment: 'card', card: r.card,
      });
      setBasket([]);
      setLastScan(null);
      setCard(null);
      setActiveOrder(null);
      setScreen('done');
      play('cheer');
    } catch (e) {
      play('buzz');
      if (e.status === 402) {
        // Balance moved since the sheet opened — show the fresh figure.
        setCard((c) => (c ? { ...c, balance: e.balance ?? c.balance } : c));
      } else {
        setToast(e.message);
      }
    }
  };

  if (!authed) {
    if (!pub) return <Boot />;
    return <Login pub={pub} onIn={() => setAuthed(true)} />;
  }

  if (!settings) return <Boot />;

  if (screen === 'admin') {
    return (
      <Admin
        settings={settings}
        onClose={() => { setScreen('till'); load(); }}
        onSettings={setSettings}
        onSignOut={signOut}
      />
    );
  }

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
  const shown = category === 'All' ? products : products.filter((p) => p.category === category);

  return (
    <div className="app">
      {laser > 0 && <div className="laser" key={laser} />}

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">🛒</div>
          <div className="brand-text">
            <h1>{settings.shopName}</h1>
            <p>{settings.shopTagline}</p>
          </div>
        </div>
        <div className="topbar-actions">
          {tapToAdd && (
            <button
              className={'icon-btn' + (screen === 'shelf' ? ' on' : '')}
              title={screen === 'shelf' ? 'Back to the till' : 'Browse the shelves'}
              onClick={() => setScreen(screen === 'shelf' ? 'till' : 'shelf')}
            >{screen === 'shelf' ? '🧾' : '🏪'}</button>
          )}
          {settings.onlineOn && (
            <button className="icon-btn" title="Online orders" onClick={() => setOrdersOpen(true)} style={{ position: 'relative' }}>
              🛍️
              {pendingCount > 0 && (
                <span className="tile-count" style={{ position: 'absolute', top: -8, right: -8 }}>{pendingCount}</span>
              )}
            </button>
          )}
          <button className="icon-btn" title="Scan with the camera" onClick={() => setCamera(true)}>📷</button>
          <button
            className={'icon-btn' + (soundOn ? ' on' : '')}
            title={soundOn ? 'Sound is on' : 'Sound is off'}
            onClick={async () => {
              const next = !soundOn;
              setSettings({ ...settings, soundOn: next });
              try { await api('/settings', { method: 'PUT', body: JSON.stringify({ soundOn: next }) }); } catch {}
            }}
          >{soundOn ? '🔊' : '🔇'}</button>
          <button className="icon-btn" title="Grown-ups" onClick={() => setScreen('admin')}>⚙️</button>
        </div>
      </header>

      {/* ---------------- THE TILL: scan, and the list fills up ---------------- */}
      {screen === 'till' && (
        <main className="till-screen">
          {activeOrder && (
            <div className="banner warn" style={{ margin: '0 0 12px' }}>
              🛍️ Loaded from {activeOrder.customerName || 'an online order'}'s order (#{activeOrder.pickupCode}) —
              add more if needed, then Pay now.
              <button className="link-btn" style={{ marginLeft: 8 }} onClick={releaseOrder}>Unlink</button>
            </div>
          )}
          <ScanWindow last={lastScan} sym={sym} showPrices={settings.showPrices}
            onCamera={() => setCamera(true)} />

          <section className="list-wrap">
            <div className="list-head">
              <h2>Your list</h2>
              {count > 0 && (
                <>
                  <span className="pill">{count} {count === 1 ? 'item' : 'items'}</span>
                  <button className="link-btn" onClick={clearList}>Start again</button>
                </>
              )}
            </div>

            {basket.length === 0 ? (
              <div className="list-empty">
                <div className="big">📦</div>
                <p><strong>Nothing scanned yet.</strong></p>
                <p>Point the scanner at a barcode — the item will pop up here.</p>
              </div>
            ) : (
              <ul className="list">
                {basket.map((i, n) => (
                  <li key={i.id} className={'row' + (flash === i.id ? ' flash' : '')}>
                    <span className="row-no">{basket.length - n}</span>
                    <span className="row-art">
                      {i.photo ? <img src={'/photos/' + i.photo} alt="" /> : (i.emoji || '🛒')}
                    </span>
                    <div className="row-text">
                      <div className="row-name">{i.name}</div>
                      {settings.showPrices && <div className="row-each">{money(i.price, sym)} each</div>}
                    </div>
                    <div className="qty">
                      <button onClick={() => setQty(i.id, i.qty - 1)} aria-label={'One less ' + i.name}>−</button>
                      <span>{i.qty}</span>
                      <button onClick={() => setQty(i.id, i.qty + 1)} aria-label={'One more ' + i.name}>+</button>
                    </div>
                    {settings.showPrices && <span className="row-total">{money(i.price * i.qty, sym)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      )}

      {/* ---------------- Optional shelf browsing ---------------- */}
      {screen === 'shelf' && (
        <>
          <nav className="rail">
            {categories.map((c) => (
              <button key={c} className={'chip' + (c === category ? ' active' : '')} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </nav>
          <main className="shelf">
            {shown.map((p) => {
              const inList = basket.find((i) => i.id === p.id);
              return (
                <button
                  key={p.id}
                  className={'tile' + (flash === p.id ? ' zapped' : '')}
                  onClick={() => addToBasket(p)}
                >
                  {inList && <span className="tile-count">{inList.qty}</span>}
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
                <p>No items on this shelf yet. Add some in the grown-up area.</p>
              </div>
            )}
          </main>
        </>
      )}

      <div className="till">
        <div className="till-info">
          <div className="label">{count} {count === 1 ? 'item' : 'items'} scanned</div>
          <div className="total">{money(total, sym)}</div>
        </div>
        <button className="big-btn" disabled={!count} onClick={() => { play('drop'); setScreen('checkout'); }}>
          Pay now →
        </button>
      </div>

      {screen === 'checkout' && (
        <Checkout
          basket={basket} total={total} sym={sym} settings={settings}
          onBack={() => setScreen('till')} onDone={finishSale} onCardPay={payByCard} play={play}
        />
      )}

      {screen === 'done' && lastSale && (
        <DoneSheet sale={lastSale} sym={sym} shopName={settings.shopName} onClose={() => setScreen('till')} />
      )}

      {card && (
        <CardSheet
          card={card}
          sym={settings.currencySymbol}
          total={total}
          itemCount={basket.reduce((s, i) => s + i.qty, 0)}
          grownUp={!!settings.grownUp}
          onPay={payByCard}
          onTopUp={() => { setCard(null); setScreen('admin'); }}
          onClose={() => setCard(null)}
        />
      )}

      {camera && (
        <CameraScanner
          onCode={handleCode}
          onClose={() => setCamera(false)}
          httpsPort={settings.httpsPort}
        />
      )}

      {ordersOpen && (
        <OrdersSheet sym={sym} onClose={() => setOrdersOpen(false)} onLoad={loadOrder} />
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
// The scanner window at the top of the till: idle, then shows what was scanned.
function ScanWindow({ last, sym, showPrices, onCamera }) {
  return (
    <section className={'scan-window' + (last ? ' hit' : '')}>
      <div className="scan-glass">
        {last ? (
          <div className="scan-hit" key={last.n}>
            <div className="scan-hit-art">
              {last.product.photo
                ? <img src={'/photos/' + last.product.photo} alt="" />
                : (last.product.emoji || '🛒')}
            </div>
            <div className="scan-hit-text">
              <div className="scan-hit-name">{last.product.name}</div>
              {showPrices && <div className="scan-hit-price">{money(last.product.price, sym)}</div>}
            </div>
            <div className="scan-hit-tick">✓</div>
          </div>
        ) : (
          <div className="scan-idle">
            <div className="barcode" aria-hidden="true">
              {Array.from({ length: 26 }, (_, i) => (
                <i key={i} style={{ width: [2, 3, 5, 7][i % 4] + 'px' }} />
              ))}
            </div>
            <div className="scan-beam" />
            <p>Scan an item</p>
          </div>
        )}
      </div>
      <button className="scan-cam" onClick={onCamera}>📷 Use the camera</button>
    </section>
  );
}

// ============================================================
function Checkout({ basket, total, sym, settings, onBack, onDone, onCardPay, play }) {
  const [handed, setHanded] = useState([]);
  const [stage, setStage] = useState('pay'); // pay | quiz
  const [picked, setPicked] = useState(null);
  const [how, setHow] = useState('cash');    // cash | card
  const [cards, setCards] = useState([]);
  const [cardBusy, setCardBusy] = useState(null);
  const [cardErr, setCardErr] = useState(null);
  const [browsing, setBrowsing] = useState(false);   // the pick-a-card list
  const [typed, setTyped] = useState('');
  const [cardCam, setCardCam] = useState(false);
  const wedge = useRef({ str: '', at: 0 });

  const cardsOn = settings.cardsOn;
  useEffect(() => {
    if (!cardsOn) return;
    api('/cards').then((c) => setCards(c.filter((x) => x.active))).catch(() => {});
  }, [cardsOn]);

  const tapCard = async (c) => {
    setCardErr(null);
    if (c.balance < total) {
      play('buzz');
      setCardErr(`${c.name} only has ${money(c.balance, sym)} on it — that is ${money(total - c.balance, sym)} short. A grown-up needs to reload it first.`);
      return;
    }
    setCardBusy(c.id);
    await onCardPay(c);
    setCardBusy(null);
  };

  // Turn a scanned or typed barcode into a card, then pay with it.
  const useBarcode = async (code) => {
    const clean = String(code || '').trim();
    if (!clean) return { ok: false, code: clean };
    setCardErr(null);
    try {
      const c = await api('/cards/by-barcode/' + encodeURIComponent(clean));
      setTyped('');
      setCardCam(false);
      if (!c.active) {
        play('buzz');
        setCardErr(`${c.name} has been switched off by a grown-up.`);
        return { ok: false, code: clean };
      }
      await tapCard(c);
      return { ok: true, card: c };
    } catch {
      play('buzz');
      setCardErr(`No card has the barcode ${clean}. Try again, or pick the card from the list.`);
      return { ok: false, code: clean };
    }
  };

  // The till's scanner listener is switched off on this screen, so the
  // card tab runs its own while it is showing.
  useEffect(() => {
    if (how !== 'card' || !cardsOn || cardCam) return;
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;   // let the typed box have its keys
      const now = Date.now();
      if (now - wedge.current.at > 120) wedge.current.str = '';
      wedge.current.at = now;
      if (e.key === 'Enter') {
        const code = wedge.current.str.trim();
        wedge.current.str = '';
        if (code.length >= 3) useBarcode(code);
        return;
      }
      if (e.key.length === 1) wedge.current.str += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [how, cardsOn, cardCam, total, cards]);
  const paid = handed.reduce((s, d) => s + d.v, 0);
  const short = total - paid;
  const change = paid - total;

  const quizOptions = useRef([]);
  const startQuiz = () => {
    if (!settings.changeQuizOn || change === 0) return onDone(paid, null);
    const wrongs = new Set();
    const jitters = [100, 200, 500, 1000, -100, -500];
    while (wrongs.size < 2) {
      const j = jitters[Math.floor(Math.random() * jitters.length)];
      const w = change + j;
      if (w > 0 && w !== change) wrongs.add(w);
      if (wrongs.size < 2 && jitters.length === 0) break;
    }
    quizOptions.current = [change, ...wrongs].sort(() => Math.random() - 0.5);
    setStage('quiz');
  };

  return (
    <div className="sheet-bg">
      <div className="sheet">
        {stage === 'pay' && (
          <>
            <div className="sheet-head">
              <button className="icon-btn" onClick={onBack}>←</button>
              <h2>Time to pay</h2>
            </div>

            {cardsOn && (
              <div className="pay-tabs">
                <button className={'pay-tab' + (how === 'cash' ? ' on' : '')} onClick={() => setHow('cash')}>
                  💵 Cash
                </button>
                <button className={'pay-tab' + (how === 'card' ? ' on' : '')} onClick={() => setHow('card')}>
                  💳 Card
                </button>
              </div>
            )}

            {how === 'card' && cardsOn && (
              <>
                <div className="line" style={{ justifyContent: 'space-between' }}>
                  <span className="line-name">{basket.reduce((s, i) => s + i.qty, 0)} items to pay for</span>
                  <span className="line-total">{money(total, sym)}</span>
                </div>
                {cardErr && <div className="banner bad">{cardErr}</div>}

                {!browsing ? (
                  <>
                    <div className="scan-prompt">
                      <div className="scan-prompt-mark">💳</div>
                      <p>Scan the card now</p>
                      <span>Hold it under the scanner, or use one of the options below</span>
                    </div>

                    <div className="field">
                      <label>Or type the number on the card</label>
                      <input
                        value={typed}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="card barcode"
                        onChange={(e) => setTyped(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') useBarcode(typed); }}
                      />
                    </div>
                    <button className="big-btn wide" disabled={!typed.trim() || cardBusy !== null}
                      onClick={() => useBarcode(typed)}>
                      {cardBusy ? 'Paying…' : 'Use this card'}
                    </button>

                    <div className="alt-row">
                      <button className="big-btn ghost" onClick={() => setCardCam(true)}>
                        📷 Camera
                      </button>
                      <button className="big-btn ghost" onClick={() => { setCardErr(null); setBrowsing(true); }}>
                        📋 Choose a card
                      </button>
                    </div>
                  </>
                ) : cards.length === 0 ? (
                  <>
                    <div className="banner warn">
                      No cards yet. A grown-up can make one under ⚙️ → Cards.
                    </div>
                    <button className="big-btn wide ghost" onClick={() => setBrowsing(false)}>← Back to scanning</button>
                  </>
                ) : (
                  <>
                    <p className="sub">Tap the card to pay with</p>
                    <div className="card-picker">
                      {cards.map((c) => {
                        const enough = c.balance >= total;
                        return (
                          <button
                            key={c.id}
                            className={'card-pick' + (enough ? '' : ' low')}
                            disabled={cardBusy !== null}
                            onClick={() => tapCard(c)}
                          >
                            <CardFace card={c} sym={sym} />
                            <span className="card-pick-note">
                              {cardBusy === c.id ? 'Paying…' : enough ? 'Tap to pay' : 'Not enough'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button className="big-btn wide ghost" style={{ marginTop: 12 }}
                      onClick={() => setBrowsing(false)}>← Back to scanning</button>
                  </>
                )}

                {cardCam && (
                  <CameraScanner
                    onCode={useBarcode}
                    onClose={() => setCardCam(false)}
                    httpsPort={settings.httpsPort}
                  />
                )}
              </>
            )}

            {how === 'cash' && (
            <>
            <div className={'tally' + (short > 0 ? ' short' : ' ready')}>
              <span className="k">{short > 0 ? 'Still needed' : 'Paid enough — nice!'}</span>
              <span className="v">{short > 0 ? money(short, sym) : money(paid, sym)}</span>
            </div>

            <div className="line" style={{ justifyContent: 'space-between' }}>
              <span className="line-name">{basket.reduce((s, i) => s + i.qty, 0)} items to pay for</span>
              <span className="line-total">{money(total, sym)}</span>
            </div>

            <p className="sub">Tap the notes and coins to hand them over</p>
            <div className="money-grid">
              {DENOMS.map((d) => (
                <button key={d.v} className={'money ' + d.cls}
                  onClick={() => { play('drop'); setHanded((h) => [...h, d]); }}>
                  {d.label}
                </button>
              ))}
            </div>

            <div className="paid-strip">
              {handed.length === 0
                ? <span className="paid-empty">Nothing handed over yet</span>
                : handed.map((d, i) => (
                    <button key={i} className="paid-chip"
                      onClick={() => setHanded((h) => h.filter((_, n) => n !== i))}>
                      {d.label} ✕
                    </button>
                  ))}
            </div>

            <button className="big-btn wide" disabled={short > 0} onClick={startQuiz}>
              {short > 0 ? `Need ${money(short, sym)} more` : 'Ring it up'}
            </button>
            </>
            )}
          </>
        )}

        {stage === 'quiz' && (
          <>
            <h2>How much change?</h2>
            <p className="sub">
              The shopping cost {money(total, sym)} and you handed over {money(paid, sym)}.
            </p>
            <div className="quiz-options">
              {quizOptions.current.map((opt) => (
                <button key={opt}
                  className={'quiz-opt' + (picked == null ? '' : opt === change ? ' right' : picked === opt ? ' wrong' : '')}
                  disabled={picked != null}
                  onClick={() => {
                    setPicked(opt);
                    play(opt === change ? 'cheer' : 'buzz');
                    setTimeout(() => onDone(paid, opt === change), 1100);
                  }}>
                  {money(opt, sym)}
                </button>
              ))}
            </div>
            {picked != null && (
              <div className={'banner ' + (picked === change ? 'ok' : 'bad')} style={{ marginTop: 14 }}>
                {picked === change ? 'Spot on! 🎉' : `Close — the change is ${money(change, sym)}`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
function DoneSheet({ sale, sym, shopName, onClose }) {
  const coins = breakChange(sale.change);
  return (
    <div className="sheet-bg">
      <Confetti />
      <div className="sheet">
        {sale.payment === 'card' ? (
          <div className="change-show card">
            <div style={{ fontWeight: 800 }}>Paid by card 💳</div>
            <div className="amount">{money(sale.total, sym)}</div>
            {sale.card && (
              <div className="sub" style={{ margin: 0 }}>
                {sale.card.name} has {money(sale.card.balance, sym)} left
              </div>
            )}
          </div>
        ) : (
          <div className="change-show">
            <div style={{ fontWeight: 800 }}>Change to give back</div>
            <div className="amount">{money(sale.change, sym)}</div>
            {coins.length > 0 && (
              <div className="change-coins">
                {coins.map((d, i) => <span key={i} className={'money ' + d.cls}>{d.label}</span>)}
              </div>
            )}
          </div>
        )}

        <div className="receipt" style={{ margin: '18px 0' }}>
          <h3>{shopName}</h3>
          <div className="r-sub">{sale.at.toLocaleString()}</div>
          <hr />
          {sale.items.map((i) => (
            <div className="r-line" key={i.id}>
              <span>{i.qty} × {i.name}</span>
              <span>{money(i.price * i.qty, sym)}</span>
            </div>
          ))}
          <hr />
          <div className="r-line r-big"><span>TOTAL</span><span>{money(sale.total, sym)}</span></div>
          {sale.payment === 'card' ? (
            <>
              <div className="r-line"><span>Paid by card</span><span>{sale.card?.name}</span></div>
              <div className="r-line"><span>Left on the card</span><span>{money(sale.card?.balance ?? 0, sym)}</span></div>
            </>
          ) : (
            <>
              <div className="r-line"><span>Paid</span><span>{money(sale.paid, sym)}</span></div>
              <div className="r-line"><span>Change</span><span>{money(sale.change, sym)}</span></div>
            </>
          )}
          <hr />
          <div className="r-sub">Thank you for shopping!</div>
        </div>

        <button className="big-btn wide" onClick={onClose}>Next customer 🛒</button>
      </div>
    </div>
  );
}

// ============================================================
// Orders waiting from the online shop. "Load" claims one and drops its
// items straight onto the till; the queue leaves it to whoever gets there
// first, so two tablets can't both pick up the same order.
function OrdersSheet({ sym, onClose, onLoad }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  const refresh = useCallback(() => {
    api('/orders?status=pending')
      .then(setOrders)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const claim = async (o) => {
    setBusy(o.id);
    setErr(null);
    try {
      const full = await api('/orders/' + o.id + '/claim', { method: 'POST' });
      onLoad(full);
    } catch (e) {
      setErr(e.message);
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (o) => {
    if (!confirm(`Cancel ${o.customerName || 'this'}'s order?`)) return;
    setBusy(o.id);
    setErr(null);
    try {
      await api('/orders/' + o.id + '/cancel', { method: 'POST' });
      refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sheet-bg">
      <div className="sheet">
        <div className="sheet-head">
          <button className="icon-btn" onClick={onClose}>←</button>
          <h2>Online orders</h2>
        </div>
        {err && <div className="banner bad">{err}</div>}
        {loading ? (
          <p className="sub">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="list-empty">
            <div className="big">📭</div>
            <p><strong>No orders waiting.</strong></p>
            <p>Anything sent from the online shop shows up here.</p>
          </div>
        ) : (
          <ul className="list">
            {orders.map((o) => (
              <li key={o.id} className="row" style={{ alignItems: 'flex-start' }}>
                <span className="row-art">🛍️</span>
                <div className="row-text">
                  <div className="row-name">{o.customerName || 'Online order'} · #{o.pickupCode}</div>
                  <div className="row-each">{o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {money(o.total, sym)}</div>
                  {o.note && <div className="row-each">📝 {o.note}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                  <button className="big-btn" style={{ padding: '8px 16px', boxShadow: 'none' }}
                    disabled={busy === o.id} onClick={() => claim(o)}>
                    {busy === o.id ? '…' : 'Load'}
                  </button>
                  <button className="link-btn" disabled={busy === o.id} onClick={() => cancel(o)}>Cancel</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 40 }, (_, i) => i);
  const colors = ['#ff5a46', '#ffc93c', '#22b573', '#8a5cf6', '#22307a'];
  return (
    <div className="confetti">
      {bits.map((i) => (
        <i key={i} style={{
          left: Math.random() * 100 + '%',
          background: colors[i % colors.length],
          animationDuration: 1.6 + Math.random() * 1.6 + 's',
          animationDelay: Math.random() * 0.5 + 's',
        }} />
      ))}
    </div>
  );
}

function Boot() {
  return (
    <div className="boot">
      <div className="boot-mark">🛒</div>
      <p>Opening the shop…</p>
    </div>
  );
}
