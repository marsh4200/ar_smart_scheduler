import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// CAMERA SCANNER
//
// Two things stop a tablet camera from scanning, and both are
// handled here.
//
// 1. Secure context. Browsers only expose navigator.mediaDevices
//    on https:// or localhost. A LAN address over plain http gets
//    nothing at all — which is the "camera doesn't work" message.
//    So if we are not on a secure origin we say exactly that, and
//    offer a one-tap jump to the https port the server also listens on.
//
// 2. Decoding. BarcodeDetector is Chrome/Android only. Everywhere
//    else (iPad Safari, Firefox) we fall back to ZXing, loaded on
//    demand so it never lands in the main bundle.
// ============================================================

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar', 'qr_code'];
const REPEAT_MS = 1400; // ignore the same barcode if it is still in front of the lens

export default function CameraScanner({ onCode, onClose, httpsPort }) {
  const videoRef = useRef(null);
  const [state, setState] = useState('starting'); // starting | scanning | insecure | error
  const [error, setError] = useState(null);
  const [engine, setEngine] = useState('');
  const [feed, setFeed] = useState(null); // { ok, name, emoji, photo, code }
  const [torch, setTorch] = useState(null); // null = unsupported

  const stopRef = useRef([]);
  const seenRef = useRef({ code: null, at: 0 });
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const secureUrl = (() => {
    const host = location.hostname;
    const port = httpsPort || 3011;
    return `https://${host}:${port}${location.pathname}`;
  })();

  // ---------- a hit ----------
  const hit = useCallback(async (raw) => {
    const code = String(raw || '').trim();
    if (!code) return;
    const now = Date.now();
    if (seenRef.current.code === code && now - seenRef.current.at < REPEAT_MS) return;
    seenRef.current = { code, at: now };

    if (navigator.vibrate) { try { navigator.vibrate(35); } catch {} }
    const result = await onCodeRef.current(code);
    setFeed(result?.ok
      ? { ok: true, name: result.product.name, emoji: result.product.emoji, photo: result.product.photo }
      : { ok: false, code });
  }, []);

  useEffect(() => {
    if (!feed) return;
    const t = setTimeout(() => setFeed(null), 2200);
    return () => clearTimeout(t);
  }, [feed]);

  // ---------- start up ----------
  useEffect(() => {
    let dead = false;
    const stops = stopRef.current;

    const wireTorch = (stream) => {
      const track = stream?.getVideoTracks?.()[0];
      if (!track?.getCapabilities) return;
      try {
        if (track.getCapabilities().torch) {
          setTorch({ on: false, track });
        }
      } catch {}
    };

    (async () => {
      // --- gate 1: is the camera even reachable here? ---
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setState('insecure');
        return;
      }

      // --- native BarcodeDetector (Chrome, Android) ---
      if ('BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const formats = FORMATS.filter((f) => supported.includes(f));
          if (!formats.length) throw new Error('no usable formats');
          const detector = new window.BarcodeDetector({ formats });

          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }

          stops.push(() => stream.getTracks().forEach((t) => t.stop()));
          wireTorch(stream);

          const v = videoRef.current;
          v.srcObject = stream;
          await v.play();

          setEngine('native');
          setState('scanning');

          let raf;
          const tick = async () => {
            if (dead) return;
            try {
              const codes = await detector.detect(v);
              if (codes.length) hit(codes[0].rawValue);
            } catch {}
            raf = requestAnimationFrame(tick);
          };
          stops.push(() => cancelAnimationFrame(raf));
          tick();
          return;
        } catch (e) {
          if (e?.name === 'NotAllowedError') {
            setError('The browser blocked the camera. Allow camera access for this page and try again.');
            setState('error');
            return;
          }
          // otherwise fall through to ZXing
        }
      }

      // --- ZXing fallback (iPad Safari, Firefox, older Chrome) ---
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (dead) return;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
          BarcodeFormat.ITF, BarcodeFormat.CODABAR,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => { if (result) hit(result.getText()); }
        );
        if (dead) { controls.stop(); return; }

        stops.push(() => { try { controls.stop(); } catch {} });
        stops.push(() => {
          const s = videoRef.current?.srcObject;
          s?.getTracks?.().forEach((t) => t.stop());
        });
        wireTorch(videoRef.current?.srcObject);

        setEngine('zxing');
        setState('scanning');
      } catch (e) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'The browser blocked the camera. Allow camera access for this page and try again.'
            : e?.name === 'NotFoundError'
              ? 'No camera found on this device. A USB scanner works anywhere.'
              : 'The camera would not start. A USB scanner works anywhere.'
        );
        setState('error');
      }
    })();

    return () => {
      dead = true;
      stops.forEach((fn) => { try { fn(); } catch {} });
      stops.length = 0;
    };
  }, [hit]);

  const toggleTorch = async () => {
    if (!torch?.track) return;
    const on = !torch.on;
    try {
      await torch.track.applyConstraints({ advanced: [{ torch: on }] });
      setTorch({ ...torch, on });
    } catch {}
  };

  // ---------- not a secure origin ----------
  if (state === 'insecure') {
    return (
      <div className="scan-overlay light">
        <div className="scan-help">
          <div className="scan-help-mark">🔒</div>
          <h2>The camera needs a padlock</h2>
          <p className="sub">
            Browsers only hand over the camera on a secure <strong>https://</strong> address. This page
            is on plain <strong>http://</strong>, so the camera is switched off before the shop even asks
            for it.
          </p>
          <a className="big-btn wide" href={secureUrl}>
            Open the shop on https:// →
          </a>
          <p className="sub" style={{ marginTop: 12 }}>
            The first time, the browser warns that it does not know the certificate — tap
            <strong> Advanced</strong> then <strong>Continue</strong>. It is your own server, so that is
            expected. Bookmark that address on the tablet and the camera keeps working.
          </p>
          <button className="big-btn wide ghost" style={{ marginTop: 10 }} onClick={onClose}>
            Not now — use the USB scanner
          </button>
        </div>
      </div>
    );
  }

  // ---------- something else went wrong ----------
  if (state === 'error') {
    return (
      <div className="scan-overlay light">
        <div className="scan-help">
          <div className="scan-help-mark">📷</div>
          <h2>No luck with the camera</h2>
          <div className="banner warn">{error}</div>
          <button className="big-btn wide" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // ---------- live ----------
  return (
    <div className="scan-overlay">
      <video ref={videoRef} playsInline muted autoPlay />

      <div className="scan-frame">
        <span className="scan-line" />
      </div>

      {feed && (
        <div className={'scan-feed' + (feed.ok ? ' ok' : ' bad')}>
          {feed.ok ? (
            <>
              <span className="scan-feed-art">
                {feed.photo ? <img src={'/photos/' + feed.photo} alt="" /> : (feed.emoji || '🛒')}
              </span>
              <span>{feed.name} added ✓</span>
            </>
          ) : (
            <span>No item has the barcode {feed.code}</span>
          )}
        </div>
      )}

      <div className="scan-bar">
        <p className="sub" style={{ margin: '0 0 10px' }}>
          {state === 'starting'
            ? 'Waking the camera up…'
            : 'Hold a barcode in the box — keep scanning, they all drop onto the list'}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {torch && (
            <button className="big-btn ghost" style={{ flex: '0 0 auto' }} onClick={toggleTorch}>
              {torch.on ? '💡 Off' : '🔦 Light'}
            </button>
          )}
          <button className="big-btn wide red" style={{ flex: 1 }} onClick={onClose}>
            Done
          </button>
        </div>
        {engine === 'zxing' && <p className="scan-engine">Using the built-in decoder</p>}
      </div>
    </div>
  );
}
