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
