Rails.application.routes.draw do


  # SPA shell
  root "spa#index"
  get "*path", to: "spa#index", constraints: ->(req) { !req.xhr? && req.format.html? }
end
