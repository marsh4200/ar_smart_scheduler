# Scanner

A play grocery shop for kids. Scan the items, watch them drop onto the list, pay at the
till with notes and coins, and work out the change.

Runs on any Ubuntu server on the LAN, opens in any browser, and works well on a tablet.

## Install

```bash
curl -sL https://raw.githubusercontent.com/marsh4200/scanner/main/install.sh | sudo bash
```

Then open `http://<server-ip>:3010`.

| | |
|---|---|
| Sign in | **admin** / **scanner** |
| Grown-up PIN | **1234** |

Change both under ⚙️ → Shop setup, first thing.

## Camera scanning

Browsers only hand the camera to a page on a **secure origin** — `https://` or `localhost`.
A tablet on `http://192.168.x.x:3010` is neither, which is why the camera button used to
dead-end. So the server also listens on HTTPS, on port **3011**, with a certificate it
generates itself on first boot:

```
https://<server-ip>:3011
```

The browser warns once that it does not know who issued the certificate — tap **Advanced**,
then **Continue**. It is your own server on your own network, so that is expected. Bookmark
that address on the tablet and the camera keeps working.

Nicer still, if the shop is already behind a Cloudflare tunnel it gets a real certificate and
the camera just works with no warning at all.

Scanning uses Chrome's built-in barcode reader where it exists, and falls back to a bundled
decoder everywhere else, so iPad Safari and Firefox work too. EAN-13, EAN-8, UPC-A, UPC-E,
Code 128, Code 39, ITF, Codabar and QR. The camera stays open while you scan, so a whole
trolley goes on the list in one go.

A USB barcode scanner needs none of this and works on any address.

## Online shop

A little side app, running on the same server and the same data, on its own port:

```
http://<server-ip>:3012
```

Whoever opens it signs in the same way as the till, browses whatever is currently on the
shelves (anything switched off there disappears here too), builds a basket and sends it in —
nothing is paid for yet. That order lands under the 🛍️ button at the till, badge and all.
Tap **Load** to drop it straight onto the scanner's list, add anything extra, then **Pay now**
as normal — cash or card. The order tracks itself back on the shopper's screen: waiting,
being packed, then paid.

Switch it off under ⚙️ → Shop setup if you only want the till.

## Updating

⚙️ → Updates → **Update now**. It pulls from GitHub, rebuilds, and restarts the service.
If something breaks, **Go back to previous version** restores the last working commit.

## How the kids use it

| | |
|---|---|
| **Scan a barcode** | The item pops up in the scanner window and drops onto the list, with a beep and a laser sweep |
| **The list** | Everything scanned so far, newest first, with minus and plus to change quantities |
| Camera button | Uses the phone or tablet camera instead of a USB scanner — stays open so you can scan item after item |
| **Start again** | Empties the list |
| **Pay now** | Hand over notes and coins until the amount is covered |
| **How much change?** | Three answers to pick from — the score is kept for you |

Nothing reaches the list except by scanning. If a grown-up would rather the kids could
also tap pictures, switch it on under Shop setup and a shop button appears in the top bar.

## Who can get in

Two separate doors:

- **Sign in** — a username and password, needed before the shop loads at all. Tick *keep me signed in*
  on the till tablet and it stays signed in for 60 days
- **Grown-up PIN** — a second door in front of ⚙️, so a signed-in tablet left on the counter cannot
  wander into the settings

Eight wrong tries locks that device out for five minutes. Passwords are stored as scrypt hashes and
are left out of backups.

## Bank cards

Give each child a card with a barcode — an old loyalty card, a printed label, anything that scans.

- Make the card under ⚙️ → Cards, and capture its barcode by scanning it rather than typing
- Load money on from the same place; this sits behind the grown-up PIN so pocket money stays finite
- At the till, scanning a card shows its balance. With shopping in the basket, pay right there
- Or at checkout, switch to the Card tab and scan the card. If it will not scan, type its number,
  use the camera, or tap **Choose a card** to pick from the list
- If the money is short the shop says how much by, and that it needs reloading first
- Balances can never go below zero, even if the scanner fires the same card twice

Switch the whole thing off under ⚙️ → Shop setup if you want a cash-only shop.

## Grown-up area (⚙️)

- **Items** — add, edit, hide or delete groceries; set price, shelf, barcode; upload a photo or pick an emoji
- **Cards** — make bank cards, load money, view history, switch one off
- **Shop setup** — shop name, money symbol, price display, tap-the-shelves mode, change quiz, sounds, sign-in details, PIN, backup/restore
- **Sales** — what has been sold, favourite items, change-quiz score
- **Updates** — check, update, roll back, and read the log

## Adding real items

Give an item a barcode and the kids can scan the actual packet from your kitchen.
Easiest way: open the item, click into the barcode box, and scan — the scanner types
the digits for you.

## Server layout

| | |
|---|---|
| Source | `/opt/scanner-src` |
| App | `/opt/scanner` |
| Data | `/opt/scanner/data` (SQLite + photos) |
| Service | `scanner` |
| Ports | `3010` http, `3011` https, `3012` online shop (override with `APP_PORT=…` / `ONLINE_PORT=…` on install) |
| Certificate | `/opt/scanner/data/certs` — delete it and restart to reissue |
| Update by SSH | `sudo scanner-update` (add `--force` to rebuild regardless) |
| Roll back | `sudo scanner-rollback` |

```bash
systemctl status scanner
journalctl -u scanner -f
```

## Development

```bash
cd server && npm install && npm start     # API on :3010 (and :3012 for the online shop)
cd client && npm install && npm run dev   # Vite on :5173, proxies to the API
```

The till is at `http://localhost:5173/`, the online shop at `http://localhost:5173/shop.html`.
