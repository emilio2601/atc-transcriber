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
end
