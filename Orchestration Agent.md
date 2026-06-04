# 🎻 ORCHESTRATOR AGENT — TECHNICAL PLAN

**Date:** June 4, 2026
**Project:** Hackathon 2026 - Microsoft
**Component:** Orchestrator Agent (User Experience)
**Status:** Planning Phase

---

## PROJECT OVERVIEW

The orchestrator is the front door of the fashion AI stylist. It takes a human request in plain language, figures out what the person actually wants, decides which subagents to call and in what order, hands each one clean inputs, and stitches their outputs back into one coherent stylist response in a single consistent voice.

It is the conductor, not a soloist. It does not do the styling, the discovery, the image work, or the buying itself. It routes, it synthesizes, and it holds the voice and the trust gate so the whole thing feels like one stylist rather than five tools talking over each other.

---

## 1. ROLE IN THE SYSTEM

In A2A terms the orchestrator is the **client**. The other agents are **servers** that publish an Agent Card describing what they do and how to reach them. The orchestrator reads those cards, sends each agent a task, and assembles the results.

```
┌─────────────────────────────────────────────────────────┐
│                        USER                              │
│      (natural language request, optional photo)          │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              ORCHESTRATOR AGENT (this build)             │
│                                                          │
│  1. Parse intent (occasion, mood, constraints, budget)  │
│  2. Run warm intake to fill missing slots               │
│  3. STYLING BRAIN: form the look (House of Nova prompt)  │
│  4. Decide the call sequence                            │
│  5. Call subagents via A2A, fill any missing slots      │
│  6. Synthesize results in House of Nova voice           │
│  7. Hold the human approval gate before any purchase    │
│  8. Manage conversation state across turns              │
│                                                          │
│  (Styling brain lives HERE, owned by us. See Section 6.) │
└───────┬───────────────┬───────────────┬────────────────┘
        │ A2A           │ A2A           │ A2A
        ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Photo / Media │ │  Retailer     │ │  Purchase     │
│ Intake Agent  │ │  Discovery    │ │  Approval     │
│ (optional)    │ │  Agent        │ │  Agent        │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## 2. THE PHOTO-OPTIONAL DECISION

**Decision:** The user photo is an optional input, not a requirement. The experience must work end to end with no photo at all.

### Why

The photo was doing two different jobs, and only one of them needs the user's body.

- **Job A, personalization:** coloring, silhouette, sizing. This is the only job that wants a photo, and even here a photo is a weak input. Size is a question, not a picture.
- **Job B, the shopping visual:** the image that drives the look and the links. This does not need the user's body at all. It can be rendered on a styled figure, built as an editorial flat lay, or assembled from the retailers' own product imagery (which the shopping links already provide).

A styled lookbook frame reads as couture. An outfit pasted onto a selfie reads as a mall try-on kiosk. For this brand, photo-free is often the more premium answer, not the lesser one.

### Graceful degradation (three tiers)

The orchestrator treats the body as one optional slot and never blocks on it.

| Tier | Inputs | What the user gets |
|------|--------|--------------------|
| 1 | Occasion and mood only | A strong directional look. "Here is the direction." |
| 2 (default) | Occasion and mood + 2-3 intake answers (size, what she lives in, what she avoids) | Fit-aware looks and accurate shopping links. This is the photo-free default. |
| 3 | Everything above + a photo, only if she offers it | Palette and silhouette tuned to her exactly. The upgrade, earned in conversation, never the toll at the door. |

### Intake, not a form

The intake should feel like a stylist asking, not a sizing wizard. Three or four warm questions, the kind you would actually ask someone. The wording should live in House of Nova voice.

---

## 3. GOLDEN PATH (DEMO SCENARIO)

1. User: "I have a gallery opening Friday night. I want to feel powerful but not stiff." (No photo.)
2. Orchestrator parses intent: occasion, mood, formality, constraints.
3. Orchestrator runs a short warm intake to fill size and preference slots.
4. Orchestrator forms the look concept (styling brain step, runs the House of Nova stylist prompt).
5. Orchestrator calls the discovery agent with the components of that look, gets matching retailers and pieces.
6. Orchestrator composes the look in House of Nova voice and presents it with shopping links.
7. User says yes to a piece.
8. Orchestrator hands off to the purchase approval agent, surfaces the confirmation.
9. Orchestrator closes in voice, ending on how she will feel walking in, not on the garment.

Note that step 7 to 8 maps directly onto A2A's built-in `input-required` task state, which is purpose-built for a human approval gate. The system never auto-buys. The pause is part of the experience.

---

## 4. AGENT CONTRACTS (DO THIS FIRST)

A2A does not enforce a typed definition of each agent's inputs and outputs, so the team has to agree on the shapes ourselves. Mismatched inputs and outputs are the single most common thing that breaks a multi-agent demo. One hour of alignment here saves the demo.

For each subagent we need to write down:

- **Photo / Media Intake Agent:** What does it accept (image, none) and return (coloring, silhouette, sizing fields)? The orchestrator must work when this returns nothing.
- **Retailer Discovery Agent:** Input shape for a look's components, output shape for matches (see their plan: retailer name, endpoint, category, confidence, links).
- **Purchase Approval Agent:** What it needs to authorize and complete a purchase, and what confirmation it returns.

Action: collect the Agent Card from each teammate and lock a shared JSON shape per agent before writing orchestration logic.

---

## 5. TECH STACK (RECOMMENDATION)

| Layer | Choice | Reason |
|-------|--------|--------|
| Orchestration framework | Microsoft Agent Framework 1.0 (Python) | Native A2A client support, built-in sequential and handoff orchestration patterns, front-end adapters (CopilotKit, ChatKit) for the UX layer. Matches the Microsoft hackathon stack. |
| Language | Python | Matches the discovery agent's stack, writes cleanly with Copilot. |
| Voice layer | House of Nova stylist system prompt | The final synthesis step. Already a finished asset. |
| State | In-memory or lightweight store for the demo | Conversation state across turns. Keep it simple for the hackathon. |

A plain FastAPI service with an A2A client also works if the team prefers maximum simplicity. A2A is the contract either way, so the orchestrator's choice of framework does not block interop.

---

## 6. THE STYLING BRAIN (DECIDED)

**Who owns the styling decision?** The orchestrator does. It lives inside this build, owned by us.

The styling brain is the step that turns intent plus the person into an actual look concept: the pieces, the silhouette, the palette, the styling logic. It sits after intake and before the discovery call, and it hands discovery the components to go shopping for. Without it, the system can find clothes and buy clothes but nobody decides what the look should be, which is the whole reason someone comes to a stylist instead of a search bar.

In practice it is one model call driven by the House of Nova stylist voice guide and look generation prompts, which already exist. So this is not new logic to invent, it is an existing asset wired in as a named step.

**Why it stays in the orchestrator and is not a separate agent:**

- The brand voice already lives in the orchestrator's final synthesis step. Splitting styling into its own agent would put the same voice on both sides of a network boundary, in two prompts, which is exactly where voice drift creeps in. One voice, one place, in our hands.
- It is essentially a single prompt call. Wrapping that in its own deployed agent, endpoint, and A2A contract is a lot of plumbing around something small, and it sits on the critical path of every request, so every hop is latency and one more thing that can break live.
- Separate concern does not require a separate agent. Build it as its own clean, clearly named module or function inside the orchestrator. Conceptually separate, physically together. Easy to lift out into a standalone agent later if that need ever appears.

**The one exception:** if the fifth teammate wants to own styling as their own agent and has the time, and the team wants five clearly separated agents to demonstrate the multi-agent pattern to judges, that is legitimate. Even then, the House of Nova voice prompt stays ours.

---

## 7. BUILD SEQUENCE

1. **Lock the contracts** (Section 4). Agree the JSON shapes with every teammate. Do this first.
2. **Stand up the orchestrator** in Microsoft Agent Framework as an A2A client.
3. **Stub every subagent.** Hardcode a fake response for each agent matching the agreed contract, so the full experience loop can be built and demoed even if a teammate's agent is not finished. Swap real endpoints in as they land.
4. **Build the photo-optional branch.** The photo agent call is conditional. If no photo, fill the same slots from intake and never block.
5. **Wire in the styling brain.** Drop the House of Nova stylist prompt in as a named module that runs after intake and before the discovery call. This is the step that makes the orchestrator the stylist rather than a router.
6. **Wire the voice as the last mile.** The orchestrator's final step before it speaks is to rewrite the assembled facts in House of Nova voice.
7. **Add the approval gate** using A2A's `input-required` state before any purchase handoff.
8. **Polish one clean scripted scenario** end to end for the demo.

---

## 8. OUT OF SCOPE

- **Payments plumbing** (x402, XRPL, micropayments). This belongs to the discovery and purchase agents. The orchestrator has no money and does not settle transactions.
- **Building the subagents.** Owned by teammates.

---

## Document History

| Date | Version | Status | Notes |
|------|---------|--------|-------|
| 2026-06-04 | 1.0 | Draft | Initial orchestrator plan, photo-optional decision captured |
| 2026-06-04 | 1.1 | Draft | Styling brain resolved: lives inside the orchestrator, owned by us, built on the House of Nova prompt |