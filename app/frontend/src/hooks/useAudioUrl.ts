import { useEffect, useState } from "react"
import { getClipAudioUrl } from "../api/clips"

const cache = new Map<number, string>()

export function useAudioUrl(clipId: number | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clipId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (cache.has(clipId)) {
          setUrl(cache.get(clipId) || null)
        } else {
          const res = await getClipAudioUrl(clipId)
          if (cancelled) return
          cache.set(clipId, res.audio_url)
          setUrl(res.audio_url)
        }
      } catch (e: any) {
        if (cancelled) return
        setError(e.message || "Failed to fetch audio url")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [clipId])

  return { url, loading, error }
}


