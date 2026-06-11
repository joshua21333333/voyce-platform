import { Resend } from 'resend'
import { generateApprovalToken } from './tokens'

export const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM ?? 'Voyce <drafts@voyce.ai>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function approvalUrl(contentItemId: string, action: 'approve' | 'revise' | 'hold'): string {
  const token = generateApprovalToken(contentItemId, action)
  return `${APP_URL}/api/approvals/${token}`
}

// ─── Draft delivery email ──────────────────────────────────────────────────────

export async function sendDraftEmail({
  to,
  clientName,
  contentItemId,
  contentType,
  preview,
  fullDraftText,
}: {
  to: string
  clientName: string
  contentItemId: string
  contentType: string
  preview: string
  fullDraftText: string
}) {
  const approveUrl = approvalUrl(contentItemId, 'approve')
  const reviseUrl = approvalUrl(contentItemId, 'revise')
  const holdUrl = approvalUrl(contentItemId, 'hold')

  await resend.emails.send({
    from: FROM,
    to,
    replyTo: process.env.EMAIL_REPLY_TO,
    subject: `Your ${contentType} draft is ready for review`,
    html: draftEmailHtml({
      clientName,
      contentType,
      fullDraftText,
      preview,
      approveUrl,
      reviseUrl,
      holdUrl,
    }),
  })
}

// ─── Discovery Mode email — 3 style variants ──────────────────────────────────

export async function sendDiscoveryEmail({
  to,
  clientName,
  contentItemId,
  variants,
}: {
  to: string
  clientName: string
  contentItemId: string
  variants: Array<{ label: string; draft: string }>
}) {
  const approveUrl = (label: string) =>
    `${approvalUrl(contentItemId, 'approve')}&variant=${encodeURIComponent(label)}`
  const reviseUrl = approvalUrl(contentItemId, 'revise')

  await resend.emails.send({
    from: FROM,
    to,
    replyTo: process.env.EMAIL_REPLY_TO,
    subject: `3 style drafts for you to choose from — which one sounds like you?`,
    html: discoveryEmailHtml({ clientName, variants, approveUrl, reviseUrl }),
  })
}

// ─── Welcome email ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail({ to, clientName }: { to: string; clientName: string }) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to Voyce — here's what happens next`,
    html: welcomeEmailHtml({ clientName }),
  })
}

// ─── Follow-up email (48hr nudge) ─────────────────────────────────────────────

export async function sendFollowUpEmail({
  to,
  clientName,
  contentItemId,
  contentType,
  preview,
}: {
  to: string
  clientName: string
  contentItemId: string
  contentType: string
  preview: string
}) {
  const approveUrl = approvalUrl(contentItemId, 'approve')
  const reviseUrl = approvalUrl(contentItemId, 'revise')

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Quick reminder — your ${contentType} draft is still waiting`,
    html: followUpEmailHtml({ clientName, contentType, preview, approveUrl, reviseUrl }),
  })
}

// ─── Hold recommendation email ────────────────────────────────────────────────

export async function sendHoldRecommendationEmail({
  to,
  clientName,
  contentItemId,
  contentType,
  holdReason,
}: {
  to: string
  clientName: string
  contentItemId: string
  contentType: string
  holdReason: string
}) {
  const approveUrl = approvalUrl(contentItemId, 'approve')
  const holdUrl = approvalUrl(contentItemId, 'hold')

  await resend.emails.send({
    from: FROM,
    to,
    subject: `We recommend holding your ${contentType} — here's why`,
    html: holdEmailHtml({ clientName, contentType, holdReason, approveUrl, holdUrl }),
  })
}

// ─── HTML templates ───────────────────────────────────────────────────────────

const baseStyle = `
  font-family: 'DM Mono', monospace;
  background: #FAF7F2;
  color: #1a1a1a;
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 32px;
`

const buttonBase = `
  display: inline-block;
  padding: 12px 24px;
  border-radius: 4px;
  text-decoration: none;
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  font-weight: 500;
  margin: 8px 8px 8px 0;
`

function draftEmailHtml({
  clientName,
  contentType,
  fullDraftText,
  preview: _preview,
  approveUrl,
  reviseUrl,
  holdUrl,
}: {
  clientName: string
  contentType: string
  fullDraftText: string
  preview: string
  approveUrl: string
  reviseUrl: string
  holdUrl: string
}): string {
  return `<!DOCTYPE html><html><body style="${baseStyle}">
    <p style="color:#C8A95A;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:32px;">VOYCE</p>
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:600;margin-bottom:8px;">Your ${contentType} draft is ready</h1>
    <p style="color:#666;margin-bottom:32px;">Hi ${clientName}, your draft is below. Approve it, request a revision, or hold it if the timing isn't right.</p>
    <div style="background:#fff;border:1px solid #e8e0d4;border-radius:6px;padding:28px;margin-bottom:32px;white-space:pre-wrap;font-size:14px;line-height:1.7;">${fullDraftText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div style="margin-bottom:40px;">
      <a href="${approveUrl}" style="${buttonBase}background:#C8A95A;color:#fff;">Approve &amp; publish</a>
      <a href="${reviseUrl}" style="${buttonBase}background:#fff;color:#1a1a1a;border:1px solid #1a1a1a;">Request revision</a>
      <a href="${holdUrl}" style="${buttonBase}background:#fff;color:#666;border:1px solid #e0d8cc;">Hold for now</a>
    </div>
    <p style="color:#999;font-size:11px;">Questions? Reply to this email.</p>
  </body></html>`
}

