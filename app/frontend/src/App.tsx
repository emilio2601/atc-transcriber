import React, { useState } from "react"
import ClipsBrowser from "./pages/ClipsBrowser"
import LabelingApp from "./pages/LabelingApp"
import TopBar from "./layout/TopBar"

export default function App() {
  const [view, setView] = useState<"browser" | "labeling">("browser")

  return (
    <div className="relative min-h-screen text-ink">
      {/* CRT scanline + vignette atmosphere */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 scanlines opacity-[0.35]" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40"
        style={{ boxShadow: "inset 0 0 220px 40px rgba(0,0,0,0.6)" }}
      />

      <TopBar view={view} onChangeView={setView} fullWidth={view === "labeling"} />
      <main className={`relative mx-auto px-5 py-5 ${view === "labeling" ? "w-[94%]" : "max-w-6xl"}`}>
        {view === "browser" ? <ClipsBrowser /> : <LabelingApp />}
      </main>
    </div>
  )
}
