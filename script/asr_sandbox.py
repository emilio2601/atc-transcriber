# /// script
# dependencies = [
#   "requests==2.32.5",
#   "faster-whisper==1.2.1",
#   "python-dotenv==1.2.1",
# ]
# ///
import os
import sys
import time
import json
from dataclasses import dataclass
from typing import Optional, Dict, Any, List

import requests
from dotenv import load_dotenv
from faster_whisper import WhisperModel

load_dotenv()

@dataclass
class Config:
    api_base: str
    api_token: str
    whisper_models: List[str]
    whisper_device: str = "cpu"
    whisper_compute: str = "int8"   # good default for fast CPU (Apple Silicon)
    whisper_language: Optional[str] = "en"
    audio_cache_dir: str = ".asr_sandbox_cache"
    timeout: int = 30

    @classmethod
    def from_env(cls) -> "Config":
        api_base = os.environ.get("ATC_API_BASE", "http://localhost:3000").rstrip("/")
        api_token = os.environ.get("ASR_WORKER_TOKEN") or os.environ.get("ATC_API_TOKEN")

        if not api_token:
            print("[sandbox] Missing ASR_WORKER_TOKEN / ATC_API_TOKEN in env", file=sys.stderr)
            sys.exit(1)

        # Allow override: WHISPER_MODELS="medium,large-v3,distil-large-v3"
        models_env = os.environ.get("WHISPER_MODELS")
        if models_env:
            whisper_models = [m.strip() for m in models_env.split(",") if m.strip()]
        else:
            # Sensible benchmarks for your M4 Max:
            whisper_models = ["medium", "large-v3", "distil-large-v3"]

        return cls(
            api_base=api_base,
            api_token=api_token,
            whisper_models=whisper_models,
            whisper_device=os.environ.get("WHISPER_DEVICE", "cpu"),
            whisper_compute=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
            whisper_language=os.environ.get("WHISPER_LANGUAGE", "en"),
            audio_cache_dir=os.environ.get("AUDIO_CACHE_DIR", ".asr_sandbox_cache"),
            timeout=int(os.environ.get("ATC_API_TIMEOUT", "30")),
        )


