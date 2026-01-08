#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "watchdog",
#   "requests",
#   "minio",
# ]
# ///
"""
Real-time airband recording uploader for Raspberry Pi.

Watches the airband recordings directory and immediately uploads new files to R2
and notifies the Rails API for transcription processing.

Usage:
    uv run script/airband_realtime_sync.py

Environment variables:
    AIRBAND_RECORDINGS_DIR   - Directory to watch (default: ~/airband-recordings)
    R2_ENDPOINT              - R2 endpoint URL (required)
    R2_BUCKET                - R2 bucket name (required)
    R2_ACCESS_KEY_ID         - R2 access key (required)
    R2_SECRET_ACCESS_KEY     - R2 secret key (required)
    R2_PREFIX                - Optional prefix path in bucket
    API_BASE_URL             - Rails API URL (required)
    ASR_WORKER_TOKEN         - Bearer token for API auth (required)
    FFPROBE_PATH             - Path to ffprobe (optional, searches PATH)

Prerequisites:
    - Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh
    - Set environment variables in ~/.bashrc or systemd service

Example:
    export AIRBAND_RECORDINGS_DIR="/home/emilio/airband-recordings"
    export R2_ENDPOINT="https://...r2.cloudflarestorage.com"
    export R2_BUCKET="radio-recordings"
    export R2_ACCESS_KEY_ID="your-key-id"
    export R2_SECRET_ACCESS_KEY="your-secret"
    export API_BASE_URL="https://your-app.com"
    export ASR_WORKER_TOKEN="your-token-here"
    uv run script/airband_realtime_sync.py
"""

import os
import sys
import time
import json
import subprocess
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import requests
from minio import Minio


