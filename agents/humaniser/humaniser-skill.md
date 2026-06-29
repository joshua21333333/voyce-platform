# VOYCE — Humanizer Skill
# skills/translated/humanizer.md
# v3.2 — Added patterns 43 and 44 from post analysis
# Runs as verification/iteration step inside EVERY specialist agent's internal loop
# before output returns to the Orchestrator for its own 8-check eval

---

## PURPOSE

Strip AI-generated writing tells from every piece of Voyce output. A piece can pass voice match, audience fit, pillar alignment, platform format, and every other Orchestrator check and still read as obviously machine-generated because of structural and lexical patterns models default to. This skill catches those patterns specifically.

This is not a style guide. It is a removal list. The goal is output that reads as if a specific human wrote it on their best day — not output that reads like an AI trying to sound human.

Process: draft → audit against all patterns below → rewrite → confirm clean → submit to internal eval gate.

---

## PART 1 — STRUCTURAL AND STYLISTIC PATTERNS

**1. Significance inflation**
Remove language that artificially inflates the importance of what's being said. Examples: "this is a game-changer", "this changes everything", "a watershed moment", "this is a turning point". If the point is significant the writing should demonstrate that — the label is never needed.

**2. Notability drops**
Remove unearned credibility markers placed before a name or noun. Examples: "renowned", "acclaimed", "award-winning", "world-class", "leading". Only use these if the client's actual material includes verifiable evidence. Never generate them.

**3. -ing openers / dangling participle analysis**
Never open a sentence or paragraph with an -ing clause that analyses rather than states. Examples to remove: "Highlighting the importance of...", "Demonstrating how...", "Acknowledging that...", "Recognising the need for...". These are AI-default framing devices that postpone the actual point. State the point directly.

**4. Promo language**
Strip marketing-speak that oversells. Full banned list: "revolutionary", "cutting-edge", "industry-leading", "best-in-class", "groundbreaking", "transformative", "disruptive", "next-generation", "innovative" (when used as a filler adjective rather than a specific claim), "state-of-the-art", "world-class".

**5. Vague attributions**
Remove: "experts say", "studies show", "research suggests", "many believe", "it has been shown that", "according to sources". If a source exists name it. If it doesn't cut the claim or rephrase as the client's own position.

**6. Formulaic challenge closers**
Remove the "but it's not without its challenges" and "however, this comes with important caveats" patterns. These are AI-default attempts at balance that read as filler. If there is a genuine tension worth exploring write it as a specific point not a template caveat.

**7. AI vocabulary — banned word list**
Strip these words in every context where they function as filler or default reach: delve, leverage (as verb — "leverage your skills"), robust, seamless, navigate (metaphorical), landscape (metaphorical — "the marketing landscape"), tapestry, testament to, underscore, foster, bolster, pivotal, embark, unlock, elevate, harness (metaphorical), realm, synergy, ecosystem (when used loosely), holistic, comprehensive (as empty modifier), solution (when used generically — "our solution"), journey (metaphorical), empower, utilize (use "use"), facilitate (use "help" or "make"), leverage (use "use"), commence (use "start"), endeavour, furthermore, moreover, nevertheless, notwithstanding.

**8. Copula avoidance**
Do not avoid "is" and "are" in favour of awkward constructions designed to sound more sophisticated. "The platform is fast" is better than "The platform demonstrates speed". Direct statements are stronger. Write what something is, not what it demonstrates, exhibits, or possesses.

**9. Negative parallelism**
"It's not just X, it's Y" is a pattern. Use it maximum once per piece, only when the contrast is genuinely earned. Never as an opener. Never twice.

**10. Rule-of-three default**
Do not list things in groups of three for rhythm ("fast, reliable, and scalable"). Lists should be as long as they need to be — two items, four items, one item. Defaulting to three is a tell. Vary list lengths naturally or cut lists entirely when prose serves better.

**11. Synonym cycling**
Do not artificially vary word choice to avoid repeating a word. Repeating the right word is cleaner than rotating through synonyms for the sake of variety. If the word is correct use it again.

**12. False ranges**
Avoid "from X to Y" constructions that imply a full spectrum when only two specific examples exist. "From startups to enterprises" when two companies are being compared is false range. Name the two things or drop the construction.

**13. Passive dramatic fragments**
Avoid strings of short passive sentences used for dramatic rhythm: "Built for scale. Designed for speed. Made for founders." This pattern reads as generated unless it is a genuine stylistic signature confirmed in the client's stylometric profile. Default to prose.

**14. Em and en dashes — zero**
No em dashes (—). No en dashes (–). None. If a sentence requires one, restructure the sentence. Use a period or a comma or rewrite. This is non-negotiable regardless of how the sentence was drafted. One of the most reliable AI-writing fingerprints in existence.

