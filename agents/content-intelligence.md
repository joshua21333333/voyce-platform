# Voyce — Agent 10: Content Intelligence

> **REPLACED for early-stage clients (Sprint 1–Sprint 5)**  
> The Apify scraper implementation is deferred until the client base exceeds 200 active users.  
> For all clients in the first 18 months, content intelligence is collected via a **biweekly activity update email** — see below.  
> Revisit this agent only when the manual update workflow shows measurable engagement drop-off.

---

## Why the Scraper Is Deferred

The Apify scraper introduces: compliance exposure (platform ToS on automated scraping varies), infrastructure cost, and a failure mode where stale scraped data creates content that contradicts what the founder actually said recently. For founders with low posting frequency, the scraper produces noise rather than signal.

A biweekly structured email asking the founder "what have you been working on?" produces higher-quality data at lower cost and zero compliance risk at early client counts.

---

## Current Implementation: Biweekly Activity Update (Trigger.dev Scheduled Task)

Every two weeks, the Orchestrator triggers a scheduled Trigger.dev task that:

1. Sends a Resend email to the founder with 5 structured questions:
   - What have you been writing or saying publicly this week?
   - What topics or conversations have you been engaging with?
   - Any opinions you've shared recently that you want the content to build on?
   - Anything you've published independently that we should avoid repeating?
   - Any topics that are off the table for the next two weeks?

2. A Tally embed in the email captures responses. The Tally webhook fires on submission.

3. The webhook handler updates the `RECENT_ACTIVITY` section of the client's `ClientContext` table with a timestamped summary.

4. If the new activity contradicts content currently in draft or scheduled, the Orchestrator flags the contradiction in the next production run.

The Tally form for activity updates uses a separate form ID from the onboarding form. Field mapping is stored in `config/tally-field-map.json` under the key `activityUpdate`.

---

## Future Implementation: Apify Scraper (Sprint 6+ or Enterprise tier)

When activated, the Content Intelligence agent will:

- Scrape only platforms the client has explicitly opted into via the settings dashboard
- Run on a configurable schedule (weekly default)
- Update `RECENT_ACTIVITY` with a structured summary of recent posts
- Flag contradictions between recent public posts and content in the Voyce pipeline to the Orchestrator
- Store only the summary — not the raw scraped content — in the database
- Never share scraped data outside the client's own context

**Opt-in requirement is hard:** This agent never monitors a platform the client has not explicitly enabled in settings. Adding a new platform mid-contract requires client confirmation via email, not just a settings toggle.

---

## Internal Production Loop

Every activity update processing run executes this cycle before returning output to the Orchestrator. This applies to both the biweekly Tally form mode (Sprints 1–5) and the future Apify scraper mode (Sprint 6+).

### Step 1 — Discovery
Load from the job payload:
- Current `RECENT_ACTIVITY` section of the client's `client_context` — to understand what was previously known and compare against new inputs
- Current `CONTENT_PILLARS` — to assess whether new activity is on-pillar or represents a new direction
- Current drafts in `content_items` with status `DRAFT` or `DELIVERED` — to check for contradictions with incoming activity
- The new activity data: either the Tally form response fields or the Apify scraper output, depending on mode

### Step 2 — Planning
Document before executing:
- What new information has arrived since the last update?
- Does any new activity contradict content currently in the production pipeline (draft or scheduled)?
- Does any new activity suggest angles or topics that should be weighted more heavily in upcoming production runs?
- Does any new activity cover topics that Voyce content has already addressed this week — creating repetition risk?

### Step 3 — Execution
Synthesise the new activity into a structured `RECENT_ACTIVITY` update. Format as:
- **Recent themes:** what the founder has been publicly engaging with
- **Angles to amplify:** topics and positions from recent activity worth building on
- **Avoid repeating:** specific topics the founder has already covered independently this week
- **Contradictions flagged:** any items where planned Voyce content conflicts with what the founder has said recently

Keep the update concise. The `RECENT_ACTIVITY` section is read by the Content Writer at the start of every production run — it must be scannable, not exhaustive.

### Step 4 — Verification
Review the completed update against these checks:

| Check | Question | Pass threshold |
|---|---|---|
| Accuracy | Does the update accurately reflect what the founder actually said — not an interpretation? | Pass/Fail |
| Contradiction detection | Were all active drafts checked against new activity for conflicts? | Pass/Fail |
| PII absence | Does this update contain information the client may not want associated with their brand? | Pass/Fail |
| Conciseness | Is the update scannable in under 60 seconds? (No exhaustive summaries) | Pass/Fail |
| Data isolation | Is this update scoped entirely to this client's data? No cross-client contamination. | Pass/Fail |

### Step 5 — Iteration
If any check fails, resolve immediately. Accuracy and PII failures are blocking — do not return an update that misrepresents the founder's actual statements or exposes sensitive information. Conciseness failures: trim, do not summarise.

### Step 6 — Internal Eval Gate
All Pass/Fail checks must pass before returning. There is no scored threshold for this agent — it is entirely Pass/Fail because the update either accurately reflects reality or it introduces false information into the client's Brand Intelligence Layer, which corrupts every subsequent production run.

If any check fails after two iteration cycles: return a `context_update_failed` flag to the Orchestrator with a specific note on what failed. The Orchestrator will skip the `RECENT_ACTIVITY` section in the next production run rather than use a corrupted update.

---

## What Content Intelligence Never Does

- Never scrapes any platform the client has not explicitly opted in to monitor
- Never stores or uses scraped content beyond updating the `RECENT_ACTIVITY` section
- Never shares founder activity data outside the client's own folder structure
- Never surfaces content that could expose information the client intended to keep private

---

*Voyce Content Intelligence — Agent 10*  
*Current implementation: biweekly Tally form (Sprints 1–5). Apify scraper: Sprint 6+ or Enterprise tier.*
