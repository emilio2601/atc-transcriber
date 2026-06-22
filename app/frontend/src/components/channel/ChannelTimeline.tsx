import React, { useEffect } from "react"
import { useLabeling } from "../../context/LabelingContext"
import { SectionLabel, formatInt, cx } from "../../common/ui"

export default function ChannelTimeline() {
  const { clips, isLoading, loadError, selectedClipId, setSelectedClip } = useLabeling()

  useEffect(() => {
    if (!selectedClipId) return
    const el = document.querySelector(`[data-clip-id="${selectedClipId}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [selectedClipId])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <SectionLabel>Timeline</SectionLabel>
        <span className="font-mono text-[10px] text-ink-faint tabular-nums">
          {formatInt(clips.length)} TX
        </span>
      </div>

      {isLoading && <div className="font-mono text-[11px] text-ink-faint">Acquiring signal…</div>}
      {loadError && <div className="font-mono text-[11px] text-fault">Error: {loadError}</div>}
      {!isLoading && !loadError && clips.length === 0 && (
        <div className="font-mono text-[11px] text-ink-faint">No clips yet for this selection.</div>
      )}

      <div className="flex-1 overflow-y-auto pr-1">
        <ul className="space-y-1">
          {clips.map((c) => {
            const isActive = c.id === selectedClipId
            const timeLabel = c.started_at ? new Date(c.started_at).toLocaleTimeString() : ""
            const approved = !!c.final_text?.trim() || c.status === "finalized"
            return (
              <li key={c.id} data-clip-id={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedClip(c.id)}
                  className={cx(
                    "group w-full rounded-md border px-3 py-2 text-left transition-colors",
                    isActive
                      ? "border-signal/70 bg-signal/[0.07]"
                      : "border-edge bg-base-2/40 hover:border-signal/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cx(
                        "h-7 w-[3px] shrink-0 rounded-full",
                        isActive ? "bg-signal" : approved ? "bg-go-dim" : "bg-edge-bright"
                      )}
                    />
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">
                      {timeLabel}
                    </span>
                    <span
                      className={cx(
                        "flex-1 truncate font-mono text-[13px]",
                        c.final_text?.trim() ? "text-ink" : "text-ink-dim"
                      )}
                    >
                      {c.final_text || c.asr_text || <span className="text-ink-faint italic">— no text —</span>}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {approved && (
                        <span className="label-tag rounded-sm border border-go-dim bg-go/12 px-1.5 py-[2px] text-[9px] text-go">
                          ✓
                        </span>
                      )}
                      {c.ignored && (
                        <span className="label-tag rounded-sm border border-fault-dim bg-fault/12 px-1.5 py-[2px] text-[9px] text-fault">
                          IGN
                        </span>
                      )}
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
