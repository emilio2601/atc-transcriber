import { useEffect, useState } from "react"
import { getClips } from "../api/clips"
import type { Transmission } from "../types/transmission"
import type { ApiListResponse } from "../types/api"

type UseClipsParams = {
  status?: string
  page?: number
  per?: number
  channel?: string | null
  version?: number
  filters?: {
    showIgnored?: boolean
    showOnlyUnlabeled?: boolean
  }
}

export function useClips({ status = "asr_done", page = 1, per = 200, channel = null, version = 0, filters = {} }: UseClipsParams = {}) {
  const [clips, setClips] = useState<Transmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<ApiListResponse<Transmission>["meta"] | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [list, setList] = useState<Transmission[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Require a selected channel; do not load "all channels"
      if (!channel) {
        setClips([])
        setMeta(null)
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const res = await getClips({ status, page, per, channel })
        if (cancelled) return
        const items = Array.isArray(res.items) ? res.items : (res as unknown as Transmission[])
        let filtered = items
        if (filters.showIgnored === false) {
          filtered = filtered.filter(c => !c.ignored)
        }
        if (filters.showOnlyUnlabeled) {
          filtered = filtered.filter(c => !c.final_text || c.final_text.trim() === "")
        }
        filtered.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
        setClips(filtered)
        setList(items)
        // @ts-expect-error tolerate array response shape
        setMeta(res.meta || null)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || "Failed to load clips")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [status, page, per, channel, filters.showIgnored, filters.showOnlyUnlabeled, reloadTick, version])

  const reload = () => setReloadTick((t) => t + 1)
  const removeClip = (id: number) => {
    setClips((prev) => prev.filter((c) => c.id !== id))
  }
  const updateClipLocal = (id: number, patch: Partial<Transmission>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  return { clips, isLoading, error, meta, reload, removeClip, updateClipLocal }
}


