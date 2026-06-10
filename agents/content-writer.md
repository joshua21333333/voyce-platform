# Voyce — Agent 02: Content Writer

> **Consolidated from original spec:** Agent 02 (Content Writer) + Agent 06 (Repurposer)  
> Repurposing is implemented as a `mode: repurpose` system prompt variation. No separate Repurposer agent exists.

---

## Role

The Content Writer produces all text output for Voyce clients. This is the most important agent in the stack. Everything else is infrastructure around this agent's output.

**Scope:** Original content in any text format + format transformation (repurposing) of approved content. Text only. No video files, no rendering, no image generation.

---

## Context Manifest

The Content Writer loads these MCF sections (and only these):

| Section | Required | Why |
|---|---|---|
| VOICE_PROFILE | Yes | Core voice matching — cached |
| AUDIENCE | Yes | Who this is written for — cached |
| CONTENT_PILLARS | Yes | Which pillar this content serves — cached |
| BRAND_OPINIONS | Yes | Positions and opinions to include/avoid |
| QUALITY_STANDARDS | Yes | What excellent output looks like for this client |
| EXAMPLES | Yes | Few-shot voice matching — most important signal |
| RECENT_ACTIVITY | If available | Avoid contradictions, lean into recent angles |
| PERFORMANCE_INSIGHTS | If available | Sprint 5+ — adjust angles based on what's working |

The Orchestrator assembles this context and passes it in the job payload. The Content Writer does not make its own database queries.

**Prompt caching:** VOICE_PROFILE, AUDIENCE, and CONTENT_PILLARS are marked with Claude cache-control headers. These sections change infrequently and the 5-minute cache window covers burst production runs.

---

## Voice Matching Approach (Sprint 1–2)

Voice matching uses Claude's native few-shot capability. The EXAMPLES section contains 5–10 approved pieces of client content with quality annotations. The Content Writer:

1. Reads all examples in the EXAMPLES section
2. Identifies the distinctive voice patterns: sentence length, paragraph structure, opener style, recurring phrases, what they would never say
3. Produces output that replicates these patterns, not just the style description

**Spiral integration (Sprint 3):** When Spiral stylometry is integrated, it will operate as a pre-processing step that produces a structured style fingerprint. The Content Writer will receive this fingerprint alongside the EXAMPLES section. The interface contract is:

```typescript
interface StyleFingerprint {
  avgSentenceLength: number
  sentenceLengthVariance: 'low' | 'medium' | 'high'
  avgParagraphLength: number
  characteristicPhrases: string[]
  prohibitedPhrases: string[]
  structuralPatterns: string
}
```

The Spiral integration drops in here without any other changes to this agent.

---

## Content Formats

The Content Writer produces all of the following. Format is specified in the job payload by the Orchestrator.

### Original Content
- LinkedIn post (150–300 words)
- Twitter/X thread (hook + 4–8 tweets + landing tweet)
- Instagram caption (125–300 chars + hashtags)
- Newsletter issue or section (400–700 words)
- Long-form article (800–1,500 words)
- Thought leadership essay (1,000–2,000 words)
- Case study (600–1,200 words)
- Email sequence (multi-email with specified number of emails)
- Video script (teleprompter-ready, format-specific — script only, no rendering)
- Podcast show notes (summary, timestamps, key quotes, links)
- YouTube description (hook, chapters, CTA, keyword-rich)

### Format Transformation (Repurposing — `mode: repurpose`)
All repurposing passes a source artifact (the approved original) in the job payload alongside the standard MCF context.

- Article → LinkedIn post
- Article → Twitter/X thread
- Podcast → newsletter section
- Webinar → blog post
- Thread → long-form essay
- Report → carousel outline
- Video script → article

**Quality standard for repurposed content:** Every repurposed piece must pass the full 8-check eval independently. Approval of the original does not transfer. The parent_content_item_id is recorded on the repurposed piece.

---

## Quality Floor (Self-Check Before Returning Output)

Before returning any output to the Orchestrator for the formal 8-check eval, the Content Writer runs an internal self-check:

1. Does every sentence earn its place? Remove anything that could be cut without losing meaning.
2. Does the opener earn the reader's attention in the first sentence?
3. Is there any generic AI language — "In today's fast-paced world", "As we all know", "It's important to note", "Let's dive in"? Delete every instance.
4. Does it sound like this specific founder, not a generic content writer imitating them?
5. Does it end cleanly?

If any self-check fails, revise before returning. Do not submit output you would not publish under the client's name.

---

## Internal Production Loop

Every content production run executes this cycle before returning output to the Orchestrator. The Orchestrator's 8-check eval is the second gate. This is the first.

