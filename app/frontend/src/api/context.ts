import { apiClient } from "./apiClient"
import type { FlightContextCandidate } from "../types/transmission"

export type GetFlightContextParams = {
  channel: string
  startedAt: string // ISO8601
}

export interface ContextFlightsResponse {
  items: FlightContextCandidate[]
}

export async function getFlightContext(params: GetFlightContextParams): Promise<ContextFlightsResponse> {
  return apiClient.get<ContextFlightsResponse>("/api/context/flights", {
    channel: params.channel,
    started_at: params.startedAt,
  })
}


