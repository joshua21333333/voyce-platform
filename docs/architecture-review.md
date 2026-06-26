# Voyce — Architecture Review

> GStack Autoplan — YC Office Hours Format  
> Generated: 2026-06-08  
> Status: Pre-build decision document

---

## Executive Summary

Five questions that determine whether Voyce ships something valuable or ships something complicated:

**1. Can the system produce a draft that sounds like the founder?**
Everything else is downstream of this. The entire value proposition — autonomous content, voice-matched output, trusted publishing — collapses if the first draft reads like generic AI copy. Before Agent 03 through Agent 11 are designed, the answer to this question must be demonstrated with real client feedback. Sprint 1 is an experiment, not a product launch.

**2. Is the Orchestrator a reliable coordinator or a single point of failure?**
The current architecture routes every agent task, every quality check, every workflow decision, and every client context operation through a single agent. When it degrades, stalls, or hallucinates a routing decision, the entire production pipeline stops for every affected client simultaneously. There is no described fallback, circuit breaker, or recovery path. This is not a theoretical risk — it is a design flaw that will produce incidents at scale.

**3. Can the file-based data layer survive multi-agent concurrent writes?**
The Master Context File is read by agents and written by Agent 10, with insights fed back by Agent 07, all potentially during the same production run. Flat markdown files have no locking, no transactions, and no conflict resolution. The spec mixes SQLite-via-Prisma and file-based storage as if they are complementary. They are not — one must win as the authoritative source of truth, and it should not be a markdown file.

**4. Is the Starter tier economically viable?**
At $99/month (revised from the original $40) with COGS of $11–13/month per client, gross margin is approximately 87% — defensible as long as prompt caching is applied to stable MCF sections and revision loops are capped at 3 cycles. The original $40 pricing would have produced negative or breakeven margin after Claude API eval-loop costs. The current $99/$249/$499 tier structure was locked after architecture review.

**5. Which ICP is Voyce actually building for?**
The architecture is sized for a growth-stage startup with a marketing lead and clear content benchmarks. The pricing is positioned for a bootstrapped solo founder who cannot afford $200/month for a tool they are still evaluating. These are different products with different onboarding flows, different retention levers, and different sales conversations. The current spec serves both profiles with the same system and will produce inconsistent results across all customer conversations until this is resolved.

---

## 1. Agent Architecture

### What the Analysis Got Right

The instinct behind specialist agents is architecturally sound. A Content Writer with a constrained system prompt focused exclusively on voice-matched output will outperform a general-purpose agent that also handles SEO, repurposing, and ad copy. Narrow context windows with specific tools produce more consistent results than bloated prompts trying to do everything. The 8-check evaluation loop is the right pattern for quality control — sequential LLM passes that catch specific failure modes are more reliable than asking a single call to evaluate everything at once.

The Orchestrator-as-central-coordinator pattern is also appropriate for a system where tasks have dependencies and client context must be consistent across calls. The alternative — a peer-to-peer mesh of agents that route to each other — is dramatically harder to debug and monitor.

### What Is Over-Engineered

**The 11-agent count is inflated by approximately 40%.** After examining each agent's functional responsibilities, the genuinely distinct agent count is 6 to 7. The overlap problems are specific:

Agent 09 (Skills Interpreter) is routing logic wrapped in a system prompt. Its described responsibilities — reading skill files, translating to platform format, routing to the correct specialist, storing in persistent memory — are a parser, a lookup table, and a database write. None of these actions require an LLM call. If an LLM call is being made, the team is spending tokens on work that a deterministic router handles faster, cheaper, and more reliably. This function belongs inside the Orchestrator's initialization logic. The agent count goes from 11 to 10, the architecture becomes simpler, and nothing is lost.

Agent 08 (AEO/GEO Specialist) is a subset of Agent 05 (Researcher). Both do competitive analysis, both monitor what entities are saying about topics, both inform content strategy. AEO optimization is a specialized prompt template applied within a research function — it is not a separate architectural boundary. The correct implementation is a Research agent with an AEO prompt template available as a mode, not two agents with overlapping monitoring responsibilities.

Agent 06 (Repurposer) vs. Agent 02 (Content Writer): the functional difference between "write a LinkedIn post in this founder's voice" and "convert this approved article to a LinkedIn post in this founder's voice" is a system prompt delta and an additional input — the source artifact. This does not justify standing up separate agent infrastructure. The Content Writer, given the approved article as context and a format instruction, handles repurposing. The Repurposer is a prompt template, not an agent boundary.

**The consolidated architecture that covers all the same functional territory:**
- Agent 01: Orchestrator (absorbs Agent 09 routing logic)
- Agent 02: Content Writer (handles original content and format transformation)
- Agent 03: SEO Specialist
- Agent 04: Ad Copywriter
- Agent 05: Researcher (absorbs Agent 08 AEO capabilities as a mode)
- Agent 07: Performance Analyst
- Agent 10: Content Intelligence
- Agent 11: Video Production

That is 8 agents doing 11 agents worth of work, with cleaner boundaries and fewer inter-agent handoffs.

### Sprint Sequencing for Agent Rollout

**Sprint 1 (the only agents that should exist):**
Agent 01 (Orchestrator with routing logic collapsed in) and Agent 02 (Content Writer with full voice fingerprinting and MCF loading). The entire Sprint 1 experiment is: does the draft sound like the founder? Two agents. One workflow.

**Sprint 3–4 (post-voice-match validation):**
Agent 03 (SEO) requires content volume before keyword optimization is meaningful. Agent 04 (Ad Copywriter) targets a different buyer segment — do not bifurcate the ICP before the core product is validated. Repurposing capability is valuable only after the original content loop is reliable.

**Sprint 5–6 (post-retention data):**
Agent 07 (Performance Analyst) requires months of data to produce actionable insights. Building it in Sprint 2 is premature construction. Agent 05 (Researcher) is not blocking early production — the MCF founder-provided context is sufficient for the first 90 days.

**Sprint 8+ or as a premium add-on:**
AEO/GEO capabilities. This is a niche enough discipline that charging for it as a premium module is more defensible than including it in the base product.

**Sprint 15+ or evaluate for removal:**
Agent 11 (Video). Correctly deferred. Do not let scope pressure pull this earlier.

**Agent 10 (Content Intelligence) — replace entirely for early-stage clients:**
The Apify scraper introduces compliance exposure (platform ToS varies), infrastructure cost, and a failure mode where stale scraped data creates content that contradicts the founder's recent statements. For clients with insufficient public activity volume to generate useful signal, the scraper produces noise. A biweekly "what have you been up to?" structured Tally prompt achieves equivalent or better data quality at this stage, with zero infrastructure overhead and no compliance exposure. Agent 10 is a Series A enterprise feature. Replace it with a structured activity update form for the first 18 months.

