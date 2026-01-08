#!/bin/bash
set -euo pipefail

# Installation script for airband-sync systemd service
# Run this on your Raspberry Pi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "Airband Sync Service Installer"
echo "========================================"
echo

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo "ERROR: Do not run this script as root/sudo"
   echo "Run as your normal user: ./script/install-service.sh"
   exit 1
fi

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "ERROR: uv is not installed"
    echo "Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "✓ uv found: $(which uv)"

# Check if config exists
CONFIG_FILE="$HOME/.config/airband-sync.env"
if [ ! -f "$CONFIG_FILE" ]; then
    echo
    echo "Creating configuration file..."
    mkdir -p "$HOME/.config"
    cp "$SCRIPT_DIR/airband-sync.env.example" "$CONFIG_FILE"
    echo
    echo "⚠️  Please edit the configuration file with your credentials:"
    echo "   nano $CONFIG_FILE"
    echo
    read -p "Press Enter when you've configured the file, or Ctrl+C to exit..."
fi

# Validate config has required values
echo
echo "Validating configuration..."
source "$CONFIG_FILE"

REQUIRED_VARS=(
    "R2_ENDPOINT"
    "R2_BUCKET"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    "API_BASE_URL"
    "ASR_WORKER_TOKEN"
)

MISSING=0
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR:-}" ]; then
        echo "✗ Missing: $VAR"
        MISSING=1
    else
        echo "✓ $VAR is set"
    fi
done

if [ $MISSING -eq 1 ]; then
    echo
    echo "ERROR: Please configure all required variables in:"
    echo "       $CONFIG_FILE"
    exit 1
fi

# Test the script
echo
echo "Testing the sync script..."
timeout 10 uv run --no-project "$SCRIPT_DIR/airband_realtime_sync.py" || true

echo
read -p "Did the test run successfully? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please fix any errors and run this script again."
    exit 1
fi

# Prepare service file
echo
echo "Installing systemd service..."
SERVICE_FILE="/tmp/airband-sync.service"
UV_PATH="$(which uv)"
USER="$(whoami)"

# Create service file with correct paths
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Airband Real-time Recording Sync
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=$CONFIG_FILE

# Use --no-project to avoid loading project dependencies
ExecStart=$UV_PATH run --no-project $SCRIPT_DIR/airband_realtime_sync.py

# Restart policy
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=airband-sync

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${AIRBAND_RECORDINGS_DIR:-/home/$USER/airband-recordings}

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# Install service
sudo cp "$SERVICE_FILE" /etc/systemd/system/airband-sync.service
sudo systemctl daemon-reload

echo "✓ Service file installed"

# Enable and start service
read -p "Enable service to start on boot? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo systemctl enable airband-sync
    echo "✓ Service enabled"
fi

read -p "Start service now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo systemctl start airband-sync
    echo "✓ Service started"
    echo
    sleep 2
    sudo systemctl status airband-sync --no-pager
fi

echo
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo
echo "Useful commands:"
echo "  View logs:     sudo journalctl -u airband-sync -f"
echo "  Check status:  sudo systemctl status airband-sync"
echo "  Restart:       sudo systemctl restart airband-sync"
echo "  Stop:          sudo systemctl stop airband-sync"
echo
echo "See script/SETUP.md for full documentation."
