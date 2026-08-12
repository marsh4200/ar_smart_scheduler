#!/usr/bin/env bash
# ============================================================
# In-app updater for Scanner
# Run via 'sudo updater.sh' from the running service.
# Logs to $DATA_DIR/updater.log so the UI can tail it.
# ============================================================
set -euo pipefail

# --force / FORCE=1 rebuilds even when GitHub has nothing new.
FORCE="${FORCE:-0}"
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    --preflight) echo "updater reachable"; exit 0 ;;   # plumbing check, changes nothing
    *) echo "Unknown option: $arg"; exit 2 ;;
  esac
done

INSTALL_DIR="/opt/scanner"
REPO_DIR="/opt/scanner-src"
DATA_DIR="$INSTALL_DIR/data"
SERVICE="scanner"
SERVICE_USER="scanner"
LOG_FILE="$DATA_DIR/updater.log"
STATE_FILE="$DATA_DIR/updater.state"
PREVIOUS_SHA_FILE="$DATA_DIR/previous-sha"

say() { echo "[$(date +%H:%M:%S)] $1" | tee -a "$LOG_FILE"; }
set_state() { echo "$1" > "$STATE_FILE"; chown "$SERVICE_USER:$SERVICE_USER" "$STATE_FILE"; }
fail() { say "FAILED: $1"; set_state "failed"; exit 1; }

mkdir -p "$DATA_DIR"
echo "===== Update started $(date)$([ "$FORCE" = "1" ] && echo ' (forced)') =====" > "$LOG_FILE"
chown "$SERVICE_USER:$SERVICE_USER" "$LOG_FILE"
set_state "running"

[ -d "$REPO_DIR" ] || fail "Repo not found at $REPO_DIR."

say "Step 1/6: Backing up the shop database..."
if [ -f "$DATA_DIR/scanner.db" ]; then
  STAMP=$(date +%Y%m%d-%H%M%S)
  mkdir -p "$DATA_DIR/backups"
  cp "$DATA_DIR/scanner.db" "$DATA_DIR/backups/pre-update-$STAMP.db" || fail "DB backup failed"
  say "  ok Backup: pre-update-$STAMP.db"
else
  say "  (no database yet; skipping)"
fi

say "Step 2/6: Recording current version for rollback..."
CURRENT_SHA=$(sudo -u "$SERVICE_USER" git -C "$REPO_DIR" rev-parse HEAD)
echo "$CURRENT_SHA" > "$PREVIOUS_SHA_FILE"
chown "$SERVICE_USER:$SERVICE_USER" "$PREVIOUS_SHA_FILE"
say "  ok Previous SHA: ${CURRENT_SHA:0:8}"

say "Step 3/6: Pulling latest code from GitHub..."
sudo -u "$SERVICE_USER" git -C "$REPO_DIR" fetch origin main 2>&1 | tee -a "$LOG_FILE" || fail "git fetch failed"
sudo -u "$SERVICE_USER" git -C "$REPO_DIR" reset --hard origin/main 2>&1 | tee -a "$LOG_FILE" || fail "git reset failed"
NEW_SHA=$(sudo -u "$SERVICE_USER" git -C "$REPO_DIR" rev-parse HEAD)
say "  ok New SHA: ${NEW_SHA:0:8}"

# GitHub's web uploader drops the executable bit, which breaks the next
# update. Put it back on every pull so it can never strand itself.
chmod +x "$REPO_DIR/scripts/"*.sh 2>/dev/null || true

if [ "$CURRENT_SHA" = "$NEW_SHA" ]; then
  if [ "$FORCE" = "1" ]; then
    say "  Already on the latest commit, but --force was given: rebuilding anyway."
  else
    say "Already on the latest version, nothing to do."
    say "  (run with --force to rebuild and restart regardless)"
    set_state "idle"
    exit 0
  fi
fi

say "Step 4/6: Syncing files..."
rsync -a --delete --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='data' \
  "$REPO_DIR/server/" "$INSTALL_DIR/server/" 2>&1 | tee -a "$LOG_FILE"
rsync -a --delete --exclude='node_modules' --exclude='dist' --exclude='.git' \
  "$REPO_DIR/client/" "$INSTALL_DIR/client/" 2>&1 | tee -a "$LOG_FILE"
cp "$REPO_DIR/VERSION" "$INSTALL_DIR/VERSION"
cp "$REPO_DIR/CHANGELOG.md" "$INSTALL_DIR/CHANGELOG.md" 2>/dev/null || true
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/server" "$INSTALL_DIR/client" "$INSTALL_DIR/VERSION"
say "  ok Files synced"

say "Step 5/6: Installing dependencies and building..."
sudo -u "$SERVICE_USER" bash -c "cd '$INSTALL_DIR/server' && npm install --omit=dev" 2>&1 | tee -a "$LOG_FILE" || fail "server npm install failed"
sudo -u "$SERVICE_USER" bash -c "cd '$INSTALL_DIR/client' && npm install && npm run build" 2>&1 | tee -a "$LOG_FILE" || fail "client build failed"
say "  ok Build complete"

NEW_VERSION=$(cat "$INSTALL_DIR/VERSION" 2>/dev/null || echo "unknown")
say "Step 6/6: Restarting service..."
say "Update complete! Now on v$NEW_VERSION"
set_state "done"
if command -v systemd-run >/dev/null 2>&1; then
  systemd-run --scope --quiet --collect systemctl restart "$SERVICE" >/dev/null 2>&1 || systemctl restart "$SERVICE"
else
  systemctl restart "$SERVICE" || fail "systemctl restart failed"
fi
sleep 3
if systemctl is-active --quiet "$SERVICE"; then
  say "  ok Service is running"
else
  say "Service may not be running. Check: journalctl -u $SERVICE -n 50"
fi
exit 0
