import { useMemo } from "react"
import type { Transmission } from "../types/transmission"

export function useClip(clips: Transmission[], selectedClipId: number | null) {
  return useMemo(() => {
    if (!Array.isArray(clips) || selectedClipId == null) return null
    return clips.find(c => c.id === selectedClipId) || null
  }, [clips, selectedClipId])
}


