import React from "react"
import SegmentedControl from "../common/SegmentedControl"

export default function TopBar({
  view,
  onChangeView,
  fullWidth = false,
}: {
  view: "browser" | "labeling"
  onChangeView: (v: "browser" | "labeling") => void
  fullWidth?: boolean
}) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className={`mx-auto flex items-center justify-between px-4 py-4 ${fullWidth ? "w-[90%]" : "max-w-6xl"}`}>
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold text-emerald-400 uppercase tracking-[0.22em]">
            airband
          </span>
          <h1 className="text-xl font-semibold text-slate-100">
            Transcriber
          </h1>
        </div>
        <SegmentedControl
          segments={[
            { value: "browser", label: "Browser" },
            { value: "labeling", label: "Labeling" },
          ]}
          value={view}
          onChange={onChangeView}
        />
      </div>
    </header>
  )
}