**15. Boldface overuse**
Do not bold phrases within prose for emphasis. Sentence structure carries emphasis. If it doesn't the sentence needs to be rewritten. Bolding is permitted in structured reference documents, headers, and deliberate UI-facing content — never in flowing prose.

**16. Inline-header lists**
Remove "**Bold Label:** description text" patterns repeated down a list. This is one of the most identifiable AI-generated document structures. If content needs a list use a clean list. If it needs prose write prose. Never combine them in the **Label:** format within running body text.

**17. Title case headings**
Use sentence case for all headings. Not Title Case For Every Word. The only exception is a proper noun within a heading.

**18. Emojis**
None, unless the client's voice profile explicitly specifies emoji use and the platform context supports it. Even then use exactly what the stylometric profile reflects — never generate emoji that aren't confirmed in the client's own published work.

**19. Curly / smart quotes**
Use straight quotes. Curly quotes are a formatting artifact of word processors. On platforms like LinkedIn and Twitter they create inconsistency depending on device rendering.

---

## PART 2 — CHATBOT AND AI TELLS

**20. Chatbot artifacts**
Remove any phrasing that reveals content was generated in response to a prompt. Full list: "Sure, here's...", "Of course!", "Certainly!", "I hope this helps", "Let me know if you'd like...", "Feel free to...", "I'd be happy to...", "Great question", "Absolutely". These phrases belong in a chat interface. They have no place in content a founder is publishing under their name.

**21. Cutoff disclaimers and speculative gap-fill**
Never reference knowledge limitations. Never hedge with "as of my last update", "as of early 2026", "I should note that my information may be outdated". Content speaks as the founder, from the founder's perspective, in the present tense of their world. Not as a model hedging its training data.

**22. Sycophantic tone**
Strip excessive enthusiasm directed at an imagined reader. "You're absolutely right", "What a fascinating topic", "This is such an important question". Readers don't need to be flattered. The writing should engage them through substance not through performative warmth.

**23. Filler phrases — full banned list**
Remove every instance of: "in today's world", "in this day and age", "at the end of the day", "when it comes to", "it's worth noting that", "it goes without saying", "needless to say", "the fact of the matter is", "make no mistake", "at its core", "in the grand scheme of things", "by the same token", "that being said", "with that in mind", "first and foremost", "last but not least", "all things considered", "in light of the above".

**24. Excessive hedging**
Remove: "might potentially", "could possibly", "it seems that", "one might argue", "perhaps", "arguably" (when used as a hedge not a genuine qualifier), "it could be said that", "in some ways", "to some extent". State the point. The client's stylometric profile defines their actual confidence register — match it. Never default to AI-cautious hedged phrasing when the client's real voice is declarative.

**25. Generic conclusions**
Never close with a paragraph that summarises what was just said. Remove: "In conclusion", "To sum up", "In summary", "Ultimately", "At the end of the day" (also in filler), "To wrap up", "In closing". The last sentence of a piece should be the piece's sharpest point — not a recap of it.

**26. Hyphenated word pairs**
Drop predicate hyphens. "The platform is user-friendly" should be "the platform is easy to use" or restructured entirely. Only hyphenate compound modifiers that precede a noun where grammar requires it ("a well-known author") — never in predicate position ("the author is well-known").

**27. Persuasive authority tropes**
Remove: "as any expert will tell you", "it's widely accepted that", "everyone knows that", "the consensus is clear", "industry insiders agree". These are AI defaults for making claims sound more authoritative than they are. If the claim is true state it. If it needs a source name the source.

**28. Signposting announcements**
Remove: "In this post I'll cover...", "Let's break this down...", "Here's what you need to know about...", "Today I want to talk about...", "I'm going to share three things...", "Without further ado...". Just say the thing. The content should begin with content, not with a description of the content about to follow.

**29. Fragmented listicle headers**
Avoid headers that are sentence fragments designed to mimic a listicle format when the content isn't genuinely a list. "The Problem", "The Solution", "The Takeaway" as headers within a LinkedIn post or newsletter article are AI-generated structure defaults. Use headers only when the content genuinely requires navigation — and write them as complete, specific descriptors of what follows.

**30. Diff-anchored writing**
When revising or repurposing existing content, do not write in a way that's anchored to "what changed". The output must read as a complete standalone piece, not as a patch or variation on a previous version. A reader encountering the revised piece cold should not be able to tell it was revised from something else.

---

## PART 3 — VOYCE CUSTOM PATTERNS

**31. Adjective stacking**
Strip modifier clusters to the single adjective that earns its place, or cut all modifiers entirely. "A powerful, innovative, game-changing solution" → "a solution" or "the right solution" — one modifier maximum when it adds something specific that the noun alone doesn't carry. The noun should do most of the work. Modifiers are earned, not accumulated.

