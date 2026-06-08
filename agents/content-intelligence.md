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

## What Content Intelligence Never Does

- Never scrapes any platform the client has not explicitly opted in to monitor
- Never stores or uses scraped content beyond updating the `RECENT_ACTIVITY` section
- Never shares founder activity data outside the client's own folder structure
- Never surfaces content that could expose information the client intended to keep private

---

*Voyce Content Intelligence — Agent 10*  
*Current implementation: biweekly Tally form (Sprints 1–5). Apify scraper: Sprint 6+ or Enterprise tier.*
