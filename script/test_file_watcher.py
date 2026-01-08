#!/usr/bin/env python3
"""
Test script to monitor filesystem events and understand airband file writing patterns.

Usage:
    python script/test_file_watcher.py /path/to/airband-recordings

This will print all filesystem events to help determine:
- Which event signals file completion (created, modified, closed)
- Whether files are written atomically or incrementally
- If we need stabilization delays
"""

import sys
import time
import os
from datetime import datetime
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class VerboseEventHandler(FileSystemEventHandler):
    """Prints all filesystem events with timestamps and file info."""

    def __init__(self):
        super().__init__()
        self.file_sizes = {}  # Track file sizes to detect size changes

    def _log_event(self, event_type, path, extra_info=""):
        """Log an event with timestamp and file details."""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]

        # Get file info if it exists
        file_info = ""
        if os.path.exists(path):
            try:
                stat = os.stat(path)
                size = stat.st_size
                file_info = f"size={size:,} bytes"

                # Track size changes
                if path in self.file_sizes:
                    old_size = self.file_sizes[path]
                    if old_size != size:
                        file_info += f" (was {old_size:,}, +{size - old_size:,})"

                self.file_sizes[path] = size
            except (OSError, FileNotFoundError):
                file_info = "file disappeared"
        else:
            file_info = "does not exist"
            if path in self.file_sizes:
                del self.file_sizes[path]

        # Format path relative to cwd for readability
        try:
            rel_path = Path(path).relative_to(Path.cwd())
        except ValueError:
            rel_path = path

        print(f"[{timestamp}] {event_type:20s} {rel_path}  ({file_info}){extra_info}")

    def on_created(self, event):
        if not event.is_directory:
            self._log_event("CREATED", event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._log_event("MODIFIED", event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            self._log_event("DELETED", event.src_path)

    def on_moved(self, event):
        if not event.is_directory:
            self._log_event("MOVED", event.dest_path, f" (from {event.src_path})")

    def on_closed(self, event):
        """Linux-specific: fired when file is closed after writing."""
        if not event.is_directory:
            self._log_event("CLOSED", event.src_path, " ← FILE COMPLETE!")


def main():
    if len(sys.argv) < 2:
        print("Usage: python script/test_file_watcher.py <directory_to_watch>")
        print("\nExample:")
        print("  python script/test_file_watcher.py ~/airband-recordings")
        sys.exit(1)

    watch_path = sys.argv[1]

    if not os.path.isdir(watch_path):
        print(f"Error: Directory does not exist: {watch_path}")
        sys.exit(1)

    print(f"Starting filesystem watcher on: {watch_path}")
    print(f"Watching for: *.mp3 files (and all other events)")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 100)
    print()

    event_handler = VerboseEventHandler()
    observer = Observer()
    observer.schedule(event_handler, watch_path, recursive=True)
    observer.start()

    print("✓ Watcher started. Press Ctrl+C to stop.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n" + "=" * 100)
        print("Stopping watcher...")
        observer.stop()

    observer.join()
    print("✓ Stopped.")


if __name__ == "__main__":
    main()
