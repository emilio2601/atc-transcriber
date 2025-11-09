import React, { useState } from "react"
import ClipsBrowser from "./pages/ClipsBrowser"
import LabelingApp from "./pages/LabelingApp"
import TopBar from "./layout/TopBar"

export default function App() {
  const [view, setView] = useState<"browser" | "labeling">("browser")

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <TopBar view={view} onChangeView={setView} fullWidth={view === "labeling"} />
      <main className={`mx-auto px-4 py-4 ${view === "labeling" ? "w-[90%]" : "max-w-6xl"}`}>
        {view === "browser" ? <ClipsBrowser /> : <LabelingApp />}
      </main>
    </div>
  )
}


