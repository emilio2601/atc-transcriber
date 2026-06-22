import React from "react"
import { SectionLabel } from "../../common/ui"

export default function FlightContextSidebar() {
  return (
    <div className="flex h-full flex-col">
      <SectionLabel>Flight Context</SectionLabel>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="relative h-16 w-16 opacity-50">
          <span className="absolute inset-0 rounded-full border border-go-dim" />
          <span className="absolute inset-2 rounded-full border border-go-dim/60" />
          <span className="absolute inset-4 rounded-full border border-go-dim/40" />
          <span className="live-dot absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-go" />
        </div>
        <div className="font-mono text-[11px] leading-relaxed text-ink-faint">
          Select a clip to load nearby flights.
          <br />
          <span className="text-go-dim">[ COMING SOON ]</span>
        </div>
      </div>
    </div>
  )
}
