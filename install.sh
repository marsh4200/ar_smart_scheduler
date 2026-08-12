#!/usr/bin/env bash
# ============================================================
# Scanner — One-Line Installer
#
#   curl -sL https://raw.githubusercontent.com/marsh4200/scanner/main/install.sh | sudo bash
#
# Installs Node 20, clones the repo, builds the app, creates the
# systemd service and wires up the in-app updater.
# ============================================================
set -e

REPO_URL="${REPO_URL:-https://github.com/marsh4200/scanner.git}"
REPO_DIR="${REPO_DIR:-/opt/scanner-src}"
INSTALL_DIR="${INSTALL_DIR:-/opt/scanner}"
SERVICE_USER="${SERVICE_USER:-scanner}"
SERVICE="${SERVICE:-scanner}"
APP_PORT="${APP_PORT:-3010}"
HTTPS_PORT="${HTTPS_PORT:-$((APP_PORT + 1))}"
ONLINE_PORT="${ONLINE_PORT:-$((APP_PORT + 2))}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}!! ${NC} $1"; }
err()  { echo -e "${RED}XX${NC} $1"; }

if [ "$(id -u)" -ne 0 ]; then
  err "This installer must run as root."
  err "Usage: curl -sL https://raw.githubusercontent.com/marsh4200/scanner/main/install.sh | sudo bash"
  exit 1
fi

echo "============================================================"
echo " Scanner — Installer"
echo "============================================================"
echo " Repo:        $REPO_URL"
echo " Install dir: $INSTALL_DIR"
echo " Service:     $SERVICE (user: $SERVICE_USER)"
echo " Ports:       $APP_PORT (http), $HTTPS_PORT (https, for tablet cameras), $ONLINE_PORT (online shop)"
echo "============================================================"
echo

log "Updating package lists…"
apt-get update -qq

log "Installing prerequisites (git, curl, rsync)…"
apt-get install -y -qq git curl rsync ca-certificates openssl

log "Checking Node.js…"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
  log "Installing Node.js 20 from NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs build-essential python3
else
  log "Node $(node -v) already installed."
  apt-get install -y -qq build-essential python3
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  log "Creating service user '$SERVICE_USER'…"
  useradd --system --create-home --home-dir "/home/$SERVICE_USER" --shell /bin/bash "$SERVICE_USER"
fi

if [ -d "$REPO_DIR/.git" ]; then
  log "Repo already exists at $REPO_DIR, pulling latest…"
  sudo -u "$SERVICE_USER" git -C "$REPO_DIR" fetch origin main
  sudo -u "$SERVICE_USER" git -C "$REPO_DIR" reset --hard origin/main
else
  log "Cloning repo to $REPO_DIR…"
  rm -rf "$REPO_DIR"
  mkdir -p "$REPO_DIR"
  chown "$SERVICE_USER:$SERVICE_USER" "$REPO_DIR"
  sudo -u "$SERVICE_USER" git clone "$REPO_URL" "$REPO_DIR"
fi

log "Syncing source to $INSTALL_DIR…"
mkdir -p "$INSTALL_DIR"
rsync -a --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='data' \
  "$REPO_DIR/server" "$REPO_DIR/client" "$INSTALL_DIR/"
[ -f "$REPO_DIR/VERSION" ] && cp "$REPO_DIR/VERSION" "$INSTALL_DIR/VERSION"
[ -f "$REPO_DIR/CHANGELOG.md" ] && cp "$REPO_DIR/CHANGELOG.md" "$INSTALL_DIR/CHANGELOG.md"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

log "Installing server dependencies…"
sudo -u "$SERVICE_USER" bash -c "cd '$INSTALL_DIR/server' && npm install --omit=dev"

log "Building the shop front end (takes ~30s)…"
sudo -u "$SERVICE_USER" bash -c "cd '$INSTALL_DIR/client' && npm install && npm run build"

chmod +x "$REPO_DIR/scripts/"*.sh 2>/dev/null || true

