#!/usr/bin/env python3
# /// script
# dependencies = [
#   "requests==2.32.5",
#   "librosa==0.10.2",
#   "numpy==1.26.4",
#   "scipy==1.14.1",
#   "python-dotenv==1.2.1",
# ]
# ///
"""
Analyze ATC channel quality using audio signal processing (no AI required).

This script samples transmissions from each channel, downloads audio files,
and analyzes them using signal processing metrics to determine the clearest channel.

Quality metrics:
- Signal-to-Noise Ratio (SNR) - Primary metric (80% of score)
- Spectral characteristics - Secondary metric (20% of score)
- Energy consistency, clipping, silence - Measured but not scored (don't discriminate)

Usage:
    python script/analyze_channel_quality.py

Environment variables required:
    ATC_API_BASE - Rails API URL (default: http://localhost:3000)
    ASR_WORKER_TOKEN - API bearer token for authentication
"""

import os
import sys
import json
import argparse
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import statistics

import requests
import librosa
import numpy as np
from scipy import stats as scipy_stats
from dotenv import load_dotenv


load_dotenv()


@dataclass
class AudioQualityMetrics:
    """Metrics for a single audio file."""
    transmission_id: int
    channel_label: str
    duration_sec: float

    # SNR and energy
    snr_db: Optional[float]
    rms_energy: float
    energy_variance: float
    dynamic_range_db: float

    # Spectral features
    spectral_centroid_hz: float
    spectral_rolloff_hz: float
    spectral_flatness: float
    zero_crossing_rate: float

    # Quality issues
    clipping_ratio: float
    silence_ratio: float

    # Composite score
    quality_score: float


@dataclass
class ChannelQualityReport:
    """Aggregate quality report for a channel."""
    channel_label: str
    sample_count: int

    # Average metrics
    avg_snr_db: float
    avg_spectral_score: float
    avg_energy_consistency: float
    avg_clipping_ratio: float
    avg_silence_ratio: float

    # Composite score
    quality_score: float

    # Raw samples for detailed analysis
    samples: List[AudioQualityMetrics]


class Config:
    """Configuration from environment."""
    def __init__(self):
        self.api_base = os.environ.get("ATC_API_BASE", "http://localhost:3000").rstrip("/")
        self.api_token = os.environ.get("ASR_WORKER_TOKEN")
        self.cache_dir = Path(".channel_analysis_cache")
        self.samples_per_channel = int(os.environ.get("SAMPLES_PER_CHANNEL", "25"))
        self.timeout = 30

        if not self.api_token:
            print("Error: ASR_WORKER_TOKEN required", file=sys.stderr)
            sys.exit(1)


