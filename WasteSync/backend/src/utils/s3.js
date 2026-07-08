const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config/environment');

// One shared S3 client for the whole app. The configuration here is IDENTICAL
// to SafeWork's so both apps behave the same way against AWS.
// The bucket must live in an EEA region (eu-central-1 / Frankfurt) for GDPR.
const s3Client = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// Builds the S3 "folder path" (key) for a generated report file.
// Layout: wastesync/{tenantId}/{companyId}/reports/{year}/{timestamp}_{name}
// Organising by tenant then company keeps every customer's data clearly
// separated inside the bucket, which helps audits and access reviews.
const buildReportKey = ({ tenantId, companyId, year, fileName }) => {
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `wastesync/${tenantId}/${companyId}/reports/${year}/${Date.now()}_${safeName}`;
};

// Uploads a file we generated on the server (XML or PDF report) straight to S3.
// Unlike SafeWork's document flow (where the browser uploads), WasteSync builds
// these files itself, so we PUT the bytes directly. Returns the stored key.
const uploadBuffer = async ({ key, body, contentType }) => {
  const command = new PutObjectCommand({
    Bucket: config.s3.bucketName,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    // Server-side encryption at rest (AES-256) for every stored report.
    ServerSideEncryption: 'AES256',
  });

  await s3Client.send(command);
  return key;
};

// Creates a short-lived link the browser can use to download a stored report
// directly from S3. The link expires in 15 minutes so it cannot be shared or
// reused later. The bucket itself stays private — no public access ever.
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
  buildReportKey,
  uploadBuffer,
  generateDownloadUrl,
};
