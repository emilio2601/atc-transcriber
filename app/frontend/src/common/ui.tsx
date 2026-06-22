import React from "react"
import type { PaginationMeta } from "../types/api"

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

/** Integer with thousands separators, e.g. 14267 → "14,267". */
export function formatInt(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return ""
  return n.toLocaleString("en-US")
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!(typeof seconds === "number" && seconds >= 0)) return ""
  const s = Number(seconds)
  if (s < 60) {
    const value = s < 10 ? s.toFixed(1) : Math.round(s).toString()
    return `${value}s`
  }
  const mins = Math.floor(s / 60)
  const secs = Math.round(s % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function freqMHz(hz: number | null | undefined): string {
  return typeof hz === "number" ? (hz / 1e6).toFixed(3) : ""
}

/** Monospace frequency readout with the airband dial styling. */
export function Freq({ hz, className }: { hz: number | null | undefined; className?: string }) {
  const v = freqMHz(hz)
  if (!v) return null
  return (
    <span className={cx("font-mono text-signal glow tabular-nums", className)}>
      {v}
      <span className="ml-1 text-[0.7em] text-signal-dim tracking-widest">MHZ</span>
    </span>
  )
}

/** Decorative receiver signal-strength bars. */
export function SignalBars({ className }: { className?: string }) {
  const heights = [4, 7, 5, 9, 6, 8, 4, 7]
  return (
    <span className={cx("inline-flex items-end gap-[2px]", className)} aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className={i < 5 ? "bg-signal" : "bg-signal-dim/50"}
          style={{ width: 2, height: h, borderRadius: 1 }}
        />
      ))}
    </span>
  )
}

type StatusKey =
  | "pending_asr"
  | "asr_in_progress"
  | "asr_done"
  | "finalized"
  | "asr_failed"
  | "skipped"
  | string

const STATUS_META: Record<string, { label: string; cls: string; dot?: string }> = {
  pending_asr: { label: "PENDING", cls: "border-edge-bright text-ink-dim bg-panel-2" },
  asr_in_progress: { label: "RX···", cls: "border-signal-dim text-signal bg-signal/10", dot: "live-dot bg-signal" },
  asr_done: { label: "READY", cls: "border-signal/60 text-signal bg-signal/10" },
  finalized: { label: "FINAL", cls: "border-go-dim text-go bg-go/12 glow-go" },
  asr_failed: { label: "FAULT", cls: "border-fault-dim text-fault bg-fault/12" },
  skipped: { label: "SKIP", cls: "border-edge text-ink-faint bg-base-2" },
}

export function StatusBadge({ status }: { status: StatusKey }) {
  const m = STATUS_META[status] || { label: String(status).toUpperCase(), cls: "border-edge text-ink-dim bg-panel-2" }
  return (
    <span
      className={cx(
        "label-tag inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-[2px] text-[9px] leading-none",
        m.cls
      )}
    >
      {m.dot && <span className={cx("h-1.5 w-1.5 rounded-full", m.dot)} />}
      {m.label}
    </span>
  )
}

export function Pager({
  meta,
  onPage,
  className,
}: {
  meta: PaginationMeta
  onPage: (page: number) => void
  className?: string
}) {
  const btn =
    "label-tag rounded-sm border px-2 py-1 text-[10px] transition-colors"
  return (
    <div className={cx("flex items-center gap-3 font-mono text-[11px] text-ink-dim", className)}>
      <span className="tabular-nums">
        <span className="text-ink">{formatInt(meta.from)}–{formatInt(meta.to)}</span>
        <span className="text-ink-faint"> / </span>
        <span className="text-ink">{formatInt(meta.count)}</span>
      </span>
      <span className="tabular-nums text-ink-faint">
        PG <span className="text-ink">{formatInt(meta.page)}</span>/<span className="text-ink">{formatInt(meta.pages)}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!meta.previous}
          onClick={() => meta.previous && onPage(meta.previous)}
          className={cx(
            btn,
            meta.previous
              ? "border-edge-bright text-ink-dim hover:border-signal hover:text-signal"
              : "border-edge text-ink-faint/50 cursor-not-allowed"
          )}
        >
          ◀ PREV
        </button>
        <button
          type="button"
          disabled={!meta.next}
          onClick={() => meta.next && onPage(meta.next)}
          className={cx(
            btn,
            meta.next
              ? "border-edge-bright text-ink-dim hover:border-signal hover:text-signal"
              : "border-edge text-ink-faint/50 cursor-not-allowed"
          )}
        >
          NEXT ▶
        </button>
      </div>
    </div>
  )
}

/** Section heading: amber uppercase label with a leading tick. */
export function SectionLabel({
  children,
  tone = "signal",
  className,
}: React.PropsWithChildren<{ tone?: "signal" | "dim"; className?: string }>) {
  return (
    <div
      className={cx(
        "label-tag flex items-center gap-2 text-[11px]",
        tone === "signal" ? "text-signal" : "text-ink-dim",
        className
      )}
    >
      <span className={cx("h-[7px] w-[7px] rounded-[1px]", tone === "signal" ? "bg-signal" : "bg-ink-faint")} />
      {children}
    </div>
  )
}
