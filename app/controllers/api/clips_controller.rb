class Api::ClipsController < ApplicationController
  protect_from_forgery with: :null_session
  before_action :require_login

  # GET /api/clips
  # ?status=all            -> all statuses
  # ?status=asr_done       -> only that status
  # (no status param)      -> default: asr_done + finalized
  def index
    scope = Transmission.all

    if params[:status].present? && params[:status] != "all"
      scope = scope.where(status: params[:status])
    elsif !params[:status].present?
      scope = scope.where(status: %w[asr_done finalized])
    end

    limit = (params[:limit] || 200).to_i.clamp(1, 1000)
    scope = scope.order(started_at: :desc).limit(limit)

    render json: scope.map { |tx|
      {
        id: tx.id,
        object_key: tx.object_key,
        channel_label: tx.channel_label,
        freq_hz: tx.freq_hz,
        started_at: tx.started_at,
        status: tx.status,
        asr_text: tx.asr_text,
        final_text: tx.final_text
      }
    }
  end

  # GET /api/clips/:id
  def show
    tx = Transmission.find(params[:id])

    render json: {
      id: tx.id,
      object_key: tx.object_key,
      channel_label: tx.channel_label,
      freq_hz: tx.freq_hz,
      started_at: tx.started_at,
      status: tx.status,
      asr_text: tx.asr_text,
      final_text: tx.final_text
    }
  end

  # PATCH /api/clips/:id
  # Body: { final_text: "...", status: "finalized" }
  def update
    tx = Transmission.find(params[:id])

    tx.final_text = params[:final_text] if params.key?(:final_text)
    tx.status = params[:status] if params.key?(:status)
    tx.finalized_at = Time.current if tx.status == "finalized" && tx.final_text.present?
    tx.save!

    render json: {
      id: tx.id,
      status: tx.status,
      final_text: tx.final_text,
      finalized_at: tx.finalized_at
    }
  end

  # GET /api/clips/:id/audio
  def audio
    tx = Transmission.find(params[:id])

    # you can add simple guards here:
    # head :not_found and return unless tx.object_key&.end_with?(".mp3")

    url = R2.presigned_url(tx.object_key, expires_in: 600)
    render json: { audio_url: url }
  end
end
