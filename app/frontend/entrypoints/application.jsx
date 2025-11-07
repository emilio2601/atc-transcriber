import React from "react"
import { createRoot } from "react-dom/client"

function App() {
  return (
    <div style={{ padding: "1rem", fontFamily: "system-ui" }}>
      <h1>Airband Transcriber</h1>
      <p>Backend is up, React+Vite is wired. Next: hook ASR + labeling UI.</p>
    </div>
  )
}

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("root")
  if (el) {
    const root = createRoot(el)
    root.render(<App />)
  }
})
