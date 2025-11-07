class CreateTransmissions < ActiveRecord::Migration[8.1]
  def change
    create_table :transmissions do |t|
      t.string  :object_key,    null: false
      t.string  :channel_label, null: false
      t.integer :freq_hz,       null: false
      t.datetime :started_at,   null: false

      t.float   :duration_sec
      t.bigint  :size_bytes

      t.string  :status, null: false, default: "pending_asr"

      t.string  :asr_model
      t.text    :asr_text
      t.float   :asr_confidence
      t.datetime :asr_completed_at

      t.text :final_text
      t.datetime :finalized_at

      t.timestamps
    end

    add_index :transmissions, :object_key, unique: true
    add_index :transmissions, :status
    add_index :transmissions, [ :channel_label, :started_at ]
  end
end
