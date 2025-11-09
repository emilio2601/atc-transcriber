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
import queue
import signal
import threading
from dataclasses import dataclass
from typing import Optional, Dict, Any, List

import requests
from dotenv import load_dotenv
from faster_whisper import WhisperModel

load_dotenv()

SHUTDOWN = False


@dataclass
class Config:
    api_base: str
    api_token: str

    # Concurrency / queue
    worker_concurrency: int = 2
    max_queue_size: int = 8
    poll_idle_seconds: float = 5.0

    # ASR / model
    whisper_model: str = "large-v3"
    whisper_device: str = "cpu"
    whisper_compute: str = "int8"
    whisper_language: Optional[str] = "en"
    cpu_threads: Optional[int] = None  # let faster-whisper decide, or override

    # I/O
    audio_cache_dir: str = ".asr_cache"
    http_timeout: int = 30

    @classmethod
    def from_env(cls) -> "Config":
        api_base = os.environ.get("ATC_API_BASE", "http://localhost:3000").rstrip("/")
        api_token = os.environ.get("ASR_WORKER_TOKEN") or os.environ.get("ATC_API_TOKEN")

        if not api_token:
            print("[worker] Missing ASR_WORKER_TOKEN / ATC_API_TOKEN in env", file=sys.stderr)
            sys.exit(1)

        wc = int(os.environ.get("WORKER_CONCURRENCY", "2"))
        mqs = int(os.environ.get("MAX_QUEUE_SIZE", "8"))
        idle = float(os.environ.get("POLL_IDLE_SECONDS", "5.0"))

        model = os.environ.get("WHISPER_MODEL", "large-v3")
        device = os.environ.get("WHISPER_DEVICE", "cpu")
        compute = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
        lang = os.environ.get("WHISPER_LANGUAGE", "en")
        cpu_threads = os.environ.get("WHISPER_CPU_THREADS")
        cpu_threads_val = int(cpu_threads) if cpu_threads else None

        cache_dir = os.environ.get("AUDIO_CACHE_DIR", ".asr_cache")
        timeout = int(os.environ.get("ATC_API_TIMEOUT", "30"))

        return cls(
            api_base=api_base,
            api_token=api_token,
            worker_concurrency=wc,
            max_queue_size=mqs,
            poll_idle_seconds=idle,
            whisper_model=model,
            whisper_device=device,
            whisper_compute=compute,
            whisper_language=lang,
            cpu_threads=cpu_threads_val,
            audio_cache_dir=cache_dir,
            http_timeout=timeout,
        )


def http_post_json(url: str, cfg: Config, payload: Dict[str, Any]) -> requests.Response:
    resp = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {cfg.api_token}",
            "Content-Type": "application/json",
        },
        data=json.dumps(payload),
        timeout=cfg.http_timeout,
    )
    return resp


def http_post_json_ok(url: str, cfg: Config, payload: Dict[str, Any]) -> bool:
    try:
        resp = http_post_json(url, cfg, payload)
        if resp.status_code != 200:
            print(f"[worker] POST {url} failed: {resp.status_code} {resp.text}", file=sys.stderr)
            return False
        return True
    except Exception as e:
        print(f"[worker] Error POST {url}: {e}", file=sys.stderr)
        return False


def http_post_next_job(cfg: Config) -> Optional[Dict[str, Any]]:
    url = f"{cfg.api_base}/api/asr/next"
    try:
        resp = http_post_json(url, cfg, {})
        if resp.status_code != 200:
            print(f"[worker] /api/asr/next error: {resp.status_code} {resp.text}", file=sys.stderr)
            return None
        data = resp.json()
    except Exception as e:
        print(f"[worker] Error calling /api/asr/next: {e}", file=sys.stderr)
        return None

    job = data.get("job") if isinstance(data, dict) else None
    # Our controller returns bare object, not under job
    if job is None and isinstance(data, dict) and "id" in data and "audio_url" in data:
        job = data

    return job


