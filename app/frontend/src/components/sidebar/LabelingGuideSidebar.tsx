import React from "react"
import { SectionLabel } from "../../common/ui"

const RULES = [
  ["Callsigns", "Standard ICAO (e.g. JBU123)."],
  ["Altitudes", "Feet or FL (e.g. 5000, FL240)."],
  ["Headings", "Degrees (e.g. heading 270)."],
  ["Squawks", "4 octal digits (e.g. 7234)."],
  ["Runways", "RWY + number (e.g. RWY 31L)."],
  ["Frequencies", "MHz (e.g. 135.900)."],
  ["Artifacts", "Normalize obvious ASR errors."],
]

const KEYS = [
  ["←/J", "prev"],
  ["→/K", "next"],
  ["Space/P", "play"],
  ["⌘/Ctrl+S", "save+next"],
  ["I", "ignore"],
  ["E", "focus editor"],
]

export default function LabelingGuideSidebar() {
  return (
    <div className="flex h-full flex-col">
      <SectionLabel>Labeling Guide</SectionLabel>
      <ul className="mt-3 space-y-1.5 font-mono text-[12px]">
        {RULES.map(([k, v]) => (
          <li key={k} className="flex gap-2 leading-snug">
            <span className="w-[78px] shrink-0 text-signal-dim">{k}</span>
            <span className="text-ink-dim">{v}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-edge pt-3">
        <SectionLabel tone="dim">Shortcuts</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px]">
          {KEYS.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <kbd className="rounded-sm border border-edge-bright bg-base-2 px-1.5 py-[1px] text-[10px] text-ink">
                {k}
              </kbd>
              <span className="text-ink-faint">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-2.5 font-mono text-[10px] leading-relaxed text-ink-faint">
          Editor focused: use Shift+Space to play/pause so typing Space still works.
        </p>
      </div>
    </div>
  )
}
