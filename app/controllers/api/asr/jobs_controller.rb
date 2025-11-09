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
  # JSON body:
  # {
  #   "id": 123,
  #   "asr_text": "raw whisper output",
  #   "asr_model": "large-v3-int8",
  #   "asr_avg_logprob": -0.42,
  #   "asr_compression_ratio": 1.8,
  #   "asr_no_speech_prob": 0.12,
  #   "asr_speech_ratio": 0.42,
  #   "status": "asr_done" | "finalized" | "asr_failed" | "skipped" (optional),
  #   "error": "optional error message if failed"
  # }
  #
  def submit_result
    tx = Transmission.find(params[:id])

    unless tx
      render json: { error: "not_found" }, status: :not_found
      return
    end

    unless %w[asr_in_progress pending_asr].include?(tx.status)
      render json: { error: "invalid_state", current_status: tx.status },
             status: :unprocessable_entity
      return
    end

    if params[:error].present?
      # Hard failure for this item
      update_attrs = {
        status: "asr_failed",
        asr_error: params[:error].to_s
      }
    else
      update_attrs = result_params

      # Default status if not provided
      update_attrs[:status] ||= "asr_done"

      # Only stamp completion time on success-ish outcomes
      if %w[asr_done finalized].include?(update_attrs[:status])
        update_attrs[:asr_completed_at] ||= Time.current
      end
    end

    if tx.update(update_attrs)
      render json: { ok: true }
    else
      render json: {
        error: "validation_failed",
        messages: tx.errors.full_messages
      }, status: :unprocessable_entity
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

  def result_params
    params.permit(
      :asr_text,
      :asr_model,
      :asr_avg_logprob,
      :asr_compression_ratio,
      :asr_no_speech_prob,
      :asr_speech_ratio,
      :status
    )
  end

  def authenticate_worker!
    return true if Rails.env.development?

    token = request.authorization.to_s.sub(/^Bearer\s+/i, "")
    expected = ENV["ASR_WORKER_TOKEN"].to_s

    if expected.empty? || token != expected
      render json: { error: "unauthorized" }, status: :unauthorized
    end
  end
end
