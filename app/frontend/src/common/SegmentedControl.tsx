import React from "react"

type Segment<T extends string> = { value: T; label: string }

export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-xl border border-emerald-500/50 bg-slate-900/60 p-1">
      {segments.map((seg) => {
        const selected = seg.value === value
        return (
          <button
            key={seg.value}
            onClick={() => onChange(seg.value)}
            className={[
              "px-4 py-1.5 text-[11px] rounded-lg transition-colors",
              selected
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-300 hover:text-emerald-300 hover:bg-slate-800",
            ].join(" ")}
          >
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}


