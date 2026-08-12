# Changelog

## v1.5.0 - an online shop out front

**Online ordering**
- A little side app, on its own port (`3012` by default) — same server, same data, same
  sign-in as the till
- Browse whatever is currently on the shelves, build a basket, send it in. Nothing is
  charged yet; it's a heads-up, not a payment
- Orders show up under a new 🛍️ button at the till, with a badge for how many are waiting
- **Load** claims one and drops its items straight onto the scanner's list — add anything
  extra, then **Pay now** as normal, cash or card
- The shopper's own screen tracks progress: waiting → being packed → paid
- Switch it off under ⚙️ → Shop setup → *Let people order from the online shop*, and the
  address to hand out is shown right there too

## v1.4.0 - scan the card at checkout, and type any amount

**Paying by card**
- The Card tab now asks you to **scan the card** first, the way a real till does, instead of
  showing a list straight away
- The barcode scanner works on the checkout screen — it was only listening on the till screen
  before, so scanning there did nothing at all
- **Type the number** on the card if it will not scan, and press Enter
- **📷 Camera** to scan the card with a phone or tablet
- **📋 Choose a card** to pick from the list, for when the card is lost or the barcode is worn off
- A scanned barcode that is not a card says so, and points at the list

**Loading money**
- Money fields no longer fight you. They were reformatting on every keystroke — typing "5" turned
  into "5.00" and the caret jumped to the end, so a decimal point could never be entered. They now
  keep what you type and only convert when saving
- Amounts up to **R1 000 000** per load, instead of the old R10 000 ceiling
- Bigger quick-tap amounts: R10, R20, R50, R100, R500, R1 000, R10 000, R100 000
- Comma or full stop both work as the decimal separator, and spaces in thousands are ignored
- The same field is used for a card's starting balance, which had the same fault

## v1.3.1 - the update button actually works

The in-app update button had two faults that hid each other.

- **Failures were thrown away.** The app launched the updater with its output discarded and
  no exit handler, then replied "Update started" whatever happened. Any problem vanished
  without trace. Failures are now captured, written to the update log and shown on screen
- **Every successful update broke the next one.** Step 3 does `git reset --hard`, which restores
  the file modes recorded in the repo — stripping the executable bit off the scripts. `sudo` then
  refused to run them. The sudoers rule now points at root-owned wrappers in `/usr/local/sbin`,
  outside the git tree, where a pull cannot touch them
- **Preflight check** before every update: if the app cannot run the updater, it says so, with the
  reason, instead of pretending
- **Force rebuild** button for rebuilding and restarting when GitHub has nothing new
- **Clear stuck update** for a state file left on "running" by an update that died mid-way, which
  used to block every later attempt
- `sudo scanner-update` and `sudo scanner-rollback` now work from any SSH session, with `--force`
- The updater repairs the executable bit itself after each pull, as a second line of defence

## v1.3.0 - bank cards

Each child gets a card with a barcode on it. Grown-ups load money on, kids scan it to pay,
and the shop keeps track of what is left.

- **Scan a card at the till** and its balance comes up on a proper-looking card. With shopping
  in the basket, pay straight from that screen
- **Pay by card at checkout** — a new Card tab next to Cash. Scan the card or tap it on screen
- **Not enough money** says so plainly: what is on the card, what the shopping costs, exactly how
  much short, and that a grown-up needs to reload it. No cryptic error
- **Loading money is behind the PIN**, so nobody prints their own pocket money. Quick amounts, or
  type any figure; a negative amount takes money back off
- **⚙️ → Cards** to make cards, rename them, pick a colour and a picture, switch one off, or delete it
- **Capture the barcode by scanning it** when making a card — no typing long numbers
- A barcode can only mean one thing: the shop refuses a card barcode already used by an item, and
  the other way round
- **Balances cannot go negative.** The check and the debit happen in one database transaction, so
  even a jammed scanner firing repeat scans cannot overdraw a card
- Every load and spend is kept, with the running balance, shown as recent history on the card
- Card receipts show what is left on the card instead of change, and skip the change quiz
- Cards are included in backup and restore
- The whole feature has an off switch under ⚙️ → Shop setup

## v1.2.0 - a front door, and a camera that actually works

**Sign in**
- The shop now opens with a **login page**. Nothing loads and no API answers until someone signs in, so the server is no longer wide open to everyone on the network
- Starter sign-in is `admin` / `scanner` — the app nags with a yellow banner until it is changed
- Username and password live under ⚙️ → Shop setup, alongside the PIN
- "Keep me signed in on this tablet" holds the session for 60 days; without it, 12 hours
- Sessions are stored in the database, so an update or a reboot no longer signs the tablet out mid-game
- The grown-up PIN is now a **second** door, not the only one: signed in gets you the shop, the PIN gets you the settings
- "Sign out every other device" for when a tablet goes missing
- Repeated wrong passwords or PINs lock that device out for five minutes
- Passwords stored as scrypt hashes, never in the clear — backups deliberately leave them out

**Camera scanning**
- The real reason it never worked: browsers only hand over the camera on a secure origin, and `http://192.168.x.x:3010` is not one. The server now also listens on **https** (port 3011 by default) with a certificate it makes itself on first boot
- Tap 📷 on a plain http page and the shop explains this in plain words and offers a one-tap jump to the https address, instead of the old dead-end error
- Scanning no longer depends on Chrome's `BarcodeDetector`. When it is missing — iPad Safari, Firefox — the shop falls back to a built-in decoder, loaded only when needed so the app stays quick to open
- EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF, Codabar and QR
- The camera now **stays open**: scan one item after another and watch each one confirm on screen, instead of closing after every single barcode
- A green bar names the item as it lands, a yellow one says so when a barcode is unknown
- Torch button on phones that have one, a buzz on each hit, and a laser sweeping the box
- The camera shuts down properly on close — no more green light left on

## v1.1.0 - scan to build the list
- The till is now the main screen: items only appear on the list when they are **scanned**
- New scanner window at the top - a sweeping laser while it waits, then the item pops up big with a green tick
- Scanned items land at the **top** of the list with a slide-in and a yellow flash, numbered, with quantity buttons and a line total
- "Start again" clears the list without leaving the till
- The old tap-a-picture shelf is now optional: Shop setup has a new switch, *Let the shelves be tapped as well as scanned*, and a shop button then appears in the top bar
- Separate basket sheet removed - the list is always on screen, so there is nothing to open
- Nicer look throughout: rounder cards, chunkier shadows, a friendlier empty state and a centred layout on tablets

## v1.0.0 — first release
- Play shop for kids: tap a picture or scan a barcode to drop groceries in the basket
- 38 starter grocery items across 8 shelves, each with a picture, price and barcode
- Basket with plus/minus buttons and a running total
- Till: hand over notes and coins one at a time, see what's still owed
- "How much change?" question with three answers, so the maths gets practised
- Printed receipt with the change broken into notes and coins
- Barcode support: USB scanners work anywhere, phone/tablet cameras where the browser allows it
- Beeps, laser sweep and confetti (all switchable)
- Grown-up area behind a PIN: add or edit items, upload photos, pick emoji, set prices
- Sales history, favourite items and change-quiz score
- Backup and restore to a JSON file
- One-line installer, systemd service, and in-app update with rollback