def download_audio(job: Dict[str, Any], cfg: Config) -> Optional[str]:
    audio_url = job.get("audio_url")
    if not audio_url:
        print(f"[worker] Job {job.get('id')} missing audio_url", file=sys.stderr)
        return None

    os.makedirs(cfg.audio_cache_dir, exist_ok=True)

    object_key = job.get("object_key") or f"job-{job.get('id', int(time.time()))}"
    basename = object_key.split("/")[-1]
    if "." not in basename:
        basename += ".bin"

    path = os.path.join(cfg.audio_cache_dir, basename)

    try:
        with requests.get(audio_url, stream=True, timeout=cfg.http_timeout) as r:
            r.raise_for_status()
            with open(path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
    except Exception as e:
        print(f"[worker] Error downloading audio for job {job.get('id')}: {e}", file=sys.stderr)
        return None

    return path


def build_model(cfg: Config) -> WhisperModel:
    print(
        f"[worker] Loading model='{cfg.whisper_model}' "
        f"device='{cfg.whisper_device}' compute_type='{cfg.whisper_compute}' "
        f"cpu_threads={cfg.cpu_threads or 'auto'}"
    )
    kwargs = {
        "device": cfg.whisper_device,
        "compute_type": cfg.whisper_compute,
    }
    if cfg.cpu_threads:
        kwargs["cpu_threads"] = cfg.cpu_threads

    return WhisperModel(cfg.whisper_model, **kwargs)


def transcribe(path: str, cfg: Config, model: WhisperModel) -> Dict[str, Any]:
    start = time.time()
    segments_iter, info = model.transcribe(
        path,
        language=cfg.whisper_language,
        beam_size=5,
        vad_filter=True,
        word_timestamps=False,  # prod: off unless you really need words
    )

    segments: List[Any] = []
    speech_duration = 0.0
    total_logprob = 0.0
    logprob_count = 0
    compression_ratios: List[float] = []
    no_speech_probs: List[float] = []

    for seg in segments_iter:
        segments.append(seg)
        dur = float(seg.end - seg.start)
        if dur > 0:
            speech_duration += dur

        if getattr(seg, "avg_logprob", None) is not None:
            v = float(seg.avg_logprob)
            total_logprob += v
            logprob_count += 1

        if getattr(seg, "compression_ratio", None) is not None:
            compression_ratios.append(float(seg.compression_ratio))

        if getattr(seg, "no_speech_prob", None) is not None:
            no_speech_probs.append(float(seg.no_speech_prob))

    elapsed = time.time() - start
    duration = getattr(info, "duration", None)

    # Stitch text
    text = "".join(seg.text for seg in segments).strip()

    avg_logprob = (total_logprob / logprob_count) if logprob_count else None
    avg_compression_ratio = (
        sum(compression_ratios) / len(compression_ratios)
        if compression_ratios
        else None
    )
    max_no_speech = max(no_speech_probs) if no_speech_probs else None

    speech_ratio = (speech_duration / duration) if (duration and duration > 0) else None

    # Real-time factor (for logs only)
    rtf = (duration / elapsed) if (duration and elapsed > 0) else None

    return {
        "text": text,
        "duration_sec": duration,
        "asr_avg_logprob": avg_logprob,
        "asr_compression_ratio": avg_compression_ratio,
        "asr_no_speech_prob": max_no_speech,
        "asr_speech_ratio": speech_ratio,
        "elapsed_ms": int(elapsed * 1000),
        "rtf": rtf,
    }


def submit_success(job_id: int, cfg: Config, model_name: str, metrics: Dict[str, Any]) -> None:
    payload = {
        "id": job_id,
        "asr_text": metrics["text"],
        "asr_model": model_name,
        "asr_avg_logprob": metrics["asr_avg_logprob"],
        "asr_compression_ratio": metrics["asr_compression_ratio"],
        "asr_no_speech_prob": metrics["asr_no_speech_prob"],
        "asr_speech_ratio": metrics["asr_speech_ratio"],
        # status omitted → defaults to "asr_done" in controller
    }
    ok = http_post_json_ok(f"{cfg.api_base}/api/asr/result", cfg, payload)
    if not ok:
        print(f"[worker] Failed to submit result for job {job_id}", file=sys.stderr)


def submit_failure(job_id: int, cfg: Config, error_msg: str) -> None:
    payload = {
        "id": job_id,
        "status": "asr_failed",
        "error": error_msg[:500],  # trim so it doesn't explode the DB
    }
    ok = http_post_json_ok(f"{cfg.api_base}/api/asr/result", cfg, payload)
    if not ok:
        print(f"[worker] Failed to submit failure for job {job_id}", file=sys.stderr)


def downloader_loop(cfg: Config, q: "queue.Queue[Dict[str, Any]]"):
    global SHUTDOWN
    print("[worker] Downloader loop started")

    while not SHUTDOWN:
        try:
            # Backpressure: don't overfill queue
            if q.qsize() >= cfg.max_queue_size:
                time.sleep(0.2)
                continue

            job = http_post_next_job(cfg)
            if not job:
                # No jobs available, chill a bit
                time.sleep(cfg.poll_idle_seconds)
                continue

            job_id = job.get("id")
            path = download_audio(job, cfg)
            if not path:
                if job_id is not None:
                    submit_failure(job_id, cfg, "download_failed")
                continue

            # Enqueue for transcription
            record = {
                "id": job_id,
                "path": path,
                "meta": {
                    "channel_label": job.get("channel_label"),
                    "freq_hz": job.get("freq_hz"),
                    "started_at": job.get("started_at"),
                },
            }
            q.put(record)
            print(f"[worker] Queued job {job_id} (queue={q.qsize()})")

        except Exception as e:
            print(f"[worker] Downloader loop error: {e}", file=sys.stderr)
            time.sleep(cfg.poll_idle_seconds)

    print("[worker] Downloader loop stopping (shutdown requested)")


def worker_loop(name: str, cfg: Config, model: WhisperModel, q: "queue.Queue[Dict[str, Any]]"):
    global SHUTDOWN
    print(f"[worker:{name}] Worker started")

    while True:
        if SHUTDOWN and q.empty():
            break

        try:
            item = q.get(timeout=0.5)
        except queue.Empty:
            if SHUTDOWN:
                break
            continue

        job_id = item["id"]
        path = item["path"]

        try:
            metrics = transcribe(path, cfg, model)
            rtf = metrics.get("rtf")
            rtf_str = f"{rtf:.2f}x" if rtf else "n/a"
            print(f"[worker:{name}] Job {job_id} done "
                  f"(dur={metrics.get('duration_sec')}, rtf={rtf_str})")

            submit_success(job_id, cfg, cfg.whisper_model, metrics)
        except Exception as e:
            print(f"[worker:{name}] Error processing job {job_id}: {e}", file=sys.stderr)
            submit_failure(job_id, cfg, f"transcription_failed: {e}")

        finally:
            q.task_done()

    print(f"[worker:{name}] Worker exiting (shutdown or idle)")


def handle_signal(signum, frame):
    global SHUTDOWN
    if not SHUTDOWN:
        print(f"[worker] Received signal {signum}, initiating graceful shutdown...")
        SHUTDOWN = True
    else:
        print("[worker] Second signal received, exiting now.")
        sys.exit(1)


def main():
    cfg = Config.from_env()

    print("[worker] Starting ASR worker with config:")
    print(json.dumps({
        "api_base": cfg.api_base,
        "whisper_model": cfg.whisper_model,
        "whisper_device": cfg.whisper_device,
        "whisper_compute": cfg.whisper_compute,
        "worker_concurrency": cfg.worker_concurrency,
        "max_queue_size": cfg.max_queue_size,
    }, indent=2))

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    job_queue: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=cfg.max_queue_size)

    try:
        model = build_model(cfg)
    except Exception as e:
        print(f"[worker] Failed to load model: {e}", file=sys.stderr)
        sys.exit(1)

    # Downloader thread
    dl_thread = threading.Thread(
        target=downloader_loop,
        args=(cfg, job_queue),
        name="downloader",
        daemon=True,
    )
    dl_thread.start()

    # Worker threads
    workers = []
    for i in range(cfg.worker_concurrency):
        t = threading.Thread(
            target=worker_loop,
            args=(f"w{i+1}", cfg, model, job_queue),
            name=f"worker-{i+1}",
            daemon=True,
        )
        t.start()
        workers.append(t)

    # Wait for workers to finish on shutdown
    try:
        while any(t.is_alive() for t in workers):
            time.sleep(1.0)
    except KeyboardInterrupt:
        handle_signal(signal.SIGINT, None)

    print("[worker] ASR worker stopped.")


if __name__ == "__main__":
    main()
