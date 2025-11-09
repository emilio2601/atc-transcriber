import { RefObject, useEffect } from "react"

type Handlers = {
  next: () => void
  prev: () => void
  playPause: () => void
  saveAndNext: () => void
  toggleIgnore: () => void
  focusEditor: () => void
}

export function useKeyboardShortcuts(
  handlers: Handlers,
  opts?: { editorRef?: RefObject<HTMLElement> }
) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isTyping = tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable
      const isEditorFocused = !!opts?.editorRef?.current && document.activeElement === opts.editorRef.current

      // Cmd/Ctrl+S → save & next
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault()
        handlers.saveAndNext()
        return
      }

      // Space / Shift+Space / P → play/pause
      // If editor focused: use Shift+Space to avoid blocking normal typing.
      // If not typing: plain Space or 'P' toggles playback.
      if (!e.altKey) {
        if (isEditorFocused && e.key === " " && e.shiftKey) {
          e.preventDefault()
          handlers.playPause()
          return
        }
        if (!isTyping) {
          if (e.key === " " && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            handlers.playPause()
            return
          }
          if (e.key === "p" || e.key === "P") {
            e.preventDefault()
            handlers.playPause()
            return
          }
        }
      }

      // I → toggle ignore
      // If editor focused: require Ctrl/Cmd; otherwise allow plain I when not typing
      if (e.key === "i" || e.key === "I") {
        if (isEditorFocused) {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handlers.toggleIgnore()
          }
          return
        } else if (!isTyping) {
          e.preventDefault()
          handlers.toggleIgnore()
          return
        }
      }

      // E → focus editor
      if (!isTyping && (e.key === "e" || e.key === "E")) {
        e.preventDefault()
        handlers.focusEditor()
        return
      }

      // Arrows or J/K → prev/next
      if (!isTyping) {
        if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
          e.preventDefault()
          handlers.prev()
          return
        }
        if (e.key === "ArrowRight" || e.key === "k" || e.key === "K") {
          e.preventDefault()
          handlers.next()
          return
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handlers, opts?.editorRef])
}


