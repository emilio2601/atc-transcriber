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
  page: number
  per: number
  dataVersion: number
  setChannel: (id: string | null) => void
  setSelectedClip: (id: number | null) => void
  setFilters: (f: Filters) => void
  setPage: (p: number) => void
  bumpDataVersion: () => void
  goToNextClip: (orderedClipsAsc: Transmission[]) => void
  goToPrevClip: (orderedClipsAsc: Transmission[]) => void
}

const LabelingContext = createContext<LabelingContextValue | null>(null)

export function LabelingProvider({ children }: React.PropsWithChildren<{}>) {
  const [currentChannel, setChannel] = useState<string | null>(null)
  const [selectedClipId, setSelectedClip] = useState<number | null>(null)
  const [page, setPage] = useState<number>(1)
  const [per] = useState<number>(200)
  const [dataVersion, setDataVersion] = useState<number>(0)
  const [filters, setFilters] = useState<Filters>({
    showIgnored: true,
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

  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), [])

  const value: LabelingContextValue = useMemo(() => ({
    currentChannel,
    selectedClipId,
    filters,
    page,
    per,
    dataVersion,
    setChannel,
    setSelectedClip,
    setFilters,
    setPage,
    bumpDataVersion,
    goToNextClip,
    goToPrevClip,
  }), [currentChannel, selectedClipId, filters, page, per, dataVersion, setChannel, setSelectedClip, setFilters, setPage, bumpDataVersion, goToNextClip, goToPrevClip])

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


