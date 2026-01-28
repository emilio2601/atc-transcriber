import React from "react"
import { createRoot } from "react-dom/client"
import App from "../src/App"
import { AuthProvider } from "../src/context/AuthContext"
import "../styles/tailwind.css"

const el = document.getElementById("root")
if (el) {
  const loggedIn = el.dataset.loggedIn === "true"
  const userEmail = el.dataset.userEmail || null

  const root = createRoot(el)
  root.render(
    <AuthProvider loggedIn={loggedIn} userEmail={userEmail}>
      <App />
    </AuthProvider>
  )
}


