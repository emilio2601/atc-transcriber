class R2SyncJob < ApplicationJob
  queue_as :default

  def perform
    client = R2.client
    bucket = R2.bucket
    prefix = R2.prefix

    continuation_token = nil
    imported = 0
    skipped = 0

    loop do
      resp = client.list_objects_v2(
        bucket: bucket,
        prefix: prefix,
        continuation_token: continuation_token
      )

      Rails.logger.info "[R2SyncJob] Found #{resp.contents.size} objects"

      resp.contents.each do |obj|
        key = obj.key

        # ignore temp or non-audio files
        next unless key.end_with?(".mp3")

        if Transmission.exists?(object_key: key)
          skipped += 1
          next
        end

        begin
          attrs = Transmission.parse_object_key(key)
        rescue => e
          Rails.logger.warn "[R2SyncJob] Skipping #{key}: #{e.class}: #{e.message}"
          next
        end

        Transmission.create!(
          object_key:    key,
          channel_label: attrs[:channel_label],
          freq_hz:       attrs[:freq_hz],
          started_at:    attrs[:started_at],
          duration_sec:  nil,        # optional: fill via later job
          size_bytes:    obj.size,
          status:        "pending_asr"
        )

        imported += 1
      end

      break unless resp.is_truncated
      continuation_token = resp.next_continuation_token
    end

    Rails.logger.info "[R2SyncJob] Imported #{imported} new, skipped #{skipped} existing"
  end
end
