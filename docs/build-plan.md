# Voyce — Phased Build Plan

> GStack Autoplan — YC Office Hours Format  
> Generated: 2026-06-08  
> Status: Pre-build decision document — read architecture-review.md first

---

## Core Hypothesis (What Sprint 1 Must Validate)

The entire Voyce thesis rests on a single falsifiable claim: **an AI system can produce content that sounds sufficiently like a specific founder that they approve it for publication without rewriting it.**

Everything else — SEO optimization, AEO citation strategy, video production, performance analytics, multi-channel delivery — is contingent on this claim being true. If first-draft approval rate is below 40%, the product has a voice-matching problem that no amount of integration work will fix. If it is above 70%, the core value proposition is validated and the product earns the right to expand scope.

Sprint 1 exists to answer exactly one question: **what is the first-draft approval rate?**

This means Sprint 1 does not need Buffer. It does not need Beehiiv. It does not need SEO tooling or performance analytics. It needs onboarding data flowing into a context file, a Content Writer producing drafts that load that context, and a delivery mechanism that collects a binary approve/revise signal from the founder. That is the experiment. Everything else is noise until this question is answered.

---

## Revised MVP Scope (Tighter Than the Original Spec)

The original Sprint 1 scope includes: Orchestrator agent, Content Writer with Spiral stylometry, email delivery, Buffer integration, Stripe billing, Tally onboarding, basic dashboard, and client folder creation. This is too wide. It bundles infrastructure (Stripe, Buffer) with the core experiment (voice match), meaning a billing bug or a Buffer API issue can block the entire sprint without telling you anything about whether the AI can write like your client.

**Revised Sprint 1 scope:**

- Tally onboarding webhook handling with idempotency
- Master Context File auto-build from onboarding responses (Claude API, structured prompt, stored in database)
- Content Writer agent producing one draft per production run using MCF context
- Email delivery of that draft to the founder (plain HTML email via Resend)
- A single-click approve/revise link in that email
- A minimal dashboard showing draft status (approved, pending, revised)
- Stripe billing gating access (checkout only — no metering, no overages)
- PostgreSQL via Prisma from day one

**What is deferred from the original Sprint 1:**

- Buffer integration (moves to Sprint 4) — publishing is downstream of approval; you cannot test publishing until approval works
- Spiral stylometry (stubbed with Claude few-shot voice matching) — removes a blocking external dependency from the critical path
- 8-check eval system (simplified to 3 checks for Sprint 1: voice match, pillar alignment, platform format) — full 8-check eval adds iteration cycles before the quality bar is established
- Slack/WhatsApp/Notion/Google Docs delivery — email only
- Agent 09 Skills Interpreter — collapsed into Orchestrator initialization logic
- All other agents (03 through 10) — deferred per sprint roadmap below

---

## What Is Out of Scope Until Customer Signal

The following items are explicitly deferred and should not be architected speculatively. Each item has a signal threshold that must be met before it earns a place in the backlog.

**Agent 03 (SEO Specialist):** Signal required — a paying client explicitly requests SEO optimization and current content pipeline is stable.

**Agent 04 (Ad Copywriter):** Signal required — 5 or more clients requesting ad copy within a 30-day window.

**Agent 05 (Researcher):** Signal required — qualitative feedback from 3 or more clients that content feels generic or lacks market context.

**Agent 06 (Repurposer):** Signal required — clients have 10 or more approved pieces and are actively requesting format transformations.

**Agent 07 (Performance Analyst):** Signal required — 3 clients with 90 days of publish history and GA integration configured.

**Agent 08 (AEO/GEO Specialist):** Collapsed into Agent 05 as a prompt template variation. Not a standalone agent.

**Agent 09 (Skills Interpreter):** Collapsed into Orchestrator initialization. Not a separate agent. Ever.

**Agent 10 (Content Intelligence / Apify):** Replaced with a structured biweekly "activity update" prompt sent to the founder via email. Revisit Apify integration only when client base exceeds 200 active users and manual update workflows show measurable engagement drop-off.

**Agent 11 (Video Production):** Sprint 15+ as specified. No scope creep.

**Multi-channel delivery (Slack, WhatsApp, Notion, Google Docs):** Signal required — clients explicitly request a specific channel and email open rates show a delivery problem.

**Ghost, Substack, WordPress, Webflow publishing:** Signal required — first paying client onboards with that platform as their primary publishing destination. Note: Substack has no official public API. Do not promise Substack integration; route clients to a manual export flow.

---

## Sprint 1A — Throwaway Prototype (Days 1–2, before Sprint 1B)

### Why This Exists

Before building production infrastructure, validate the core hypothesis with a throwaway prototype. This is not in the original spec and is the most important addition to the build plan.

The hypothesis — "does the draft sound like the founder?" — can be answered with a two-day prototype: collect a Tally form response, call Claude with it as context, email the output to the founder. If the approval signal is strong (50%+ of recipients say "yes, I'd publish this"), proceed to Sprint 1B. If weak, understand why before building any infrastructure around the broken loop.

### Scope

- Raw Tally form with 10–15 voice questions and writing sample upload
- A script that calls Claude API with the Tally response as context and a content prompt
- Sends the output via email (can use personal email account or free Resend tier)
- Collects approval via email reply

### Acceptance Criteria

- 5 internal or friendly external founders complete the flow
- Average approval score tracked (1 = would not publish, 5 = would publish as-is)
- Decision gate: if average score is below 3.5, diagnose voice-matching problems before proceeding to Sprint 1B

---

## Sprint 1B — Foundation (Weeks 1–3)

### Scope

