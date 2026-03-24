import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function createR2Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(`R2 credentials missing: R2_ACCESS_KEY_ID=${!!accessKeyId} R2_SECRET_ACCESS_KEY=${!!secretAccessKey}`);
  }
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId, secretAccessKey },
  });
}

let _r2Client: S3Client | null = null;
export const r2Client = new Proxy({} as S3Client, {
  get(_target, prop) {
    if (!_r2Client) _r2Client = createR2Client();
    return (_r2Client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export async function getPresignedUploadUrl(
  filename: string,
  userId: string,
  expiresIn = 3600
): Promise<PresignedUploadResult> {
  if (!filename) throw new Error("filename is required");
  if (!userId) throw new Error("userId is required");

  const ext = filename.split(".").pop() ?? "mp4";
  const key = `uploads/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: `video/${ext}`,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  const publicUrl = `${process.env.R2_ENDPOINT}/${R2_BUCKET}/${key}`;

  return { uploadUrl, key, publicUrl };
}
