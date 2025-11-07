class Api::ClipsController < ApplicationController
  protect_from_forgery with: :null_session

  # GET /api/clips
  # Optional:
  #   ?status=asr_done
  #   ?limit=50
  def index
    scope = Transmission.all

    if params[:status].present?
      scope = scope.where(status: params[:status])
    else
      # by default, show things that at least have ASR text
      scope = scope.where(status: %w[asr_done finalized])
    end

    limit = (params[:limit] || 50).to_i.clamp(1, 500)
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
end
