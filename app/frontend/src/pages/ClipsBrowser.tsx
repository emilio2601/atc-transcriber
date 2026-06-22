import React, { useEffect, useState, useRef } from "react"
import { getClips, getClipAudioUrl } from "../api/clips"
import type { Transmission } from "../types/transmission"
import type { PaginationMeta } from "../types/api"
import { StatusBadge, Pager, Freq, formatDuration, formatInt, SectionLabel, cx } from "../common/ui"

const STATUS_LABELS: Record<string, string> = {
  pending_asr: "Pending",
  asr_in_progress: "RX",
  asr_done: "Ready",
  finalized: "Final",
  asr_failed: "Fault",
  skipped: "Skip",
}

const STATUS_ORDER = [
  "all",
  "pending_asr",
  "asr_in_progress",
  "asr_done",
  "finalized",
  "asr_failed",
  "skipped",
]

function parseInitialParams() {
  const usp = new URLSearchParams(window.location.search)
  const rawStatus = usp.get("status") || "all"
  const status = STATUS_ORDER.includes(rawStatus) ? rawStatus : "all"
  const page = Math.max(1, parseInt(usp.get("page") || "1", 10) || 1)
  const per = Math.max(1, Math.min(1000, parseInt(usp.get("per") || "100", 10) || 100))
  return { status, page, per }
}

export default function ClipsBrowser() {
  const [clips, setClips] = useState<Transmission[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initial =
    typeof window !== "undefined" ? parseInitialParams() : { status: "all", page: 1, per: 100 }
  const [statusFilter, setStatusFilter] = useState(initial.status)
  const [page, setPage] = useState(initial.page)
  const [per] = useState(initial.per)
  const [currentClipId, setCurrentClipId] = useState<number | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await getClips({ status: statusFilter || "all", page, per })
        if (cancelled) return
        setClips(Array.isArray(res.items) ? res.items : (res as unknown as Transmission[]))
        setMeta((res.meta as PaginationMeta) || null)
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message || "Failed to load clips")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [statusFilter, page, per])

  useEffect(() => {
    const usp = new URLSearchParams(window.location.search)
    usp.set("status", statusFilter || "all")
    usp.set("page", String(page))
    usp.set("per", String(per))
    const newSearch = `?${usp.toString()}`
    if (window.location.search !== newSearch) {
      window.history.pushState(null, "", newSearch)
    }
  }, [statusFilter, page, per])

  useEffect(() => {
    function onPopState() {
      const { status, page: p } = parseInitialParams()
      setStatusFilter(status)
      setPage(p)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  async function handlePlay(clipId: number) {
    setAudioError(null)
    setCurrentClipId(clipId)
    try {
      const { audio_url } = await getClipAudioUrl(clipId)
      if (!audioRef.current) return
      audioRef.current.src = audio_url
      await audioRef.current.play()
    } catch (err: any) {
      console.error(err)
      setAudioError(`Could not play clip ${clipId}: ${err?.message || "error"}`)
    }
  }

  return (
    <div className="pb-24">
      {/* Controls */}
      <div className="reveal mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[11px] text-ink-dim">
          {meta ? (
            <span className="tabular-nums">
              <span className="text-ink">{formatInt(meta.from)}–{formatInt(meta.to)}</span>
              <span className="text-ink-faint"> of </span>
              <span className="text-ink">{formatInt(meta.count)}</span> clips
            </span>
          ) : (
            <span className="tabular-nums">
              <span className="text-ink">{formatInt(clips.length)}</span> clips
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((status) => {
            const active = statusFilter === status
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setStatusFilter(status)
                  setPage(1)
                }}
                className={cx(
                  "label-tag rounded-sm border px-2 py-1 text-[10px] transition-colors",
                  active
                    ? "border-signal bg-signal text-base"
                    : "border-edge text-ink-dim hover:border-signal/50 hover:text-signal"
                )}
              >
                {status === "all" ? "All" : STATUS_LABELS[status] || status}
              </button>
            )
          })}
        </div>
      </div>

      {meta && (
        <div className="reveal mb-3 panel px-3 py-2">
          <Pager meta={meta} onPage={setPage} />
        </div>
      )}

      {loading && <div className="font-mono text-[11px] text-ink-faint">Acquiring signal…</div>}
      {error && (
        <div className="mb-3 rounded-md border border-fault-dim bg-fault/10 px-3 py-2 font-mono text-[11px] text-fault">
          Error loading clips: {error}
        </div>
      )}
      {audioError && (
        <div className="mb-3 rounded-md border border-fault-dim bg-fault/10 px-3 py-2 font-mono text-[11px] text-fault">
          {audioError}
        </div>
      )}
      {!loading && !error && clips.length === 0 && (
        <div className="mt-4 font-mono text-[11px] text-ink-faint">No clips match this filter yet.</div>
      )}

      <ul className="space-y-2">
        {clips.map((c, i) => {
          const timeLabel = c.started_at ? new Date(c.started_at).toLocaleString() : ""
          const durationLabel = formatDuration(c.duration_sec)
          const isCurrent = currentClipId === c.id
          return (
            <li
              key={c.id}
              className={cx(
                "reveal panel px-3.5 py-2.5 transition-colors",
                isCurrent ? "border-signal/70" : "hover:border-signal/40"
              )}
              style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="font-display text-[13px] font-semibold tracking-wide text-signal">
                    {c.channel_label || "Unknown"}
                  </span>
                  {typeof c.freq_hz === "number" && <Freq hz={c.freq_hz} className="text-[12px]" />}
                  <StatusBadge status={c.status} />
                </div>
                <div className="flex items-center gap-3">
                  {durationLabel && (
                    <span className="font-mono text-[11px] tabular-nums text-ink-dim">{durationLabel}</span>
                  )}
                  <span className="font-mono text-[11px] tabular-nums text-ink-faint">{timeLabel}</span>
                  <button
                    type="button"
                    onClick={() => handlePlay(c.id)}
                    aria-label={`Play clip ${c.id}`}
                    className={cx(
                      "label-tag rounded-sm border px-2 py-1 text-[10px] transition-colors",
                      isCurrent
                        ? "border-signal bg-signal text-base"
                        : "border-edge-bright text-ink-dim hover:border-signal hover:text-signal"
                    )}
                  >
                    {isCurrent ? "▶ Playing" : "▶ Play"}
                  </button>
                </div>
              </div>
              <div className="mt-1.5 font-mono text-[12px] leading-snug text-ink-dim">
                {c.final_text || c.asr_text || (
                  <span className="text-ink-faint italic">— no text —</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Fixed transport bar */}
      <div className="fixed bottom-3 left-0 right-0 z-30 flex justify-center px-4">
        <div className="panel corners w-full max-w-3xl px-3 py-2 backdrop-blur-md">
          <div className="mb-1 flex items-center gap-2">
            <SectionLabel tone="dim" className="text-[9px]">Transport</SectionLabel>
            {currentClipId && (
              <span className="font-mono text-[10px] text-signal">CLIP #{currentClipId}</span>
            )}
          </div>
          <audio ref={audioRef} controls className="w-full" />
        </div>
      </div>
    </div>
  )
}
