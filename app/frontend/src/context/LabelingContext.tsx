import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { Transmission } from "../types/transmission"

type Filters = {
  showIgnored: boolean
  showOnlyUnlabeled: boolean
  showSuspicious: boolean
}

type LabelingContextValue = {
  currentChannel: string | null
  selectedClipId: number | null
  filters: Filters
  setChannel: (id: string | null) => void
  setSelectedClip: (id: number | null) => void
  setFilters: (f: Filters) => void
  goToNextClip: (orderedClipsAsc: Transmission[]) => void
  goToPrevClip: (orderedClipsAsc: Transmission[]) => void
}

const LabelingContext = createContext<LabelingContextValue | null>(null)

export function LabelingProvider({ children }: { children: React.ReactNode }) {
  const [currentChannel, setChannel] = useState<string | null>(null)
  const [selectedClipId, setSelectedClip] = useState<number | null>(null)
  const [filters, setFilters] = useState<Filters>({
    showIgnored: false,
    showOnlyUnlabeled: false,
    showSuspicious: false,
  })

  const goToNextClip = useCallback((orderedClipsAsc: Transmission[] = []) => {
    if (!orderedClipsAsc.length || selectedClipId == null) return
    const idx = orderedClipsAsc.findIndex(c => c.id === selectedClipId)
    if (idx >= 0 && idx < orderedClipsAsc.length - 1) {
      setSelectedClip(orderedClipsAsc[idx + 1].id)
    }
  }, [selectedClipId])

  const goToPrevClip = useCallback((orderedClipsAsc: Transmission[] = []) => {
    if (!orderedClipsAsc.length || selectedClipId == null) return
    const idx = orderedClipsAsc.findIndex(c => c.id === selectedClipId)
    if (idx > 0) {
      setSelectedClip(orderedClipsAsc[idx - 1].id)
    }
  }, [selectedClipId])

  const value: LabelingContextValue = useMemo(() => ({
    currentChannel,
    selectedClipId,
    filters,
    setChannel,
    setSelectedClip,
    setFilters,
    goToNextClip,
    goToPrevClip,
  }), [currentChannel, selectedClipId, filters, setChannel, setSelectedClip, setFilters, goToNextClip, goToPrevClip])

  return (
    <LabelingContext.Provider value={value}>
      {children}
    </LabelingContext.Provider>
  )
}

export function useLabeling(): LabelingContextValue {
  const ctx = useContext(LabelingContext)
  if (!ctx) throw new Error("useLabeling must be used within LabelingProvider")
  return ctx
}


