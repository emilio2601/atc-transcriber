class SpaController < ApplicationController
  def index
    @logged_in = logged_in?
    @current_user_email = current_user&.email
  end
end