---

## 2. Data Layer Design

### The Core Decision

The spec presents file-based storage and SQLite-via-Prisma as a combined data layer. This is not a combined layer — it is two competing persistence strategies that must be resolved before code is written. **The database wins. Completely.**

Flat markdown files provide no concurrency protection, no atomic transactions, no query capability, no schema enforcement, and no migration path when the product evolves. At 11 concurrent agents potentially writing to the same client's data, race conditions on markdown files are not edge cases — they are the default operating condition. A production run that crashes between the three file writes required to record an approval leaves the system in a permanently inconsistent state. There is no rollback.

More critically: every major deployment target for a Next.js application (Vercel, Railway, Render) uses ephemeral container filesystems. Files written during request handling are gone when the container recycles. The file-based persistence model is architecturally incompatible with the deployment environment the tech stack implies. This is not a future scaling concern — it is a Sprint 1 deployment blocker.

### The Recommended Three-Layer Architecture

**Layer 1: PostgreSQL via Prisma (source of truth for all structured data)**

This layer owns everything that is relational, queryable, or needs transactional guarantees: client records, subscription state, content calendar entries, draft status and approval state, agent run logs, quality check results, revision records, performance metrics, billing events. The Prisma schema is already database-agnostic — switching from SQLite to PostgreSQL requires changing a single line in `schema.prisma` and running `prisma migrate deploy` against a Postgres instance. Supabase, Neon, and Railway all support this out of the box at zero or low cost for early production.

**Migrate to Postgres before Sprint 1 ships to any real client.** SQLite's single-writer lock will cause contention the first time two agents attempt concurrent writes for the same client. This is not a risk to evaluate — it is a certainty to eliminate.

The Master Context File becomes a `client_context` table with rows keyed by `(client_id, section_type)`. Section types are an enum: `voice_profile`, `audience`, `content_pillars`, `brand_opinions`, `competitor_intel`, `quality_standards`, `platform_config`. Each row carries a `content` column (JSONB or TEXT), a `version` integer, `updated_at`, and `updated_by`. The "Master Context File" that agents load is assembled at runtime from a query fetching only the sections declared by that agent type — the Content Writer does not load the competitor SEO audit; the Ad Copywriter does not load the full voice fingerprint history. This assembly function produces a markdown string for injection into the system prompt, which preserves the human-readable, LLM-friendly format while moving the source of truth to the database.

**Layer 2: Object Storage (S3 or Cloudflare R2 for content artifacts)**

The actual text of drafted articles, approved newsletters, ad copy variants, and repurposed content are write-once blobs that do not benefit from relational structure. They belong in object storage. The database stores a `storage_key` field pointing to the object; the object store holds the content. This is the industry-standard pattern for content platforms. R2 has no egress costs and integrates cleanly with Next.js via the AWS SDK. Content artifacts are immutable — revisions create new objects with new keys, never overwrites.

**Layer 3: Vector Store (pgvector extension on Postgres for Sprint 1; dedicated service later)**

The `examples-database` and `swipe-file` concepts are semantic retrieval problems. When the Content Writer needs to match the client's voice, the correct operation is querying for the 5 most semantically similar approved pieces, not loading a flat file of all examples and passing it in full. The pgvector extension on Postgres handles this for early production without introducing a separate infrastructure dependency. At 500+ clients with dense example libraries, migrate to a dedicated service (Pinecone or Weaviate). For Sprint 1, pgvector on the same Postgres instance is sufficient.

### Prompt Caching as a First-Order Economic Control

The stable sections of the client context — voice profile, audience definition, content pillars — change infrequently. Claude's API supports cache-control headers on system prompt content. Marking these sections as cacheable means the 5-minute cache window covers burst execution and the 1-hour extended cache covers weekly production runs. Cache hits cost approximately $0.30 per million tokens versus $3.00 for full reads — a 90% reduction on stable context sections.

Without prompt caching, loading a 6,000-token context 8 times for a single production run's eval passes costs $0.14 in input tokens alone per client per run. Across 100 clients running weekly, that is $58/month purely in context loading before any generation tokens. The math compounds unfavorably at growth-tier client counts. Prompt caching is the highest-leverage cost optimization available and should be implemented in Sprint 1 regardless of which other architectural decisions are made.

### Append-Only Logs Become Typed Events

`revision-history.md` and `performance-log.md` as flat files are incompatible with the Performance Analyst's actual job. Answering "which content pillars underperformed in Q1?" from a markdown file requires loading the entire document, parsing inconsistently formatted entries, and filtering in application code. At month 12 for an active client, this file could be 50,000+ words being passed to an LLM.

The correct model is an events table: `(id, client_id, content_item_id, platform, metric_type, value, recorded_at)`. The Performance Analyst receives a structured summary generated by a SQL query — aggregate engagement by platform, content volume by type, revision rate, average time to approval. This structured summary is both cheaper in tokens and more reliable in data quality. Revision history becomes a `revisions` table with `(content_item_id, revision_number, previous_version_key, feedback_text, created_at)`, enabling analytics that are genuinely useful and completely unachievable from a flat file.

---

## 3. Workflow Engine and Integration Stack

### The Critical Path

The Sprint 1 critical path is narrow and must be built in this sequence: Tally webhook → idempotency check → client record creation → MCF section build → Orchestrator initialization → Content Writer production run → email delivery → approval signal → Buffer publish → Stripe metering decrement.

Everything not on this path is Sprint 2 or later. This is not a suggestion — it is a timeline constraint. Each integration not on this list is 1 to 4 days of work with testing and error handling that produces no additional AI capability and delays validation of the core hypothesis.

### Integrations Required for Sprint 1

**Tally:** The pipeline entry point. Build the Tally submission ID as an idempotency key from day one. Before executing any side effects on webhook receipt, check whether a client record with that submission ID already exists. Return 200 and exit if it does. Add a unique constraint at the database level. Tally returns field IDs rather than labels in its webhook payload, meaning the form field to MCF section mapping is brittle if the form is edited. Store this mapping as a configuration file, not hardcoded logic, so it can be updated without a code deploy.

**Claude API:** Every agent depends on it. No stubs. Implement prompt caching on stable MCF sections immediately. Enforce a token budget per agent call — a maximum of 3 revision loops before a quality failure is escalated to human review. Without this cap, a malformed prompt causes infinite retries and unbounded API costs.