**32. "Quietly" as qualifier or adjective**
Never use "quietly" to modify a verb, describe an action, or add colour to a claim. Examples to cut entirely: "quietly building", "quietly shipping", "quietly powerful", "quietly changing the industry", "a quietly impressive result". This is one of the most identifiable AI-writing tics in current models. Replace with what is actually happening, stated plainly. If you can't say it plainly the claim is probably weak.

**33. "Actually" as qualifier or emphasis marker**
Never use "actually" to add false emphasis or signal a reveal. Examples to cut: "this is actually a bigger problem than it looks", "what's actually happening is", "it actually works", "you actually already know this". "Actually" functions as a hedge masquerading as emphasis. If the point needs emphasis the sentence structure should carry it. Cut "actually" in every case.

**34. "Most" as a sentence opener**
Never begin a sentence with "Most" as a generalising opener. Examples: "Most founders struggle with...", "Most marketers don't realize...", "Most companies get this wrong...", "Most people think...". This is the single most common AI framing device for making broad unverifiable claims sound authoritative. It asserts without evidence. Rewrite to: name a specific example instead of the generalisation, state the actual claim directly without "most", or find the specific context the generalisation was trying to invoke and name it precisely.

**35. "Genuinely" and "honestly" as emphasis markers**
Never use "genuinely" or "honestly" as qualifiers meant to signal sincerity or importance. Examples: "this is genuinely useful", "honestly, this is the best approach", "I genuinely believe", "honestly speaking". Sincerity is demonstrated through the writing, not asserted through these words. Cut both in every case.

**36. Opening with "I" on social platforms**
On LinkedIn and X specifically, never open with "I" as the first word of a post. This is an algorithm and engagement pattern issue as much as a style one. Restructure the opening so the point, the observation, or the story comes first. The "I" can appear but not in the opening word position.

**37. Motivational posturing**
Strip any sentence that reads as inspirational or motivational without being grounded in a specific concrete observation. Examples: "Success leaves clues", "The best time to start was yesterday", "Consistency is the key", "Your only competition is your past self", "Great things take time". These are content that sounds like content. Voyce clients are building real things. Their content should reflect real observations not motivational poster text.

**38. CTA as closer**
Never end a piece of content with a call to action question unless the client's voice profile specifically reflects this pattern in their existing published work. Examples to remove: "What do you think?", "Have you experienced this?", "Drop your thoughts in the comments", "Let me know below", "Tag someone who needs to hear this". The content should end on the point. The point is the closer. Questions directed at the audience as closing devices are filler.

**39. Rhetorical question openers**
Avoid opening a piece with a rhetorical question. "Have you ever wondered why...", "What if I told you...", "Do you ever feel like...", "Why do so many founders...". These are among the most overused openers in AI-generated content. Open with a statement, an observation, a specific example, or a direct claim. Never a question.

**40. Hyperbolic time claims**
Remove: "in today's fast-paced world", "in an era of rapid change", "as the pace of innovation accelerates", "in the age of AI", "as the world moves faster than ever". These phrases add no information and mark the content as generic. If time context matters state the specific relevant fact — not a generic statement about the speed of everything.

**41. Staccato sentence strings used for false rhythm**
Avoid stacking a run of short, subject-verb sentences back to back purely for punchy effect when the content doesn't earn it. Example to flag: "We build fast. We ship often. We listen." This is a manufactured cadence — it imitates confident, declarative writing without doing the work of saying something specific. The fix is not "make the sentences longer" — it's to check whether each short sentence is carrying real information or just performing rhythm. A genuine short sentence used for impact after a longer build-up is fine and often strong. A row of three or more short sentences in immediate sequence, each making a similarly-weighted generic claim, is the tell. Cross-reference against the client's stylometric profile — if their measured pattern doesn't show this rhythm, it isn't their voice, it's a generated cadence.

**42. "e.g." and "i.e." as Latin-abbreviation crutches**
Avoid defaulting to "e.g." and "i.e." in running prose, especially in content meant for LinkedIn, newsletters, or any conversational platform content. These read as formal-document shorthand, not how a person writes when speaking to their audience directly. Replace with "for example", "like", "meaning", or restructure the sentence so the example is integrated naturally rather than parenthetically tacked on. Acceptable only in genuinely technical or reference-style content where the client's own stylometric profile shows this pattern in their published work — never the default.

**43. Obvious statements**
Never state things the reader already knows as if they are insights or new information. Examples: "As a founder, your time is valuable." "Content marketing is important for growing your business." "Building a successful company takes hard work." "Customers want to feel heard." These sentences have the form of insight but the content of common knowledge. Any person in the target audience already knows this without being told. The test before keeping a sentence: does this tell the reader something they don't already know, or does it tell them something they've known their whole life in slightly different words? If the latter, cut it entirely or replace it with a specific, non-obvious observation grounded in the client's actual experience or data. Obvious statements are the most invisible AI tell — they don't flag the way em dashes do, but readers feel them as a vague sense that nothing is being said. This is the root cause of "so much output, yet so little outcome."

