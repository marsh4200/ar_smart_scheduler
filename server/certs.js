// ============================================================
// Scanner — self-signed certificate for the LAN
//
// Browsers only hand over the camera on a "secure context":
// https://, or localhost. A tablet opening http://192.168.x.x:3010
// is neither, so getUserMedia is not even defined there.
//
// So the server also listens on HTTPS with a certificate it makes
// itself on first boot. The browser will warn once about the
// unknown issuer; after you tap through, the origin counts as
// secure and the camera works.
// ============================================================
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

export function localAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

export function ensureCert(dir) {
  const keyPath = path.join(dir, 'key.pem');
  const certPath = path.join(dir, 'cert.pem');
  const sanPath = path.join(dir, 'sans.txt');

  const wantSans = [
    'DNS:localhost',
    `DNS:${os.hostname()}`,
    `DNS:${os.hostname()}.local`,
    'IP:127.0.0.1',
    ...localAddresses().map((ip) => `IP:${ip}`),
  ].join(',');

  const have = fs.existsSync(keyPath) && fs.existsSync(certPath);
  let sansMatch = false;
  try { sansMatch = fs.readFileSync(sanPath, 'utf8').trim() === wantSans; } catch {}

  // Re-issue if the server has picked up a new IP since last time.
  if (have && sansMatch) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath), regenerated: false };
  }

  fs.mkdirSync(dir, { recursive: true });
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 3650 ` +
      `-keyout "${keyPath}" -out "${certPath}" ` +
      `-subj "/CN=scanner" -addext "subjectAltName=${wantSans}" ` +
      `-addext "basicConstraints=CA:FALSE" ` +
      `-addext "keyUsage=digitalSignature,keyEncipherment" ` +
      `-addext "extendedKeyUsage=serverAuth"`,
      { stdio: 'pipe', timeout: 30000 }
    );
    fs.chmodSync(keyPath, 0o600);
    fs.writeFileSync(sanPath, wantSans);
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath), regenerated: true };
  } catch (e) {
    // openssl missing or unhappy — carry on with plain HTTP only.
    return null;
  }
}
