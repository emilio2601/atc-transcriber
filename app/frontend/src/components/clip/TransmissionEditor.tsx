import React, { useEffect, useMemo, useRef, useState } from "react"
import { useLabeling } from "../../context/LabelingContext"
import { useAuth } from "../../context/AuthContext"
import { useClip } from "../../hooks/useClip"
import { useAudioUrl } from "../../hooks/useAudioUrl"
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts"
import { updateClip } from "../../api/clips"
import { Freq, SectionLabel, cx } from "../../common/ui"

type SaveState = "idle" | "saving" | "saved" | "error"

export default function TransmissionEditor() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const { loggedIn } = useAuth()
  const {
    clips,
    updateClipLocal,
    bumpDataVersion,
    selectedClipId,
    goToNextClip,
    goToPrevClip,
    page,
    setPage,
  } = useLabeling()
  const clip = useClip(clips, selectedClipId)
  const { url } = useAudioUrl(clip?.id || null)

  // Per-clip unsaved drafts: editing one clip then navigating away and back
  // preserves the in-progress text instead of silently discarding it (#3).
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)

  const baseText = clip ? clip.final_text || clip.asr_text || "" : ""
  const finalText = clip && drafts[clip.id] !== undefined ? drafts[clip.id] : baseText
  const dirty = !!clip && drafts[clip.id] !== undefined && drafts[clip.id] !== baseText

  const setFinalText = (v: string) => {
    if (!clip) return
    setDrafts((d) => ({ ...d, [clip.id]: v }))
  }
  const clearDraft = (id: number) =>
    setDrafts((d) => {
      const next = { ...d }
      delete next[id]
      return next
    })

  useEffect(() => {
    if (!audioRef.current || !url) return
    audioRef.current.src = url
  }, [url])

  // Reset transient save status when the selection changes.
  useEffect(() => {
    setSaveState("idle")
    setSaveError(null)
  }, [clip?.id])

  // Auto-clear the "saved" confirmation.
  useEffect(() => {
    if (saveState !== "saved") return
    const t = setTimeout(() => setSaveState("idle"), 1800)
    return () => clearTimeout(t)
  }, [saveState])

  const playPause = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }

  // Returns true only when the server confirmed the write. Local/optimistic
  // state is applied *after* success, never on failure (#1).
  const save = async (finalize: boolean): Promise<boolean> => {
    if (!clip) return false
    setSaveState("saving")
    setSaveError(null)
    try {
      await updateClip(clip.id, {
        final_text: finalText,
        status: finalize ? "finalized" : undefined,
      })
      updateClipLocal(clip.id, { final_text: finalText, ...(finalize ? { status: "finalized" } : {}) })
      clearDraft(clip.id)
      bumpDataVersion()
      setSaveState("saved")
      return true
    } catch (e: any) {
      setSaveState("error")
      setSaveError(e?.message || "Save failed — not stored")
      return false
    }
  }

  // Single ignore path shared by button and shortcut, so the timeline badge
  // always reflects the change immediately (#2).
  const toggleIgnore = async () => {
    if (!clip) return
    const newIgnored = !clip.ignored
    try {
      await updateClip(clip.id, { ignored: newIgnored })
      updateClipLocal(clip.id, { ignored: newIgnored })
      bumpDataVersion()
    } catch (e: any) {
      setSaveState("error")
      setSaveError(e?.message || "Could not toggle ignore")
    }
  }

  const handlers = useMemo(
    () => ({
      next: () => goToNextClip(),
      prev: () => goToPrevClip(),
      playPause,
      saveAndNext: async () => {
        const ok = await save(false)
        if (!ok) return
        const allLabeled = clips.every(
          (c) =>
            c.ignored ||
            (c.final_text && c.final_text.trim().length > 0) ||
            (c.id === clip?.id && finalText.trim().length > 0)
        )
        if (allLabeled) setPage(page + 1)
        else goToNextClip()
      },
      toggleIgnore,
      focusEditor: () => textareaRef.current?.focus(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips, clip?.id, clip?.ignored, finalText, page]
  )
  useKeyboardShortcuts(handlers, { editorRef: textareaRef })

  if (!clip) {
    return (
      <div>
        <SectionLabel>Editor</SectionLabel>
        <div className="mt-3 font-mono text-[12px] text-ink-faint">Select a clip from the timeline.</div>
      </div>
    )
  }

  const timeLabel = clip.started_at ? new Date(clip.started_at).toLocaleString() : ""

  return (
    <div>
      {/* Header: tuner readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={playPause}
            aria-label="Play or pause clip audio"
            title="Space: Play/Pause"
            className="rounded-md border border-edge-bright bg-base-2 px-2.5 py-1 text-sm text-signal hover:border-signal hover:text-[#ffc760] transition-colors"
          >
            ⏯
          </button>
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[14px] font-semibold tracking-wide text-ink">
              {clip.channel_label}
            </span>
            {typeof clip.freq_hz === "number" && <Freq hz={clip.freq_hz} className="text-[13px]" />}
          </div>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-ink-faint">{timeLabel}</span>
      </div>

      <audio ref={audioRef} className="hidden" />

      {/* ASR (machine) */}
      <div className="mb-3">
        <SectionLabel tone="dim">ASR</SectionLabel>
        <div className="panel-inset mt-1.5 max-h-24 overflow-y-auto px-3 py-2 font-mono text-[13px] leading-snug text-ink-dim whitespace-pre-wrap">
          {clip.asr_text || <span className="text-ink-faint italic">— no transcription —</span>}
        </div>
      </div>

      {/* Final (human) */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SectionLabel>Final</SectionLabel>
            {dirty && (
              <span className="label-tag flex items-center gap-1 text-[9px] text-signal">
                <span className="h-1.5 w-1.5 rounded-full bg-signal blink" />
                Unsaved
              </span>
            )}
          </div>
          {loggedIn ? (
            <span className="font-mono text-[10px] text-ink-faint">E focus · ⌘/Ctrl+S save+next</span>
          ) : (
            <a href="/login" className="label-tag text-[10px] text-signal hover:text-[#ffc760]">
              Log in to edit
            </a>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={finalText}
          onChange={(e) => setFinalText(e.target.value)}
          rows={2}
          disabled={!loggedIn}
          aria-label="Final transcription"
          className={cx(
            "mt-1.5 w-full rounded-md border px-3 py-2 font-mono text-[13px] leading-snug transition focus:outline-none focus:ring-1",
            loggedIn
              ? "border-edge-bright bg-base-2 text-ink focus:border-signal focus:ring-signal/40"
              : "border-edge bg-base-2/50 text-ink-faint cursor-not-allowed"
          )}
        />
      </div>

      {loggedIn && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await save(true)
              if (ok) goToNextClip()
            }}
            disabled={saveState === "saving"}
            title="Approve and finalize"
            className="label-tag rounded-md bg-go px-3 py-1.5 text-[11px] text-base font-semibold shadow-[0_0_14px_-4px_rgba(79,224,139,0.7)] hover:bg-[#67e89e] active:translate-y-px disabled:opacity-60 transition"
          >
            Approve ✓
          </button>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saveState === "saving"}
            title="Save"
            className="label-tag rounded-md border border-edge-bright bg-base-2 px-3 py-1.5 text-[11px] text-ink-dim hover:border-signal hover:text-signal disabled:opacity-60 transition"
          >
            Save
          </button>
          <button
            type="button"
            onClick={toggleIgnore}
            title="Toggle ignore (I)"
            className="label-tag rounded-md border border-edge-bright bg-base-2 px-3 py-1.5 text-[11px] text-ink-dim hover:border-fault hover:text-fault transition"
          >
            {clip.ignored ? "Unignore" : "Ignore"}
          </button>

          {/* Save status feedback (#1) */}
          <span className="ml-auto font-mono text-[11px]">
            {saveState === "saving" && <span className="text-signal">writing…</span>}
            {saveState === "saved" && <span className="text-go glow-go">✓ saved</span>}
            {saveState === "error" && <span className="text-fault">⚠ {saveError}</span>}
          </span>
        </div>
      )}
    </div>
  )
}
