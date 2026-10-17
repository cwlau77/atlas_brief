# Atlas Brief backlog

Ideas captured for later. Each needs its own design pass (brainstorm → spec → plan) before work starts.

## 1. Ask Atlas about this briefing (chat)

A chat panel on the briefing page that answers questions about the current briefing: "Why does the Suez revenue drop matter?", "Which sources disagree about the tanker damage?", "What should I read first?"

- Grounded only in the briefing's content and its cited articles; every answer cites sources, and says so when the briefing doesn't cover the question.
- Lives on the Briefing page (likely a third tab or a side panel next to Story/Signals).
- Backend: a new `/briefing/{id}/ask` endpoint (or a stateless endpoint that receives the briefing payload, since briefings are stored client-side).
- Open questions: conversation memory per briefing, cost limits, whether answers can trigger a fresh search when the briefing is thin.

## 2. Onboarding and personas

A first-run flow that builds a user profile and tailors briefings to it.

- Captures role or persona (student, analyst, investor, policy staffer, journalist), regions and topics of interest, depth preference, and reading time.
- Persona shapes the synthesis prompt (emphasis, jargon level, what counts as a priority alert) and the default topic chips on Home.
- Extends the existing Settings/profile data (`userProfileV1`) rather than adding a new store.
- Open questions: skippable vs required, editing later from Settings, whether personas apply per briefing or globally.

## 3. Broaden article retrieval

Briefings on major domestic topics can come back nearly empty. Example: "Data centers and privacy in the US" returned one unrelated article.

Root causes and options are written up in the session notes from 2026-10-17. In short: the upstream query sends the whole phrase as one exact quoted string, the RSS pool is world-desk feeds only, the short token "us" matches the pronoun, and relevance scoring uses TF-IDF rather than semantic similarity. Candidate fixes: smarter query building, LLM query expansion, US and tech feeds, additional search sources, and better relevance ranking.