**44. Verbose paragraph padding**
Every sentence in a paragraph must add new information. A sentence that restates what the previous sentence said, re-explains in different words what was just explained, or qualifies a point that didn't need qualifying is padding. AI models generate verbosity because they're optimised to produce plausible-sounding next tokens, not to be concise. The result is paragraphs that circle a point instead of making it — three or four sentences where one would do. The audit check: read each sentence in isolation and ask "does this sentence exist in the paragraph or could it be removed without the reader losing anything?" If it could be removed, remove it. A paragraph that loses two of its four sentences and is stronger for it was padded. Good human writing makes its point and moves on. It does not elaborate to demonstrate thoroughness. It does not re-approach the same idea from a slightly different angle to add word count. Say the thing once, say it well, stop.

---

## PART 4 — VOICE CALIBRATION STANDARDS

These patterns apply on top of the removal list above and govern how the rewritten content must read against the client's specific voice.

**Sentence rhythm**
After the Humanizer audit, cross-reference the rewritten piece against Section 13 of the Master Context File (Stylometric Profile). If the client's measured average sentence length is short (under 12 words average) and the rewritten piece contains long compound sentences, restructure. The Humanizer pass must not introduce sentence patterns that contradict the stylometric fingerprint.

**Confidence register**
The hedging removal in Pattern 24 must be calibrated against the client's actual confidence level as measured in their own work. A client whose stylometric profile shows consistently declarative language should produce declarative output. A client whose profile shows measured, qualified language should produce measured output. Strip AI-default hedging but do not replace it with AI-default confidence that doesn't match the founder.

**Opening quality**
After all patterns are addressed, the opening sentence must pass a single test: would a person matching this client's audience stop scrolling for this? If the answer is uncertain the opener needs to be rewritten. The Humanizer pass is also an opener quality check.

**Closing quality**
The final sentence must land. Not summarise. Not encourage. Not ask. It must deliver the piece's sharpest point or most resonant observation. If the last sentence is softer than the second-to-last sentence, swap or rewrite.

---

## PROCESS — FOUR STEPS, NON-NEGOTIABLE

**Step 1 — Draft**
Produce the content against the brief, the voice profile, the stylometric fingerprint, and the content pillar.

**Step 2 — Audit**
Read through against all 40 patterns above. Flag every instance. Do not skip patterns because the content "seems clean". Every audit runs all 40 checks every time.

**Step 3 — Rewrite**
For each flagged instance: cut the offending word, phrase, or structure; or rewrite the sentence so it doesn't require what was flagged. A full rewrite in the client's actual voice. Never a find-and-replace. Never a near-synonym swap that keeps the same pattern. The rewrite must eliminate the pattern completely.

**Step 4 — Confirm clean**
Re-read the rewritten piece from top to bottom against the full 40-pattern list. If anything remains, return to Step 3. Maximum 2 full cycles before flagging to the Orchestrator that this piece has a pattern that cannot be resolved without losing the content's meaning — include a specific note identifying which pattern and why.

---

## WHERE THIS SKILL RUNS

Inside every specialist agent's internal loop at Steps 4 and 5 (Verification and Iteration), before the specialist's internal eval gate and before output returns to the Orchestrator.

Applies to:
- Content Writer — all modes including LinkedIn, newsletter, long-form, threads, repurpose mode
- SEO + AEO/GEO Specialist — including FAQ answers and answer capsules from the GEO Optimize skill
- Ad Copywriter — all copy formats
- Researcher — any written synthesis or report that goes to the client
- Video Production Agent — script stage

Does not apply to:
- Database operations
- Routing logic
- Structured JSON outputs
- Schema markup generated by GEO Optimize skill

The Orchestrator does not run the Humanizer — it runs the 8-check eval. The Humanizer is a specialist-level pass. By the time output reaches the Orchestrator it should already be clean.

---

## ONGOING ADDITIONS

Every pattern on this list started as a specific observation from real output. When a new pattern is identified during eval review, client feedback, or Orchestrator run-log analysis, it gets added here with the same format: what it is, examples, fix. Flag to the Orchestrator's run-log system so the new pattern gets retroactively checked against the last 30 days of output for that client.

Current pattern count: 44

---

*Voyce Humanizer Skill v3.2 — 2026*
*44 patterns across 4 parts: structural/stylistic, chatbot tells, Voyce custom, voice calibration*
*Runs inside every specialist's internal verification loop before the Orchestrator's 8-check eval*
