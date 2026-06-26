// Ops alerting. Posts to ALERT_WEBHOOK_URL (Slack- or Discord-compatible) when a run
// fails or escalates, so failures are not silently buried in logs. Falls back to
// console.error when no webhook is configured — never throws into the caller.
export async function alertOps(event: string, detail: Record<string, unknown> = {}): Promise<void> {
  const line = `[Voyce] ${event} ${JSON.stringify(detail)}`
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url) {
    console.error(line)
    return
  }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` for Slack, `content` for Discord — harmless extra key for each.
      body: JSON.stringify({ text: line, content: line }),
    })
  } catch (err) {
    console.error('[alert] webhook failed', err, line)
  }
}