**Stripe:** Implement exactly five webhook events for Sprint 1: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`. Use Stripe's event ID as the idempotency key. Verify webhook signatures on every request — Stripe sends a `Stripe-Signature` header for this purpose, and skipping verification is a security vulnerability. The Content Actions counter must decrement atomically at the database layer using a check constraint, not application-layer logic. A race condition where two concurrent agent executions both claim the last available actions against the same client account will occur in production. For Sprint 1, implement a hard stop at the action limit with a notification. Upgrade to soft-warn-then-stop in Sprint 2.

**Email (Resend or SendGrid):** No OAuth per client, works universally, handles formatted HTML drafts cleanly. Build with proper threading so replies become approval signals. This is the only delivery channel for Sprint 1. The five-channel approach (email, Slack, WhatsApp, Notion, Google Docs) is 1–2 weeks of plumbing that adds zero AI capability. Slack requires per-workspace OAuth and Block Kit formatting. WhatsApp requires Meta Business API, phone verification, and pre-approved message templates. Build email, build it correctly, and ship.

**Buffer:** In Sprint 1 scope and the most technically subtle of the required integrations. Developers commonly assume a successful Buffer API call means a successful social post. Buffer's architecture does not work this way — the API acknowledges receipt, and the actual platform post happens asynchronously. Failures surface via webhook events that arrive minutes or hours later. If the `post_failed` webhook handler is not built in Sprint 1, posts will silently fail in production with no visibility. This is a category of bug that only surfaces with real client accounts posting to real platforms, typically after launch. Build the `post_failed` handler before shipping to any client.

### Integrations to Stub or Defer

Beehiiv, Ghost, Substack, WordPress, and Webflow are each 1–4 days of integration work with distinct authentication patterns, API shapes, and content format requirements. Substack has no official public API — any integration is a workaround with undefined longevity. Mock publishing actions for Sprint 1 (write to a log or a draft database record), ship real integrations in Sprint 2 by demand signal from actual clients.

Google Analytics, Semrush, and Apify support agents (Performance Analyst, SEO Specialist, Content Intelligence) that are explicitly not Sprint 1 scope. Stub them entirely.

Spiral stylometry: treat it as a swappable function that accepts text and returns a style fingerprint. For Sprint 1, implement Claude-native voice matching via few-shot examples from the MCF. Architect the interface contract so Spiral can be dropped in as a pre-processing step without changing the Content Writer's logic. Treating Spiral as a required Sprint 1 dependency adds an external service to the critical path for a capability that can be adequately approximated with prompt engineering at this stage.

### Integration Risk Register

| Integration | Sprint 1 Required | Key Risk | Mitigation |
|---|---|---|---|
| Tally | Yes | Duplicate webhooks, brittle field mapping | Idempotency key, config-driven field map |
| Claude API | Yes | Cost overruns if MCF builds loop | Token budget per agent call |
| Stripe | Yes | Async webhook ordering, metering race conditions | Idempotency keys, atomic DB decrement |
| Email delivery | Yes | Low — mature tooling | Use Resend or SendGrid |
| Buffer | Yes | Silent async post failures | Implement post_failed webhook handler |
| Spiral | No | Blocking dependency if treated as required | Stub with Claude few-shot voice matching |
| All other publishing platforms | No | Each is 2–4 days of work | Defer to Sprint 2+ |
| Slack/WhatsApp/Notion/Docs delivery | No | Disproportionate build time vs value | Email only for Sprint 1 |

---

## 4. Business Model Assessment

### ICP Ambiguity Is the Primary Strategic Risk

The current positioning spans three distinct customer profiles: the bootstrapped solo founder for whom $40/month is a real expense and every post is high-stakes personal branding; the early-growth startup with a marketing lead, clear content benchmarks, and budget for infrastructure; and the implicit agency operator managing multiple clients. These are not the same product with different price points — they have fundamentally different onboarding requirements, different definitions of success, different approval workflows, and different retention levers.

The architecture is built for Profile B (growth-stage startup). The pricing is aimed at Profile A (solo founder). This mismatch will produce inconsistent sales conversations, high early churn from founders who expected a ghostwriter and received a content system, and premature feature requests from growth-stage buyers who want performance dashboards before the voice model is calibrated.

Pick one ICP for Sprint 1. The evidence from the architecture strongly suggests Profile B is the intended customer — the architecture (MCF sophistication, SEO infrastructure, performance feedback loop) is built for a buyer with content strategy maturity. The revised pricing ($99 Starter) reflects this: it's still impulse-buy territory for a B2B founder, but it correctly positions Voyce as a content system rather than a cheap writing tool. Consider positioning Starter explicitly as a 60-day calibration tier that graduates to Growth on the first successful publish cycle.

### Unit Economics: Revised Pricing Locks in Margin

Pricing tiers (revised 2026-06-08):
- **Starter — $99/month** — 50 Content Actions — solo founders, early operators
- **Growth — $249/month** — 150 Content Actions — scaling founders, small teams
- **Pro — $499/month** — 400 Content Actions — growth-stage companies
- **Enterprise — Contact us** — unlimited, multiple brand profiles

Estimated Starter tier COGS at $99/month:
- Claude API: ~$6.30/month (50 actions × 8 calls × 4,000-token context)
- Infrastructure, Semrush amortized, Buffer, hosting: ~$4–7/month
- Total COGS: ~$11–13/month
- Gross margin: **~87%** — defensible as long as prompt caching and a 3-cycle eval loop cap are in place

The original $40/$80/$199 pricing was flagged as margin-destroying. At $40, Claude API alone could consume 30–40% of revenue per client depending on usage. The revised pricing makes $249 Growth an easy B2B justification against a $3,000 agency retainer, and $499 Pro the obvious choice for anyone serious. Implement prompt caching and the revision loop cap in Sprint 1 regardless.

### The Autonomy Trust Curve Must Be a Named Product Feature

"Autonomous publishing" is the most compelling feature claim and the most significant adoption barrier. No first-time client authorizes AI publishing on day one. The trust arc should be named and visible in the dashboard:

- **Weeks 1–4:** Every piece requires explicit approval. System builds revision history and correction patterns.
- **Weeks 5–8:** System surfaces confidence signals ("this draft matches your last 3 approved pieces at 94% style consistency").
- **Month 3+:** Client grants auto-publish permission for specific content types above a confidence threshold.
- **Month 6+:** Full autonomous publishing with a 48-hour review window rather than an approval gate.

Without this arc as a named feature — "Autonomy Levels" or "Trust Progression" — clients default to human-in-the-loop indefinitely, increasing their workload and accelerating churn at the 3–4 month mark when the novelty of reviewing every draft wears off.

### Realistic Churn Drivers (Ranked)

1. **Voice mismatch** — early drafts that "don't sound like me" are the fastest path to cancellation. Highest risk in the first 60 days.
2. **Approval loop inertia** — clients who go dark create stalled pipelines that precede churn. The 48-hour follow-up is necessary but insufficient; add a one-tap approval in the follow-up email.
3. **Integration friction** — a single failed publish that posts nothing or posts a draft destroys trust fast.
4. **Plateau effect** — after 3–6 months, content becomes repetitive without the Performance Analyst and Researcher injecting new angles.

---

## 5. Tech Stack Decisions

### Next.js: Keep the Frontend, Change the Backend Runtime

Next.js is the correct choice for the dashboard frontend. It is the wrong primary runtime for agent orchestration. The core workload — sequential LLM pipelines, conditional branching, retry logic, step checkpointing — is fundamentally incompatible with the stateless request/response model that Next.js API routes implement. Vercel's execution limits (60 seconds on Pro, 300 on Enterprise) will be routinely exceeded by an 8-check evaluation cycle making 3+ sequential Claude API calls.

The recommended architecture: Next.js API routes as a thin gateway layer (they accept requests, enqueue jobs, return job IDs immediately). All agent execution runs in a dedicated worker process outside the HTTP request context.

For Sprint 1, **Trigger.dev** is the recommended choice — not BullMQ as a Sprint 1 solution with Trigger.dev as a later migration. Trigger.dev provides durable step-level checkpointing (a partial agent run is resumable, not restartable from scratch), built-in observability, replay, and alerting as first-class primitives. The "marginally more initial configuration" compared to BullMQ is a one-time cost. Migrating from BullMQ to Trigger.dev mid-product with live client jobs in flight is a much larger cost paid at the worst possible time. Trigger.dev's hosted tier removes all infrastructure management at low client counts and eliminates the Redis dependency entirely.

### Database: Migrate to Postgres Before Sprint 1 Ships

SQLite is acceptable for local development. Multiple worker processes will contend on SQLite's single-writer lock the moment two agents attempt concurrent writes for the same client. Prisma makes this a one-line change: `provider = "postgresql"` in `schema.prisma`, then `prisma migrate deploy` against a Supabase or Neon instance. Do this before onboarding any paying client.

### Auth: Single-Instance NextAuth for Sprint 1 Through Sprint 10

A single Next.js app serving both dashboard and API layer. NextAuth manages sessions. The background worker process shares the same database directly and does not need to handle auth. Migrate to a separate frontend/backend architecture with JWT Bearer tokens when there is a dedicated backend team or when Next.js becomes a measurable bottleneck — which will not occur before 500+ active clients.

### Tech Stack Decision Summary

| Decision | Recommendation |
|---|---|
| Backend runtime | Next.js API routes as thin gateway; **Trigger.dev** for all agent execution |
| Data system of record | Postgres via Prisma; files are generated artifacts only |
| Async tasks | Job queue with checkpointed steps; webhooks for external APIs |
| Eval pipeline | Parallel independent checks; step-level checkpointing; max 3 retry cycles |
| Scheduler | Trigger.dev scheduled tasks |
| Database | Migrate to Postgres (Supabase or Neon) before first real client |
| Auth | Single Next.js instance with NextAuth; worker shares the DB directly |
| Content artifacts | Cloudflare R2 (no egress costs) addressed by storage_key in DB |

---

## 6. Critical Risks (Ranked by Severity)

**Severity 1 — Orchestrator single point of failure.** Every agent, every quality check, every workflow decision routes through a single agent with no described fallback. Design the failure mode before writing integration code. Required mitigations: circuit breaker pattern with a maximum retry count before escalation to a human-readable error state; database-level job state tracking so a stalled Orchestrator job can be inspected and manually restarted; Orchestrator prompt versioning so degradation can be detected by comparison against a known-good baseline.

**Severity 2 — Voice mismatch causing early churn.** The product's entire value proposition is voice fidelity. If the first draft reads like generic AI content, the client cancels before the voice model has time to calibrate. This risk is highest for clients with limited prior content to train on. Mitigations: set explicit expectations during onboarding that calibration requires 3–5 approved drafts; surface a "calibration progress" indicator in the dashboard; treat the first draft as a collaborative exercise, not a finished product.

**Severity 3 — Master Context File race conditions.** Concurrent agent reads and writes to client context without a locking mechanism will produce silent inconsistencies in SQLite and data corruption at the application layer. The database architecture change (Section 2) is the primary mitigation.

**Severity 4 — Token cost spiral from uncontrolled eval loops.** A client whose MCF voice profile is inconsistently specified can generate continuous quality failures that trigger infinite revision loops. Implement: maximum 3 revision cycles per Content Action before human escalation; prompt caching on stable MCF sections; a per-action token budget enforced at the worker level.

**Severity 5 — Tally webhook duplication on client onboarding.** A duplicated webhook fires onboarding twice, creates duplicate Stripe customer records, and sends a duplicate confirmation email. The idempotency key pattern is the complete mitigation and must be in Sprint 1 scope.

**Severity 6 — Buffer silent post failures.** A production environment where social posts silently fail without any error surface is a client trust issue that surfaces post-launch when it is most damaging. The `post_failed` webhook handler is a Sprint 1 requirement, not a Sprint 2 enhancement.

**Severity 7 — ICP mismatch producing unqualified customers.** The pricing attracts solo founders; the architecture serves growth-stage teams. Misaligned customer expectations produce churn at month 2–3, after onboarding costs are sunk but before lifetime value materializes.

---

## 7. Key Decisions Required Before Sprint 1

These decisions cannot be deferred. Building before making them means building against an assumption that may need to be reversed.

**Decision 1: Choose one ICP.** Define whether Sprint 1 is targeting the solo founder or the growth-stage startup. This determines pricing, onboarding flow complexity, the minimum viable voice calibration approach, and the sales narrative. The architecture as designed is better suited to the growth-stage buyer. If that is the decision, revise the Starter price floor before the first sales conversation.

**Decision 2: Commit to Postgres before any client onboarding.** The SQLite-to-Postgres migration is a one-line Prisma change. Doing it after the first client is onboarded means migrating live data. Do it before. Supabase or Neon, free tier, deployed alongside the application before Sprint 1 ships.

**Decision 3: Define the Content Actions accounting model.** Specify whether a "production run" that yields 3 LinkedIn posts and 1 newsletter consumes 4 actions or 1. Document it in the product spec before the first Stripe integration code is written. The billing handler logic, the dashboard counter display, and the limit enforcement all branch on this definition. Ambiguity here will produce bugs that charge clients incorrectly.

**Decision 4: Define the Orchestrator failure mode.** Before writing the Orchestrator's system prompt or integration code, specify what happens when it returns an error, exceeds context length, or produces an unroutable quality failure. Define the maximum retry depth, the escalation path, and the client-facing error message. Document this in the agent specification before implementation begins.

**Decision 5: Establish the per-action token budget.** Set a maximum number of Claude API calls per Content Action and a maximum token count per call. A reasonable starting constraint: 10 Claude calls maximum per Content Action, 8,000 tokens maximum context per call (with caching applied to the stable MCF sections).

**Decision 6: Define the approval workflow for Sprint 1 completely.** Specify: what constitutes approval (email reply, button click, inaction after 48 hours?), what triggers a revision request, what happens when a draft is approved but the Buffer post fails, and whether repurposed content requires separate approval or inherits the original approval.

**Decision 7: Stub vs. integrate Spiral.** Define the interface (function accepts text, returns style fingerprint), implement with Claude few-shot matching, document the Spiral integration as a Sprint 3 enhancement to the same interface. This keeps the critical path clean without permanently deferring voice fingerprinting quality.

---

## Appendix: Adversarial Challenge

*Six challenges issued after the primary review — each identifies a blind spot in the above analysis.*

**1. The most dangerous assumption: onboarding data quality is sufficient to produce voice-matched output.**

Sprint 1's hypothesis is framed as a test of the AI system. It is not. It is a test of the onboarding form. The quality of the Master Context File is a direct function of what founders type into Tally fields under pressure, without coaching, in a single sitting. Most founders will write vague, aspirational answers. "I want to sound authentic and data-driven" is not a voice profile. The Content Writer will produce competent generic AI content, the approval rate will be 35–45%, and the team will spend Sprints 3 and 4 rebuilding the agent architecture when the actual problem is that a Tally form cannot capture voice in one pass.

Recommendation: add a mandatory human-assisted MCF review step before the first production run. A 30-minute founder interview, conducted by a human, produces MCF inputs that a self-serve form cannot. Standard for the first 10 clients, with automation of the intake process deferred until there is empirical evidence of what good MCF inputs look like at scale.

**2. The underweighted technical risk: Claude API rate limits under concurrent multi-client production loads.**

The architecture review discusses token cost economics and prompt caching carefully. It does not mention rate limits once. Claude's API enforces requests-per-minute and tokens-per-minute limits at the account level. A system designed to run production jobs for 50 concurrent clients on a Monday morning — each job making 8–10 sequential API calls — will hit rate limit errors before it hits cost problems. Rate limit errors in the middle of an eval chain produce partial results and retry storms that make the rate limit problem worse.

The build plan must specify a client-level job throttling strategy before Sprint 2: maximum concurrent production runs per account tier, exponential backoff with jitter on rate limit responses, and a queue depth monitor that alerts before the system is in a degraded state.

**3. Sprint 1 is still too large. The absolute minimum viable experiment is:**

Tally form submission → Claude API call with that submission as context → one piece of content returned → sent to the founder's email. No database migrations. No approval tokens. No Stripe checkout. No dashboard. No Trigger.dev. A founder reads the draft and replies "yes" or "no" to the email.

That experiment can be built in two days and answers the only question that matters in Sprint 1. If the approval signal is strong, everything the build plan specifies for Sprint 1 is worth building correctly. If the signal is weak, the team needs to understand why before building any infrastructure around the broken loop.

Recommendation: Sprint 1 Phase A is a throwaway prototype (two days, no production code). Sprint 1 Phase B is the production implementation — only if Phase A approval rate exceeds 50%.

**4. The unaddressed competitive threat: frontier models shipping native memory and voice features.**

Anthropic's Projects feature, OpenAI's Memory, and Google's Gems all allow a user to define persistent instructions and upload writing samples that the model applies across future sessions. A sophisticated founder can replicate 60–70% of Voyce's Sprint 1 value proposition in 20 minutes using a free tier of any of these tools. The gap is workflow automation, approval routing, calendar scheduling, and publishing integrations — a real gap, but an operational tool gap, not an AI capability gap.

The positioning cannot be "AI that writes like you." It must be "the only system that removes you from the content production loop entirely," with emphasis on the workflow automation, the approval-to-publish pipeline, and the accountability structure.

**5. The tech stack decision worth disagreeing with: Trigger.dev as the Sprint 1 choice over BullMQ.**

This point is in tension with the review's own recommendation. BullMQ on Fly.io introduces three separate infrastructure concerns — Redis provisioning and failover, Fly.io deployment and worker scaling, and the operational overhead of a separate worker fleet. Trigger.dev's hosted tier eliminates all of this at low client counts. The review correctly identifies Trigger.dev as the better long-term choice but inconsistently positions it as a Sprint 5 migration target. Use Trigger.dev from Sprint 1.

**6. The most likely reason this product fails is not the architecture — it is that the sales motion requires founders to trust AI with their public voice before they have any evidence the AI can be trusted.**

Content is identity for the founders this product targets. A bootstrapped founder's LinkedIn presence is their professional reputation, their deal flow, their hiring signal, and their investor narrative. Asking them to pay before seeing output creates a trust barrier that no landing page resolves.

Specific recommendation: build a zero-commitment voice audit before Sprint 1 ships. A founder uploads three pieces of their writing and one URL, the system produces a sample draft and a voice fingerprint summary, and the founder sees the output before any payment prompt appears. That single change moves the sales motion from "pay to find out if it works" to "see that it works, then pay."

---

*Voyce Architecture Review — GStack Autoplan — 2026-06-08*  
*Pre-build document. Review against Sprint 1 timeline before implementation begins.*

---
---

# Second Pass — Code Reconciliation Review

> GStack Autoplan — YC Office Hours Format (re-run)  
> Generated: 2026-06-16  
> Status: Post-Sprint-1A/1B reconciliation — read the 2026-06-08 review above first

## Why this section exists

The review above was written **before any code existed**. Since then, Sprint 1A (throwaway prototype) shipped in full and Sprint 1B is roughly **70% built** (commits `717c800`, `e8d3b3e`, `98fd3dc`, `96f51e1`, `3eb59f2`). The original review's framing — "decide these things before you write code" — has been overtaken by events: several decisions were silently resolved *by the implementation*, some correctly and some by accident.

This second pass was produced by a fan-out of independent reviewers across 8 dimensions, each reading the actual shipped code, with every P0/P1 finding adversarially verified against `file:line` evidence. It does **not** restate the first review. It reports three things the first review could not:

1. **Where the shipped code drifted from the plan** (and where it quietly exceeded it).
2. **Which architectural risks the first review named are still unmitigated in code** — and which it got wrong.
3. **Concrete resolutions to the open pre-build decisions**, grounded in what the code already does.

Every finding below carries a stable ID; the remediation tasks in `build-plan.md` reference these IDs.

## What the shipped code got right (verified)

Credit where due — these go beyond what the first review demanded:

- **Prompt caching is correctly implemented.** `src/lib/claude.ts` marks the stable MCF block (`voice/audience/pillars/opinions`) `cache_control: ephemeral` and leaves dynamic sections uncached. This is the single highest-leverage cost control and it is real.
- **Tally and Stripe webhook signature verification are implemented**, and Tally's check fails *closed* on a missing secret. Good.
- **Discovery Mode** (`content-production.ts:42-80`) — a 3-variant cold-start path when a client lacks writing samples — is a thoughtful, unplanned answer to the first review's #1 adversarial challenge (thin onboarding data). It is also a double-edged sword (see `meter-leak`, `discovery-unmetered`).
- **The agent topology consolidated to ~8 agents with a deterministic routing file**, as the first review recommended.
- **The model is Sonnet 4.6, not Haiku** — which means the original COGS estimate was built on wrong inputs but landed on the right margin (see `cogs-recompute`).

## P0 — Ship blockers (must fix before any real client)

**`sqlite-still-provider` — The Postgres migration is a comment, not a migration.**  
`prisma/schema.prisma:14` still declares `provider = "sqlite"`; there is no `prisma/migrations/` directory (only `db push`), `dev.db` is the live store, and the `pgvector`/embedding column was deleted for SQLite compatibility. The first review called this its #1 blocker and framed it as "a one-line change." It is no longer one line: there is no migration baseline to deploy, and the Layer-3 semantic-retrieval column the review specified must be reconstructed. **Provision Neon/Supabase, generate an initial migration, and verify the `Promise.all` context upserts behave under a real concurrent writer before onboarding anyone** — SQLite serializes writes and hides the race that Postgres will expose.

**`no-stripe-checkout-and-ungated-production` — Unpaid clients receive drafts.**  
There is **no `stripe.checkout.sessions.create` anywhere in the codebase.** The Tally webhook creates a `PENDING` client and immediately fires `mcfBuildTask`, which unconditionally triggers `contentProductionTask` (`mcf-build.ts:108`). `contentProductionTask` gates only on the action limit (`content-production.ts:310`) — it never checks `status === 'ACTIVE'`. A Tally submission with zero payment produces a synthesized draft and emails it. "Billing gates access" (build-plan §Sprint 1B) is currently false. **Add a checkout flow, move the first-production trigger into the `checkout.session.completed` handler, and add a hard `ACTIVE` guard at the top of `contentProductionTask`** (the deferred `weeklyProductionTask` already has this guard — the live path bypasses it).

**`publishing-missing` — `APPROVED` is a terminal dead-end.**  
Approving content sets `status = APPROVED` and stops. There is no Buffer/Beehiiv code in `src/`, no worker reads `APPROVED` items, and nothing ever sets `PUBLISHED` or `PUBLISH_FAILED` (those enum values are dead). Yet the approved page and emails say "queued for publishing" / "Approve and publish." **The product currently makes a promise it cannot keep.** Either build the publish task (Buffer is explicit Sprint-1 MVP scope) or change the UI/email copy to "manual publishing" so it does not lie.

**`dashboard-approve-broken` — The dashboard Approve/Hold buttons always error.**  
They are wired to malformed approval-token URLs. The email path works; the in-app path does not. A client who approves from the dashboard hits an error.

**Security P0s** (see Security section below): `approval-token-no-scope-no-expiry-replay`, `approval-secret-fallback`, `integration-secrets-plaintext`.

## P1 — Must fix before scaling past the first handful of clients

**`approval-tokens-never-persisted` / `approval-secret-fallback` (Security P0).** The `ApprovalToken` table (with `expiresAt`, `consumedAt`) is **dead code** — zero `prisma.approvalToken` calls. Tokens are stateless HMAC blobs with **no expiry, no single-use, no tenant binding**, and the HMAC secret falls back to the literal `'fallback-dev-secret'` if `AUTH_SECRET` is unset (`tokens.ts:3`). A forwarded or re-opened email link is a **permanent, forgeable, replayable publish trigger**. The intended design is already in the schema — this is wiring, not redesign. Persist tokens with 7-day expiry + `consumedAt`, check both in the same transaction as the status change, and throw at startup if `AUTH_SECRET` is missing.

**`integration-secrets-plaintext`.** Schema comments claim `beehiivApiKey` and per-client integration secrets are "encrypted at the application layer." **No encryption code exists** — they are stored in plaintext. Either encrypt at rest (envelope encryption / KMS) or delete the false comment and treat the column as plaintext in the threat model.

**`no-scheduler-registered` — After the first draft, the pipeline is dormant.**  
`weeklyProductionTask` exists but is a plain `task()`, never registered as a `schedules.task()`/cron. The biweekly activity-update form is fully mapped but never sent. The *only* production run that ever fires is the single hardcoded trigger at the end of `mcf-build`. The "weekly production on the client's cadence" core loop **does not run.** It looks built (the task exists) but is inert.

**`revision-no-reproduction` + `change-order-unenforced` — The revision loop is a dead end.**  
Requesting a revision sets `REVISION_REQUESTED` and stops. **No worker reads `Revision.feedbackText` to produce a new draft** — a client who clicks "Request revision" gets silence. Separately, the "2 rounds included, 3rd = change order" rule is unenforced; `revisionNumber` increments unbounded, so revisions are unlimited and free.

**`meter-leak` (metering-leak-expensive-runs-free) — The costliest runs are billed at $0.**  
`contentActionsUsed` increments by 1 **only on the production-mode success path** (`content-production.ts:431`). Discovery mode (`return` at :362), internal-eval escalation (`return` at :393), and client revisions all do 4–6 Claude calls and **never decrement**. These are precisely the highest-frequency, highest-cost early-client scenarios. A client churning through Discovery + escalations can run dozens of paid jobs on a $99 plan while their counter reads `0/50`.

**`call-budget-and-tokens-unenforced` / `token-counts-hardcoded-zero` — The margin guardrails are fictional.**  
`MAX_CLAUDE_CALLS_PER_ACTION = 10` is never imported. `MAX_REVISION_CYCLES = 3` is imported but unused (the loop hardcodes `while (cycles < 2)`). `callClaude` returns real token usage, but `content-production.ts:379` writes `tokenInputCount: 0, tokenOutputCount: 0`. The build plan's own `$0.75/item` cost alarm (build-plan §Token Cost Tracking) **cannot fire** because cost-per-item is never recorded. The Severity-4 cost-spiral mitigation the first review mandated is, in code, unimplemented.

**`confidence-self-eval-circular` — Autonomy auto-approve would gate on the writer grading itself.**  
`confidenceScore` is set from the production loop's *own* `runVerification` self-eval (same cached context as generation), not from the independent `runOrchestratorEval`. Autonomy Level 2 (the planned auto-approve gate) would trust the specialist's self-grade — circular by construction. Compounding bugs: `orchestrator.md` gates on `client.autonomyThreshold`, a **field that does not exist** in the schema; the enum is **misspelled `AutononomyLevel`** and that typo is baked into the live column type. (Note: Autonomy Levels are a Sprint-3 deferral, so non-implementation is by design — but the schema typo and phantom field are real bugs to fix now.)

**`no-rate-limit-throttling` — Monday-morning retry storm is the default.**  
No per-account queue concurrency cap. `maxAttempts: 2` with no 429-specific backoff means concurrent multi-client production hits Anthropic rate limits mid-eval-chain and retries the *entire task* (re-charging every prior call). The first review flagged rate limits as a pre-Sprint-2 item; it remains unaddressed and is now coupled to the unguarded-`JSON.parse` problem below.

**`json-parse-unguarded`.** Three bare `JSON.parse` calls on Claude output (`content-production.ts:78,136,277`). A single malformed response throws → the whole Trigger task retries → every Claude call re-runs and double-charges. The "malformed-response circuit breaker" documented in `orchestrator.md:80` does not exist.

## P2 — Should fix; documents real drift

- **`deterministic-checks-as-llm-calls`** (over-engineering). `PLATFORM_FORMAT` (char/word/hashtag counts) and `BOUNDARIES_CHECK` (prohibited-phrase list — already literal strings in the MCF) are asked of the LLM. An LLM cannot reliably count to 280 or exhaustively match a banned list. These are the two checks with objective ground truth and the two most wasteful to spend a model call on. Make them pure functions that run *before* any LLM call and short-circuit on failure.
- **`storagekey-keyed-on-agentrun`** (data layer). The R2 content key is derived from `agentRun.id` but labeled `contentItemId`, and content is overwritten in place on revision — breaking the immutability contract the first review specified (revisions should be new objects).
- **`clientcontext-rmw-races`** (data layer). MCF-as-typed-rows is sound, but the "race is eliminated" claim is not borne out: the `EXAMPLES` row is mutated read-modify-write by the approvals route with no transaction/lock, and four writers (onboarding, Agent 07, biweekly form, approvals) contend on the same client's rows. Wrap mutations in interactive transactions with row locks or use the `version` column as an optimistic-concurrency token; model examples as child rows so appends are independent inserts.
- **`two-layer-eval-not-in-plan`** (scope creep). Shipped eval is a two-layer 7-check internal loop + 3-check orchestrator pass — never in the plan, ~2–4 extra Claude calls per run, weaker traceability. Decide whether it's intentional and document it, or collapse to the planned 3-check until approval-rate data justifies the extra passes.
- **`discovery-mode-unplanned`** (scope creep). Discovery Mode changes the headline metric: a "discovery approval" is the client picking a *style direction*, not approving a *voice-matched draft*. If discovery runs are counted in first-draft approval rate, the 40–70% hypothesis gate is measuring the wrong thing. Track discovery as a separate cohort.
- **`dashboard-theme-contradicts-plan`** (contradiction). The plan mandates cream/gold/Cormorant/DM-Mono "from day one." Emails honor it; the **dashboard ships a dark `#0d0e12`/blue theme** matching `usevoyce.lovable.app`. Two contradictory brand identities. Pick one (recommend: ratify the dark theme as canonical, update the plan, re-skin emails).
- **`tally-fieldmap-placeholders`** (risk). `config/tally-field-map.json` ships with **100% `REPLACE_WITH_*` placeholder IDs**. Until the real form is finalized and IDs locked, onboarding maps nothing → every client falls into Discovery Mode. The webhook handler is untestable against a live form today.
- **`stripe-system-clientid-hack`** (drift). Stripe idempotency markers are written as fake `AgentRun` rows with `clientId: 'system'`, wrapped in `.catch(() => null)`. `AgentRun.clientId` is a required FK; under Postgres the insert throws, the catch swallows it, and **Stripe idempotency silently degrades to none** — enabling double-processing of `checkout.completed` and `payment_succeeded`. Use a dedicated `ProcessedWebhookEvent` table with a unique constraint on the Stripe event ID.
- **`tally-idempotency-weakened`** (risk). Idempotency dedupes on `submissionId OR email`, so any *distinct* second submission from a returning/re-onboarding client is silently dropped. Key on `submissionId` alone; handle email collisions explicitly.

