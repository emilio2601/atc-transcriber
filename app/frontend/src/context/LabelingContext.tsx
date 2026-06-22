import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Transmission } from "../types/transmission"
import type { PaginationMeta } from "../types/api"
import { useClips } from "../hooks/useClips"

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
  // Shared clip data (single source of truth for the labeling workspace)
  clips: Transmission[]
  meta: PaginationMeta | null
  isLoading: boolean
  loadError: string | null
  setChannel: (id: string | null) => void
  setSelectedClip: (id: number | null) => void
  setFilters: (f: Filters) => void
  setPage: (p: number) => void
  bumpDataVersion: () => void
  updateClipLocal: (id: number, patch: Partial<Transmission>) => void
  goToNextClip: () => void
  goToPrevClip: () => void
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

  // Single fetch shared by Timeline, Editor and Pager (was duplicated 3×).
  const { clips, meta, isLoading, error, updateClipLocal } = useClips({
    status: "asr_done",
    page,
    per,
    channel: currentChannel,
    version: dataVersion,
    filters,
  })

  // Keep a valid selection: default to the first clip when none is selected
  // or the current selection drops out of the loaded set.
  useEffect(() => {
    if (!clips.length) return
    if (selectedClipId == null || !clips.some((c) => c.id === selectedClipId)) {
      setSelectedClip(clips[0].id)
    }
  }, [clips, selectedClipId])

  const goToNextClip = useCallback(() => {
    if (!clips.length || selectedClipId == null) return
    const idx = clips.findIndex((c) => c.id === selectedClipId)
    if (idx >= 0 && idx < clips.length - 1) {
      setSelectedClip(clips[idx + 1].id)
    }
  }, [clips, selectedClipId])

  const goToPrevClip = useCallback(() => {
    if (!clips.length || selectedClipId == null) return
    const idx = clips.findIndex((c) => c.id === selectedClipId)
    if (idx > 0) {
      setSelectedClip(clips[idx - 1].id)
    }
  }, [clips, selectedClipId])

  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), [])

  const value: LabelingContextValue = useMemo(
    () => ({
      currentChannel,
      selectedClipId,
      filters,
      page,
      per,
      dataVersion,
      clips,
      meta: (meta as PaginationMeta | null) ?? null,
      isLoading,
      loadError: error,
      setChannel,
      setSelectedClip,
      setFilters,
      setPage,
      bumpDataVersion,
      updateClipLocal,
      goToNextClip,
      goToPrevClip,
    }),
    [
      currentChannel,
      selectedClipId,
      filters,
      page,
      per,
      dataVersion,
      clips,
      meta,
      isLoading,
      error,
      updateClipLocal,
      bumpDataVersion,
      goToNextClip,
      goToPrevClip,
    ]
  )

  return <LabelingContext.Provider value={value}>{children}</LabelingContext.Provider>
}

export function useLabeling(): LabelingContextValue {
  const ctx = useContext(LabelingContext)
  if (!ctx) throw new Error("useLabeling must be used within LabelingProvider")
  return ctx
}