def http_get_json(url: str, cfg: Config) -> Dict[str, Any]:
    resp = requests.get(
        url,
        headers={"Authorization": f"Bearer {cfg.api_token}"},
        timeout=cfg.timeout,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_sample_job(cfg: Config) -> Optional[Dict[str, Any]]:
    url = f"{cfg.api_base}/api/asr/sample"
    data = http_get_json(url, cfg)

    # Support { job: {...} } or direct object
    if isinstance(data, dict) and "job" in data:
        job = data["job"]
        return job if job else None

    if isinstance(data, dict) and "id" in data and "audio_url" in data:
        return data

    print("[sandbox] Unexpected /api/asr/sample response:", data, file=sys.stderr)
    return None


def download_audio(job: Dict[str, Any], cfg: Config) -> str:
    audio_url = job["audio_url"]
    os.makedirs(cfg.audio_cache_dir, exist_ok=True)

    basename = job.get("object_key") or f"job-{job.get('id', int(time.time()))}"
    basename = basename.split("/")[-1]
    if "." not in basename:
        basename += ".bin"

    path = os.path.join(cfg.audio_cache_dir, basename)

    print(f"[sandbox] Downloading audio → {path}")
    with requests.get(audio_url, stream=True, timeout=cfg.timeout) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

    return path


def load_model(model_name: str, cfg: Config) -> WhisperModel:
    print(
        f"[sandbox] Loading model='{model_name}' "
        f"device='{cfg.whisper_device}' compute_type='{cfg.whisper_compute}'"
    )
    return WhisperModel(
        model_name,
        device=cfg.whisper_device,
        compute_type=cfg.whisper_compute,
    )


def transcribe(path: str, cfg: Config, model: WhisperModel, model_name: str) -> Dict[str, Any]:
    print(f"[sandbox:{model_name}] Transcribing {path}")
    start = time.time()

    segments_iter, info = model.transcribe(
        path,
        language=cfg.whisper_language,
        beam_size=5,
        vad_filter=True,
        word_timestamps=True,
    )

    segments: List[Dict[str, Any]] = []
    speech_duration = 0.0
    total_logprob = 0.0
    logprob_count = 0
    compression_ratios: List[float] = []
    no_speech_probs: List[float] = []

    for seg in segments_iter:
        seg_dict: Dict[str, Any] = {
            "id": seg.id,
            "start": seg.start,
            "end": seg.end,
            "text": seg.text,
        }

        dur = float(seg.end - seg.start)
        if dur > 0:
            speech_duration += dur

        if getattr(seg, "avg_logprob", None) is not None:
            val = float(seg.avg_logprob)
            total_logprob += val
            logprob_count += 1
            seg_dict["avg_logprob"] = val

        if getattr(seg, "compression_ratio", None) is not None:
            val = float(seg.compression_ratio)
            compression_ratios.append(val)
            seg_dict["compression_ratio"] = val

        if getattr(seg, "no_speech_prob", None) is not None:
            val = float(seg.no_speech_prob)
            no_speech_probs.append(val)
            seg_dict["no_speech_prob"] = val

        words_out = []
        for w in getattr(seg, "words", []) or []:
            words_out.append(
                {
                    "start": w.start,
                    "end": w.end,
                    "word": w.word,
                }
            )
        if words_out:
            seg_dict["words"] = words_out

        segments.append(seg_dict)

    elapsed = time.time() - start

    duration = getattr(info, "duration", None)
    avg_logprob = (total_logprob / logprob_count) if logprob_count else None
    avg_compression_ratio = (
        sum(compression_ratios) / len(compression_ratios)
        if compression_ratios
        else None
    )
    max_no_speech = max(no_speech_probs) if no_speech_probs else None

    text = "".join(seg["text"] for seg in segments).strip()

    # Real-time factor (X × real-time)
    if duration and elapsed > 0:
        rtf = duration / elapsed
    else:
        rtf = None

    return {
        "model": model_name,
        "text": text,
        "duration_sec": duration,
        "language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "segments": segments,
        "asr_avg_logprob": avg_logprob,
        "asr_compression_ratio": avg_compression_ratio,
        "asr_no_speech_prob": max_no_speech,
        "asr_speech_duration_sec": speech_duration,
        "asr_speech_ratio": (speech_duration / duration) if (duration and duration > 0) else None,
        "elapsed_ms": int(elapsed * 1000),
        "rtf": rtf,  # X × real-time
    }


def main():
    cfg = Config.from_env()
    print(f"[sandbox] Using API base: {cfg.api_base}")
    print(f"[sandbox] Models under test: {', '.join(cfg.whisper_models)}")

    job = fetch_sample_job(cfg)
    if not job:
        print("[sandbox] No sample job available (job=nil).", file=sys.stderr)
        sys.exit(0)

    # Print basic job info + URL so you can listen & sanity-check
    print("\n[sandbox] Got sample job metadata:")
    job_preview = {
        k: job.get(k)
        for k in ("id", "object_key", "channel_label", "freq_hz", "started_at", "sandbox", "asr_text")
        if k in job
    }
    print(json.dumps(job_preview, indent=2, default=str))
    if "audio_url" in job:
        print(f"[sandbox] Audio URL (for listening): {job['audio_url']}")

    try:
        audio_path = download_audio(job, cfg)
    except Exception as e:
        print(f"[sandbox] ERROR downloading audio: {e}", file=sys.stderr)
        sys.exit(1)

    results = []

    for model_name in cfg.whisper_models:
        try:
            model = load_model(model_name, cfg)
        except Exception as e:
            print(f"[sandbox:{model_name}] ERROR loading model: {e}", file=sys.stderr)
            continue

        try:
            res = transcribe(audio_path, cfg, model, model_name)
        except Exception as e:
            print(f"[sandbox:{model_name}] ERROR during transcription: {e}", file=sys.stderr)
            continue

        results.append(res)

        # Per-model detailed output
        print(f"\n[sandbox:{model_name}] === TRANSCRIPTION PREVIEW ===")
        # Short preview so you can eyeball quality quickly
        preview = (res["text"] or "").strip()
        if len(preview) > 500:
            preview = preview[:500] + " ..."
        print(preview if preview else "[no text]")

        # Metrics
        rtf = res["rtf"]
        rtf_str = f"{rtf:.2f}x" if rtf is not None else "n/a"
        print(f"\n[sandbox:{model_name}] === METRICS ===")
        metrics = {
            "duration_sec": res["duration_sec"],
            "elapsed_ms": res["elapsed_ms"],
            "rtf_x_real_time": rtf_str,
            "speech_duration_sec": res["asr_speech_duration_sec"],
            "speech_ratio": res["asr_speech_ratio"],
            "avg_logprob": res["asr_avg_logprob"],
            "avg_compression_ratio": res["asr_compression_ratio"],
            "no_speech_prob_max": res["asr_no_speech_prob"],
            "segment_count": len(res["segments"]),
        }
        print(json.dumps(metrics, indent=2, default=str))

    # Summary across models
    print("\n[sandbox] === SUMMARY ACROSS MODELS ===")
    if not results:
        print("[sandbox] No successful runs.")
        return

    summary = []
    for r in results:
        rtf = r["rtf"]
        summary.append(
            {
                "model": r["model"],
                "duration_sec": r["duration_sec"],
                "elapsed_ms": r["elapsed_ms"],
                "rtf_x_real_time": round(rtf, 2) if rtf is not None else None,
                "speech_ratio": r["asr_speech_ratio"],
                "avg_logprob": r["asr_avg_logprob"],
            }
        )
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
