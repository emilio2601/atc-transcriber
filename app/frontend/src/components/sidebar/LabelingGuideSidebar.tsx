import React from "react"

export default function LabelingGuideSidebar() {
  return (
    <div className="flex h-full flex-col">
      <div>
        <div className="text-sm uppercase tracking-widest text-emerald-400 mb-2">Labeling Guide</div>
        <ul className="text-sm text-slate-300 space-y-1">
          <li>• Use standard ICAO callsigns (e.g., JBU123).</li>
          <li>• Altitudes in feet or FL (e.g., 5000, FL240).</li>
          <li>• Headings in degrees (e.g., heading 270).</li>
          <li>• Squawks as 4 octal digits (e.g., 7234).</li>
          <li>• Runways as RWY + number (e.g., RWY 31L).</li>
          <li>• Frequencies as MHz (e.g., 135.900).</li>
          <li>• Normalize obvious ASR artifacts.</li>
        </ul>
      </div>
      <div className="mt-auto pt-3 text-slate-400">
        <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Shortcuts</div>
        <div className="text-sm">
          ←/J prev • →/K next • Space/P play/pause • ⌘/Ctrl+S save+next • I ignore • E focus editor
        </div>
        <div className="text-xs text-slate-500">
          When the editor is focused: use Shift+Space to play/pause (so typing Space still works).
        </div>
      </div>
    </div>
  )
}


