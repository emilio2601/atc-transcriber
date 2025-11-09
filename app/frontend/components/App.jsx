import React, { useEffect, useState, useRef } from "react"

const STATUS_LABELS = {
  pending_asr: "Pending ASR",
  asr_in_progress: "ASR in progress",
  asr_done: "ASR done",
  finalized: "Finalized",
  asr_failed: "ASR failed",
  skipped: "Skipped",
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

function formatDuration(seconds) {
  if (!(seconds >= 0)) return ""
  const s = Number(seconds)
  if (s < 60) {
    const value = s < 10 ? s.toFixed(1) : Math.round(s).toString()
    return `${value}s`
  }
  const mins = Math.floor(s / 60)
  const secs = Math.round(s % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status
  let base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
  let theme = ""

  switch (status) {
    case "pending_asr":
      theme = "bg-slate-800 text-slate-300 border border-slate-600"
      break
    case "asr_in_progress":
      theme = "bg-blue-900/50 text-blue-200 border border-blue-500/60"
      break
    case "asr_done":
      theme = "bg-emerald-900/40 text-emerald-300 border border-emerald-500/60"
      break
    case "finalized":
      theme = "bg-emerald-600 text-slate-950"
      break
    case "asr_failed":
      theme = "bg-red-900/60 text-red-200 border border-red-500/70"
      break
    case "skipped":
      theme = "bg-slate-900 text-slate-400 border border-slate-700"
      break
    default:
      theme = "bg-slate-800 text-slate-300"
  }

  return <span className={`${base} ${theme}`}>{label}</span>
}

export default function App() {
  const [clips, setClips] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const initial = typeof window !== "undefined" ? parseInitialParams() : { status: "all", page: 1, per: 100 }
  const [statusFilter, setStatusFilter] = useState(initial.status)
  const [page, setPage] = useState(initial.page)
  const [per, setPer] = useState(initial.per)
  const [currentClipId, setCurrentClipId] = useState(null)
  const [audioError, setAudioError] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (statusFilter && statusFilter !== "all") {
          params.set("status", statusFilter)
        } else {
          params.set("status", "all")
        }
        params.set("page", String(page))
        params.set("per", String(per))

        const res = await fetch(`/api/clips?${params.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (Array.isArray(data.items)) {
          setClips(data.items)
          setMeta(data.meta || null)
        } else {
          // Backcompat if server returns array
          setClips(data)
          setMeta(null)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
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
      const { status, page: p, per: pr } = parseInitialParams()
      setStatusFilter(status)
      setPage(p)
      setPer(pr)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  async function handlePlay(clipId) {
    setAudioError(null)
    setCurrentClipId(clipId)

    try {
      const res = await fetch(`/api/clips/${clipId}/audio`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { audio_url } = await res.json()

      if (!audioRef.current) return
      audioRef.current.src = audio_url
      await audioRef.current.play()
    } catch (err) {
      console.error(err)
      setAudioError(`Could not play clip ${clipId}: ${err.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-[0.22em]">
              airband
            </span>
            <h1 className="text-lg font-semibold text-slate-100">
              Transcriber
            </h1>
          </div>
          <div className="text-[10px] text-slate-400">
            R2 → Solid Queue → ASR → human
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {meta ? (
              <>
                Showing{" "}
                <span className="font-semibold text-slate-200">
                  {meta.from}–{meta.to}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-200">
                  {meta.count}
                </span>{" "}
                recent clips
              </>
            ) : (
              <>
                Showing{" "}
                <span className="font-semibold text-slate-200">
                  {clips.length}
                </span>{" "}
                recent clips
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {STATUS_ORDER.map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status)
                  setPage(1)
                }}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  statusFilter === status
                    ? "bg-emerald-500 text-slate-950 border-emerald-400"
                    : status === "all"
                    ? "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-400"
                    : "bg-slate-900 text-slate-300 border-slate-800 hover:border-emerald-500/40"
                }`}
              >
                {status === "all"
                  ? "All"
                  : STATUS_LABELS[status] || status}
              </button>
            ))}
          </div>
        </div>
        {meta && (
          <div className="mb-3 flex items-center gap-2 text-[10px] text-slate-400">
            <button
              disabled={!meta.previous}
              onClick={() => meta.previous && setPage(meta.previous)}
              className={`px-2 py-0.5 rounded border ${
                meta.previous
                  ? "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
                  : "bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed"
              }`}
            >
              Prev
            </button>
            <span>
              Page{" "}
              <span className="font-semibold text-slate-200">{meta.page}</span>{" "}
              of{" "}
              <span className="font-semibold text-slate-200">
                {meta.pages}
              </span>
            </span>
            <button
              disabled={!meta.next}
              onClick={() => meta.next && setPage(meta.next)}
              className={`px-2 py-0.5 rounded border ${
                meta.next
                  ? "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
                  : "bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed"
              }`}
            >
              Next
            </button>
          </div>
        )}

        {loading && (
          <div className="text-xs text-slate-400">Loading clips…</div>
        )}

        {error && (
          <div className="mb-3 rounded-md bg-red-900/40 px-3 py-2 text-xs text-red-200">
            Error loading clips: {error}
          </div>
        )}

        {audioError && (
          <div className="mb-3 rounded-md bg-red-900/30 px-3 py-2 text-[10px] text-red-200">
            {audioError}
          </div>
        )}

        {!loading && !error && clips.length === 0 && (
          <div className="mt-4 text-xs text-slate-400">
            No clips match this filter yet.
          </div>
        )}

        <ul className="mt-2 space-y-2">
          {clips.map((c) => {
            const freqMHz = typeof c.freq_hz === "number" ? (c.freq_hz / 1e6).toFixed(3) : ""
            const timeLabel = c.started_at ? new Date(c.started_at).toLocaleString() : ""
            const durationLabel = typeof c.duration_sec === "number" ? formatDuration(c.duration_sec) : ""
            const text = c.final_text || c.asr_text || ""
            const isCurrent = currentClipId === c.id

            return (
              <li
                key={c.id}
                className={`flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 transition-colors ${
                  isCurrent
                    ? "border-emerald-500/80 bg-slate-900"
                    : "border-slate-800 bg-slate-900/60 hover:border-emerald-500/50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-semibold text-emerald-400">
                      {c.channel_label || "Unknown"}
                    </span>
                    {freqMHz && (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        {freqMHz} MHz
                      </span>
                    )}
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    {durationLabel && (
                      <span className="text-[10px] text-slate-400">
                        {durationLabel}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {timeLabel}
                    </span>
                    <button
                      onClick={() => handlePlay(c.id)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-600 hover:bg-emerald-500 hover:text-slate-950 hover:border-emerald-400 transition-colors"
                    >
                      {isCurrent ? "▶︎ Playing" : "▶︎ Play"}
                    </button>
                  </div>
                </div>
                <div className="text-[11px] leading-snug text-slate-200">
                  {text}
                </div>
              </li>
            )
          })}
        </ul>
      </main>

      {/* Shared audio player */}
      <div className="fixed bottom-2 left-0 right-0 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-3xl rounded-xl bg-slate-900/95 border border-slate-700 px-3 py-2 shadow-lg">
          <audio
            ref={audioRef}
            controls
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