## Corrections to the first review

- **`cogs-recompute`** — The first review's `$6.30/mo` Claude figure assumed 8 calls × 4k context. The shipped happy path is **4 calls** (plan, execute, 1 verification, 1 orchestrator eval); worst case 6. Recomputed with real Sonnet-4.6 pricing and cache economics: **~$0.062/action happy, ~$0.093 worst, ~$3.71–$8/mo** depending on format. **The ~87% margin headline survives — but for different reasons than stated.** Do not re-price; do fix the misleading rationale in `pricing.ts` so future cost work targets real drivers (the metering leak, uncached examples in the verification message) rather than phantom 8-call loops.
- **`moat-reframe`** — The first review names the MCF "the core moat." But the MCF is *exactly* what Claude Projects / ChatGPT memory / Gemini Gems replicate for free in 20 minutes, and Discovery Mode is a single copyable prompt. **The AI layer has ≈zero moat.** The non-replicable asset already in the codebase is the **closed-loop operational state machine**: approval tokens, `HOLD_RECOMMENDED` gating, 48h auto-cancel follow-up, action metering, the autonomy-graduation ledger (`consecutiveApprovals`), and async publish-failure handling. **Reposition messaging from "AI that writes like you" (a comparison Voyce loses) to "removes you from the production loop end-to-end."** Treat voice match as table stakes; make switching cost (owned calendar, approval history, publish integrations) the moat.
- **`churn-driver-human-labor-tax`** — The first review mandates a 30–60 min human MCF interview for the first clients but never models that labor in unit economics. Fully-loaded, that onboarding cost can exceed 1–2 months of $99 revenue. Starter is coherent **only as a loss-leading paid trial that graduates to $249**, not as a steady-state self-serve product. Gate human-assisted onboarding behind Growth, or enforce the Starter→Growth upgrade at the calibration milestone the autonomy ledger already tracks. Track approval-rate-by-onboarding-type from beta one.
- The first review's "trust barrier vs. prepay" framing was **refuted** on verification: the shipped flow does not yet gate on payment at all (`no-stripe-checkout`), so there is no live prepay-vs-trust contradiction to resolve — the real issue is the *absence* of a gate, not its placement. The zero-commitment voice-audit recommendation still stands as a go-to-market lever.

