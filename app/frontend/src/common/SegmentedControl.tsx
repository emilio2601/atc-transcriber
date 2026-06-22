import React from "react"
import { cx } from "./ui"

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
    <div className="inline-flex rounded-md border border-edge-bright bg-base-2 p-0.5">
      {segments.map((seg) => {
        const selected = seg.value === value
        return (
          <button
            key={seg.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(seg.value)}
            className={cx(
              "label-tag rounded-[5px] px-4 py-1.5 text-[11px] transition-colors",
              selected
                ? "bg-signal text-base shadow-[0_0_14px_-4px_rgba(255,178,46,0.7)]"
                : "text-ink-dim hover:text-signal"
            )}
          >
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}
