#!/usr/bin/env python3
import argparse
import json
import os
import sys
from datetime import datetime
from statistics import mean

from faster_whisper import WhisperModel
from tqdm import tqdm


def load_prompt(prompt_str: str = None, prompt_file: str = None) -> str:
    text = ""
    if prompt_file:
        with open(prompt_file, "r", encoding="utf-8") as f:
            text = f.read().strip()
    if prompt_str:
        text = (text + " " + prompt_str).strip() if text else prompt_str.strip()
    return text if text else None


def build_argparser():
    p = argparse.ArgumentParser(
        description="Transcribe an audio file with faster-whisper and emit JSON."
    )
    p.add_argument("--audio", required=True, help="Path to input audio/video file")
    p.add_argument("--out", required=True, help="Path to output JSON file")
    p.add_argument("--model", default="large-v3",
                   help="Whisper model size or path (e.g., tiny, base, small, medium, large-v3)")
    p.add_argument("--device", default="auto",
                   help="Device: auto|cpu|cuda. (auto picks cuda if available)")
    p.add_argument("--compute-type", default="auto",
                   help="Precision: auto|int8|int8_float16|float16|float32")
    p.add_argument("--language", default="en", help="Language code, e.g., en")
    p.add_argument("--beam-size", type=int, default=5, help="Beam size for decoding")
    p.add_argument("--temperature", type=float, default=0.0, help="Sampling temperature")
    p.add_argument("--vad", action="store_true", help="Enable VAD filtering (recommended)")
    p.add_argument("--prompt", default=None, help="Inline initial prompt text")
    p.add_argument("--prompt-file", default=None, help="File with initial prompt text")
    p.add_argument("--max-compute-chunk", type=float, default=30.0,
                   help="Split long audio into chunks of ~N seconds for decoding (heuristic)")
    return p


def main():
    args = build_argparser().parse_args()

    if not os.path.exists(args.audio):
        print(f"Input not found: {args.audio}", file=sys.stderr)
        sys.exit(1)

    initial_prompt = load_prompt(args.prompt, args.prompt_file)

    # Create model
    # device="auto" tries CUDA first; falls back to CPU (Accelerate on macOS).
    model = WhisperModel(
        args.model,
        device=args.device,
        compute_type=args.compute_type,
    )

    # VAD parameters (tweak if you want more/less aggressive speech detection)
    vad_params = None
    if args.vad:
        vad_params = {
            "min_silence_duration_ms": 300,
            "speech_pad_ms": 150,
        }

    # Transcribe
    segments, info = model.transcribe(
        args.audio,
        language=args.language,
        beam_size=args.beam_size,
        temperature=args.temperature,
        vad_filter=bool(args.vad),
        vad_parameters=vad_params,
        initial_prompt=initial_prompt,
        word_timestamps=True,           # crucial for editor word-level fixes
        without_timestamps=False,
        condition_on_previous_text=True,
        chunk_length=int(args.max_compute_chunk),  # heuristic; keeps memory predictable
    )

    # Build output JSON
    out = {
        "audio": os.path.abspath(args.audio),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "engine": "faster-whisper",
        "model": args.model,
        "decode_params": {
            "language": args.language,
            "beam_size": args.beam_size,
            "temperature": args.temperature,
            "vad_filter": bool(args.vad),
            "compute_type": args.compute_type,
            "initial_prompt_len": len(initial_prompt) if initial_prompt else 0,
        },
        "detected_language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "duration": getattr(info, "duration", None),
        "segments": []
    }

    # Progress bar setup based on audio duration (seconds)
    duration = getattr(info, "duration", None)
    total_seconds = float(duration) if duration is not None else None
    pbar = tqdm(
        total=total_seconds,
        unit="s",
        unit_scale=True,
        desc="Transcribing",
        dynamic_ncols=True,
    )
    progressed_seconds = 0.0

    segs = []
    for i, seg in enumerate(segments):
        # faster-whisper segments expose: start, end, text, words (with t0, t1, prob, etc.)
        words = []
        if getattr(seg, "words", None):
            for w in seg.words:
                # Each word has .start, .end, .word, and .prob (0..1) if available
                words.append({
                    "t0": float(w.start) if w.start is not None else None,
                    "t1": float(w.end) if w.end is not None else None,
                    "w": w.word,
                    "p": float(w.prob) if hasattr(w, "prob") and w.prob is not None else None,
                })

        # Heuristic confidence = mean per-word probs (if present)
        conf = None
        if words and any(w["p"] is not None for w in words):
            vals = [w["p"] for w in words if w["p"] is not None]
            if vals:
                conf = float(mean(vals))

        segs.append({
            "id": i,
            "start": float(seg.start),
            "end": float(seg.end),
            "text_raw": seg.text.strip(),
            "confidence": conf,              # optional heuristic
            "words": words,                  # for your word-level editor
            # Placeholders you can fill in your UI later:
            "role": None,                    # "PILOT" | "ATCO"
            "position": None,                # e.g., "LGA_TWR"
            "airport": None,                 # e.g., "KLGA"
            "runway": None,                  # e.g., "22R"
            "heading_deg": None,
            "altitude_ft": None,
            "flight_level": None,            # e.g., "FL230"
            "callsigns": [],                 # ["DAL123"]
        })

        # Advance progress bar by the newly covered time span
        seg_end = float(seg.end)
        if total_seconds is not None:
            target = min(seg_end, total_seconds)
        else:
            target = seg_end
        delta = max(0.0, target - progressed_seconds)
        if delta:
            pbar.update(delta)
            progressed_seconds += delta

    out["segments"] = segs

    # Ensure bar completes
    if total_seconds is not None and progressed_seconds < total_seconds:
        pbar.update(total_seconds - progressed_seconds)
        progressed_seconds = total_seconds
    pbar.close()

    # Write JSON
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"Wrote {args.out} ({len(segs)} segments)")


if __name__ == "__main__":
    main()
