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

    if params[:channel].present?
      scope = scope.where(channel_label: params[:channel])
    end

    per = (params[:per] || params[:limit] || 50).to_i.clamp(1, 1000)
    scope = scope.order(started_at: :desc)
    pagy_obj, records = pagy(scope, limit: per)

    from = pagy_obj.count.positive? ? (pagy_obj.page - 1) * pagy_obj.limit + 1 : 0
    to = pagy_obj.count.positive? ? [ pagy_obj.page * pagy_obj.limit, pagy_obj.count ].min : 0

    render json: {
      items: records.map { |tx|
        {
          id: tx.id,
          object_key: tx.object_key,
          channel_label: tx.channel_label,
          freq_hz: tx.freq_hz,
          started_at: tx.started_at,
          duration_sec: tx.duration_sec,
          status: tx.status,
          asr_text: tx.asr_text,
          final_text: tx.final_text
        }
      },
      meta: {
        count: pagy_obj.count,
        page: pagy_obj.page,
        limit: pagy_obj.limit,
        pages: pagy_obj.pages,
        previous: pagy_obj.previous,
        next: pagy_obj.next,
        from: from,
        to: to
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
      duration_sec: tx.duration_sec,
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
