# app/models/transmission.rb
class Transmission < ApplicationRecord
  STATUSES = %w[
    pending_asr
    asr_in_progress
    asr_done
    finalized
    asr_failed
    skipped
  ].freeze

  validates :object_key, :channel_label, :freq_hz, :started_at, presence: true
  validates :status, inclusion: { in: STATUSES }

  # Example key:
  #  "2025/11/07/JFK_135.900_Dep_20251107_182653_135900000.mp3"
  def self.parse_object_key(object_key)
    base = File.basename(object_key, ".mp3")
    parts = base.split("_")
    raise ArgumentError, "unexpected key format: #{object_key}" if parts.size < 4

    channel_label = parts[0..-4].join("_")
    date = parts[-3] # YYYYMMDD
    time = parts[-2] # HHMMSS
    freq = parts[-1]

    started_at = Time.utc(
      date[0, 4].to_i,
      date[4, 2].to_i,
      date[6, 2].to_i,
      time[0, 2].to_i,
      time[2, 2].to_i,
      time[4, 2].to_i
    )

    {
      channel_label: channel_label,
      freq_hz: freq.to_i,
      started_at: started_at
    }
  end
end
