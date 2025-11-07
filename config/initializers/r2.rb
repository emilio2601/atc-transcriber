require "aws-sdk-s3"

module R2
  def self.client
    @client ||= Aws::S3::Client.new(
      endpoint:         ENV.fetch("R2_ENDPOINT"),
      region:           "auto",
      force_path_style: true,
      credentials:      Aws::Credentials.new(
        ENV.fetch("R2_ACCESS_KEY_ID"),
        ENV.fetch("R2_SECRET_ACCESS_KEY")
      )
    )
  end

  def self.bucket
    ENV.fetch("R2_BUCKET")
  end

  def self.prefix
    ENV.fetch("R2_PREFIX", "")
  end

  def self.presigned_url(object_key, expires_in: 600)
    presigner = Aws::S3::Presigner.new(client: client)
    presigner.presigned_url(
      :get_object,
      bucket: bucket,
      key: object_key,
      expires_in: expires_in
    )
  end
end
