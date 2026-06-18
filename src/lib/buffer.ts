// Minimal Buffer client. Social scheduling for the platforms Buffer fronts
// (LinkedIn, X, Instagram, Facebook, etc.). Access tokens are stored encrypted per
// client (see src/lib/crypto.ts) and decrypted only at publish time.
//
// Uses Buffer's update-create endpoint. `now: true` publishes immediately; otherwise
// the post enters the client's Buffer queue. The returned update id is stored on the
// content item so post-failure webhooks can be correlated back to the draft.

const BUFFER_API_BASE = process.env.BUFFER_API_BASE ?? 'https://api.bufferapp.com/1'

export interface BufferUpdateResult {
  id: string
  publishedUrl?: string
}

export class BufferError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'BufferError'
  }
}

export async function createBufferUpdate({
  accessToken,
  profileId,
  text,
  now = false,
}: {
  accessToken: string
  profileId: string
  text: string
  now?: boolean
}): Promise<BufferUpdateResult> {
  const body = new URLSearchParams()
  body.set('access_token', accessToken)
  body.append('profile_ids[]', profileId)
  body.set('text', text)
  if (now) body.set('now', 'true')

  let res: Response
  try {
    res = await fetch(`${BUFFER_API_BASE}/updates/create.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch (err) {
    throw new BufferError(`Buffer request failed: ${(err as Error).message}`)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new BufferError(`Buffer returned ${res.status}: ${detail.slice(0, 200)}`, res.status)
  }

  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; updates?: Array<{ id: string }>; message?: string }
    | null

  if (!json?.success || !json.updates?.length) {
    throw new BufferError(`Buffer rejected the update: ${json?.message ?? 'unknown error'}`)
  }

  return { id: json.updates[0].id }
}