The goal of Sprint 1B is to get a complete, production-grade flow working end-to-end: a founder fills out a Tally form, the system builds their context file, produces one piece of content, emails it to them, and records whether they approved it or requested revision.

**Database setup:** PostgreSQL via Prisma on Supabase or Neon. Schema includes: `clients`, `content_items`, `revisions`, `agent_runs`, `approval_tokens`. No SQLite in production under any circumstances.

**Tally webhook handler:** Idempotent endpoint keyed on Tally submission ID. Creates a client record on first receipt, silently returns 200 on duplicates. Tally form field ID mapping stored in a config file, not hardcoded.

**MCF auto-build:** On client record creation, trigger a background job (Trigger.dev) that calls the Claude API with a structured prompt to synthesize the Master Context File from Tally responses. Output stored as a `client_context` table with typed sections: `voice_profile`, `audience`, `content_pillars`, `brand_opinions`, `quality_standards`. Not a flat file.

**Content Writer agent (Agent 02):** A single agent with a carefully constructed system prompt. Loads MCF sections from the database, assembles them into a prompt context, produces one piece of content. Voice matching via Claude few-shot examples drawn from the MCF examples section. No Spiral dependency.

**3-check simplified eval:** Voice match (Claude self-eval against voice profile), pillar alignment (does this content reference at least one defined pillar), platform format check (character count, structure). Simplified from the final 8-check system. Any check failure triggers one automatic revision attempt before escalating to human review.

**Email delivery:** Resend integration. HTML-formatted draft email with approve button and revise button. Each button encodes a signed approval token (stored in `approval_tokens` table, expires 7 days). Approve records approval, marks content_item status as `approved`. Revise captures revision notes via email reply or a Tally embed.

