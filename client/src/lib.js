// Shared helpers for the shop and the grown-up area.

export const getToken = () => localStorage.getItem('scanner_token');
export const setToken = (t) => localStorage.setItem('scanner_token', t);
export const clearToken = () => localStorage.removeItem('scanner_token');

export const api = async (path, opts = {}) => {
  const token = getToken();
  const res = await fetch('/api' + path, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
};

export const money = (cents, sym = 'R') =>
  sym + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// Notes and coins the kid can hand over
export const DENOMS = [
  { v: 20000, label: 'R200', cls: 'note-200' },
  { v: 10000, label: 'R100', cls: 'note-100' },
  { v: 5000, label: 'R50', cls: 'note-50' },
  { v: 2000, label: 'R20', cls: 'note-20' },
  { v: 1000, label: 'R10', cls: 'note-10' },
  { v: 500, label: 'R5', cls: 'coin' },
  { v: 200, label: 'R2', cls: 'coin' },
  { v: 100, label: 'R1', cls: 'coin' },
  { v: 50, label: '50c', cls: 'coin' },
];

export function breakChange(amount) {
  const out = [];
  let left = amount;
  for (const d of DENOMS) {
    while (left >= d.v) { out.push(d); left -= d.v; }
  }
  return out;
}

// ---------- sounds ----------
let audioCtx = null;
function tone(freqs, dur = 0.09, type = 'square') {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    freqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.13, audioCtx.currentTime + i * dur);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (i + 1) * dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * dur);
      osc.stop(audioCtx.currentTime + (i + 1) * dur);
    });
  } catch {}
}

export const SOUND = {
  beep: () => tone([1500], 0.07),
  drop: () => tone([700, 1000], 0.06),
  buzz: () => tone([180, 140], 0.13, 'sawtooth'),
  cheer: () => tone([523, 659, 784, 1047], 0.11, 'triangle'),
};
