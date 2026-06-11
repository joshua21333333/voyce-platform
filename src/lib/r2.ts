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

export function contentKey(clientId: string, contentItemId: string): string {
  return `content/${clientId}/${contentItemId}.md`
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
