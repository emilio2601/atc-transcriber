# ATC Transcriber

A system for capturing, transcribing, and labeling air traffic control (ATC) radio communications. Designed for building high-quality datasets of aviation communications.

## What It Does

**Capture** → **Transcribe** → **Correct** → **Label**

1. **Audio Ingestion**: Continuously captures radio transmissions from ATC frequencies via RTL-SDR receivers
2. **Cloud Storage**: Streams audio clips to Cloudflare R2 with structured naming (channel, frequency, timestamp)
3. **Automatic Transcription**: Processes audio through ASR (speech-to-text) with quality metrics
4. **Human Labeling**: Web interface for reviewing, correcting, and finalizing transcriptions

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  RTL-SDR    │────▶│ Cloudflare  │────▶│    Rails    │────▶│   React     │
│  Receiver   │     │     R2      │     │     API     │     │   Labeler   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │              ┌────┴────┐
                           └─────────────▶│   ASR   │
                                          │ Worker  │
                                          └─────────┘
```

**Data Flow:**
- Raspberry Pi with RTL-SDR captures radio → uploads MP3s to R2
- Rails syncs R2 bucket → creates transmission records
- ASR worker pulls pending jobs → transcribes → submits results
- Labelers review/correct via web UI → finalized transcripts

## Tech Stack

**Backend**
- Ruby on Rails 8
- PostgreSQL
- Solid Queue (background jobs)
- Cloudflare R2 (S3-compatible storage)

**Frontend**
- React 19 + TypeScript
- Vite
- Tailwind CSS

**ASR Pipeline**
- Python with faster-whisper
- Configurable models and compute backends

**Infrastructure**
- Docker + Kamal deployment
- Systemd services for capture/sync

## Key Components

| Component | Purpose |
|-----------|---------|
| `R2SyncJob` | Periodically syncs R2 bucket → database |
| `asr_worker.py` | Multi-threaded transcription worker |
| `airband_realtime_sync.py` | Real-time file watcher for Pi uploads |
| Clips Browser | Browse and filter all transmissions |
| Labeling App | Keyboard-driven interface for transcript correction |

## Supported Channels

Currently monitoring New York area ATC:
- N90 TRACON (LGA Final, approach control)
- JFK Departure
- ZNY/ZBW ARTCC (en-route)

## API

RESTful JSON API with token authentication:

- `GET /api/clips` - List transmissions with filtering
- `GET /api/clips/:id/audio` - Presigned URL for audio playback
- `PATCH /api/clips/:id` - Update transcription/status
- `POST /api/asr/next` - Fetch next transcription job
- `POST /api/asr/result` - Submit ASR results

## Status

Active development. Current focus:
- Moving from local Whisper to API-based transcription
- Adding AI correction step before human review
- Optimizing for cost and latency

## License

MIT