class APIClient:
    """Client for Rails API."""
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {cfg.api_token}",
            "Content-Type": "application/json"
        })
        print(f"[api] Using token authentication")

    def get_channels(self) -> List[str]:
        """Get list of available channels."""
        resp = self.session.get(
            f"{self.cfg.api_base}/api/channels",
            timeout=self.cfg.timeout
        )
        resp.raise_for_status()
        return resp.json()["channels"]

    def get_transmissions(self, channel: str, limit: int = 1000) -> List[Dict]:
        """
        Get transmissions for a channel using multiple paginated requests
        to ensure representative sampling across time.
        """
        all_transmissions = []
        pages_to_fetch = 5  # Fetch 5 pages to get diverse time coverage
        per_page = max(50, limit // pages_to_fetch)

        for page in range(1, pages_to_fetch + 1):
            try:
                resp = self.session.get(
                    f"{self.cfg.api_base}/api/clips",
                    params={
                        "channel": channel,
                        "status": "all",  # Get any status to maximize sample pool
                        "per": per_page,
                        "page": page
                    },
                    timeout=self.cfg.timeout
                )
                resp.raise_for_status()
                items = resp.json()["items"]

                if not items:
                    break

                all_transmissions.extend(items)

                # Check if we've reached the end
                meta = resp.json().get("meta", {})
                if page >= meta.get("pages", 0):
                    break

            except Exception as e:
                print(f"[api] Warning: Error fetching page {page}: {e}", file=sys.stderr)
                break

        return all_transmissions

    def get_audio_url(self, transmission_id: int) -> str:
        """Get presigned URL for audio file."""
        resp = self.session.get(
            f"{self.cfg.api_base}/api/clips/{transmission_id}/audio",
            timeout=self.cfg.timeout
        )
        resp.raise_for_status()
        return resp.json()["audio_url"]

    def download_audio(self, transmission_id: int, url: str, dest: Path) -> bool:
        """Download audio file from presigned URL."""
        try:
            resp = requests.get(url, stream=True, timeout=self.cfg.timeout)
            resp.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            return True
        except Exception as e:
            print(f"[download] Error downloading transmission {transmission_id}: {e}", file=sys.stderr)
            return False


def calculate_snr(audio: np.ndarray, sr: int, frame_length: int = 2048) -> Optional[float]:
    """
    Calculate Signal-to-Noise Ratio using spectral analysis.

    Approach: Use the lower 10th percentile of energy frames as noise floor,
    and upper 90th percentile as signal. This works well for radio transmissions
    which have periodic silence/static and periodic speech.
    """
    # Calculate frame-wise RMS energy
    rms = librosa.feature.rms(y=audio, frame_length=frame_length, hop_length=frame_length//4)[0]

    if len(rms) < 10:
        return None

    # Use percentiles to estimate signal vs noise
    noise_level = np.percentile(rms, 10)
    signal_level = np.percentile(rms, 90)

    if noise_level <= 0 or signal_level <= 0:
        return None

    snr = 20 * np.log10(signal_level / noise_level)
    return float(snr)


def calculate_spectral_features(audio: np.ndarray, sr: int) -> Dict[str, float]:
    """Calculate spectral characteristics."""
    # Spectral centroid - "center of mass" of spectrum
    centroid = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]

    # Spectral rolloff - frequency below which 85% of energy is contained
    rolloff = librosa.feature.spectral_rolloff(y=audio, sr=sr, roll_percent=0.85)[0]

    # Spectral flatness - how noise-like vs tone-like (0=pure tone, 1=white noise)
    flatness = librosa.feature.spectral_flatness(y=audio)[0]

    # Zero crossing rate - rate at which signal changes sign
    zcr = librosa.feature.zero_crossing_rate(audio)[0]

    return {
        "spectral_centroid_hz": float(np.mean(centroid)),
        "spectral_rolloff_hz": float(np.mean(rolloff)),
        "spectral_flatness": float(np.mean(flatness)),
        "zero_crossing_rate": float(np.mean(zcr))
    }


def detect_clipping(audio: np.ndarray, threshold: float = 0.99) -> float:
    """Detect proportion of samples that are clipped (near maximum amplitude)."""
    clipped_samples = np.sum(np.abs(audio) > threshold)
    return float(clipped_samples / len(audio))


def calculate_silence_ratio(audio: np.ndarray, sr: int, threshold_db: float = -40) -> float:
    """Calculate proportion of audio that is silence/noise."""
    # Convert to dB
    db = librosa.amplitude_to_db(np.abs(audio), ref=np.max)
    silent_samples = np.sum(db < threshold_db)
    return float(silent_samples / len(audio))


def calculate_spectral_score(spectral_features: Dict[str, float]) -> float:
    """
    Score spectral features for speech-likeness (0-1 scale).

    Good speech typically has:
    - Spectral centroid: 1000-3000 Hz
    - Low spectral flatness: < 0.3
    - Moderate zero crossing rate
    """
    centroid = spectral_features["spectral_centroid_hz"]
    flatness = spectral_features["spectral_flatness"]

    # Score centroid (ideal range 1000-3000 Hz)
    if 1000 <= centroid <= 3000:
        centroid_score = 1.0
    elif centroid < 1000:
        centroid_score = max(0, centroid / 1000)
    else:
        centroid_score = max(0, 1.0 - (centroid - 3000) / 3000)

    # Score flatness (lower is better, speech typically < 0.3)
    flatness_score = max(0, 1.0 - (flatness / 0.5))

    return (centroid_score * 0.6 + flatness_score * 0.4)


def analyze_audio_file(file_path: Path, transmission_id: int, channel_label: str) -> Optional[AudioQualityMetrics]:
    """Analyze a single audio file and return quality metrics."""
    try:
        # Load audio
        audio, sr = librosa.load(file_path, sr=None, mono=True)
        duration = len(audio) / sr

        # SNR
        snr = calculate_snr(audio, sr)

        # Energy metrics
        rms_energy = float(np.sqrt(np.mean(audio**2)))

        # Calculate energy variance (consistency)
        frame_length = 2048
        rms_frames = librosa.feature.rms(y=audio, frame_length=frame_length)[0]
        energy_variance = float(np.var(rms_frames))

        # Dynamic range
        db = librosa.amplitude_to_db(np.abs(audio), ref=np.max)
        dynamic_range = float(np.max(db) - np.percentile(db, 10))

        # Spectral features
        spectral = calculate_spectral_features(audio, sr)

        # Quality issues
        clipping = detect_clipping(audio)
        silence = calculate_silence_ratio(audio, sr)

        # Calculate composite score
        # SNR is the primary quality indicator - normalize to 0-1 scale
        # Typical ATC: 10-30 dB range. Use 10-35 dB mapping for better spread.
        snr_norm = min(1.0, max(0.0, (snr - 10) / 25)) if snr is not None else 0.3  # Map 10-35 dB to 0-1
        spectral_score = calculate_spectral_score(spectral)

        # Energy consistency: prefer moderate variance (too low = dead air, too high = fading)
        energy_consistency = 1.0 / (1.0 + energy_variance * 10)

        # Simplified quality score: SNR dominates (80%), spectral is secondary (20%)
        # Silence, clipping, and energy are all normal/identical across good ATC equipment
        quality_score = (
            snr_norm * 0.80 +
            spectral_score * 0.20
        )

        return AudioQualityMetrics(
            transmission_id=transmission_id,
            channel_label=channel_label,
            duration_sec=duration,
            snr_db=snr,
            rms_energy=rms_energy,
            energy_variance=energy_variance,
            dynamic_range_db=dynamic_range,
            spectral_centroid_hz=spectral["spectral_centroid_hz"],
            spectral_rolloff_hz=spectral["spectral_rolloff_hz"],
            spectral_flatness=spectral["spectral_flatness"],
            zero_crossing_rate=spectral["zero_crossing_rate"],
            clipping_ratio=clipping,
            silence_ratio=silence,
            quality_score=quality_score
        )

    except Exception as e:
        print(f"[analyze] Error analyzing {file_path}: {e}", file=sys.stderr)
        return None


def sample_transmissions(transmissions: List[Dict], n: int) -> List[Dict]:
    """
    Sample N transmissions using stratified random sampling for representativeness.

    Strategy:
    1. Stratify by time (different hours to capture traffic patterns)
    2. Within each time stratum, stratify by duration
    3. Randomly sample from each stratum

    This ensures we get:
    - Transmissions from different times (avoiding temporal bias)
    - Mix of short/medium/long transmissions (duration diversity)
    - True randomness within constraints (not just first/last/evenly-spaced)
    """
    if len(transmissions) <= n:
        return transmissions

    # Parse timestamps and add metadata
    from datetime import datetime
    for tx in transmissions:
        try:
            dt = datetime.fromisoformat(tx["started_at"].replace("Z", "+00:00"))
            tx["_hour"] = dt.hour
            tx["_date"] = dt.date()
        except:
            tx["_hour"] = 0
            tx["_date"] = None

    # Group by hour of day (0-23)
    hour_buckets = {}
    for tx in transmissions:
        hour = tx.get("_hour", 0)
        if hour not in hour_buckets:
            hour_buckets[hour] = []
        hour_buckets[hour].append(tx)

    # Determine how many samples per hour bucket
    num_hours = len(hour_buckets)
    samples_per_hour = max(1, n // num_hours)
    remaining = n - (samples_per_hour * num_hours)

    selected = []

    # Sample from each hour bucket
    for hour in sorted(hour_buckets.keys()):
        bucket = hour_buckets[hour]

        # How many to take from this bucket
        take = samples_per_hour
        if remaining > 0:
            take += 1
            remaining -= 1

        # Stratify by duration within this hour
        if len(bucket) <= take:
            selected.extend(bucket)
        else:
            # Sort by duration (handle None values)
            sorted_bucket = sorted(bucket, key=lambda x: x.get("duration_sec") or 0)

            # Sample evenly across duration range with some randomness
            # Use linspace for stratification but add small random offset
            base_indices = np.linspace(0, len(sorted_bucket) - 1, take)

            # Add random jitter within stratum (±10% of stratum width)
            stratum_width = len(sorted_bucket) / take
            jitter_range = stratum_width * 0.1

            indices = []
            for idx in base_indices:
                jittered = idx + np.random.uniform(-jitter_range, jitter_range)
                jittered = int(np.clip(jittered, 0, len(sorted_bucket) - 1))
                indices.append(jittered)

            # Remove duplicates, sort, and select
            indices = sorted(set(indices))[:take]
            selected.extend([sorted_bucket[i] for i in indices])

    # Trim to exactly n samples if we went over
    if len(selected) > n:
        selected = selected[:n]

    return selected


def analyze_channel(api: APIClient, cfg: Config, channel: str) -> Optional[ChannelQualityReport]:
    """Analyze all samples for a channel."""
    print(f"\n[analyze] Analyzing channel: {channel}")

    # Get transmissions (fetches multiple pages for time diversity)
    print(f"[analyze] Fetching transmissions from API...")
    transmissions = api.get_transmissions(channel)

    if not transmissions:
        print(f"[analyze] No transmissions found for {channel}")
        return None

    print(f"[analyze] Fetched {len(transmissions)} total transmissions")

    # Sample using stratified random sampling (time + duration)
    samples = sample_transmissions(transmissions, cfg.samples_per_channel)
    print(f"[analyze] Selected {len(samples)} samples (stratified by time and duration)")

    # Download and analyze
    metrics: List[AudioQualityMetrics] = []

    for i, tx in enumerate(samples, 1):
        tx_id = tx["id"]
        print(f"[analyze] Processing {i}/{len(samples)}: transmission {tx_id}...", end=" ")

        # Download audio
        cache_file = cfg.cache_dir / f"{tx_id}.mp3"
        if not cache_file.exists():
            try:
                audio_url = api.get_audio_url(tx_id)
                cfg.cache_dir.mkdir(exist_ok=True)
                if not api.download_audio(tx_id, audio_url, cache_file):
                    print("FAILED (download)")
                    continue
            except Exception as e:
                print(f"FAILED ({e})")
                continue

        # Analyze
        result = analyze_audio_file(cache_file, tx_id, channel)
        if result:
            metrics.append(result)
            print(f"OK (score: {result.quality_score:.2f})")
        else:
            print("FAILED (analysis)")

    if not metrics:
        print(f"[analyze] No successful analyses for {channel}")
        return None

    # Aggregate metrics
    avg_snr = statistics.mean(m.snr_db for m in metrics if m.snr_db is not None)
    avg_spectral = statistics.mean(
        calculate_spectral_score({
            "spectral_centroid_hz": m.spectral_centroid_hz,
            "spectral_rolloff_hz": m.spectral_rolloff_hz,
            "spectral_flatness": m.spectral_flatness,
            "zero_crossing_rate": m.zero_crossing_rate
        })
        for m in metrics
    )
    avg_energy_consistency = statistics.mean(
        1.0 / (1.0 + m.energy_variance * 10) for m in metrics
    )
    avg_clipping = statistics.mean(m.clipping_ratio for m in metrics)
    avg_silence = statistics.mean(m.silence_ratio for m in metrics)

    # Composite quality score
    quality_score = statistics.mean(m.quality_score for m in metrics)

    return ChannelQualityReport(
        channel_label=channel,
        sample_count=len(metrics),
        avg_snr_db=avg_snr,
        avg_spectral_score=avg_spectral,
        avg_energy_consistency=avg_energy_consistency,
        avg_clipping_ratio=avg_clipping,
        avg_silence_ratio=avg_silence,
        quality_score=quality_score,
        samples=metrics
    )


def print_report(reports: List[ChannelQualityReport]):
    """Print comparison report."""
    # Sort by quality score
    sorted_reports = sorted(reports, key=lambda r: r.quality_score, reverse=True)

    print("\n" + "="*90)
    print("CHANNEL QUALITY ANALYSIS REPORT")
    print("="*90)
    print()
    print("Scoring: SNR (80%) + Spectral (20%)")
    print("Note: Silence/clipping/energy shown for reference but don't affect score")
    print()

    # Summary table
    print(f"{'Rank':<6} {'Channel':<25} {'Score':<10} {'SNR(dB)':<10} {'Spectral':<10} {'Silence':<10}")
    print("-" * 90)

    for i, report in enumerate(sorted_reports, 1):
        print(
            f"{i:<6} "
            f"{report.channel_label:<25} "
            f"{report.quality_score:.2f}/1.0  "
            f"{report.avg_snr_db:>6.1f}    "
            f"{report.avg_spectral_score:>6.2f}    "
            f"{report.avg_silence_ratio*100:>6.0f}%"
        )

    print()
    print("="*90)
    print(f"RECOMMENDATION: Focus on {sorted_reports[0].channel_label}")
    print(f"  - Highest quality score: {sorted_reports[0].quality_score:.2f}/1.0")
    print(f"  - Best SNR: {sorted_reports[0].avg_snr_db:.1f} dB")
    print(f"  - {sorted_reports[0].sample_count} samples analyzed")
    print("="*90)
    print()

    # Detailed metrics
    print("\nDETAILED METRICS PER CHANNEL:")
    print("-" * 90)
    for report in sorted_reports:
        print(f"\n{report.channel_label}:")
        print(f"  Quality Score:      {report.quality_score:.3f}/1.0")
        print(f"  SNR:                {report.avg_snr_db:.1f} dB")
        print(f"  Spectral Score:     {report.avg_spectral_score:.3f}/1.0")
        print(f"  Energy Consistency: {report.avg_energy_consistency:.3f}/1.0")
        print(f"  Clipping Rate:      {report.avg_clipping_ratio*100:.2f}%")
        print(f"  Silence Ratio:      {report.avg_silence_ratio*100:.1f}%")
        print(f"  Samples Analyzed:   {report.sample_count}")


def main():
    parser = argparse.ArgumentParser(description="Analyze ATC channel quality")
    parser.add_argument("--samples", type=int, help="Samples per channel (default: 25)")
    parser.add_argument("--channel", type=str, help="Analyze specific channel only")
    parser.add_argument("--export-json", type=str, help="Export detailed results to JSON file")
    args = parser.parse_args()

    cfg = Config()
    if args.samples:
        cfg.samples_per_channel = args.samples

    print("="*90)
    print("ATC CHANNEL QUALITY ANALYZER")
    print("="*90)
    print(f"API Base:           {cfg.api_base}")
    print(f"Samples per channel: {cfg.samples_per_channel}")
    print(f"Cache directory:    {cfg.cache_dir}")
    print()

    # Initialize API client
    api = APIClient(cfg)

    # Get channels
    if args.channel:
        channels = [args.channel]
    else:
        channels = api.get_channels()

    print(f"Channels to analyze: {', '.join(channels)}")

    # Analyze each channel
    reports: List[ChannelQualityReport] = []

    for channel in channels:
        report = analyze_channel(api, cfg, channel)
        if report:
            reports.append(report)

    if not reports:
        print("\nNo channels successfully analyzed", file=sys.stderr)
        sys.exit(1)

    # Print report
    print_report(reports)

    # Export JSON if requested
    if args.export_json:
        output = {
            "summary": [
                {
                    "channel": r.channel_label,
                    "quality_score": r.quality_score,
                    "avg_snr_db": r.avg_snr_db,
                    "sample_count": r.sample_count
                }
                for r in reports
            ],
            "detailed": [
                {
                    "channel": r.channel_label,
                    **asdict(r)
                }
                for r in reports
            ]
        }

        with open(args.export_json, "w") as f:
            json.dump(output, f, indent=2, default=str)

        print(f"\nDetailed results exported to: {args.export_json}")


if __name__ == "__main__":
    main()
