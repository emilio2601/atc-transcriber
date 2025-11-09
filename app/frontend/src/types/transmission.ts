export type TransmissionStatus =
  | "pending_asr"
  | "asr_in_progress"
  | "asr_done"
  | "finalized"
  | "asr_failed"
  | "skipped";

export interface Transmission {
  id: number;
  object_key?: string;
  channel_label: string;
  freq_hz: number;
  started_at: string; // ISO8601
  duration_sec: number | null;
  status: TransmissionStatus;
  asr_text: string | null;
  final_text: string | null;

  // Optional ASR metadata (may not always be present)
  asr_model?: string | null;
  asr_avg_logprob?: number | null;
  asr_compression_ratio?: number | null;
  asr_no_speech_prob?: number | null;
  asr_speech_ratio?: number | null;
  asr_error?: string | null;

  // Labeling flags
  ignored?: boolean | null;
}

export interface Channel {
  id: string; // e.g. "JFK_135.900_Dep"
  label: string; // human display
  freq_hz?: number;
}

export interface FlightContextCandidate {
  callsign: string; // e.g. "JBU35"
  name?: string; // human readable name e.g. "Brickyard 4688"
  altitude_ft?: number;
  heading_deg?: number;
  distance_nm?: number;
  relevance?: number; // 0..1
}


