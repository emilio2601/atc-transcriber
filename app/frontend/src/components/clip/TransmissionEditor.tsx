import React, { useEffect, useMemo, useRef, useState } from "react"
import { useLabeling } from "../../context/LabelingContext"
import { useAuth } from "../../context/AuthContext"
import { useClips } from "../../hooks/useClips"
import { useClip } from "../../hooks/useClip"
import { useAudioUrl } from "../../hooks/useAudioUrl"
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts"
import { updateClip } from "../../api/clips"

export default function TransmissionEditor() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { loggedIn } = useAuth()
  const { currentChannel, filters, selectedClipId, bumpDataVersion } = useLabeling()
  const { clips, removeClip, updateClipLocal } = useClips({
    status: "asr_done",
    page: 1,
    per: 200,
    channel: currentChannel,
    filters,
  })
  const clip = useClip(clips, selectedClipId)
  const { url, loading: audioLoading, error: audioError } = useAudioUrl(clip?.id || null)
  const [finalText, setFinalText] = useState<string>("")
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!audioRef.current || !url) return
    audioRef.current.src = url
  }, [url])

  useEffect(() => {
    // Initialize editor text when selection changes
    setFinalText(clip?.final_text || clip?.asr_text || "")
  }, [clip?.id])

  const playPause = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }

  const save = async (finalize: boolean) => {
    if (!clip) return
    try {
      await updateClip(clip.id, {
        final_text: finalText,
        status: finalize ? "finalized" : undefined,
      })
      updateClipLocal(clip.id, { final_text: finalText, ...(finalize ? { status: "finalized" } : {}) })
      bumpDataVersion()
    } catch (e) {
      // noop for now; could surface toast
    }
  }

  const { goToNextClip, goToPrevClip, page, setPage } = useLabeling()
  const handlers = useMemo(() => ({
    next: () => goToNextClip(clips),
    prev: () => goToPrevClip(clips),
    playPause,
    saveAndNext: async () => {
      await save(false)
      // local update to final_text for current clip
      if (clip) updateClipLocal(clip.id, { final_text: finalText })
      const allLabeled = clips.every(c => c.ignored || (c.final_text && c.final_text.trim().length > 0) || (c.id === clip?.id && finalText.trim().length > 0))
      if (allLabeled) {
        setPage(page + 1)
      } else {
        goToNextClip(clips)
      }
    },
    toggleIgnore: async () => {
      if (!clip) return
      try {
        const newIgnored = !clip.ignored
        await updateClip(clip.id, { ignored: newIgnored })
        updateClipLocal(clip.id, { ignored: newIgnored })
        bumpDataVersion()
      } catch {}
    },
    focusEditor: () => {
      textareaRef.current?.focus()
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [clips, clip?.id, clip?.ignored, finalText])
  useKeyboardShortcuts(handlers, { editorRef: textareaRef })

  if (!clip) {
    return (
      <>
        <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Editor</div>
        <div className="text-sm text-slate-500">Select a clip from the timeline.</div>
      </>
    )
  }

  const timeLabel = clip.started_at ? new Date(clip.started_at).toLocaleString() : ""
  const freqMHz = typeof clip.freq_hz === "number" ? (clip.freq_hz / 1e6).toFixed(3) : ""

  return (
    <>
      <div className="text-sm uppercase tracking-widest text-emerald-400 mb-2">Editor</div>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <button
            onClick={playPause}
            className="text-xs px-2 py-0.5 rounded border bg-slate-900 text-slate-200 border-slate-600 hover:border-emerald-400"
            title="Space: Play/Pause"
          >
            ⏯
          </button>
          <div className="text-base text-slate-200">{clip.channel_label}{freqMHz ? ` • ${freqMHz} MHz` : ""}</div>
        </div>
        <div className="text-xs text-slate-400">{timeLabel}</div>
      </div>
      {/* Hidden minimal audio element */}
      <audio ref={audioRef} className="hidden" />

      <div className="mt-3">
        <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">ASR</div>
        <div className="text-sm text-slate-200 whitespace-pre-wrap max-h-28 overflow-y-auto">
          {clip.asr_text || ""}
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Final</div>
          {loggedIn ? (
            <div className="text-xs text-slate-500">E: focus • ⌘/Ctrl+S: save</div>
          ) : (
            <a href="/login" className="text-xs text-emerald-400 hover:underline">Log in to edit</a>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={finalText}
          onChange={(e) => setFinalText(e.target.value)}
          className={`w-full rounded border p-2 text-sm ${loggedIn ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-800 bg-slate-900/50 text-slate-400 cursor-not-allowed"}`}
          rows={2}
          disabled={!loggedIn}
        />
      </div>
      {loggedIn && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={async () => { await save(true); goToNextClip(clips) }}
            className="text-sm px-3 py-1 rounded border bg-emerald-600 text-slate-950 border-emerald-500"
            title="Approve and finalize"
          >
            Approve ✓
          </button>
          <button
            onClick={async () => { await save(false) }}
            className="text-sm px-3 py-1 rounded border bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500"
            title="Save"
          >
            Save 💾
          </button>
          <button
            onClick={async () => { if (clip) await updateClip(clip.id, { ignored: !clip.ignored }) }}
            className="text-sm px-3 py-1 rounded border bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500"
            title="Toggle ignore (I)"
          >
            {clip.ignored ? "Unignore" : "Ignore"}
          </button>
        </div>
      )}
    </>
  )
}


