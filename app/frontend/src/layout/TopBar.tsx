import React from "react"
import SegmentedControl from "../common/SegmentedControl"
import { useAuth } from "../context/AuthContext"

export default function TopBar({
  view,
  onChangeView,
  fullWidth = false,
}: {
  view: "browser" | "labeling"
  onChangeView: (v: "browser" | "labeling") => void
  fullWidth?: boolean
}) {
  const { loggedIn, userEmail } = useAuth()

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
        <div className="flex items-center gap-4">
          {loggedIn ? (
            <SegmentedControl
              segments={[
                { value: "browser", label: "Browser" },
                { value: "labeling", label: "Labeling" },
              ]}
              value={view}
              onChange={onChangeView}
            />
          ) : null}
          {loggedIn ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">{userEmail}</span>
              <form action="/logout" method="post" className="inline">
                <input type="hidden" name="_method" value="delete" />
                <input
                  type="hidden"
                  name="authenticity_token"
                  value={document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || ""}
                />
                <button
                  type="submit"
                  className="text-slate-500 hover:text-slate-300"
                >
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <a
              href="/login"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              Log in
            </a>
          )}
        </div>
      </div>
    </header>
  )
}


