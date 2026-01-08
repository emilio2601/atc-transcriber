# app/controllers/concerns/api_authentication.rb
#
# Mixed authentication for API endpoints:
# - Bearer token auth for scripts/workers (ASR_WORKER_TOKEN)
# - Session auth for frontend (user_id in session)
#
module ApiAuthentication
  extend ActiveSupport::Concern

  private

  def authenticate_api!
    # Try token auth first (for scripts)
    if bearer_token_present?
      authenticate_with_token!
    # Fall back to session auth (for frontend)
    elsif logged_in?
      true
    else
      render json: { error: "unauthorized" }, status: :unauthorized
    end
  end

  def bearer_token_present?
    request.authorization.to_s.start_with?("Bearer ")
  end

  def authenticate_with_token!
    token = request.authorization.to_s.sub(/^Bearer\s+/i, "")
    expected = ENV["ASR_WORKER_TOKEN"].to_s

    if expected.empty? || token != expected
      render json: { error: "unauthorized" }, status: :unauthorized
      return false
    end

    true
  end
end
