import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

const BUCKET = process.env.R2_BUCKET_NAME ?? 'voyce-content'

// Content objects are immutable and versioned. A revision writes a NEW object
// (v2, v3, …) rather than overwriting v1, so prior versions remain retrievable and
// the revision history is reconstructable from storage.
export function contentKey(clientId: string, contentItemId: string, version = 1): string {
  return `content/${clientId}/${contentItemId}/v${version}.md`
}

export async function putContent(key: string, body: string): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: 'text/markdown; charset=utf-8',
    }),
  )
}

export async function getContent(key: string): Promise<string> {
  const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  return res.Body?.transformToString() ?? ''
}

export async function signedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn })
}
