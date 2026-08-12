import { useState, useEffect, useRef } from 'react';
import { api, setToken } from './lib.js';

// ============================================================
// The front door. Nothing in the shop loads until this passes.
// ============================================================
export default function Login({ pub, onIn }) {
  const [username, setUsername] = useState(localStorage.getItem('scanner_user') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const userRef = useRef(null);
  const passRef = useRef(null);

  useEffect(() => {
    (username ? passRef : userRef).current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (busy || !username || !password) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, remember }),
      });
      setToken(r.token);
      localStorage.setItem('scanner_user', r.username || username);
      onIn();
    } catch (e) {
      setError(e.message);
      setPassword('');
      passRef.current?.focus();
      setBusy(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-mark">🛒</div>
        <h1 className="login-title">{pub?.shopName || 'Scanner'}</h1>
        <p className="login-sub">{pub?.shopTagline || 'Sign in to open the shop'}</p>

        {error && <div className="banner bad">{error}</div>}

        <div className="field">
          <label>Username</label>
          <input
            ref={userRef}
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={onKey}
            placeholder="admin"
          />
        </div>

        <div className="field">
          <label>Password</label>
          <input
            ref={passRef}
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKey}
            placeholder="••••••••"
          />
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            Keep me signed in on this tablet
          </label>
        </div>

        <button className="big-btn wide" onClick={submit} disabled={busy || !username || !password}>
          {busy ? 'Checking…' : 'Open the shop'}
        </button>

        {pub?.defaultLogin && (
          <div className="banner warn" style={{ marginTop: 14, marginBottom: 0 }}>
            First time here? Sign in with <strong>admin</strong> / <strong>scanner</strong>, then change it
            under ⚙️ → Shop setup.
          </div>
        )}

        <p className="login-foot">v{pub?.version || '…'}</p>
      </div>
    </div>
  );
}
