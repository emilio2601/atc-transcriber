import React from "react"
import SegmentedControl from "../common/SegmentedControl"
import { SignalBars } from "../common/ui"
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
    <header className="sticky top-0 z-30 border-b border-edge bg-base/85 backdrop-blur-md">
      <div className={`mx-auto flex items-center justify-between gap-4 px-5 py-3.5 ${fullWidth ? "w-[94%]" : "max-w-6xl"}`}>
        <div className="flex items-center gap-3">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-signal" />
          <div className="flex items-baseline gap-2.5">
            <span className="label-tag text-[12px] text-signal glow">AIRBAND</span>
            <h1 className="font-display text-base font-semibold tracking-wide text-ink">
              Transcriber
            </h1>
          </div>
          <SignalBars className="ml-1 hidden sm:inline-flex" />
        </div>

        <div className="flex items-center gap-4">
          {loggedIn && (
            <SegmentedControl
              segments={[
                { value: "browser", label: "Browser" },
                { value: "labeling", label: "Labeling" },
              ]}
              value={view}
              onChange={onChangeView}
            />
          )}
          {loggedIn ? (
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="hidden text-ink-dim md:inline">{userEmail}</span>
              <form action="/logout" method="post" className="inline">
                <input type="hidden" name="_method" value="delete" />
                <input
                  type="hidden"
                  name="authenticity_token"
                  value={document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || ""}
                />
                <button
                  type="submit"
                  className="label-tag text-[10px] text-ink-faint hover:text-fault transition-colors"
                >
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <a
              href="/login"
              className="label-tag text-[11px] text-signal hover:text-[#ffc760] transition-colors"
            >
              Log in
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
