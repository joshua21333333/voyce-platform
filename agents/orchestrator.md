# Voyce — Agent 01: Orchestrator

> **Consolidated from original spec:** Agent 01 (Orchestrator) + Agent 09 (Skills Interpreter)  
> Agent 09 routing logic is collapsed here. No separate Skills Interpreter agent exists.

---

## Role

The Orchestrator is the central coordinator of the Voyce production pipeline. It does not write content. It routes tasks to the correct specialist agent, runs the quality eval before any output reaches the client, manages the weekly production schedule, and handles proactive client briefing.

**This agent is the only agent that calls other agents.** All inter-agent communication flows through the Orchestrator. Specialists produce output and return it. The Orchestrator decides what to do with that output.

---

## Routing Logic (absorbed from Skills Interpreter)

The Orchestrator reads `config/agent-routing-rules.json` at initialization. This file maps content types and task categories to the correct specialist agent. Routing is deterministic — the Orchestrator does not use an LLM call to decide which agent handles what. It uses the routing table.

**Routing table summary:**
- Content production (any format) → Content Writer (Agent 02)
- Repurposing (format transformation of approved content) → Content Writer (Agent 02) with `mode: repurpose`
- SEO brief, keyword research, topic clusters → SEO Specialist (Agent 03) — Sprint 3+
- Ad copy, campaign variants → Ad Copywriter (Agent 04) — Sprint 4+
- Competitor audit, trend report, persona, AEO/GEO research → Researcher (Agent 05) — Sprint 5+
- Monthly performance report → Performance Analyst (Agent 07) — Sprint 5+
- Content Intelligence update → biweekly Tally form (not an agent call) — replaces Agent 10

For Sprint 1–2, the only routing branch that matters: **all content tasks → Content Writer.**

---

## Two-Layer Quality Architecture

Voyce has two independent quality gates. They are not redundant — they operate at different levels and catch different failure modes.

**Layer 1 — Specialist Internal Eval Gate:** Every specialist agent runs a 6-step internal production loop (Discovery → Planning → Execution → Verification → Iteration → Internal Eval Gate) before returning output to the Orchestrator. The specialist scores its own output against a minimum 3.5/5 threshold. If it fails after two internal cycles, it returns a structured failure flag — not a failing draft. The Orchestrator never sees content that failed the specialist's own standard.

**Layer 2 — Orchestrator 8-Check Eval:** The Orchestrator runs its own independent eval pass on any output that cleared the specialist's internal gate. The Orchestrator checks things the specialist cannot check from inside its own context: coherence with recent founder activity, cross-platform format compliance, boundaries violations, and consistency with the examples database. A piece that passes both layers has survived two independent quality checks by two different evaluation contexts.

Output that reaches a client has passed Layer 1 (specialist self-check) and Layer 2 (Orchestrator gate). Both must pass. Neither overrides the other.

---

## Quality Eval (8 Checks) — Layer 2

The Orchestrator runs 8 quality checks **before any output reaches the client**. This runs on output that has already cleared the specialist's internal eval gate. No exceptions.

Checks run in this order. Independent checks (1, 2, 3) run in parallel. Dependent checks run sequentially after.

**Parallel batch (run together):**
1. `VOICE_MATCH` — Does this sound like the founder? Score 0–100 vs voice profile.
2. `AUDIENCE_FIT` — Is this written for the right person at the right level?
3. `PILLAR_ALIGNMENT` — Does this content belong to a defined content pillar?

**Sequential (run after parallel batch):**
4. `STANDARDS_CHECK` — Does this meet the client's defined quality standard for this content type?
5. `BOUNDARIES_CHECK` — Does this violate any agent boundary? Legal claims? Named competitor attacks? Fabricated quotes?
6. `EXAMPLES_MATCH` — Is quality consistent with the client's approved examples database?
7. `COHERENCE_CHECK` — Does this contradict recent founder activity? Repeat a point made this week?
8. `PLATFORM_FORMAT` — Character count, structure, hashtags, link formatting correct for the target platform?

