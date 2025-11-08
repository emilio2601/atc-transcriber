class ApplicationController < ActionController::Base
  include Pagy::Method
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern
  protect_from_forgery with: :exception
  helper_method :current_user, :logged_in?
  rescue_from StandardError, with: :log_and_reraise

  private

  def current_user
    @current_user ||= User.find_by(id: session[:user_id]) if session[:user_id]
  end

  def logged_in?
    current_user.present?
  end

  def require_login
    return if logged_in?

    respond_to do |format|
      format.html { redirect_to login_path, alert: "Please sign in." }
      format.json { render json: { error: "unauthorized" }, status: :unauthorized }
    end
  end

  def append_info_to_payload(payload)
    super
    payload[:request_id] = request.request_id
    payload[:remote_ip]  = request.remote_ip
    payload[:user_id]    = current_user&.id if respond_to?(:current_user, true)
  end

  def log_and_reraise(exception)
    Rails.logger.error(
      at: "exception",
      error_class: exception.class.name,
      error: exception.message,
      backtrace: exception.backtrace&.take(10).join(" | "),
      request_id: request.request_id,
      user_id: try(:current_user)&.id,
      path: request.fullpath,
      params: request.filtered_parameters.except("password", "token")
    )

    raise exception
  end
end