## Resolved open decisions (the checklist was never finished)

The first review left 7 decisions "required before Sprint 1." Code shipped anyway. Here are the resolutions, grounded in what the code already does:

1. **ICP → Profile B (growth-stage / funded founder with an existing content function).** Three shipped signals point here: the product only works with rich prior content (Discovery Mode fires otherwise), the $249 reference price assumes an agency-retainer alternative, and the trust-to-publish barrier is fatal for solo founders but tolerable for a managed-vendor relationship. Position Starter $99 as a **60-day calibration tier that auto-graduates to Growth**, with a beta cohort of founders with 12+ months of public writing.
2. **Content Action = one delivered content item** (`DELIVERED` or `HOLD_RECOMMENDED`), independent of internal eval cycles or included revision rounds. In Sprint 1 every run yields one item, so this equals the code's current `increment: 1` — but **move the decrement to the delivery point** so Discovery and revision deliverables are metered uniformly, and it extends cleanly to N when multi-piece runs ship in Sprint 2. (This reconciles the two reviewers who split on "1 vs N per run": 1-per-run is correct *today*; per-delivered-item is the rule that stays correct.)
3. **Orchestrator failure mode** — there is **no Orchestrator entity**; the pipeline is a linear Trigger.dev task chain (`mcf-build → content-production → email-delivery`) and the production `AgentRun` is tagged `CONTENT_WRITER`. This is a defensible architecture, but `orchestrator.md` describes a coordinator that does not exist. Either rewrite `orchestrator.md` to the real topology or build the entity. Add a client-facing error path for the `escalated` status (currently silent).
4. **Per-action token budget** — treat as unimplemented. Wire a per-run call+token accumulator that escalates past `MAX_CLAUDE_CALLS_PER_ACTION`, use `MAX_REVISION_CYCLES` in the loop or delete it, and persist real token counts.
5. **Approval workflow** — adopt the DB-backed `ApprovalToken` design already in the schema (single-use, 7-day expiry). Define what `REVISION_REQUESTED` triggers (a re-run worker — currently nothing). Decide repurpose-inherits-approval: **no** — repurposed children get their own eval and approval.
6. **Spiral** — no swappable interface contract was created; voice matching is inlined into prompts. Acceptable as a stub, but extract the `text → fingerprint` interface so Spiral can drop in without touching the Content Writer.
7. **Eval determinism** — 4 LLM checks (voice, audience, pillar, coherence) + 4 deterministic checks (platform format, boundaries, examples-presence, prohibited-phrases). Not 8 LLM calls.