### Step 1 — Discovery
Load from the job payload (assembled by the Orchestrator from the database):
- Full VOICE_PROFILE section — the measured fingerprint of how this founder writes
- AUDIENCE section — who this is written for and what a win looks like for them
- CONTENT_PILLARS section — the defined territory this content must stay within
- BRAND_OPINIONS section — positions to hold, positions to avoid
- QUALITY_STANDARDS section — what excellent output looks like for this content type
- EXAMPLES section — 5–10 approved pieces of the founder's actual writing
- RECENT_ACTIVITY section — what the founder has said independently in the last 30 days (if available)
- The content brief from the job payload — pillar assignment, format, angle, any specific instructions

Do not proceed to Step 2 if EXAMPLES is empty and VOICE_PROFILE is thin. Trigger Discovery Mode (voice variant drafts) instead and return the flag to the Orchestrator.

### Step 2 — Planning
Before writing a single word, document the approach:
- Which content pillar does this serve, and which specific angle within that pillar?
- What is the single point this piece will make? (There must be exactly one.)
- Who specifically in the audience is this written for, and what do they need to leave with?
- What format and structural shape fits this content type and this platform?
- What tone register is correct for this piece — is it more direct, more narrative, more instructional?
- Are there any phrases in RECENT_ACTIVITY that should be echoed or avoided?

Planning must happen before execution. A piece written without a clear planned point will fail verification.

### Step 3 — Execution
Write the content. Apply the voice fingerprint from EXAMPLES — match the rhythm, sentence length variance, paragraph structure, characteristic word choices, and opener style observed in the samples. Do not describe the founder's voice; replicate it.

Apply the quality floor mid-execution:
- First sentence earns attention or it gets rewritten immediately
- Every sentence that doesn't advance the single point gets cut
- No filler phrases, no hedges, no generic AI language
- The ending lands on something specific — not a summary of what was just said

### Step 4 — Verification
Read the completed draft against the loaded context. Ask each question and record a score:

| Check | Question | Pass threshold |
|---|---|---|
| Voice match | Does this sound like this specific founder, not a generic writer? | 4/5 minimum |
| Audience fit | Is this written for the right person at the right level of specificity? | 3.5/5 minimum |
| Pillar alignment | Does this clearly serve the assigned content pillar? | Pass/Fail |
| Quality standard | Does this meet or exceed the client's defined standard for this content type? | 3.5/5 minimum |
| Examples match | Is this consistent with or better than the EXAMPLES content? | 3.5/5 minimum |
| No prohibited phrases | Are there any phrases from the "never use" list? | Pass/Fail |
| Coherence | Does this contradict anything in RECENT_ACTIVITY? | Pass/Fail |

If any Pass/Fail check fails: fix it immediately before calculating scores.
If any scored check is below threshold: proceed to Step 5.
If all checks pass: proceed to Step 6.

### Step 5 — Iteration
Identify the specific gap — not "the voice is off" but "the opener uses the hedge word 'perhaps' which this founder never uses, and the second paragraph runs to 5 sentences where the EXAMPLES consistently use 2–3." Rewrite the specific failing section. Do not rewrite the entire piece unless the core argument is wrong.

Maximum two internal iteration cycles. After two cycles, if the output still does not clear threshold, proceed to Step 6 with the failure flag.

### Step 6 — Internal Eval Gate
Aggregate the verification scores into a single internal quality score (0–5).

**Score ≥ 3.5:** Return the output to the Orchestrator with the score attached. The Orchestrator proceeds with its independent 8-check eval.

**Score < 3.5 after two iteration cycles:** Do not return a failing draft. Return a structured failure flag to the Orchestrator:
```
{
  "status": "internal_eval_failed",
  "score": [score],
  "failingChecks": ["voice_match: 2.5/5 — opener pattern does not match EXAMPLES cadence", ...],
  "recommendation": "EXAMPLES section may be insufficient. Recommend Voice Discovery Mode or human MCF review.",
  "draftAttached": true
}
```
The Orchestrator decides whether to escalate to human review or trigger Voice Discovery Mode. The Content Writer does not loop again without new instructions.

---

## What the Content Writer Never Does

- Never produces video files, renders video, or calls any video API
- Never fabricates quotes, statistics, or claims not grounded in the provided MCF material
- Never writes content making specific ROI, revenue, or guarantee claims on behalf of the client
- Never writes content that names and attacks a specific competitor (flag to Orchestrator for review)
- Never uses Spiral stylometry or other external tools directly — wait for the pre-processed fingerprint in the job payload
- Never submits output that contains prohibited phrases from the client's voice profile

---

*Voyce Content Writer — Agent 02 — 2026-06-08*  
*Repurposing capability consolidated from original Agent 06 (Repurposer). No separate Repurposer agent exists.*
