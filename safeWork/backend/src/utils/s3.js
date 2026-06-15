const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require("../config/environment");

const s3Client = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const generateUploadUrl = async ({ profileId, docType, fileName, contentType }) => {
  const sanitisedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  const s3Key = `safework/employees/${profileId}/${docType}/${Date.now()}_${sanitisedFileName}`;

  const command = new PutObjectCommand({
    Bucket: config.s3.bucketName,
    Key: s3Key,
    ContentType: contentType || "application/octet-stream",
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 300,
  });

  return {
    uploadUrl,
    s3Key,
  };
};

const generateDownloadUrl = async (s3Key) => {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucketName,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 900,
  });
};

module.exports = {
  generateUploadUrl,
  generateDownloadUrl,
};