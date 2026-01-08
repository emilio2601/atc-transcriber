# app/controllers/api/ingest_controller.rb
class Api::IngestController < ApplicationController
  protect_from_forgery with: :null_session
  before_action :authenticate_worker!

  # POST /api/ingest
  #
  # JSON body:
  # {
  #   "object_key": "2025/01/08/JFK_135.900_Dep_20250108_142345_135900000.mp3",
  #   "size_bytes": 45678,    # optional - will fetch from R2 if not provided
  #   "duration_sec": 12.5    # optional - recommended to provide from Pi's ffprobe
  # }
  #
  # Response:
  #   201 Created: { "ok": true, "id": 123, "created": true }
  #   200 OK: { "ok": true, "id": 123, "created": false }  # already existed
  #   422 Unprocessable: { "error": "invalid_object_key", "message": "..." }
  #
  def create
    object_key = params[:object_key].to_s.strip

    if object_key.blank?
      render json: { error: "missing_object_key" }, status: :unprocessable_entity
      return
    end

    # Only accept .mp3 files
    unless object_key.end_with?(".mp3")
      render json: {
        error: "invalid_object_key",
        message: "Only .mp3 files are accepted"
      }, status: :unprocessable_entity
      return
    end

    # Check if already exists (idempotent)
    existing = Transmission.find_by(object_key: object_key)
    if existing
      render json: { ok: true, id: existing.id, created: false }, status: :ok
      return
    end

    # Parse object key
    begin
      attrs = Transmission.parse_object_key(object_key)
    rescue => e
      render json: {
        error: "invalid_object_key",
        message: e.message
      }, status: :unprocessable_entity
      return
    end

    # Get size_bytes (from params or R2)
    size_bytes = params[:size_bytes].to_i
    if size_bytes <= 0
      size_bytes = fetch_size_from_r2(object_key)
      unless size_bytes
        render json: {
          error: "not_found_in_r2",
          message: "File not found in R2 and size_bytes not provided"
        }, status: :not_found
        return
      end
    end

    # Get duration_sec if provided (recommended from Pi's ffprobe)
    duration_sec = params[:duration_sec].presence&.to_f

    # Create transmission
    tx = Transmission.create!(
      object_key:    object_key,
      channel_label: attrs[:channel_label],
      freq_hz:       attrs[:freq_hz],
      started_at:    attrs[:started_at],
      duration_sec:  duration_sec,
      size_bytes:    size_bytes,
      status:        "pending_asr"
    )

    log_msg = "Ingested #{object_key} (id=#{tx.id}, size=#{size_bytes} bytes"
    log_msg += ", duration=#{duration_sec.round(3)}s" if duration_sec
    log_msg += ")"
    Rails.logger.info log_msg

    render json: { ok: true, id: tx.id, created: true }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: {
      error: "validation_failed",
      message: e.message
    }, status: :unprocessable_entity
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

  def fetch_size_from_r2(object_key)
    client = R2.client
    bucket = R2.bucket

    resp = client.head_object(bucket: bucket, key: object_key)
    resp.content_length
  rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchKey
    nil
  rescue => e
    Rails.logger.error "Error fetching size for #{object_key}: #{e.class}: #{e.message}"
    nil
  end
end