**Outcome logic:**
- All 8 pass → approve for delivery → route to client via email
- Any fail → route back to the relevant specialist with a specific fix instruction
- 3 consecutive failed revision cycles on the same piece → escalate to human review, notify client

**Hard constraint:** Maximum 3 revision cycles per Content Action. After 3 cycles, mark the agent run as `escalated` and notify the client. Do not loop again.

---

## Failure Mode

The Orchestrator must never silently fail. Every failure path produces a database state change and, where appropriate, a client notification.

**Defined failure states (set on `agent_runs.status`):**
- `failed` — unrecoverable error (API timeout, context overflow, malformed response)
- `escalated` — 3 revision cycles exhausted, human review required

**Circuit breaker:** If the Orchestrator prompt produces 3 consecutive malformed routing decisions for the same client (e.g., routing to a non-existent agent), mark the run as `failed`, log the prompt version that failed, and alert the system operator. Do not retry.

**Token budget:** Maximum 10 Claude API calls per Content Action across the full production pipeline (Orchestrator + specialist + eval). Maximum 8,000 tokens per call (apply prompt caching to stable MCF sections). If a run exceeds this budget, escalate rather than continue.

---

## Context Loading

The Orchestrator loads the **full Master Context File** before every production run. This is the only agent that loads all sections.

Context assembly order:
1. Load all `ClientContext` rows for this client from the database
2. Assemble into a markdown document in section order
3. Mark stable sections (VOICE_PROFILE, AUDIENCE, CONTENT_PILLARS) with Claude cache-control headers
4. Pass to specialist agents via the job payload — specialists do not make their own DB queries

**Each specialist agent receives only the sections it needs** (declared in its context manifest). The Orchestrator handles sectioning; specialists do not.

---

## Proactive Briefing

Every Friday, the Orchestrator sends a brief to each active client:
- What's scheduled for next week
- What's pending approval
- Any production run failures or escalations from the past 7 days

This is a scheduled Trigger.dev task, not an agent call. It reads directly from the `content_items` table. No LLM required.

---

## Autonomy Level Enforcement

The Orchestrator enforces the client's configured Autonomy Level before deciding whether to deliver or auto-approve:

- **Level 1 (LEVEL_1_MANUAL):** Always deliver for approval. Never auto-approve.
- **Level 2 (LEVEL_2_CONFIDENCE):** Auto-approve if the orchestrator eval passes AND `confidenceScore >= client.autonomyThreshold` (default 90%). Otherwise deliver for approval.
- **Level 3 (LEVEL_3_AUTONOMOUS):** Auto-publish without approval. **Only available after 10 consecutive approved drafts without revision, enforced at the DB layer.** Check `client.consecutiveApprovals >= 10` before allowing Level 3 to activate.

> **Implementation note (Sprint 1B-R).** Autonomy Levels are a Sprint-3 feature; the
> enum (`AutonomyLevel`) and `client.autonomyThreshold` (default 90) now exist in the
> schema so Sprint 3 can build on real columns. `confidenceScore` is derived from the
> **independent orchestrator eval** (`runOrchestratorEval`), never the specialist's own
> self-eval — auto-approve must not gate on the writer grading itself. The eval is not
> 8 LLM calls: platform-format and boundaries are deterministic pure functions
> (`src/lib/checks.ts`) that run before any model call; voice and pillar are LLM checks.
> There is no standalone Orchestrator service — the pipeline is a linear Trigger.dev
> task chain (`mcf-build → content-production → email-delivery → publish`).

---

## What the Orchestrator Never Does

- Never writes content
- Never calls external publishing APIs directly (delegates to publishing tasks)
- Never overrides a boundaries check failure to meet a deadline
- Never routes to an agent not listed in the routing rules
- Never allows Level 3 autonomy before the 10-consecutive-approvals threshold is met

---

*Voyce Orchestrator — Agent 01 — 2026-06-08*  
*Routing logic consolidated from original Agent 09 (Skills Interpreter). No separate Skills Interpreter agent exists.*
