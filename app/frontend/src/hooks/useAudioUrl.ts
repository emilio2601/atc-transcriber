import { useEffect, useState } from "react"
import { getClipAudioUrl } from "../api/clips"

// Presigned R2 URLs expire, so cache entries must too — otherwise replaying a
// clip viewed earlier in a long session would 403 (#6).
const TTL_MS = 50 * 60 * 1000
const cache = new Map<number, { url: string; exp: number }>()

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
        const hit = cache.get(clipId)
        if (hit && hit.exp > Date.now()) {
          setUrl(hit.url)
        } else {
          const res = await getClipAudioUrl(clipId)
          if (cancelled) return
          cache.set(clipId, { url: res.audio_url, exp: Date.now() + TTL_MS })
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
    return () => {
      cancelled = true
    }
  }, [clipId])

  return { url, loading, error }
}
