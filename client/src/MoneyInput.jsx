import { useState, useEffect } from 'react';

// ============================================================
// A money field that lets you finish typing.
//
// The old fields were controlled from the cents value and
// reformatted on every keystroke, so "5" became "5.00" and the
// caret jumped to the end — you could never get a decimal point
// in. This one keeps the raw text as you type and only converts
// to cents on the way out.
// ============================================================

// "1 234,56" / "1234.5" / "1234" -> cents
export function toCents(text) {
  const clean = String(text).replace(/[\s,]/g, (m) => (m === ',' ? '.' : '')).trim();
  if (!clean || clean === '.' || clean === '-') return 0;
  const n = Number(clean);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export const fromCents = (cents) => (cents / 100).toFixed(2);

export default function MoneyInput({ value, onChange, sym = 'R', allowNegative = false, ...rest }) {
  const [text, setText] = useState(value ? fromCents(value) : '');

  // Follow the value when the parent resets it, but never while typing.
  useEffect(() => {
    if (toCents(text) !== value) setText(value ? fromCents(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value === 0]);

  const handle = (raw) => {
    // Digits, one decimal separator, optional leading minus. Nothing else.
    let v = raw.replace(allowNegative ? /[^0-9.,-]/g : /[^0-9.,]/g, '');
    v = v.replace(/,/g, '.');
    const parts = v.split('.');
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    if (allowNegative) v = (v.startsWith('-') ? '-' : '') + v.replace(/-/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) v = v.slice(0, dot + 3); // at most two decimals
    setText(v);
    onChange(toCents(v));
  };

  return (
    <div className="money-input">
      <span className="money-input-sym">{sym}</span>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        value={text}
        placeholder="0.00"
        onChange={(e) => handle(e.target.value)}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}
