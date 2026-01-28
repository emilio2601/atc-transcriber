class Api::ChannelsController < ApplicationController
  protect_from_forgery with: :null_session

  # GET /api/channels
  def index
    rows = Transmission
      .select("channel_label, MIN(freq_hz) AS freq_hz")
      .group(:channel_label)
      .order(:channel_label)

    render json: {
      channels: rows.map(&:channel_label),
      items: rows.map { |r|
        {
          id: r.channel_label,
          label: r.channel_label,
          freq_hz: r.freq_hz
        }
      }
    }
  end
end
