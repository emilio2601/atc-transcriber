import React, { useEffect, useState } from "react"
import { useLabeling } from "../../context/LabelingContext"
import { getChannels } from "../../api/channels"
import type { Channel } from "../../types/transmission"

type Option = { id: string; label: string }

export default function ChannelSelector() {
  const { currentChannel, setChannel } = useLabeling()
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await getChannels()
        if (cancelled) return
        const items: Channel[] = res.items || []
        const opts: Option[] = items.map((c) => ({ id: c.id, label: c.label }))
        setOptions(opts)
        // Default to the first available channel if none is selected yet.
        if (!currentChannel && opts.length > 0) {
          setChannel(opts[0].id)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="panel flex items-center gap-3 px-3 py-2">
      <label htmlFor="channel-select" className="label-tag text-[11px] text-signal">
        Channel
      </label>
      <div className="relative">
        <select
          id="channel-select"
          value={currentChannel || options[0]?.id || ""}
          onChange={(e) => setChannel(e.target.value)}
          className="appearance-none rounded-md border border-edge-bright bg-base-2 pl-3 pr-8 py-1.5 font-mono text-[13px] text-ink focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal/40 disabled:opacity-50 transition"
          disabled={loading}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-signal-dim">
          ▾
        </span>
      </div>
    </div>
  )
}
