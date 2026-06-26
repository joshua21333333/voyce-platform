// Minimal Buffer client. Social scheduling for the platforms Buffer fronts
// (LinkedIn, X, Instagram, Facebook, etc.). Access tokens are stored encrypted per
// client (see src/lib/crypto.ts) and decrypted only at publish time.
//
// Uses Buffer's update-create endpoint. `now: true` publishes immediately; otherwise
// the post enters the client's Buffer queue. The returned update id is stored on the
// content item so post-failure webhooks can be correlated back to the draft.

const BUFFER_API_BASE = process.env.BUFFER_API_BASE ?? 'https://api.bufferapp.com/1'
const BUFFER_OAUTH_AUTHORIZE = process.env.BUFFER_OAUTH_AUTHORIZE ?? 'https://bufferapp.com/oauth2/authorize'

export function bufferConfigured(): boolean {
  return Boolean(process.env.BUFFER_CLIENT_ID && process.env.BUFFER_CLIENT_SECRET && process.env.BUFFER_REDIRECT_URI)
}

// Step 1 — URL the client is sent to in order to authorize Voyce.
export function bufferAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.BUFFER_CLIENT_ID ?? '',
    redirect_uri: process.env.BUFFER_REDIRECT_URI ?? '',
    response_type: 'code',
    state,
  })
  return `${BUFFER_OAUTH_AUTHORIZE}?${params.toString()}`
}

// Step 2 — exchange the returned code for an access token.
export async function exchangeBufferCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.BUFFER_CLIENT_ID ?? '',
    client_secret: process.env.BUFFER_CLIENT_SECRET ?? '',
    redirect_uri: process.env.BUFFER_REDIRECT_URI ?? '',
    code,
    grant_type: 'authorization_code',
  })
  const res = await fetch(`${BUFFER_API_BASE}/oauth2/token.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new BufferError(`Token exchange failed: ${res.status}`, res.status)
  }
  const json = (await res.json().catch(() => null)) as { access_token?: string } | null
  if (!json?.access_token) throw new BufferError('Token exchange returned no access_token')
  return json.access_token
}

export interface BufferProfile {
  id: string
  service: string
  formattedUsername: string
}

// Step 3 — list the channels this token can post to.
export async function fetchBufferProfiles(accessToken: string): Promise<BufferProfile[]> {
  const res = await fetch(`${BUFFER_API_BASE}/profiles.json?access_token=${encodeURIComponent(accessToken)}`)
  if (!res.ok) throw new BufferError(`Could not load Buffer profiles: ${res.status}`, res.status)
  const json = (await res.json().catch(() => [])) as Array<{ id?: string; service?: string; formatted_username?: string }>
  return json
    .filter((p): p is { id: string; service?: string; formatted_username?: string } => Boolean(p.id))
    .map((p) => ({ id: p.id, service: p.service ?? 'unknown', formattedUsername: p.formatted_username ?? '' }))
}

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
