import { useState, useEffect, useRef } from 'react';
import { api, money } from './lib.js';
import { CardFace } from './CardSheet.jsx';
import MoneyInput from './MoneyInput.jsx';

const COLOURS = ['blue', 'grape', 'leaf', 'tomato', 'sunshine', 'ocean'];
const EMOJIS = ['💳', '🐻', '🦄', '🚀', '⚽', '🐙', '🌈', '🦖', '🍩', '⭐'];
// cents: R10 up to R100 000, then type anything in the box below
const QUICK = [1000, 2000, 5000, 10000, 50000, 100000, 1000000, 10000000];

// ============================================================
// CARDS — the grown-up side. Making cards and loading money
// both live behind the PIN, so pocket money stays finite.
// ============================================================
export default function Cards({ sym }) {
  const [cards, setCards] = useState([]);
  const [editing, setEditing] = useState(null);
  const [topUp, setTopUp] = useState(null);
  const [err, setErr] = useState(null);

  const load = () => api('/cards').then(setCards).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const blank = () => ({ name: '', barcode: '', emoji: '💳', colour: 'blue', balance: 0, active: true });

  return (
    <div>
      {err && <div className="banner bad">{err}</div>}

      <div className="card">
        <h3>Bank cards</h3>
        <p className="sub">
          Give each child a card with a barcode on it — an old loyalty card, a printed label,
          anything that scans. Scan it at the till and the shopping comes off the balance.
        </p>
        <button className="big-btn wide" onClick={() => setEditing(blank())}>+ New card</button>
      </div>

      {cards.length === 0 && (
        <div className="card">
          <p className="sub" style={{ margin: 0 }}>No cards yet. Make the first one above.</p>
        </div>
      )}

      {cards.map((c) => (
        <div className="card" key={c.id}>
          <div className="card-row">
            <CardFace card={c} sym={sym} />
            <div className="card-row-side">
              <button className="big-btn grape" onClick={() => setTopUp(c)}>💰 Load money</button>
              <button className="big-btn ghost" onClick={() => setEditing(c)}>Edit</button>
            </div>
          </div>
          <p className="sub" style={{ margin: '10px 0 0' }}>
            Barcode <code>{c.barcode}</code>{!c.active && ' · switched off'}
          </p>
        </div>
      ))}

      {editing && (
        <CardForm
          card={editing}
          sym={sym}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {topUp && (
        <TopUp
          card={topUp}
          sym={sym}
          onClose={() => setTopUp(null)}
          onSaved={() => { setTopUp(null); load(); }}
        />
      )}
    </div>
  );
}

// ============================================================
function CardForm({ card, sym, onClose, onSaved }) {
  const isNew = !card.id;
  const [f, setF] = useState({ ...card, balance: card.balance || 0 });
  const [err, setErr] = useState(null);
  const [listening, setListening] = useState(false);
  const buf = useRef('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // Capture a barcode straight off the USB scanner: it types fast and
  // finishes with Enter, so we collect keystrokes while armed.
  useEffect(() => {
    if (!listening) return;
    const onKey = (e) => {
      if (e.key === 'Enter') {
        if (buf.current.length >= 3) { set('barcode', buf.current); setListening(false); }
        buf.current = '';
        e.preventDefault();
        return;
      }
      if (e.key.length === 1) buf.current += e.key;
    };
    window.addEventListener('keydown', onKey);
    const bail = setTimeout(() => setListening(false), 20000);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(bail); buf.current = ''; };
  }, [listening]);

  const save = async () => {
    try {
      await api(isNew ? '/cards' : '/cards/' + card.id, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({
          name: f.name, barcode: f.barcode, emoji: f.emoji,
          colour: f.colour, active: f.active,
          ...(isNew ? { balance: f.balance } : {}),
        }),
      });
      onSaved();
    } catch (e) { setErr(e.message); }
  };

  const remove = async () => {
    if (!confirm(`Delete ${f.name}? Its balance and history go too.`)) return;
    try { await api('/cards/' + card.id, { method: 'DELETE' }); onSaved(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="icon-btn" onClick={onClose}>←</button>
          <h2>{isNew ? 'New card' : 'Edit card'}</h2>
        </div>

        {err && <div className="banner bad">{err}</div>}

        <CardFace card={f} sym={sym} big />

        <div className="field">
          <label>Whose card is it?</label>
          <input value={f.name} placeholder="Ava's card"
            onChange={(e) => set('name', e.target.value)} />
        </div>

        <div className="field">
          <label>Barcode</label>
          <input value={f.barcode} placeholder="scan it, or type the number"
            onChange={(e) => set('barcode', e.target.value.trim())} />
          <button
            className={'big-btn wide' + (listening ? ' red' : ' ghost')}
            style={{ marginTop: 8 }}
            onClick={() => setListening((v) => !v)}
          >
            {listening ? '👀 Waiting — scan the card now (tap to stop)' : '🔫 Capture with the scanner'}
          </button>
        </div>

        <div className="field">
          <label>Picture</label>
          <div className="emoji-row">
            {EMOJIS.map((e) => (
              <button key={e} className={'emoji-pick' + (f.emoji === e ? ' on' : '')}
                onClick={() => set('emoji', e)}>{e}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Colour</label>
          <div className="colour-row">
            {COLOURS.map((c) => (
              <button key={c} className={'colour-pick ' + c + (f.colour === c ? ' on' : '')}
                onClick={() => set('colour', c)} aria-label={c} />
            ))}
          </div>
        </div>

        {isNew && (
          <div className="field">
            <label>Starting money</label>
            <MoneyInput sym={sym} value={f.balance}
              onChange={(c) => set('balance', Math.max(0, c))} />
          </div>
        )}

        {!isNew && (
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
              <input type="checkbox" checked={!!f.active} style={{ width: 'auto', margin: 0 }}
                onChange={(e) => set('active', e.target.checked)} />
              Card works at the till
            </label>
          </div>
        )}

        <button className="big-btn wide" onClick={save} disabled={!f.name || !f.barcode}>
          Save card
        </button>
        {!isNew && (
          <button className="big-btn wide red" style={{ marginTop: 10 }} onClick={remove}>
            Delete card
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
function TopUp({ card, sym, onClose, onSaved }) {
  const [amount, setAmount] = useState(0);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const go = async (cents) => {
    if (!cents) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/cards/${card.id}/topup`, {
        method: 'POST',
        body: JSON.stringify({ amount: cents, note: cents > 0 ? 'Pocket money' : 'Taken off' }),
      });
      onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="icon-btn" onClick={onClose}>←</button>
          <h2>Load money</h2>
        </div>

        <CardFace card={card} sym={sym} big />
        {err && <div className="banner bad">{err}</div>}

        <p className="sub">Tap an amount to put it straight on</p>
        <div className="money-grid">
          {QUICK.map((v) => (
            <button key={v} className="money blue" disabled={busy} onClick={() => go(v)}>
              +{money(v, sym)}
            </button>
          ))}
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Or type any amount</label>
          <MoneyInput sym={sym} value={amount} allowNegative onChange={setAmount} />
        </div>
        <button className="big-btn wide" disabled={busy || !amount} onClick={() => go(amount)}>
          {amount < 0 ? `Take off ${money(Math.abs(amount), sym)}` : `Add ${money(amount || 0, sym)}`}
        </button>
        <p className="sub" style={{ marginTop: 8 }}>
          A negative amount takes money back off the card.
        </p>
      </div>
    </div>
  );
}
