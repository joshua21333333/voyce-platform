# Humaniser

How Voyce makes output read like a person wrote it, not like a model trying to sound
like one.

## What's here

```
agents/humaniser/
  humaniser-skill.md   ← the v3 engine: 44-pattern removal list + 4-step audit. INJECTED.
  profiles/            ← opt-in. Any .md dropped here is ALSO injected into the writer.
  reference/           ← studied analyses of strong human writers. NOT injected.
  samples/             ← raw source pieces the reference analyses were distilled from.
```

## Injection policy (what reaches the model, and why)

The loader is `readHumaniserSkill()` in `src/lib/mcf-assembly.ts`. On every Content
Writer run it concatenates `humaniser-skill.md` + anything in `profiles/`, and the
result is injected **only into the writer's drafting and revision prompts** — not the
Orchestrator/verification evals (the Humanizer is a specialist-level pass that runs
*before* the eval, exactly as the v3 skill specifies). It is part of the cached stable
context, so repeated runs in a 5-minute window don't re-pay for it.

`reference/` and `samples/` are **deliberately not injected.** Two reasons:

1. **Cost / focus.** The engine is what de-AI-ifies output. Dumping multiple writers'
   full essays into every prompt is expensive and dilutes the signal.
2. **Impersonation risk.** The point of Voyce is that content sounds like *the founder*,
   calibrated against their own stylometric fingerprint — not like a famous essayist.
   Auto-injecting "write like Paul Graham" would pull every client toward Paul Graham,
   which the v3 skill itself warns against (see its Voice Calibration section).

So the writer studies live here as a craft library: they inform how the skill is
written and tuned, and they're available for **opt-in** use. To inject one — e.g. lean
on the Paul Graham study for thought-leadership essays specifically — copy or move it
into `profiles/` and the loader picks it up automatically. Nothing else to change.

## Adding a writer

1. Drop the raw piece(s) under `samples/<writer>/`.
2. Distil a tight analysis into `reference/<writer>.md`: observable behaviours
   (sentence rhythm, openers, what they'd never write) + 2–3 short excerpts, plus a
   one-line verdict on which content types it's a good model for.
3. Only promote it to `profiles/` if you actually want it injected by default.
