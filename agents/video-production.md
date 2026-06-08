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

## What Video Production Never Does

- Never uses music, stock footage, or visual assets not in the client's `brand-assets/` folder in R2
- Never renders and delivers video without the Orchestrator confirming the script passed all eval checks
- Never posts video directly to any platform — always to Buffer queue or as a download link
- Never produces video without the brand calibration approval for new clients
- Never writes scripts — receives them from the Content Writer

---

*Voyce Video Production — Agent 11 — Sprint 15+*
