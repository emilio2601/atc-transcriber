import React from "react"
import { useLabeling } from "../../context/LabelingContext"
import { useClips } from "../../hooks/useClips"

export default function ChannelTimeline() {
  const { currentChannel, filters, selectedClipId, setSelectedClip, goToNextClip, goToPrevClip } = useLabeling()
  const { clips, isLoading, error } = useClips({
    status: "asr_done",
    page: 1,
    per: 200,
    channel: currentChannel,
    filters,
  })

  const items = clips

  return (
    <>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Timeline</div>
      {isLoading && <div className="text-xs text-slate-500">Loading…</div>}
      {error && <div className="text-xs text-red-300">Error: {error}</div>}
      {!isLoading && !error && items.length === 0 && (
        <div className="text-xs text-slate-500">No clips yet for this selection.</div>
      )}
      <ul className="space-y-1">
        {items.map((c) => {
          const isActive = c.id === selectedClipId
          const timeLabel = c.started_at ? new Date(c.started_at).toLocaleTimeString() : ""
          return (
            <li key={c.id}>
              <button
                onClick={() => setSelectedClip(c.id)}
                className={`w-full text-left px-2 py-1.5 rounded border transition-colors ${
                  isActive
                    ? "border-emerald-500/70 bg-slate-900"
                    : "border-slate-800 bg-slate-900/50 hover:border-emerald-500/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-200">{timeLabel}</span>
                  <span className="text-[10px] text-slate-500">{c.channel_label}</span>
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  {c.final_text || c.asr_text || ""}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      {items.length > 0 && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => goToPrevClip(items)}
            className="text-[10px] px-2 py-0.5 rounded border bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
          >
            ← Prev
          </button>
          <button
            onClick={() => goToNextClip(items)}
            className="text-[10px] px-2 py-0.5 rounded border bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
          >
            Next →
          </button>
        </div>
      )}
    </>
  )
}