# Root-owned wrappers in /usr/local/sbin. The sudoers rule points here rather
# than into the git checkout, because a "git reset --hard" restores the modes
# recorded in the repo and would otherwise strip the executable bit off the
# scripts every single update — silently breaking the in-app button.
log "Installing maintenance wrappers…"
cat > /usr/local/sbin/scanner-update <<EOF
#!/bin/bash
exec /bin/bash "$REPO_DIR/scripts/updater.sh" "\$@"
EOF
cat > /usr/local/sbin/scanner-rollback <<EOF
#!/bin/bash
exec /bin/bash "$REPO_DIR/scripts/rollback.sh" "\$@"
EOF
chown root:root /usr/local/sbin/scanner-update /usr/local/sbin/scanner-rollback
chmod 755 /usr/local/sbin/scanner-update /usr/local/sbin/scanner-rollback

# Handy from an SSH session too: `sudo scanner-update --force`
ln -sf /usr/local/sbin/scanner-update /usr/local/bin/scanner-update 2>/dev/null || true
ln -sf /usr/local/sbin/scanner-rollback /usr/local/bin/scanner-rollback 2>/dev/null || true

log "Granting the service permission to update itself…"
cat > /etc/sudoers.d/scanner-updater <<EOF
$SERVICE_USER ALL=(root) NOPASSWD: /usr/local/sbin/scanner-update
$SERVICE_USER ALL=(root) NOPASSWD: /usr/local/sbin/scanner-rollback
$SERVICE_USER ALL=(root) NOPASSWD: /bin/bash $REPO_DIR/scripts/updater.sh
$SERVICE_USER ALL=(root) NOPASSWD: /bin/bash $REPO_DIR/scripts/rollback.sh
EOF
chmod 440 /etc/sudoers.d/scanner-updater
visudo -c -f /etc/sudoers.d/scanner-updater >/dev/null

log "Creating systemd service…"
tee /etc/systemd/system/$SERVICE.service > /dev/null <<EOF
[Unit]
Description=Scanner — kids' grocery shop
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR/server
Environment="NODE_ENV=production"
Environment="PORT=$APP_PORT"
Environment="HTTPS_PORT=$HTTPS_PORT"
Environment="ONLINE_PORT=$ONLINE_PORT"
Environment="DATA_DIR=$INSTALL_DIR/data"
Environment="REPO_DIR=$REPO_DIR"
Environment="INSTALL_DIR=$INSTALL_DIR"
ExecStart=/usr/bin/node $INSTALL_DIR/server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE
systemctl restart $SERVICE

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  log "Opening firewall ports $APP_PORT, $HTTPS_PORT and $ONLINE_PORT…"
  ufw allow $APP_PORT/tcp >/dev/null
  ufw allow $HTTPS_PORT/tcp >/dev/null
  ufw allow $ONLINE_PORT/tcp >/dev/null
fi

sleep 2
echo
echo "============================================================"
log "Install complete!"
echo "============================================================"
systemctl status $SERVICE --no-pager -l | head -n 10 || true
echo
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server-ip")
VERSION=$(cat "$INSTALL_DIR/VERSION" 2>/dev/null || echo "unknown")
echo " Version installed: v$VERSION"
echo
echo " Open the shop:"
echo "   http://$IP:$APP_PORT"
echo
echo " For camera scanning on a phone or tablet, use the https address:"
echo "   https://$IP:$HTTPS_PORT"
echo "   (the browser warns once about the certificate — tap Advanced, Continue)"
echo
echo " Online shop (place an order that shows up at the till):"
echo "   http://$IP:$ONLINE_PORT"
echo
echo " Sign in:      admin / scanner   <-- change this straight away"
echo " Grown-up PIN: 1234              (change it under ⚙️ → Shop setup)"
echo " Both live under ⚙️ → Shop setup."
echo
echo " Future updates: ⚙️ → Updates → Update now."
echo "============================================================"
