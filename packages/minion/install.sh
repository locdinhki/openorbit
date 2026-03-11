#!/bin/bash
# Open Hive — Minion install script
# Usage: curl -sSL https://your-hive.example.com/minion/install.sh | bash -s -- <HIVE_URL> <API_KEY>
#
# This script:
#   1. Installs Node.js if not present (via nvm)
#   2. Clones or updates the minion source
#   3. Installs dependencies
#   4. Writes config
#   5. Installs and enables systemd service

set -e

HIVE_URL="${1:-}"
API_KEY="${2:-}"
DEVICE_NAME="${3:-$(hostname)}"
INSTALL_DIR="/opt/hive-minion"
CONFIG_DIR="/etc/hive-minion"
WORK_DIR="/home/hive/workspace"
SERVICE_USER="hive"

# ── Helpers ──────────────────────────────────────────────────────────────────

info()  { echo -e "\033[1;34m[hive]\033[0m $*"; }
error() { echo -e "\033[1;31m[hive]\033[0m $*" >&2; exit 1; }

# ── Preflight ────────────────────────────────────────────────────────────────

if [ "$(id -u)" -ne 0 ]; then
  error "This script must be run as root (use sudo)"
fi

if [ -z "$HIVE_URL" ] || [ -z "$API_KEY" ]; then
  error "Usage: install.sh <HIVE_URL> <API_KEY> [DEVICE_NAME]
  Example: install.sh wss://hive.example.com hive_abc123def456 my-pi"
fi

# ── Create service user ─────────────────────────────────────────────────────

if ! id "$SERVICE_USER" &>/dev/null; then
  info "Creating service user: $SERVICE_USER"
  useradd --system --create-home --shell /bin/bash "$SERVICE_USER"
fi

# ── Install Node.js if needed ────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  info "Installing Node.js 22.x..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  elif command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf install -y nodejs
  else
    error "Unsupported package manager. Install Node.js 22+ manually."
  fi
fi

NODE_VERSION=$(node -v)
info "Node.js: $NODE_VERSION"

# ── Install minion ───────────────────────────────────────────────────────────

info "Installing minion to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing install..."
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  info "Cloning minion source..."
  git clone --depth 1 https://github.com/yourusername/openorbit.git /tmp/openorbit-clone
  cp -r /tmp/openorbit-clone/packages/minion/* "$INSTALL_DIR/"
  cp -r /tmp/openorbit-clone/packages/minion/.* "$INSTALL_DIR/" 2>/dev/null || true
  rm -rf /tmp/openorbit-clone
fi

cd "$INSTALL_DIR"
npm install --omit=dev
info "Dependencies installed"

# ── Config ───────────────────────────────────────────────────────────────────

mkdir -p "$CONFIG_DIR"
mkdir -p "$WORK_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$WORK_DIR"

if [ ! -f "$CONFIG_DIR/config.json" ]; then
  info "Writing config to $CONFIG_DIR/config.json"
  cat > "$CONFIG_DIR/config.json" <<EOF
{
  "hiveUrl": "$HIVE_URL",
  "apiKey": "$API_KEY",
  "deviceName": "$DEVICE_NAME",
  "tags": [],
  "allowedOps": ["exec", "read", "write", "http"],
  "workDir": "$WORK_DIR",
  "localApi": { "enabled": true, "port": 18791, "bind": "0.0.0.0" },
  "maxOutputBytes": 10485760
}
EOF
  chmod 600 "$CONFIG_DIR/config.json"
  chown "$SERVICE_USER:$SERVICE_USER" "$CONFIG_DIR/config.json"
else
  info "Config already exists at $CONFIG_DIR/config.json — skipping"
fi

# ── systemd service ─────────────────────────────────────────────────────────

info "Installing systemd service"
cat > /etc/systemd/system/hive-minion.service <<EOF
[Unit]
Description=Hive Minion Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Restart=always
RestartSec=10
Environment=NODE_ENV=production
ExecStart=$(which npx) tsx $INSTALL_DIR/src/index.ts --config $CONFIG_DIR/config.json

# Hardening
NoNewPrivileges=false
ProtectSystem=strict
ReadWritePaths=$WORK_DIR $CONFIG_DIR
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable hive-minion
systemctl start hive-minion

info "Service installed and started"
info ""
info "Useful commands:"
info "  systemctl status hive-minion    — check status"
info "  journalctl -u hive-minion -f    — follow logs"
info "  systemctl restart hive-minion   — restart"
info ""
info "Config: $CONFIG_DIR/config.json"
info "Workspace: $WORK_DIR"
info "Done!"
