class AddAsrMetricsToTransmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :transmissions, :asr_compression_ratio, :float
    add_column :transmissions, :asr_no_speech_prob, :float
    add_column :transmissions, :asr_speech_ratio, :float
    add_column :transmissions, :asr_error, :text
    rename_column :transmissions, :asr_confidence, :asr_avg_logprob

    # Helpful indexes for filtering / analytics
    add_index :transmissions, :asr_model
    add_index :transmissions, :asr_avg_logprob
    add_index :transmissions, :asr_speech_ratio
  end
end
