import React, { useEffect } from "react"
import { useLabeling } from "../../context/LabelingContext"
import { useClips } from "../../hooks/useClips"

export default function ChannelTimeline() {
  const { currentChannel, filters, page, per, dataVersion, selectedClipId, setSelectedClip } = useLabeling()
  const { clips, isLoading, error } = useClips({
    status: "asr_done",
    page,
    per,
    channel: currentChannel,
    version: dataVersion,
    filters,
  })

  const items = clips
  useEffect(() => {
    if (!selectedClipId) return
    const el = document.querySelector(`[data-clip-id="${selectedClipId}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [selectedClipId])

  return (
    <div className="flex h-full flex-col">
      <div className="text-sm uppercase tracking-widest text-emerald-400 pb-4">Timeline</div>
      {isLoading && <div className="text-xs text-slate-500">Loading…</div>}
      {error && <div className="text-xs text-red-300">Error: {error}</div>}
      {!isLoading && !error && items.length === 0 && (
        <div className="text-xs text-slate-500">No clips yet for this selection.</div>
      )}
      <div className="flex-1 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="space-y-1">
          {items.map((c) => {
            const isActive = c.id === selectedClipId
            const timeLabel = c.started_at ? new Date(c.started_at).toLocaleTimeString() : ""
            return (
              <li key={c.id} data-clip-id={c.id}>
                <button
                  onClick={() => setSelectedClip(c.id)}
                  className={`w-full text-left px-3 py-2 rounded border transition-colors ${isActive ? "border-emerald-500/70 bg-slate-900" : "border-slate-800 bg-slate-900/50 hover:border-emerald-500/40"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 shrink-0">{timeLabel}</span>
                    <span className="text-sm text-slate-200 truncate flex-1">
                      {c.final_text || c.asr_text || ""}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.final_text?.trim() || c.status === "finalized" ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-900/30 px-2 py-[2px] text-xs text-emerald-200">
                          Approved
                        </span>
                      ) : null}
                      {c.ignored ? (
                        <span className="inline-flex items-center rounded-full border border-red-400/60 bg-red-900/30 px-2 py-[2px] text-xs text-red-200">
                          Ignored
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}


