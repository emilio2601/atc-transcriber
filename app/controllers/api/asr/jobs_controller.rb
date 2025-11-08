# app/controllers/api/asr/jobs_controller.rb
class Api::Asr::JobsController < ApplicationController
  protect_from_forgery with: :null_session
  before_action :authenticate_worker!

  # POST /api/asr/next
  #
  # Returns one pending job and marks it in-progress.
  #
  # Response:
  #   {
  #     "id": 123,
  #     "object_key": "2025/11/07/JFK_135.900_....mp3",
  #     "audio_url": "<presigned>",
  #     "channel_label": "JFK_135.900_Dep",
  #     "freq_hz": 135900000,
  #     "started_at": "2025-11-07T18:26:53Z"
  #   }
  #
  # If none:
  #   { "job": null }
  #
  def next_job
    tx = nil

    Transmission.transaction do
      tx = Transmission.lock
                       .where(status: "pending_asr")
                       .order(:started_at)
                       .first

      unless tx
        render json: { job: nil }
        return
      end

      tx.status = "asr_in_progress"
      tx.save!
    end

    audio_url = R2.presigned_url(tx.object_key, expires_in: 900)

    render json: {
      id: tx.id,
      object_key: tx.object_key,
      audio_url: audio_url,
      channel_label: tx.channel_label,
      freq_hz: tx.freq_hz,
      started_at: tx.started_at
    }
  end

  # POST /api/asr/result
  #
  # Body:
  #   {
  #     "id": 123,
  #     "asr_text": "raw whisper output",
  #     "status": "asr_done" | "finalized" | "asr_failed" (optional),
  #     "error": "optional error message if failed"
  #   }
  #
  def submit_result
    tx = Transmission.find_by(id: params[:id])

    unless tx
      render json: { error: "not_found" }, status: :not_found
      return
    end

    # Only accept results if it was in progress or pending
    unless %w[asr_in_progress pending_asr].include?(tx.status)
      render json: { error: "invalid_state", current_status: tx.status }, status: :unprocessable_entity
      return
    end

    if params[:error].present?
      tx.status = "asr_failed"
      # you can add a column like asr_error if you want to store this
    else
      tx.asr_text = params[:asr_text].to_s if params[:asr_text]
      tx.status   = params[:status].presence || "asr_done"
    end

    if tx.save
      render json: { ok: true }
    else
      render json: { error: "validation_failed", messages: tx.errors.full_messages },
             status: :unprocessable_entity
    end
  end

  # GET /api/asr/sample
  # Returns a random clip with a presigned URL, WITHOUT changing status.
  # Auth: Bearer ASR_WORKER_TOKEN
  #
  # Response (if found):
  # {
  #   "id": 123,
  #   "object_key": "...",
  #   "audio_url": "<presigned>",
  #   "channel_label": "JFK_135.900_Dep",
  #   "freq_hz": 135900000,
  #   "started_at": "2025-11-07T18:26:53Z",
  #   "asr_text": "existing text if any",
  #   "sandbox": true
  # }
  #
  # If none:
  # { "job": nil }
  #
  def sample
    scope = Transmission.where.not(object_key: nil)

    tx = scope.order(Arel.sql("RANDOM()")).first

    unless tx
      render json: { job: nil }
      return
    end

    audio_url = R2.presigned_url(tx.object_key, expires_in: 600)

    render json: {
      id: tx.id,
      object_key: tx.object_key,
      audio_url: audio_url,
      channel_label: tx.channel_label,
      freq_hz: tx.freq_hz,
      started_at: tx.started_at,
      asr_text: tx.asr_text,
      sandbox: true
    }
  end

  private

  def authenticate_worker!
    return true if Rails.env.development?

    token = request.authorization.to_s.sub(/^Bearer\s+/i, "")
    expected = ENV["ASR_WORKER_TOKEN"].to_s

    if expected.empty? || token != expected
      render json: { error: "unauthorized" }, status: :unauthorized
    end
  end
end