class AirbandUploader(FileSystemEventHandler):
    """Handles filesystem events and uploads new recordings."""

    def __init__(self, base_dir, r2_client, r2_bucket, r2_prefix, api_base_url, api_token):
        super().__init__()
        self.base_dir = Path(base_dir).resolve()
        self.r2_client = r2_client
        self.r2_bucket = r2_bucket
        self.r2_prefix = r2_prefix
        self.api_base_url = api_base_url.rstrip("/")
        self.api_token = api_token
        self.ffprobe_path = self._find_ffprobe()

        if not self.ffprobe_path:
            print("[WARN] ffprobe not found - duration will not be included")

    def _find_ffprobe(self):
        """Find ffprobe executable."""
        # Check environment variable first
        env_path = os.getenv("FFPROBE_PATH")
        if env_path and Path(env_path).is_file():
            return env_path

        # Search PATH
        result = subprocess.run(
            ["which", "ffprobe"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return result.stdout.strip()

        return None

    def _log(self, level, message):
        """Log with timestamp."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}", flush=True)

    def on_moved(self, event):
        """Handle file move events (airband renames .tmp to .mp3)."""
        if event.is_directory:
            return

        # Only process final .mp3 files (not .tmp)
        dest_path = event.dest_path
        if not dest_path.endswith(".mp3") or dest_path.endswith(".tmp"):
            return

        self._log("INFO", f"New recording: {dest_path}")
        self._process_file(dest_path)

    def _process_file(self, file_path):
        """Process a new recording: probe, upload, notify API."""
        try:
            file_path = Path(file_path)

            # Get relative path for object_key
            try:
                relative_path = file_path.relative_to(self.base_dir)
                # Convert to POSIX path (forward slashes)
                relative_path_str = relative_path.as_posix()
                # Add prefix if configured
                if self.r2_prefix:
                    object_key = f"{self.r2_prefix}/{relative_path_str}"
                else:
                    object_key = relative_path_str
            except ValueError:
                self._log("ERROR", f"File {file_path} is not under {self.base_dir}")
                return

            # Get file size
            size_bytes = file_path.stat().st_size

            # Get duration via ffprobe
            duration_sec = None
            if self.ffprobe_path:
                duration_sec = self._probe_duration(file_path)

            # Upload to R2
            self._log("INFO", f"Uploading {object_key} ({size_bytes:,} bytes)")
            if not self._upload_to_r2(file_path, object_key):
                self._log("ERROR", f"Upload failed: {object_key}")
                return

            # Notify API
            self._log("INFO", f"Notifying API: {object_key}")
            if not self._notify_api(object_key, size_bytes, duration_sec):
                self._log("ERROR", f"API notification failed: {object_key}")
                return

            log_msg = f"✓ Processed {object_key} ({size_bytes:,} bytes"
            if duration_sec:
                log_msg += f", {duration_sec:.2f}s"
            log_msg += ")"
            self._log("INFO", log_msg)

        except Exception as e:
            self._log("ERROR", f"Failed to process {file_path}: {e}")

    def _probe_duration(self, file_path):
        """Get audio duration using ffprobe."""
        try:
            cmd = [
                self.ffprobe_path,
                "-v", "error",
                "-print_format", "json",
                "-show_format",
                str(file_path)
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode != 0:
                self._log("WARN", f"ffprobe failed for {file_path}")
                return None

            data = json.loads(result.stdout)
            duration = data.get("format", {}).get("duration")

            if duration:
                return float(duration)

        except Exception as e:
            self._log("WARN", f"ffprobe error for {file_path}: {e}")

        return None

    def _upload_to_r2(self, file_path, object_key):
        """Upload file to R2 using minio."""
        try:
            self.r2_client.fput_object(
                self.r2_bucket,
                object_key,
                str(file_path),
                content_type="audio/mpeg"
            )

            return True

        except Exception as e:
            self._log("ERROR", f"Upload exception for {object_key}: {e}")
            return False

    def _notify_api(self, object_key, size_bytes, duration_sec):
        """Notify Rails API of new recording."""
        try:
            url = f"{self.api_base_url}/api/ingest"
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }
            payload = {
                "object_key": object_key,
                "size_bytes": size_bytes
            }

            if duration_sec is not None:
                payload["duration_sec"] = duration_sec

            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=30
            )

            if response.status_code in (200, 201):
                data = response.json()
                if data.get("created"):
                    self._log("INFO", f"Created transmission ID {data.get('id')}")
                else:
                    self._log("INFO", f"Already exists (ID {data.get('id')})")
                return True
            else:
                self._log("ERROR", f"API error {response.status_code}: {response.text}")
                return False

        except requests.Timeout:
            self._log("ERROR", f"API timeout for {object_key}")
            return False
        except Exception as e:
            self._log("ERROR", f"API exception for {object_key}: {e}")
            return False


def main():
    # Load configuration from environment
    base_dir = os.getenv("AIRBAND_RECORDINGS_DIR", os.path.expanduser("~/airband-recordings"))
    r2_endpoint = os.getenv("R2_ENDPOINT")
    r2_bucket = os.getenv("R2_BUCKET")
    r2_access_key = os.getenv("R2_ACCESS_KEY_ID")
    r2_secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    r2_prefix = os.getenv("R2_PREFIX", "")
    api_base_url = os.getenv("API_BASE_URL")
    api_token = os.getenv("ASR_WORKER_TOKEN")

    # Validate required config
    if not r2_endpoint:
        print("ERROR: R2_ENDPOINT environment variable is required")
        sys.exit(1)

    if not r2_bucket:
        print("ERROR: R2_BUCKET environment variable is required")
        sys.exit(1)

    if not r2_access_key:
        print("ERROR: R2_ACCESS_KEY_ID environment variable is required")
        sys.exit(1)

    if not r2_secret_key:
        print("ERROR: R2_SECRET_ACCESS_KEY environment variable is required")
        sys.exit(1)

    if not api_base_url:
        print("ERROR: API_BASE_URL environment variable is required")
        sys.exit(1)

    if not api_token:
        print("ERROR: ASR_WORKER_TOKEN environment variable is required")
        sys.exit(1)

    base_dir = Path(base_dir).resolve()
    if not base_dir.is_dir():
        print(f"ERROR: Directory does not exist: {base_dir}")
        sys.exit(1)

    # Parse R2 endpoint to get host
    parsed = urlparse(r2_endpoint)
    r2_host = parsed.netloc if parsed.netloc else parsed.path
    r2_secure = parsed.scheme == "https"

    # Create R2/S3 client
    try:
        r2_client = Minio(
            r2_host,
            access_key=r2_access_key,
            secret_key=r2_secret_key,
            secure=r2_secure
        )
        # Test connection by checking if bucket exists
        if not r2_client.bucket_exists(r2_bucket):
            print(f"ERROR: Bucket '{r2_bucket}' does not exist or is not accessible")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: Failed to connect to R2: {e}")
        sys.exit(1)

    # Start watcher
    print("=" * 80)
    print("Airband Real-time Sync")
    print("=" * 80)
    print(f"Watch directory: {base_dir}")
    print(f"R2 bucket:       {r2_bucket}")
    if r2_prefix:
        print(f"R2 prefix:       {r2_prefix}")
    print(f"API endpoint:    {api_base_url}/api/ingest")
    print(f"Time:            {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()

    event_handler = AirbandUploader(base_dir, r2_client, r2_bucket, r2_prefix, api_base_url, api_token)
    observer = Observer()
    observer.schedule(event_handler, str(base_dir), recursive=True)
    observer.start()

    print("✓ Watcher started. Press Ctrl+C to stop.")
    print()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n")
        print("=" * 80)
        print("Stopping watcher...")
        observer.stop()

    observer.join()
    print("✓ Stopped.")


if __name__ == "__main__":
    main()
