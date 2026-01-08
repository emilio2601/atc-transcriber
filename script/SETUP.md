# Raspberry Pi Setup Guide

Complete guide to setting up the real-time airband sync service on your Raspberry Pi.

## Prerequisites

- Raspberry Pi with Raspbian/Debian
- airband software running and writing to recordings directory
- Network connectivity to Cloudflare R2 and your Rails API

## Step 1: Install uv

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc  # or restart your shell
uv --version
```

## Step 2: Clone Repository

```bash
cd ~
git clone https://github.com/your-repo/atc-transcriber.git
cd atc-transcriber
```

## Step 3: Configure Environment

```bash
# Create config directory
mkdir -p ~/.config

# Copy and edit environment file
cp script/airband-sync.env.example ~/.config/airband-sync.env
nano ~/.config/airband-sync.env
```

Required configuration:
- `AIRBAND_RECORDINGS_DIR` - Where airband writes files
- `R2_ENDPOINT` - Your Cloudflare R2 endpoint URL
- `R2_BUCKET` - Bucket name (e.g., "radio-recordings")
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `API_BASE_URL` - Your Rails app URL
- `ASR_WORKER_TOKEN` - API authentication token

## Step 4: Test the Script

```bash
cd ~/atc-transcriber
uv run --no-project script/airband_realtime_sync.py
```

You should see:
```
================================================================================
Airband Real-time Sync
================================================================================
Watch directory: /home/emilio/airband-recordings
R2 bucket:       radio-recordings
API endpoint:    https://your-app.com/api/ingest
...
✓ Watcher started. Press Ctrl+C to stop.
```

Let it run for a minute and verify files are uploaded. Press Ctrl+C to stop.

## Step 5: Install as Systemd Service

```bash
# Copy service file
sudo cp script/airband-sync.service.example /etc/systemd/system/airband-sync.service

# Edit if needed (update User, paths, etc.)
sudo nano /etc/systemd/system/airband-sync.service

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable airband-sync

# Start the service
sudo systemctl start airband-sync

# Check status
sudo systemctl status airband-sync
```

## Step 6: Configure Log Rotation

Systemd journal handles log rotation automatically, but you can configure limits:

```bash
# Edit journald config
sudo nano /etc/systemd/journald.conf
```

Recommended settings:
```ini
[Journal]
SystemMaxUse=500M
SystemKeepFree=1G
MaxRetentionSec=2week
```

Apply changes:
```bash
sudo systemctl restart systemd-journald
```

## Managing the Service

### View Logs (Live)
```bash
sudo journalctl -u airband-sync -f
```

### View Recent Logs
```bash
sudo journalctl -u airband-sync -n 100
```

### View Logs Since Boot
```bash
sudo journalctl -u airband-sync -b
```

### View Logs for Date Range
```bash
sudo journalctl -u airband-sync --since "2025-01-07" --until "2025-01-08"
```

### Restart Service
```bash
sudo systemctl restart airband-sync
```

### Stop Service
```bash
sudo systemctl stop airband-sync
```

### Disable Service (Stop Auto-start)
```bash
sudo systemctl disable airband-sync
```

### Check Service Status
```bash
sudo systemctl status airband-sync
```

## Troubleshooting

### Service Won't Start

Check logs:
```bash
sudo journalctl -u airband-sync -n 50
```

Common issues:
- Missing environment variables (check ~/.config/airband-sync.env)
- Wrong paths in service file (check User, WorkingDirectory, ExecStart)
- uv not in PATH (check /home/emilio/.cargo/bin/uv exists)
- R2 credentials invalid (test with uv run manually)

### Files Not Uploading

1. Check airband is writing files:
   ```bash
   ls -ltr ~/airband-recordings/**/*.mp3 | tail
   ```

2. Check service is running:
   ```bash
   sudo systemctl status airband-sync
   ```

3. Check logs for errors:
   ```bash
   sudo journalctl -u airband-sync -n 100
   ```

4. Test R2 connection manually:
   ```bash
   uv run --no-project script/airband_realtime_sync.py
   ```

### High Memory Usage

Check service resource usage:
```bash
systemctl status airband-sync
ps aux | grep airband_realtime_sync
```

The script should use minimal memory (<50MB typically).

## Monitoring

### Check Upload Success Rate

View recent uploads:
```bash
sudo journalctl -u airband-sync -n 1000 | grep "✓ Processed"
```

Check for errors:
```bash
sudo journalctl -u airband-sync -n 1000 | grep ERROR
```

### Performance Metrics

Check how long uploads take:
```bash
sudo journalctl -u airband-sync | grep "Uploading"
```

## Updating the Script

```bash
cd ~/atc-transcriber
git pull
sudo systemctl restart airband-sync
```

## Uninstalling

```bash
# Stop and disable service
sudo systemctl stop airband-sync
sudo systemctl disable airband-sync

# Remove service file
sudo rm /etc/systemd/system/airband-sync.service
sudo systemctl daemon-reload

# Remove config (optional)
rm ~/.config/airband-sync.env

# Remove repository (optional)
rm -rf ~/atc-transcriber
```

## Security Notes

The systemd service includes security hardening:
- `NoNewPrivileges=true` - Prevents privilege escalation
- `PrivateTmp=true` - Isolates /tmp directory
- `ProtectSystem=strict` - Makes most of filesystem read-only
- `ProtectHome=read-only` - Protects home directory
- `ReadWritePaths=...` - Only allows writing to recordings directory

These settings prevent the service from making unauthorized changes to your system.

## Support

For issues or questions:
1. Check logs: `sudo journalctl -u airband-sync -f`
2. Test manually: `uv run --no-project script/airband_realtime_sync.py`
3. Verify environment: Check ~/.config/airband-sync.env
4. Check GitHub issues
