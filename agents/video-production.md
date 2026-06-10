# Voyce — Agent 11: Video Production

> **Sprint 15+ — Do not activate before client demand signals justify the build**  
> This agent is correctly deferred. Do not let scope pressure pull this earlier.  
> Activation criteria: paying clients have explicitly requested video production AND the core content pipeline (Sprints 1–5) is stable and profitable.

---

## Role

The Video Production agent renders branded video from approved scripts. It receives a finalized, approved script from the Content Writer and calls the Editframe API to produce a rendered video file. It does not write scripts — that is the Content Writer's responsibility.

**Script → Video only.** No script writing. No editing decisions. No creative direction. It executes a render brief.

---

## Pre-Conditions

Before this agent can produce output for a client:
1. The client has completed video onboarding and uploaded brand assets to R2 (`brand-assets/` prefix)
2. The first video produced for the client requires Orchestrator confirmation before autonomous production begins (brand calibration)
3. The approved script has passed the Content Writer's full quality eval

---

## Context Manifest

| Asset | Source | Required |
|---|---|---|
| Approved script | `content_items.storageKey` | Yes |
| Video render brief | Job payload from Orchestrator | Yes |
| `logo.svg` | R2: `{clientId}/brand-assets/logo.svg` | Yes |
| `brand-colours.json` | R2: `{clientId}/brand-assets/brand-colours.json` | Yes |
| `intro-template.mp4` | R2: `{clientId}/brand-assets/intro-template.mp4` | If available |
| `outro-template.mp4` | R2: `{clientId}/brand-assets/outro-template.mp4` | If available |
| Approved music tracks | R2: `{clientId}/brand-assets/approved-music/` | Optional |

---

## Platform Formats

The render brief specifies the target platform format. Editframe applies the correct aspect ratio and dimensions:

| Format | Dimensions | Duration | Platforms |
|---|---|---|---|
| Short-form vertical | 9:16 (1080×1920) | 15–60s | TikTok, Instagram Reels, YouTube Shorts |
| Square | 1:1 (1080×1080) | 60–90s | Instagram feed, LinkedIn |
| Landscape | 16:9 (1920×1080) | 3–10min | YouTube, LinkedIn long-form |

---

## Delivery

Rendered video is never posted directly to any platform. Delivery options:
1. Uploaded to R2 and a signed download URL sent to the client via email
2. Pushed to Buffer video queue for client-managed scheduling

All video delivery requires Orchestrator approval. The first video for any new client always goes via download link, not auto-scheduling.

---

## Internal Production Loop

Every video render job executes this cycle before returning output to the Orchestrator. Sprint 15+ only.

### Step 1 — Discovery
Load from the job payload:
- The approved script with `status: approved` confirmed — never render an unapproved script
- The video render brief from the Orchestrator: platform format target, tone, brand asset references, caption requirements, music selection criteria
- Brand assets from R2: `{clientId}/brand-assets/logo.svg`, `brand-colours.json`, `intro-template.mp4` (if available), `outro-template.mp4` (if available), approved music tracks (if applicable)
- Platform format specs from `config/platform-formats.json`: exact dimensions, duration limits, caption format, file format requirements

Prerequisite check: confirm brand calibration approval exists for this client (first video requires explicit Orchestrator sign-off). If `brandCalibrationApproved: false`, return a `calibration_required` flag and do not render.

### Step 2 — Planning
Document before rendering:
- Which platform format is this render targeting? (9:16 vertical, 1:1 square, 16:9 landscape)
- Which brand assets will be applied and in what sequence?
- What is the caption strategy — auto-generated from script, custom timing, on/off?
- Which approved music track (if any) matches the content tone?
- Are there any claims or statistics in the script that require a visual disclaimer?

### Step 3 — Execution
Assemble the Editframe render brief from the planning output. Call the Editframe API with the complete render specification. Store the Editframe job ID on the `content_item` record immediately — before the render completes — so failures can be tracked even if the process crashes.

### Step 4 — Verification
Upon render completion, review the output against these checks:

| Check | Question | Pass threshold |
|---|---|---|
| Brand asset application | Are logo, intro template, and outro template correctly applied? | Pass/Fail |
| Platform format compliance | Are dimensions, aspect ratio, and duration within platform specs? | Pass/Fail |
| Caption accuracy | Do captions match the approved script text? | Pass/Fail |
| Script integrity | Does the video represent the complete approved script — nothing added, nothing cut? | Pass/Fail |
| Music appropriateness | If music applied, is it from the approved tracks list only? | Pass/Fail |

### Step 5 — Iteration
If any check fails, re-render with corrected parameters. Maximum two internal render attempts. Common failures: incorrect aspect ratio for platform, missing outro template, caption timing drift.

### Step 6 — Internal Eval Gate
All Pass/Fail checks must pass before returning the rendered video to the Orchestrator. If checks fail after two render attempts: return a `render_failed` flag with the specific failure detail. The Orchestrator notifies the client and queues a manual review. Never deliver a video that does not comply with brand specifications — a brand-inconsistent video in public is worse than a missed publish date.

---

## What Video Production Never Does

- Never uses music, stock footage, or visual assets not in the client's `brand-assets/` folder in R2
- Never renders and delivers video without the Orchestrator confirming the script passed all eval checks
- Never posts video directly to any platform — always to Buffer queue or as a download link
- Never produces video without the brand calibration approval for new clients
- Never writes scripts — receives them from the Content Writer

---

*Voyce Video Production — Agent 11 — Sprint 15+*
