import React from "react"

export default function LabelingGuideSidebar() {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Labeling Guide</div>
      <ul className="text-xs text-slate-300 space-y-1">
        <li>• Use standard ICAO callsigns (e.g., JBU123).</li>
        <li>• Altitudes in feet or FL (e.g., 5000, FL240).</li>
        <li>• Headings in degrees (e.g., heading 270).</li>
        <li>• Squawks as 4 octal digits (e.g., 7234).</li>
        <li>• Runways as RWY + number (e.g., RWY 31L).</li>
        <li>• Frequencies as MHz (e.g., 135.900).</li>
        <li>• Normalize obvious ASR artifacts.</li>
      </ul>
    </div>
  )
}