function discoveryEmailHtml({
  clientName,
  variants,
  approveUrl,
  reviseUrl,
}: {
  clientName: string
  variants: Array<{ label: string; draft: string }>
  approveUrl: (label: string) => string
  reviseUrl: string
}): string {
  const variantHtml = variants
    .map(
      (v) => `
      <div style="background:#fff;border:1px solid #e8e0d4;border-radius:6px;padding:24px;margin-bottom:20px;">
        <p style="color:#C8A95A;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px;">${v.label}</p>
        <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;margin-bottom:16px;">${v.draft.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <a href="${approveUrl(v.label)}" style="${buttonBase}background:#C8A95A;color:#fff;font-size:12px;">This one — publish it</a>
      </div>`,
    )
    .join('')

  return `<!DOCTYPE html><html><body style="${baseStyle}">
    <p style="color:#C8A95A;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:32px;">VOYCE — VOICE DISCOVERY</p>
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:600;margin-bottom:8px;">Which one sounds most like you?</h1>
    <p style="color:#666;margin-bottom:32px;">Hi ${clientName}, we don't have enough of your writing yet to match your voice precisely. Here are three style directions — pick the one that's closest and we'll calibrate from there.</p>
    ${variantHtml}
    <p style="color:#666;font-size:13px;margin-bottom:8px;">None of these feel right?</p>
    <a href="${reviseUrl}" style="${buttonBase}background:#fff;color:#1a1a1a;border:1px solid #1a1a1a;font-size:12px;">Send feedback instead</a>
    <p style="color:#999;font-size:11px;margin-top:32px;">Your selection helps us calibrate. After 3–4 approved pieces, drafts will match your voice automatically.</p>
  </body></html>`
}

function welcomeEmailHtml({ clientName }: { clientName: string }): string {
  return `<!DOCTYPE html><html><body style="${baseStyle}">
    <p style="color:#C8A95A;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:32px;">VOYCE</p>
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:600;margin-bottom:16px;">You're set up, ${clientName}.</h1>
    <p style="margin-bottom:16px;">Here's what happens next:</p>
    <ol style="padding-left:20px;line-height:2;">
      <li>We're building your Brand Intelligence Layer from your onboarding responses</li>
      <li>Your first draft will arrive in your inbox within 24 hours</li>
      <li>Review it, approve it or ask for changes — we handle the rest</li>
    </ol>
    <p style="margin-top:32px;color:#666;">Questions? Reply to this email.</p>
  </body></html>`
}

function followUpEmailHtml({
  clientName,
  contentType,
  preview,
  approveUrl,
  reviseUrl,
}: {
  clientName: string
  contentType: string
  preview: string
  approveUrl: string
  reviseUrl: string
}): string {
  return `<!DOCTYPE html><html><body style="${baseStyle}">
    <p style="color:#C8A95A;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:32px;">VOYCE</p>
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:600;margin-bottom:16px;">Your ${contentType} is still waiting</h1>
    <p style="color:#666;margin-bottom:24px;">Hi ${clientName}, this draft has been in your queue for 48 hours. One tap to approve or send feedback.</p>
    <div style="background:#fff;border-left:3px solid #C8A95A;padding:16px 20px;margin-bottom:28px;color:#555;font-size:13px;line-height:1.6;">${preview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}&hellip;</div>
    <a href="${approveUrl}" style="${buttonBase}background:#C8A95A;color:#fff;">Approve &amp; publish</a>
    <a href="${reviseUrl}" style="${buttonBase}background:#fff;color:#1a1a1a;border:1px solid #1a1a1a;">Request revision</a>
  </body></html>`
}

function holdEmailHtml({
  clientName,
  contentType,
  holdReason,
  approveUrl,
  holdUrl,
}: {
  clientName: string
  contentType: string
  holdReason: string
  approveUrl: string
  holdUrl: string
}): string {
  return `<!DOCTYPE html><html><body style="${baseStyle}">
    <p style="color:#C8A95A;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:32px;">VOYCE</p>
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:600;margin-bottom:16px;">We recommend holding this one</h1>
    <p style="color:#666;margin-bottom:16px;">Hi ${clientName}, your ${contentType} draft is ready — but we've flagged a timing concern before publishing.</p>
    <div style="background:#fff;border:1px solid #e8e0d4;border-radius:6px;padding:20px;margin-bottom:28px;">
      <p style="font-size:11px;color:#C8A95A;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Why we recommend holding</p>
      <p style="font-size:14px;line-height:1.6;">${holdReason.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    </div>
    <p style="color:#666;font-size:13px;margin-bottom:16px;">You decide — publish it anyway or confirm the hold.</p>
    <a href="${approveUrl}" style="${buttonBase}background:#fff;color:#1a1a1a;border:1px solid #1a1a1a;">Publish anyway</a>
    <a href="${holdUrl}" style="${buttonBase}background:#C8A95A;color:#fff;">Confirm hold</a>
  </body></html>`
}
