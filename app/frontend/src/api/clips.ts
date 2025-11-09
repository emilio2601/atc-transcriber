import { apiClient } from "./apiClient"
import type { ApiListResponse, ClipUpdatePayload } from "../types/api"
import type { Transmission } from "../types/transmission"

export type GetClipsParams = {
  status?: string // "all" | "pending_asr" | etc.
  page?: number
  per?: number
  channel?: string
  from?: string // ISO8601
  to?: string // ISO8601
  includeIgnored?: boolean
}

export async function getClips(params: GetClipsParams = {}): Promise<ApiListResponse<Transmission>> {
  // Map only params supported by backend today; leave room for future
  const query: Record<string, unknown> = {}
  if (params.status) query.status = params.status
  if (params.page) query.page = params.page
  if (params.per) query.per = params.per
  if (params.channel) query.channel = params.channel
  // from/to/includeIgnored reserved for future
  return apiClient.get<ApiListResponse<Transmission>>("/api/clips", query)
}

export async function getClipAudioUrl(id: number): Promise<{ audio_url: string }> {
  return apiClient.get<{ audio_url: string }>(`/api/clips/${id}/audio`)
}

export async function updateClip(
  id: number,
  payload: ClipUpdatePayload
): Promise<{ id: number; status: string; final_text: string | null; finalized_at: string | null }> {
  return apiClient.patch(`/api/clips/${id}`, payload)
}


