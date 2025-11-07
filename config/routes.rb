Rails.application.routes.draw do
  namespace :api do
    namespace :asr do
      post "next",   to: "jobs#next_job"
      post "result", to: "jobs#submit_result"
    end

    # Public-ish API for your UI
    resources :clips, only: [ :index, :show, :update ]
  end

  mount MissionControl::Jobs::Engine, at: "/jobs"

  root "spa#index"
  get "*path", to: "spa#index", constraints: ->(req) { !req.xhr? && req.format.html? }
end