**Minimal dashboard:** Next.js app with NextAuth. Three views only: login, draft list, draft detail with approve/revise controls mirroring the email. Design system (cream background, gold #C8A95A, Cormorant Garamond headlines, DM Mono body) applied from day one.

**Stripe checkout:** Stripe-hosted checkout creates a subscription. `checkout.session.completed` webhook activates the client record. No metering, no overage logic, no Content Actions counter in Sprint 1. Billing gates access; that is sufficient.

**Trigger.dev worker:** All agent execution runs in Trigger.dev, outside the Next.js request context. No serverless timeout exposure. Step-level checkpointing from day one.

### Acceptance Criteria

- A Tally form submission creates a client record in the database. Submitting the same form twice creates exactly one client record.
- The MCF build completes within 90 seconds of the Tally webhook firing, with all required sections populated.
- The Content Writer produces a draft for a test client with at least 85% of the specified word count and format requirements met.
- The draft email delivers to a test inbox within 5 minutes of the production job completing.
- Clicking the approve button in the email marks the content item as approved in the database and reflects that status in the dashboard within 10 seconds.
- The Stripe checkout flow completes, the webhook fires, and the client record transitions to `active` status. A failed or cancelled payment does not activate the client.
- Three internal team members complete the full onboarding-to-draft flow and rate the draft's voice fidelity on a 1–5 scale. Average score must be 3.5 or above to proceed to external beta.

### Dependencies

- Supabase or Neon account provisioned and Prisma schema migrated before any development work begins.
- Tally form finalized with all required fields before webhook handler is built. Form field IDs must not change after handler is coded.
- Claude API key with sufficient rate limits for concurrent agent calls.
- Resend account with a verified sending domain.
- Stripe account in test mode with a product and price created for each tier.
- Trigger.dev account configured.

### Risks

**MCF quality risk:** If the Tally form does not capture sufficient voice signal, the MCF will be thin and drafts will feel generic. Mitigation: include at least 3 writing sample upload fields and 5 open-ended voice questions in the Tally form. Validate MCF quality with internal team members before opening beta. Consider a human-assisted MCF review call for the first 10 clients.

**Tally field mapping brittleness:** If the Tally form is edited after the webhook handler is coded, field IDs change and the mapping breaks silently. Mitigation: config-file-driven mapping with a validation step that logs a warning when an expected field ID is missing from the webhook payload.

**Trigger.dev job reliability:** Add a job status view (Trigger.dev's built-in dashboard) before running any real client onboarding. A job that is enqueued but never executed is invisible without this.

---

## Sprint 2 — Agent Core (Weeks 4–6)

### Scope

Sprint 2 expands the Content Writer's capability and hardens the quality eval system based on Sprint 1 learnings about where voice matching breaks down.

**Full 8-check eval system:** Implement all 8 quality checks as discrete, checkpointed steps in Trigger.dev (`step.run("voice-check", ...)`). Independent checks (voice match, audience fit, pillar alignment) run in parallel via `Promise.all`. Each check result stored in a `quality_check_results` table before the next check is triggered. Maximum 3 full revision cycles before escalating to human review.

**Prompt caching implementation:** Cache the stable MCF sections (voice_profile, audience, content_pillars) in the Claude API system prompt using cache-control headers. This is the single highest-leverage cost optimization available. Implement before the client count exceeds 20.

**Context sectioning:** Each agent type declares a context manifest specifying which MCF sections it requires. The Content Writer loads: voice_profile, audience, content_pillars, brand_opinions, examples. The eval system loads all sections. No agent loads the full context unless explicitly required.

**Revision workflow:** When a client requests revision via email or dashboard, capture revision notes and feed them back into the Content Writer prompt as a constrained instruction set. Store revision notes in the `revisions` table. Produce a second draft incorporating the notes.

**MCF versioning:** Add a version integer to each `client_context` section row, auto-incremented on every update. Add `updated_at` and `updated_by` columns. Every draft is traceable to the exact MCF version it was produced from.

**Biweekly activity update:** Replace Agent 10 entirely with a scheduled Resend email asking the founder: "What have you been working on, saying publicly, or thinking about this week?" A Tally embed captures the response. The webhook updates the `recent_activity` section of the client context. This is the complete implementation of what Agent 10 was trying to do, for approximately zero additional infrastructure cost.

**Multiple content formats:** Content Writer expands to produce at minimum: long-form article (800–1500 words), LinkedIn post (150–300 words), newsletter section (400–700 words). Format specified in the workflow config per client.

### Acceptance Criteria

- All 8 quality checks run and produce stored results for every production run. A quality check failure at step 6 does not re-run steps 1–5 when the revision is triggered.
- Parallel quality checks complete in under 30 seconds total for a standard 800-word draft.
- Prompt caching produces measurable cache hit rates above 60% for clients with more than 5 completed production runs.
- A content item produced by Agent 02 is traceable to the MCF version used to produce it.
- The biweekly activity update email is triggered on schedule for all active clients. Responses update the `recent_activity` context section within 5 minutes of the Tally webhook firing.
- **At least 5 external beta clients** complete a full onboarding-to-draft-to-approval cycle. Target first-draft approval rate: **50% or above**. Below 40% triggers a voice-matching architecture review before Sprint 3 begins.

### Dependencies

- Sprint 1B fully complete and stable. No Sprint 2 work begins until the Sprint 1 acceptance criteria are all passing in production.
- At least 3 paying beta clients onboarded through Sprint 1 so real approval data exists before the eval system is tuned.
- Prompt caching requires Claude API access to cache-control header support — verify before architecting.

### Risks

**Revision loop depth:** Without a hard cap, a draft that fails voice match repeatedly can loop indefinitely, consuming tokens and blocking the client's content calendar. The 3-cycle maximum cap is a hard requirement.

**Approval rate below threshold:** If first-draft approval rate does not reach 50% after Sprint 2 hardening, the product has a fundamental voice-matching problem. The path forward is not more agents — it is deeper MCF onboarding, more writing samples, and possibly fine-tuning on approved examples. This must be treated as a P0 issue that pauses the feature roadmap.

**Claude API rate limits:** At 10+ concurrent clients each running weekly production jobs, the system will encounter rate limits. Implement client-level job throttling before Sprint 2 ships: maximum concurrent production runs per account tier, exponential backoff with jitter on rate limit responses.

---

## Sprint 3 — Delivery and Approval Loop (Weeks 7–9)

### Scope

Sprint 3 hardens the client-facing experience and introduces the approval workflow as a named product feature.

**Autonomy Levels feature:** Dashboard settings where clients configure trust thresholds. Level 1: all drafts require explicit approval. Level 2: auto-approve if confidence score exceeds 85% (confidence score = aggregate of 8 quality check scores). Level 3: auto-publish without review. Clients start at Level 1 by default. The path to Level 3 requires 10 consecutive approved drafts without revision, enforced at the database layer.

**Content calendar view:** Full implementation of the content calendar dashboard page. Shows scheduled production dates, draft status per content item, delivery timestamps, approval states, publish states.

**48-hour follow-up automation:** When a draft is delivered and no approval is received within 48 hours, a delayed Trigger.dev job fires a follow-up email. The follow-up includes a summary of queued content and a direct one-tap approve link. If the client approves before the delay fires, cancel the job by ID. After 96 hours with no response, the Orchestrator flags the client for manual outreach.

**Draft performance dashboard:** Minimal performance view showing approval rate, revision rate, average time-to-approval, and drafts produced per month. Internal system performance metrics, not content performance (that comes in Sprint 5).

**Stripe Content Actions metering:** Implement the Content Actions counter. Each completed production run decrements the counter by the number of pieces produced. Atomic database-level decrement with a constraint preventing the counter from going negative. Notify clients at 80% and 100% usage. Hard stop at 100% with a Stripe upgrade link. No overage billing in Sprint 3.

### Acceptance Criteria

- A client at Autonomy Level 2 with a confidence score above 85% has their content item automatically marked as approved without requiring any action.
- The 48-hour follow-up job fires for every unacknowledged draft. Approving the draft before the 48-hour mark cancels the job. Verifiable by checking job queue state in Trigger.dev.
- The Content Actions counter decrements atomically. A test simulating two concurrent production runs for the same client never results in the counter going below zero or producing two conflicting decrements.
- Monthly Stripe billing correctly reflects the client's active subscription. Cancellation via the dashboard suspends the client's production runs within 5 minutes.

### Dependencies

- Sprint 2 first-draft approval rate data must be available to calibrate the Autonomy Level 2 confidence threshold. Do not set a threshold without empirical approval data.
- Stripe webhook handler from Sprint 1 is extended, not replaced.

### Risks

**Autonomy Level miscalibration:** If the confidence threshold for auto-approval is set too low, the system auto-approves content that the client would have revised, eroding trust. Set conservatively (90%) and let clients lower it manually. Never allow Level 3 (auto-publish) before 10 consecutive approved drafts without revision, enforced at the database layer.

---

## Sprint 4 — Publishing and Billing (Weeks 10–12)

### Scope

Sprint 4 connects approved content to publishing platforms and completes the billing implementation.

**Buffer integration:** Social publishing for LinkedIn and X (Twitter). The `post_failed` webhook handler must be implemented before any client content is sent to Buffer. Store Buffer's async job ID on the content_item record so failures can be correlated with specific drafts.

**Beehiiv integration:** Newsletter publishing via Beehiiv v2 API. Draft creation and scheduled publish. Store Beehiiv post ID on content_item.

**Stripe overage billing:** Upgrade Content Actions metering to Stripe metered billing (usage records API) for Growth and Pro tiers. When the monthly action limit is hit, present a clear upgrade path. Implement the soft-warn-then-stop flow: notify at 80% usage, queue but do not execute at 100%, prompt upgrade.

**Subscription management dashboard:** Clients can view current plan, current month's Content Actions used vs. limit, billing history, and upgrade/downgrade controls. Upgrades take effect immediately (Stripe prorates). Downgrades take effect at next billing cycle.

**Repurposing capability:** Implemented as a prompt template variation within the Content Writer agent infrastructure — same context loading, same quality eval, different transformation instruction in the system prompt. Not a separate agent service. Approval workflow for repurposed content matches original content: explicit approval required, same quality eval, same delivery via email.

### Acceptance Criteria

- An approved LinkedIn post publishes to the connected Buffer account within 10 minutes of approval. If Buffer returns a `post_failed` event, the content_item status updates to `publish_failed` and the client receives an email notification within 5 minutes of the failure event.
- An approved newsletter draft publishes to the connected Beehiiv account as a scheduled draft. The Beehiiv post ID is stored on the content_item record.
- A client who exhausts their Content Actions limit receives a notification email and cannot trigger new production runs until they upgrade or the monthly counter resets. The hard stop is enforced at the database level, not only in application logic.
- A repurposed LinkedIn post derived from an approved article passes the full 8-check eval. The repurposed piece's `parent_content_item_id` is stored on its content_item record.

### Dependencies

- Buffer OAuth flow built and tested before any client content is sent. OAuth token refresh handled — tokens expire and a job that fires with a stale token will fail silently without refresh logic.
- Beehiiv account connection requires storing API keys per client in an encrypted column.

### Risks

**Buffer post_failed silent failures:** This is the highest-probability incident in Sprint 4. Test with Buffer's sandbox environment and a deliberately malformed post to confirm the failure handler fires correctly before shipping to any client.

**Substack:** No official public API. Do not promise Substack integration. If a client requires it, route them to a manual export flow (download markdown, upload to Substack). Document this limitation explicitly in the onboarding flow for clients who identify Substack as their platform.

---

## Sprint 5 — Performance Loop (Weeks 13–16)

### Scope

Sprint 5 introduces data-driven optimization, requiring that clients have at least 90 days of publishing history.

**Google Analytics integration:** OAuth connection per client. Store GA property ID on client record. Pull engagement data (pageviews, time on page, scroll depth) for published articles weekly. Store as `performance_events` rows: `(client_id, content_item_id, platform, metric_type, value, recorded_at)`.

**Agent 07 (Performance Analyst):** A single agent that runs on the first Monday of each month. Receives a structured SQL-generated summary (not raw log data) of the previous month's performance. Produces a narrative report with top performing content by platform, engagement trends by content type and pillar, and recommended strategic adjustments. Delivers via email and dashboard.

**Agent 05 (Researcher) — initial implementation:** Implements competitor research as a scheduled monthly task. Founder provides 3–5 competitor URLs during onboarding. Agent 05 uses Claude's web research capabilities to produce a competitive intelligence summary, stored in the `competitor_intel` MCF section.

**Feedback loop:** The Performance Analyst's output feeds back into the MCF `performance_insights` section. The Content Writer loads this section and uses it to adjust content angle selection. This is the first implementation of the system learning from its own output.

### Acceptance Criteria

- Monthly performance reports generate and deliver on the first Monday of the month for all clients with 90+ days of publishing history. Reports that fail to generate trigger a manual review alert, not a silent skip.
- Performance data for a published article is queryable by platform, metric type, and date range in under 500ms.
- The feedback loop is demonstrably functional: two consecutive monthly reports show different recommended content angles based on performance data, and those angles appear in subsequent drafts.

### Dependencies

- Clients must have 90 days of publishing history. Do not activate Agent 07 for newer clients.
- Google Analytics OAuth requires per-client consent. Build the GA connection UI in the settings dashboard before Sprint 5 begins.

---

## Sprint 6 and Beyond — Scale Features (Weeks 17+)

**Sprint 6 (Weeks 17–20): SEO infrastructure.** Agent 03 with Semrush integration. Topic cluster generation. On-page optimization pass added to the Content Writer eval chain. Requires: 10+ clients publishing consistently, Semrush API provisioned.

**Sprint 7 (Weeks 21–24): Additional publishing platforms.** Ghost (requires content format transformation to mobiledoc/lexical — budget 2–3 days specifically for this). WordPress (target WordPress.com OAuth first, then self-hosted application passwords). Webflow CMS (requires per-client field mapping UI — budget 3–4 days minimum).

**Sprint 8 (Weeks 25–28): Additional delivery channels.** Slack integration (OAuth per workspace, block kit formatting). Notion (OAuth, database creation per client). Google Docs (OAuth, Drive folder per client, sharing logic). Each channel is a separate mini-project.

**Sprint 9 (Weeks 29–32): Ad copy infrastructure.** Agent 04 (Ad Copywriter) as a distinct content type. Targets a different client segment (performance marketers) — may require separate onboarding flow.

**Sprint 10+ (Weeks 33+): Agency/operator tier.** Multi-client management UI. White-label settings. Per-client team member access. API for programmatic onboarding.

**Sprint 15+: Agent 11 (Video Production)** per original spec. Editframe integration.

---

## Integration Sequencing

| Timeline | Integrations | Reason |
|---|---|---|
| Week 1–2 (Sprint 1) | Tally webhook, Claude API, Resend email, Stripe checkout | Absolute minimum to run the core experiment |
| Week 3 (Sprint 1 completion) | Supabase/Neon PostgreSQL, Trigger.dev | No SQLite in production |
| Week 4–6 (Sprint 2) | Claude API prompt caching | Highest-leverage cost optimization before client count grows |
| Week 7–9 (Sprint 3) | Stripe webhook extension | checkout-only Stripe is insufficient for production billing |
| Week 10–12 (Sprint 4) | Buffer (with post_failed handler), Beehiiv | First publishing integrations — most common client destinations |
| Week 13–16 (Sprint 5) | Google Analytics OAuth | Required for Agent 07 |
| Week 17+ (Sprint 6+) | Semrush, Ghost, WordPress, Webflow, Slack, Notion, Google Docs | In the order clients request them |
| Never before Sprint 5 | Apify | Replace with biweekly Tally form through Sprint 4 |

---

## Database Schema Decisions

### In the Database (Source of Truth)

| Table | Purpose |
|---|---|
| `clients` | Subscription state, Stripe customer ID, Tally submission ID (unique constraint), onboarding status, active plan |
| `client_context` | MCF sections as discrete typed rows: one row per (client_id, section_type), content as TEXT or JSONB, version integer, updated_at, updated_by |
| `content_items` | Every draft and published piece: client_id, content_type, format, status, word_count, storage_key, platform_target, parent_content_item_id, timestamps |
| `revisions` | revision_number, content_item_id, feedback_text, revised_by, created_at |
| `quality_check_results` | One row per check per production run: agent_run_id, check_type, passed (boolean), score, details |
| `agent_runs` | job_id, client_id, agent_type, status, started_at, completed_at, context_version, token_input_count, token_output_count |
| `approval_tokens` | Signed tokens for email-based approval, expiry and consumed_at columns |
| `performance_events` | content_item_id, platform, metric_type, value, recorded_at |

### In Object Storage (R2 or S3)

The actual text of every draft, approved article, newsletter body, and ad copy variant. Addressed by `storage_key` on the content_items record. Immutable once written — revisions create new objects.

### What Disappears as Files

All per-client markdown files described in the original spec. `master-context-file.md` is a rendered view generated from `client_context` rows on demand. `content-calendar.md` is a dashboard view over `content_items`. `performance-log.md` is a query over `performance_events`. `revision-history.md` is a query over `revisions`. These can be exported as markdown for client download, but they are not the system of record and agents never read them from disk.

### Files That Remain as Files

Tally form field ID mapping config, agent system prompt templates, environment configuration. Static configuration, not client data.

---

## Testing Strategy

### Internal Calibration (Before Any External Beta)

Three team members each complete the onboarding form as if they were a founder client. Include real writing samples — at least 500 words of prior content per person. The Content Writer produces one piece per person. Each team member rates the resulting draft on five dimensions: voice accuracy, audience fit, pillar relevance, factual accuracy, publishability. Each dimension scored 1–5. The sprint does not proceed to external beta until average scores across all five dimensions and all three team members exceed 3.5.

### Beta Cohort Selection

The first external beta cohort should be 5 founders who have at least 12 months of public writing history (LinkedIn posts, blog, newsletter). Rich prior content is a prerequisite for voice matching quality. Do not onboard founders with no prior content in the first cohort — insufficient signal will produce poor results that do not represent the product's capability.

### Approval Rate as the Primary Metric

Track first-draft approval rate (approved without any revision requested) as the single most important leading indicator. Report it weekly. Target: 50% or above by end of Sprint 2. If the rate is below 40% after 20 drafts across the beta cohort, halt feature development and conduct structured interviews with clients about where voice matching is failing.

### Revision Pattern Analysis

Every revision request should be tagged by category: voice accuracy, factual error, pillar miss, format issue, length issue. After 50 revisions, analyze the distribution. If voice accuracy accounts for more than 40% of revisions, the MCF onboarding form needs more writing sample depth. If format issues account for more than 30%, the Content Writer's platform format awareness needs refinement.

### A/B Testing Context Loading Strategies

In Sprint 2, run a controlled experiment: half of production runs load the full MCF context, half load only the minimal required sections. Measure approval rates for both groups. This validates whether context reduction degrades quality before it is applied universally.

### Token Cost Tracking from Sprint 1

Log `token_input_count` and `token_output_count` on every `agent_run` from day one. Track cost per content item weekly. If cost per item exceeds $0.75 (representing approximately 50% gross margin erosion on the Starter tier), investigate which calls are driving the overrun and implement prompt caching or context reduction before the issue compounds.

---

## Pre-Build Checklist

Before writing any application code, the following decisions must be documented:

- [ ] ICP defined: solo founder or growth-stage startup?
- [x] Starter tier pricing confirmed: $99/$249/$499/Enterprise (revised from $40/$80/$199)
- [ ] Content Actions definition documented: does a production run of 3 pieces consume 3 actions or 1?
- [ ] Orchestrator failure mode designed: retry depth, escalation path, client-facing error
- [ ] Per-action token budget set: max Claude calls, max tokens per call
- [ ] Approval workflow edge cases specified: what counts as approval, what triggers revision, what happens on Buffer post failure
- [ ] Spiral integration decision: interface contract defined, Claude few-shot matching confirmed as Sprint 1 implementation
- [ ] Postgres provisioned on Supabase or Neon
- [ ] Trigger.dev account configured
- [ ] Tally form finalized (form field IDs locked before webhook handler is built)
- [ ] Sprint 1A prototype run and approval rate documented

---

*Voyce Build Plan — GStack Autoplan — 2026-06-08*  
*Read alongside architecture-review.md. Both documents must be reviewed before Sprint 1 implementation begins.*

---
---

# Second Pass — Sprint 1 Reconciliation & Remediation Plan

> GStack Autoplan — YC Office Hours Format (re-run)  
> Generated: 2026-06-16  
> Status: Sprint 1A shipped, Sprint 1B ~70% built. Read the second-pass section of `architecture-review.md` first.

## Where we actually are

The plan above was written before code. Since then:

- **Sprint 1A (throwaway prototype): shipped.** `scripts/prototype/sprint-1a.ts` exists and has produced output. **But the decision-gate artifact does not** — there is no documented approval-rate score authorizing the move to 1B. Capture it retroactively or re-run the gate.
- **Sprint 1B: ~70% built.** The Tally→MCF→Content-Writer→email path runs end-to-end for a paying-status-bypassed client. Prompt caching, webhook signature verification, R2 storage, the dashboard, and a richer-than-planned two-layer eval + Discovery Mode all shipped.
- **The remaining 30% is load-bearing.** Three P0s make the system either dishonest (publishes nothing despite promising to), insecure (forgeable approval/publish tokens), or non-viable (unpaid clients get drafts; SQLite in prod). The weekly loop does not run. The revision loop is a dead end. These are not polish — they are the difference between a demo and a product.

The original Sprint 1B acceptance criteria that *look* met but are **not**, verified against code:

| AC (build-plan §Sprint 1B) | Claimed | Reality |
|---|---|---|
| Duplicate Tally submission → exactly one client | ✅ | ⚠️ over-dedupes on email too (`tally-idempotency-weakened`) |
| MCF build < 90s, **all sections populated** | ✅ | ❌ only `VOICE_PROFILE` synthesized; 4/5 sections pass through raw (`mcf-90s-overstated`) |
| Approve button marks approved in DB + dashboard | ✅ | ⚠️ email path works; **dashboard button errors** (`dashboard-approve-broken`) |
| Stripe checkout completes; failed payment does not activate | ✅ | ❌ **no checkout exists**; production not gated on `ACTIVE` (`no-stripe-checkout`) |
| Token counts logged from day one | ✅ | ❌ hardcoded `0` on the content path (`token-counts-zero`) |

## Sprint 1B-R — Remediation (do this before any external beta)

This is a corrective sub-sprint. No new features. Every task closes a verified P0/P1 from the second-pass review and references its finding ID. Ordered by "what makes the system honest and safe first."

### Block 1 — Make it real and safe (P0)

1. **Postgres migration** (`sqlite-still-provider`). Provision Neon/Supabase. Flip `provider = "postgresql"`, generate an initial migration (there is no baseline today), restore the `pgvector` embedding column **or** explicitly descope semantic retrieval for Sprint 1 in writing. Re-run the `Promise.all` MCF upserts against Postgres and confirm no lost updates.  
   *AC:* `prisma migrate deploy` runs clean against a hosted Postgres; `dev.db` is gone from the deploy path; a concurrent two-write test against `client_context` does not lose an update.

2. **Payment gate** (`no-stripe-checkout-and-ungated-production`). Add `checkout.sessions.create` + a signup route. Move the first-production trigger out of `mcf-build` into the `checkout.session.completed` handler. Add a hard `client.status === 'ACTIVE'` guard at the top of `contentProductionTask`.  
   *AC:* a Tally submission with no payment produces **zero** Claude calls and zero emails; only a completed checkout triggers the first production run.

3. **Approval-token hardening** (`approval-tokens-never-persisted`, `approval-secret-fallback`). Wire the existing `ApprovalToken` table: persist on send with `expiresAt` (7d), set `consumedAt` and the content status **in one transaction**, reject expired/consumed tokens. Throw at startup if `AUTH_SECRET` is unset (remove the `'fallback-dev-secret'` literal).  
   *AC:* a re-used approve link is rejected; an expired link is rejected; the app refuses to boot without `AUTH_SECRET`.

4. **Secrets at rest** (`integration-secrets-plaintext`). Either encrypt per-client integration secrets (envelope encryption/KMS) or delete the false "encrypted at application layer" schema comments and document plaintext in the threat model. No silent lies in the schema.  
   *AC:* the schema comment matches reality; if encryption is chosen, stored secrets are ciphertext.

5. **Publish path or honest copy** (`publishing-missing`). Build the Buffer publish task (`APPROVED → Buffer → PUBLISHED | PUBLISH_FAILED`, with the `post_failed` webhook handler the first review demanded) **or** change all "queued for publishing / Approve and publish" UI and email copy to "manual publishing."  
   *AC:* either an approved LinkedIn post reaches Buffer and the status reflects success/failure, or no surface claims auto-publishing.

6. **Dashboard approve/hold** (`dashboard-approve-broken`). Fix the malformed token URLs so the in-app approve/hold path works like the email path.  
   *AC:* approving from the dashboard transitions status without error.

### Block 2 — Make the loop actually loop (P1)

7. **Revision reproduction + cap** (`revision-no-reproduction`, `change-order-unenforced`). Wire `REVISION_REQUESTED` → a worker that re-runs the Content Writer with `Revision.feedbackText` injected. Enforce 2 included rounds; the 3rd converts to a change order.  
   *AC:* clicking "Request revision" delivers a revised draft within the planned turnaround; a 3rd request is blocked/converted.

8. **Register the scheduler** (`no-scheduler-registered`). Convert `weeklyProductionTask` to a `schedules.task()` that enumerates `ACTIVE` clients on their configured cadence; schedule the biweekly activity-update send.  
   *AC:* a test client receives a second piece automatically on schedule without a manual trigger.

9. **Honest metering** (`meter-leak`, `content-action-undefined`). Move the action decrement to the **delivery point** (`DELIVERED`/`HOLD_RECOMMENDED`) so Discovery and revision deliverables are metered uniformly. Codify "1 Content Action = 1 delivered item" in `pricing.ts`.  
   *AC:* every run that reaches a client decrements exactly once; discovery and escalation no longer run free; the counter a client sees equals pieces delivered.

10. **Real cost accounting + budget enforcement** (`token-counts-zero`, `call-budget-unenforced`). Accumulate `inputTokens`/`outputTokens` across every `callClaude` and persist on `AgentRun` with a call count. Enforce `MAX_CLAUDE_CALLS_PER_ACTION`; use `MAX_REVISION_CYCLES` or delete it.  
    *AC:* `agent_runs` shows non-zero token counts; a run exceeding the call budget escalates instead of looping; the `$0.75/item` alarm can fire.

11. **Rate-limit + parse resilience** (`no-rate-limit-throttling`, `json-parse-unguarded`). Add per-account queue concurrency caps and 429 backoff-with-jitter. Wrap the three `JSON.parse` calls; on malformed output, mark the `AgentRun` failed rather than retrying the whole task.  
    *AC:* a simulated 50-client Monday burst degrades gracefully (queued, not error-stormed); a malformed Claude response does not double-charge.

### Block 3 — Resolve drift before it compounds (P2, can trail Block 2)

12. **Deterministic checks** (`deterministic-checks-as-llm-calls`): implement `PLATFORM_FORMAT` and `BOUNDARIES_CHECK` as pure functions run before any LLM call.
13. **Confidence score source** (`confidence-self-eval-circular`): derive `confidenceScore` from the independent orchestrator eval, not the specialist self-eval. Fix the `AutononomyLevel` enum typo and the phantom `client.autonomyThreshold` field.
14. **R2 immutability** (`storagekey-keyed-on-agentrun`): key content objects on the content item and write new objects on revision; never overwrite.
15. **Stripe idempotency** (`stripe-system-clientid-hack`): replace the `clientId:'system'` `AgentRun` hack with a `ProcessedWebhookEvent` table keyed (unique) on the Stripe event ID.
16. **Brand identity** (`dashboard-theme-contradicts-plan`): ratify the dark theme as canonical, update §Sprint 1B design line, re-skin emails to match.
17. **Document the unplanned wins**: write Discovery Mode and the two-layer eval into this plan, and decide whether discovery approvals count toward the headline approval-rate metric (recommend: separate cohort).

## Updated Pre-Build Checklist (now a remediation gate)

| # | Item | 2026-06-08 | 2026-06-16 status |
|---|---|---|---|
| 1 | ICP defined | ☐ | ✅ **Profile B** (growth-stage/funded founder); Starter = 60-day calibration tier |
| 2 | Starter pricing | ✅ | ✅ $99/$249/$499 — keep (margin verified ~87% on real call counts) |
| 3 | Content Actions defined | ☐ | ✅ **1 action = 1 delivered item**; move decrement to delivery point (task 9) |
| 4 | Orchestrator failure mode | ☐ | ⚠️ no Orchestrator entity exists — rewrite `orchestrator.md` to real topology + add client-facing error path |
| 5 | Per-action token budget | ☐ | ❌ declared, unenforced — task 10 |
| 6 | Approval workflow edge cases | ☐ | ❌ revision = dead end, no change-order cap — tasks 3, 7 |
| 7 | Spiral interface | ☐ | ⚠️ inlined, no contract — extract `text→fingerprint` interface |
| 8 | Postgres provisioned | ☐ | ❌ **still SQLite** — task 1 (P0) |
| 9 | Trigger.dev configured | ☐ | ✅ configured and in use |
| 10 | Tally form finalized (IDs locked) | ☐ | ❌ field map is 100% `REPLACE_WITH_*` placeholders — **blocks live onboarding** |
| 11 | Sprint 1A approval rate documented | ☐ | ⚠️ prototype ran; **no documented score/gate** — capture it |

## Re-sequenced forward plan

- **Sprint 1B-R (Remediation):** Blocks 1–2 above. **Gate to external beta:** all P0s closed, the weekly loop runs, the revision loop produces a revised draft, payment gates production, and metering is honest. This replaces "ship Sprint 1B" — 1B is not done until 1B-R is.
- **Sprint 2 (Agent Core):** unchanged in intent, but add: full 8-check eval **with the 4 deterministic checks** (task 12), multi-piece runs **with N-per-piece metering** (extends task 9), and the A/B context-loading experiment. Do not start until 1B-R acceptance passes in production with ≥3 paying beta clients.
- **Sprints 3–5+:** as in the original plan. Note Autonomy Levels (Sprint 3) now depend on the fixed `confidenceScore` source (task 13) and AI-disclosure/liability governance for Level 3 auto-publish (`autonomous-publishing-liability-ungoverned`): require explicit signed autonomy opt-in separate from per-draft approval, a configurable AI-disclosure line on auto-published content, a Terms clause allocating liability with a veto window, and an immutable publish-authorization record.

---

*Voyce Build Plan — Second Pass — GStack Autoplan — 2026-06-16*  
*Sprint 1B is not complete until Sprint 1B-R closes every P0/P1 above. Finding IDs reference the second-pass section of `architecture-review.md`.*

---

# Third Pass — Sprint 1B-R Remediation (shipped)

> Generated: 2026-06-18  
> Status: **Sprint 1B-R Blocks 1–3 implemented in code.** One external-credential step
> remains (provision hosted Postgres — see `docs/postgres-migration.md`). After that
> step the Sprint-2 gate is met.

## What changed

Every P0/P1 from the second pass, plus the high-value P2s, is now closed in code. The
system that "looked built but was inert" now actually runs the loop end-to-end:
payment gates production, the weekly scheduler fires, the revision loop reproduces a
draft, approvals are single-use and replay-proof, and approved content has a real
publish path.

### Block 1 — P0 (real & safe)

| # | Finding | Resolution |
|---|---|---|
| 1 | `sqlite-still-provider` | RMW races fixed in code (transactions on MCF upserts + EXAMPLES append), `ProcessedWebhookEvent` table added, schema made Postgres-ready, **runbook** in `docs/postgres-migration.md`. Hosted-DB provisioning is the one remaining external step. |
| 2 | `no-stripe-checkout-and-ungated-production` | `src/lib/stripe.ts` + `POST /api/checkout` create checkout; first production moved to `checkout.session.completed`; hard `status==='ACTIVE'` guard at the top of `contentProductionTask` and `revisionProductionTask`. Unpaid Tally submission → **0 Claude calls**. |
| 3 | `approval-tokens-never-persisted` / `approval-secret-fallback` | `ApprovalToken` rows persisted with 7-day expiry; `consumeApprovalToken` atomically single-uses + tenant-binds; `AUTH_SECRET` fallback removed (hard error if unset). |
| 4 | `integration-secrets-plaintext` | `src/lib/crypto.ts` AES-256-GCM envelope encryption; Buffer/Beehiiv/Notion/Slack columns documented + written/read encrypted; `ENCRYPTION_KEY` required. |
| 5 | `publishing-missing` | `src/trigger/publishing.ts` (`APPROVED → PUBLISHING → PUBLISHED \| PUBLISH_FAILED`) + Buffer client + `POST /api/webhooks/buffer` post-failure handler. Honest copy when no channel is connected. |
| 6 | `dashboard-approve-broken` | Malformed token URLs replaced with authenticated `POST /api/content/[id]/[action]` (form POST), scoped to the logged-in client. |

### Block 2 — P1 (the loop actually loops)

| # | Finding | Resolution |
|---|---|---|
| 7 | `revision-no-reproduction` / `change-order-unenforced` | `revisionProductionTask` re-runs the writer with `Revision.feedbackText`; `REVISION_ROUNDS_INCLUDED = 2`, 3rd request → `CHANGE_ORDER_REQUIRED`. |
| 8 | `no-scheduler-registered` | `src/trigger/schedules.ts`: `weeklyProductionScheduler` (cron, enumerates ACTIVE clients) + `biweeklyActivityUpdate` email. |
| 9 | `meter-leak` / `content-action-undefined` | Metering moved to the delivery point (`email-delivery`), idempotent via `meteredAt`; discovery + hold + redelivery metered uniformly. `1 Content Action = 1 delivered item` codified in `pricing.ts`. |
| 10 | `token-counts-zero` / `call-budget-unenforced` | `createCallTracker` accumulates tokens + call count onto `AgentRun`; `MAX_CLAUDE_CALLS_PER_ACTION` enforced (escalates via `CallBudgetExceededError`). |
| 11 | `no-rate-limit-throttling` / `json-parse-unguarded` | Per-account queue concurrency + SDK 429 backoff (`maxRetries`); all model JSON parsed via `safeParseJson` → run fails cleanly instead of full-task retry. |

### Block 3 — P2 (drift)

| # | Finding | Resolution |
|---|---|---|
| 12 | `deterministic-checks-as-llm-calls` | `src/lib/checks.ts` — platform-format + boundaries run as pure functions before any LLM call. |
| 13 | `confidence-self-eval-circular` | `confidenceScore` now derived from `runOrchestratorEval`; enum typo `AutononomyLevel → AutonomyLevel` fixed; `autonomyThreshold` field added. |
| 14 | `storagekey-keyed-on-agentrun` | Content keyed on `contentItemId` + version; revisions write new immutable objects (`v2`, `v3`, …). |
| 15 | `stripe-system-clientid-hack` | Replaced by `ProcessedWebhookEvent` unique on `(source, eventId)`. |
| 16 | `dashboard-theme-contradicts-plan` | Dark theme ratified as canonical (see review third pass); emails remain cream/gold for inbox legibility, by design. |
| 17 | unplanned wins | Discovery Mode + two-layer eval documented (review third pass); discovery approvals tracked as a **separate cohort** for the approval-rate metric. |
| — | `tally-idempotency-weakened` | Idempotency keyed on `submissionId` alone; email collisions handled explicitly (re-onboarding rebuilds the MCF on the existing record). |

## Sprint-2 gate (status)

- [x] All P0s closed in code (payment gate, tokens, secrets, publish path, dashboard approve).
- [x] Weekly loop runs (registered scheduler).
- [x] Revision loop produces a revised draft; change-order cap enforced.
- [x] Metering honest (per delivered item, idempotent).
- [x] Cost accounting real; call budget enforced.
- [ ] **Hosted Postgres provisioned + concurrent-write verified** — external step, runbook ready.
- [ ] Tally form finalized and field IDs locked (`tally-fieldmap-placeholders`) — needs the real form.

**Once the two unchecked items are done, Sprint 2 (Agent Core) may begin.**

---

*Voyce Build Plan — Third Pass — GStack Autoplan — 2026-06-18*
