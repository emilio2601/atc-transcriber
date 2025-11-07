import React, { useEffect, useState } from "react"

export default function App() {
  const [clips, setClips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/clips?status=asr_done&limit=50")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setClips(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-[0.2em]">
              airband
            </span>
            <h1 className="text-lg font-semibold text-slate-100">
              Transcriber
            </h1>
          </div>
          <div className="text-xs text-slate-400">
            Latest clips from rtl_airband → R2 → Whisper
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {loading && (
          <div className="text-sm text-slate-400">Loading clips…</div>
        )}
        {error && (
          <div className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-200">
            Error loading clips: {error}
          </div>
        )}

        {!loading && !error && clips.length === 0 && (
          <div className="mt-4 text-sm text-slate-400">
            No clips yet. Once ASR runs, recent transmissions will show up here.
          </div>
        )}

        <ul className="mt-3 space-y-2">
          {clips.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 hover:border-emerald-500/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-emerald-400">
                    {c.channel_label}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    {(c.freq_hz / 1e6).toFixed(3)} MHz
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(c.started_at).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-slate-300 leading-snug">
                {c.final_text || c.asr_text || (
                  <span className="italic text-slate-500">
                    No transcript yet
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
