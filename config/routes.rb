Rails.application.routes.draw do
  get  "/login",  to: "sessions#new"
  post "/login",  to: "sessions#create"
  delete "/logout", to: "sessions#destroy"

  namespace :api do
    namespace :asr do
      post "next",   to: "jobs#next_job"
      post "result", to: "jobs#submit_result"
      get "sample", to: "jobs#sample"
    end

    # Ingest endpoint for Pi uploader
    post "ingest", to: "ingest#create"

    # Public-ish API for your UI
    resources :clips, only: [ :index, :show, :update ] do
      member do
        get :audio
      end
    end
    resources :channels, only: [ :index ]
  end

  mount MissionControl::Jobs::Engine, at: "/jobs"

  root "spa#index"
  get "*path", to: "spa#index", constraints: ->(req) { !req.xhr? && req.format.html? }
end