## Updated risk register (severity re-ranked against shipped code)

| # | Risk | First review severity | Status in code (2026-06-16) |
|---|---|---|---|
| 1 | Unpaid clients get drafts; nothing publishes | (not foreseen) | **P0 open** — no checkout, no `ACTIVE` gate, no publish path |
| 2 | Approval tokens forgeable/replayable; secrets plaintext | (not foreseen) | **P0 open** — security hole in the publish authorization path |
| 3 | SQLite in production | Sev-3 (data races) | **P0 open** — still `provider="sqlite"`, no migrations |
| 4 | Revision loop is a dead end | (not foreseen) | **P1 open** — `REVISION_REQUESTED` triggers nothing |
| 5 | Metering leak — expensive runs free | (not foreseen) | **P1 open** — discovery/escalation/revision unmetered |
| 6 | Cost guardrails fictional (tokens=0, budget unenforced) | Sev-4 (mitigation named) | **P1 open** — mitigation not built |
| 7 | Weekly loop never runs (no scheduler) | (not foreseen) | **P1 open** — pipeline dormant after first draft |
| 8 | Orchestrator SPOF | Sev-1 | **Partially mitigated** — no runtime LLM router; but no entity, no checkpointing, retries replay calls |
| 9 | Voice mismatch / thin MCF | Sev-2 | **Partially mitigated** — Discovery Mode added; but only voice profile is synthesized, 4/5 sections pass through raw |
| 10 | Rate-limit retry storms | (adversarial #2) | **P1 open** — no throttling, task-level retry re-charges |

---

*Voyce Architecture Review — Second Pass — GStack Autoplan — 2026-06-16*  
*Generated by an 8-dimension adversarial workflow with per-finding verification against the shipped Sprint 1A/1B code. Finding IDs are referenced by the remediation plan in `build-plan.md`.*

---

# Third Pass — Remediation Outcomes & Ratified Decisions

> Generated: 2026-06-18 — after implementing Sprint 1B-R.

This pass records the resolutions to the second-pass findings and ratifies the two
open architectural arguments. The per-finding fix table lives in `build-plan.md`
(Third Pass); this section captures the decisions a reviewer would otherwise have to
reverse-engineer from the diff.

## Ratified: the moat is the operational state machine, not the AI layer

Acting on `moat-reframe`. The remediation deliberately invested in the
**non-replicable** assets — single-use replay-proof approval authorization, the
publish/`PUBLISH_FAILED` pipeline with failure notification, idempotent metering, the
autonomy-graduation ledger (`consecutiveApprovals`), and webhook idempotency — rather
than in more agents or prompt cleverness. Voice match is treated as table stakes. The
switching cost (owned calendar, approval history, connected publish channels) is the
defensible surface.

## Ratified: dark theme is canonical

Resolving `dashboard-theme-contradicts-plan`. The dashboard's dark
`#0d0e12`/blue system (matching `usevoyce.lovable.app`) is the canonical product
identity. Transactional **emails stay cream/gold/Cormorant/DM-Mono** on purpose —
that palette reads better in an inbox and reinforces the brand at the moment of
approval. The original "cream everywhere from day one" line in the build plan is
superseded. Two surfaces, one intentional system — not a contradiction.

## Documented: the unplanned wins are now intentional

- **Discovery Mode** (`discovery-mode-unplanned`) is retained as the cold-start answer
  to thin onboarding data. Decision: discovery approvals are a *style-direction*
  selection, **not** a voice-matched draft approval, so they are tracked as a
  **separate cohort** and excluded from the headline first-draft approval-rate metric.
- **Two-layer eval** (`two-layer-eval-not-in-plan`) is kept: the specialist's internal
  self-eval (Layer 1) plus the independent orchestrator eval (Layer 2). Crucially,
  `confidenceScore` — the value Autonomy Levels gate on — is now sourced from Layer 2
  only, never the specialist grading itself (`confidence-self-eval-circular` closed).
  Deterministic checks (platform format, boundaries) were pulled out of the LLM path
  into pure functions (`deterministic-checks-as-llm-calls` closed).

## Still open (carried into the Sprint-2 gate)

- `sqlite-still-provider` — code-level races fixed and provider-agnostic; the hosted
  Postgres provisioning + concurrent-write verification is the one step requiring a
  credential unavailable in the sandbox. Runbook: `docs/postgres-migration.md`.
- `tally-fieldmap-placeholders` — the field map is still 100% placeholders; live
  onboarding is blocked until the real Tally form is finalized and its field IDs are
  locked into `config/tally-field-map.json`.

*Voyce Architecture Review — Third Pass — GStack Autoplan — 2026-06-18*
