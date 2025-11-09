import React from "react"
import { useLabeling } from "../../context/LabelingContext"
import { useClips } from "../../hooks/useClips"

export default function LabelingPager() {
  const { currentChannel, filters, page, per, setPage } = useLabeling()
  const { meta, isLoading } = useClips({
    status: "asr_done",
    page,
    per,
    channel: currentChannel,
    filters,
  })

  if (!meta) return null

  return (
    <div className="rounded-xl border border-slate-800 p-3 flex items-center gap-3 text-sm text-slate-400">
      <span>
        Showing <span className="text-slate-200">{meta.from}–{meta.to}</span> of <span className="text-slate-200">{meta.count}</span>
      </span>
      <span>
        Page <span className="text-slate-200">{meta.page}</span> of <span className="text-slate-200">{meta.pages}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={!meta.previous}
          onClick={() => meta.previous && setPage(meta.previous)}
          className={`px-2 py-0.5 rounded border ${meta.previous ? "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500" : "bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed"}`}
        >
          Prev
        </button>
        <button
          disabled={!meta.next}
          onClick={() => meta.next && setPage(meta.next)}
          className={`px-2 py-0.5 rounded border ${meta.next ? "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500" : "bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed"}`}
        >
          Next
        </button>
      </div>
    </div>
  )
}


