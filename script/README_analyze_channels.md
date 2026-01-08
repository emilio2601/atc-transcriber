# Channel Quality Analysis Tool

Fast audio quality analysis using signal processing (no AI required).

## What It Does

Analyzes ATC channels using audio signal processing metrics to determine the clearest channel:

- **Signal-to-Noise Ratio (SNR)** - Primary indicator of channel quality
- **Spectral Features** - Speech-like characteristics
- **Energy Consistency** - Signal stability
- **Quality Issues** - Clipping, silence detection
- **Composite Score** - Weighted combination of all metrics

## Setup

1. **Install Python dependencies** (uses inline script dependencies with `uv`):
   ```bash
   # Dependencies are auto-installed when running with uv
   librosa==0.10.2
   numpy==1.26.4
   scipy==1.14.1
   requests==2.32.5
   python-dotenv==1.2.1
   ```

2. **Environment variables** (already in your `.env`):
   ```bash
   ATC_API_BASE=http://localhost:3000  # or production URL
   ASR_WORKER_TOKEN=<your_token>        # Already configured
   ```

## Usage

### Basic Analysis (All Channels)

```bash
# Analyze all channels (25 samples per channel, default)
python script/analyze_channel_quality.py

# Or if using uv:
uv run script/analyze_channel_quality.py
```

### Advanced Options

```bash
# More samples for higher confidence (slower)
python script/analyze_channel_quality.py --samples 50

# Analyze specific channel only
python script/analyze_channel_quality.py --channel "JFK_135.900_Dep"

# Export detailed results to JSON
python script/analyze_channel_quality.py --export-json results.json
```

## Output

```
CHANNEL QUALITY ANALYSIS REPORT
==========================================================================================

Rank | Channel                  | Score      | SNR(dB)   | Spectral  | Energy    | Issues
-----|--------------------------|------------|-----------|-----------|-----------|------------------
  1  | N90_134.900_LGA_Final   | 8.7/10     | 22.3      | 0.89      | 0.92      | 0% clip, 15% silence
  2  | JFK_135.900_Dep         | 8.2/10     | 20.1      | 0.85      | 0.88      | 2% clip, 18% silence
  3  | ZBW_135.800_Clipper     | 7.5/10     | 18.5      | 0.81      | 0.85      | 5% clip, 22% silence
  ...

RECOMMENDATION: Focus on N90_134.900_LGA_Final
  - Highest quality score: 8.7/10
  - Best SNR: 22.3 dB
  - 25 samples analyzed
```

## Performance

- **Speed**: ~2-5 minutes for 150-200 files (vs 30+ minutes for ASR)
- **Cache**: Downloads cached in `.channel_analysis_cache/`
- **Parallel**: Uses streaming downloads for efficiency
- **Data Coverage**: Fetches ~250 transmissions per channel across multiple pages for time diversity

## How It Works

### Composite Quality Score

```
score = (SNR × 0.40) + (Spectral × 0.25) + (Energy × 0.20) +
        (1-Clipping × 0.10) + (1-Silence × 0.05)
```

### Sampling Strategy

**Stratified Random Sampling** for representative results:

1. **Temporal Stratification** - Samples from different hours of the day to capture traffic pattern variations
2. **Duration Stratification** - Within each time period, samples short/medium/long transmissions
3. **Random Selection** - Adds jitter within strata to avoid systematic bias

This ensures:
- Coverage across different times (morning/afternoon/evening/night)
- Mix of transmission types (short snippets vs long conversations)
- Statistically representative of typical channel conditions

Default: 25 samples per channel (adjustable with `--samples`)

## Authentication

Uses Bearer token authentication (ASR_WORKER_TOKEN from `.env`).

The same token works for:
- ASR worker API (`/api/asr/*`)
- Public API endpoints (`/api/clips`, `/api/channels`)

Frontend still uses session-based authentication (login form).

## Troubleshooting

**"ASR_WORKER_TOKEN required"**
- Check `.env` file has `ASR_WORKER_TOKEN` set

**"No transmissions found for channel"**
- Channel has no data in database yet
- Check channel name matches exactly (case-sensitive)

**Connection errors**
- Ensure Rails server is running (`bin/dev`)
- Check `ATC_API_BASE` points to correct URL

**Audio download failures**
- R2 credentials may be expired
- Check presigned URL expiration (10 minutes default)
