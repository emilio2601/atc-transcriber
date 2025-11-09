import { apiClient } from "./apiClient"
import type { Channel } from "../types/transmission"

export interface ChannelsResponse {
  items: Channel[]
}

export async function getChannels(): Promise<ChannelsResponse> {
  return apiClient.get<ChannelsResponse>("/api/channels")
}


