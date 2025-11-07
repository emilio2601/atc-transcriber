require "open3"
require "json"

class TransmissionDurationJob < ApplicationJob
  queue_as :default

  BATCH_SIZE = 100

  def perform(limit: nil)
    # Resolve ffprobe once per job run; exit early if unavailable
    @ffprobe_path = which_ffprobe
    unless @ffprobe_path
      Rails.logger.error "[TransmissionDurationJob] Aborting: ffprobe not available"
      return
    end

    scope = Transmission.where(duration_sec: nil)
    scope = scope.limit(limit) if limit

    scope.find_in_batches(batch_size: BATCH_SIZE) do |batch|
      batch.each do |transmission|
        process_transmission(transmission)
      end
    end
  end

  private

  def process_transmission(transmission)
    url = R2.presigned_url(transmission.object_key, expires_in: 600)
    duration = probe_duration(url)
    if duration
      transmission.update!(duration_sec: duration)
      Rails.logger.info "[TransmissionDurationJob] Updated #{transmission.object_key} duration=#{duration.round(3)}s"
    else
      Rails.logger.warn "[TransmissionDurationJob] Could not determine duration for #{transmission.object_key}"
    end
  rescue => e
    Rails.logger.error "[TransmissionDurationJob] Error processing #{transmission.object_key}: #{e.class}: #{e.message}"
  end

  def probe_duration(url)
    ffprobe = @ffprobe_path || which_ffprobe
    return nil unless ffprobe

    cmd = [
      ffprobe,
      "-v", "error",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      url
    ]

    stdout, _stderr, status = Open3.capture3(*cmd)
    return nil unless status.success?

    data = JSON.parse(stdout)

    duration = nil
    if data["format"] && data["format"]["duration"]
      duration = data["format"]["duration"].to_f
    end

    if (!duration || duration <= 0.0) && data["streams"].is_a?(Array)
      audio_stream = data["streams"].find { |s| s["codec_type"] == "audio" && s["duration"] }
      duration = audio_stream["duration"].to_f if audio_stream
    end

    return nil if !duration || duration.nan? || duration.infinite? || duration <= 0.0
    duration
  rescue JSON::ParserError
    nil
  end

  def which_ffprobe
    return @ffprobe_path if defined?(@ffprobe_path) && @ffprobe_path

    env_path = ENV["FFPROBE_PATH"]
    if env_path && !env_path.empty? && File.executable?(env_path)
      @ffprobe_path = env_path
      return @ffprobe_path
    end

    path_env = ENV["PATH"] || ""
    path_env.split(File::PATH_SEPARATOR).each do |dir|
      candidate = File.join(dir, "ffprobe")
      if File.executable?(candidate)
        @ffprobe_path = candidate
        return @ffprobe_path
      end
    end

    Rails.logger.error "[TransmissionDurationJob] ffprobe not found on PATH"
    nil
  end
end
