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
        const opts: Option[] = items.map(c => ({ id: c.id, label: c.label }))
        setOptions(opts)
        // If no channel selected yet, default to the first available channel
        if (!currentChannel && opts.length > 0) {
          setChannel(opts[0].id)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="rounded-xl border border-slate-800 p-3 flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-slate-400">Channel</span>
      <select
        value={currentChannel || (options[0]?.id ?? "")}
        onChange={(e) => setChannel(e.target.value)}
        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        disabled={loading}
      >
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}


