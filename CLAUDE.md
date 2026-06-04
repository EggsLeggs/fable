# Sentinel — CLAUDE.md

## What this is
Sentinel is an AI campaign oversight console built for the Cursor × Thrad London 2026 hackathon.
It is a Next.js 14 App Router application where an autonomous media buying agent (powered by GPT-4o)
makes real-time bid/skip/flag decisions on ad placements via the Thrad API. Every decision is logged
with full reasoning and surfaced in a human oversight dashboard where operators can approve, veto, or
challenge decisions. Vetoes feed back into the agent's context on subsequent calls.

## The core loop
1. Human fires a conversation scenario (or scenarios run automatically)
2. Agent calls Tavily to check brand safety for the advertiser
3. Agent calls GPT-4o (traced to Overmind) with: campaign config + conversation + safety context → returns structured JSON decision
4. If decision is "bid", agent calls Thrad bid API to retrieve a real ad
5. Decision (with reasoning, flags, ad creative) is stored and appears in the UI
6. Human can approve / veto / flag from the UI; vetoes accumulate and are passed back to the agent

## APIs in use
- OpenAI GPT-4o (`gpt-4o`) — the reasoning engine for every decision
- Thrad Bid API (REST, staging key) — real-time ad retrieval for bid decisions
- Overmind JS Tracing SDK (`@overmind-lab/trace-sdk`) — auto-captures every OpenAI call to `api.overmindlab.ai`
- Tavily Search API — brand safety grounding before each decision

## File structure
app/
  page.tsx                          # Main console UI (client component)
  layout.tsx
  globals.css
  api/
    run-agent/route.ts              # POST — triggers agent on a conversation context
    decisions/route.ts              # GET — returns full decision log + stats
    decisions/[id]/action/route.ts  # POST — records human approve/veto/flag
lib/
  store.ts          # In-memory decision store (module-level, no database)
  overmind.ts       # Overmind `init()` — PATH B tracing SDK bootstrap
  agent.ts          # Core decision agent (Tavily → GPT-4o → Thrad)
  thrad.ts          # Thrad bid API wrapper
  scenarios.ts      # Pre-baked demo conversation contexts
components/
  DecisionFeed.tsx
  DecisionCard.tsx
  CampaignPanel.tsx
  StatusBadge.tsx

## Key types
Decision: id, timestamp, campaignName, advertiser, contextSnippet, fullContext,
          decision (bid|skip|flagged), reasoning, confidence, flags, suggestedCPM,
          adReturned?, humanAction?, humanNote?, humanTimestamp?

Campaign: name, advertiser, goal, maxCPM, brandKeywords[], blockedTopics[]

## Environment variables required
OPENAI_API_KEY
THRAD_PUBLISHER_ID    # staging key from platform.thrads.ai
OVERMIND_API_KEY      # from console.overmindlab.ai (`ovr_…`)
TAVILY_API_KEY        # from app.tavily.com

## Observability (Overmind PATH B)
`lib/overmind.ts` exports OTLP to `https://api.overmindlab.ai/api/v1/traces` with `X-Api-Key`. `run-agent` **awaits** the agent and `flushOvermind()` so spans are not dropped. Verify with `POST /api/overmind/ping`.

**Dashboard:** PATH B traces show under your service name (`sentinel`) in Overmind **tracing/telemetry** views. The **Agents** page (`/agents`) is mainly for PATH A (CLI-registered Python agents); it can stay empty while traces still ingest. Use the same API key as the account logged into [console.overmindlab.ai](https://console.overmindlab.ai).

## Design system
Dark-first, muted monochrome, compact text, pill controls, subtle borders.
Custom dark palette: bg #161616, surface #1c1c1c/#232323, border #3e3e3e,
text #ededed, muted #707070, accent #00d4aa (teal).
Fonts: Geist Sans + Geist Mono.

## Demo scenarios (pre-baked in lib/scenarios.ts)
0. Marathon training — high intent → BID
1. Nike controversy — brand safety flag → FLAGGED
2. Weather chat — no intent → SKIP
3. Gym beginner — medium intent → BID or SKIP
4. Protest context — blocked topic → FLAGGED

## Hackathon judging criteria
- Technical execution (clean TypeScript, working APIs)
- Agent autonomy (GPT-4o makes real decisions, not rule-based)
- Safety & oversight design (THE main story — veto/reasoning log)
- Real-world applicability (this is a real product for brands/agencies)
- UX clarity (the console must be readable at a glance during a 2-min demo)

## Demo script beats
1. Show campaign config — "Nike UK, max CPM $8, these topics are blocked"
2. Fire marathon scenario — BID card appears. Show reasoning + Thrad ad creative.
3. Fire controversy scenario — FLAGGED. Veto it. Explain veto feeds back to agent.
4. Fire weather scenario — SKIP. Agent saves budget.
5. Open console.overmindlab.ai — "Every GPT-4o call is traced. Full auditability."
6. Closing: "This is what trustworthy AI-native advertising looks like."
