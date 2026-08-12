import { useState, useEffect } from 'react';
import { api, money } from './lib.js';

// ============================================================
// What a bank card looks like when you scan one.
//
// Empty basket  -> just the balance, plus recent history.
// Shopping to pay for -> pay straight from here, or a clear
// "not enough, reload first" if the money is short.
// ============================================================
export function CardFace({ card, sym, big }) {
  return (
    <div className={'bankcard ' + (card.colour || 'blue') + (big ? ' big' : '')}>
      <div className="bankcard-top">
        <span className="bankcard-chip" />
        <span className="bankcard-emoji">{card.emoji || '💳'}</span>
      </div>
      <div className="bankcard-balance">{money(card.balance, sym)}</div>
      <div className="bankcard-name">{card.name}</div>
      {!card.active && <div className="bankcard-off">switched off</div>}
    </div>
  );
}

export default function CardSheet({ card, sym, total, itemCount, grownUp, onPay, onTopUp, onClose }) {
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/cards/${card.id}/history?limit=6`).then(setHistory).catch(() => {});
  }, [card.id, card.balance]);

  const shopping = itemCount > 0;
  const short = total - card.balance;
  const canPay = shopping && card.active && short <= 0;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <CardFace card={card} sym={sym} big />

        {!shopping && (
          <p className="sub" style={{ textAlign: 'center', marginTop: 16 }}>
            {card.active
              ? 'Fill the basket, then scan this card again to pay.'
              : 'A grown-up has switched this card off.'}
          </p>
        )}

        {shopping && (
          <>
            <div className="line" style={{ justifyContent: 'space-between', marginTop: 16 }}>
              <span className="line-name">{itemCount} item{itemCount === 1 ? '' : 's'} in the basket</span>
              <span className="line-total">{money(total, sym)}</span>
            </div>

            {canPay ? (
              <>
                <div className="banner ok">
                  Enough money on the card. {money(card.balance - total, sym)} would be left over.
                </div>
                <button
                  className="big-btn wide"
                  disabled={busy}
                  onClick={async () => { setBusy(true); await onPay(card); setBusy(false); }}
                >
                  {busy ? 'Paying…' : `Pay ${money(total, sym)} with this card 💳`}
                </button>
              </>
            ) : (
              <div className="banner bad">
                <strong>Not enough money on this card.</strong>
                <br />
                It has {money(card.balance, sym)} and the shopping costs {money(total, sym)} — that
                is <strong>{money(short, sym)} short</strong>. Ask a grown-up to reload it, or pay with cash
                instead.
              </div>
            )}
          </>
        )}

        {history.length > 0 && (
          <div className="card-history">
            <h4>Recent</h4>
            {history.map((t) => (
              <div className="r-line" key={t.id}>
                <span>
                  {t.kind === 'spend' ? '🛒 Spent' : t.kind === 'topup' ? '💰 Loaded' : '✏️ Changed'}
                  {t.note ? ` · ${t.note}` : ''}
                </span>
                <span className={t.amount < 0 ? 'txn-out' : 'txn-in'}>
                  {t.amount < 0 ? '−' : '+'}{money(Math.abs(t.amount), sym)}
                </span>
              </div>
            ))}
          </div>
        )}

        {grownUp && (
          <button className="big-btn wide grape" style={{ marginTop: 12 }} onClick={() => onTopUp(card)}>
            💰 Load money on
          </button>
        )}

        <button className="big-btn wide ghost" style={{ marginTop: 10 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
