import React, { useEffect, useRef } from "react"
import { useLabeling } from "../../context/LabelingContext"
import { useClips } from "../../hooks/useClips"
import { useClip } from "../../hooks/useClip"
import { useAudioUrl } from "../../hooks/useAudioUrl"

export default function TransmissionEditor() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { currentChannel, filters, selectedClipId } = useLabeling()
  const { clips } = useClips({
    status: "asr_done",
    page: 1,
    per: 200,
    channel: currentChannel,
    filters,
  })
  const clip = useClip(clips, selectedClipId)
  const { url, loading: audioLoading, error: audioError } = useAudioUrl(clip?.id || null)

  useEffect(() => {
    if (!audioRef.current || !url) return
    audioRef.current.src = url
  }, [url])

  if (!clip) {
    return (
      <div className="rounded-xl border border-slate-800 p-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Editor</div>
        <div className="text-xs text-slate-500">Select a clip from the timeline.</div>
      </div>
    )
  }

  const timeLabel = clip.started_at ? new Date(clip.started_at).toLocaleString() : ""
  const freqMHz = typeof clip.freq_hz === "number" ? (clip.freq_hz / 1e6).toFixed(3) : ""

  return (
    <div className="rounded-xl border border-slate-800 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-200">{clip.channel_label}{freqMHz ? ` • ${freqMHz} MHz` : ""}</div>
          <div className="text-[10px] text-slate-500">{timeLabel}</div>
        </div>
        <div className="text-[10px] text-slate-400">{clip.status}</div>
      </div>
      <div className="mt-3 rounded border border-slate-700 p-2 bg-slate-900">
        <audio ref={audioRef} controls className="w-full" />
        {audioLoading && <div className="text-[10px] text-slate-500 mt-1">Loading audio…</div>}
        {audioError && <div className="text-[10px] text-red-300 mt-1">Audio error: {audioError}</div>}
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">ASR</div>
        <div className="text-[12px] text-slate-200 whitespace-pre-wrap">
          {clip.asr_text || ""}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Final</div>
        <textarea
          defaultValue={clip.final_text || clip.asr_text || ""}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-[12px] text-slate-200"
          rows={5}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button className="text-[10px] px-2 py-0.5 rounded border bg-emerald-600 text-slate-950 border-emerald-500">
          Approve
        </button>
        <button className="text-[10px] px-2 py-0.5 rounded border bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500">
          Save
        </button>
        <button className="text-[10px] px-2 py-0.5 rounded border bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500">
          Ignore
        </button>
      </div>
    </div>
  )
}


