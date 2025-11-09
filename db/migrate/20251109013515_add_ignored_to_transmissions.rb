class AddIgnoredToTransmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :transmissions, :ignored, :boolean, default: false, null: false
    add_index  :transmissions, :ignored
  end
end
