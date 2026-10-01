# biocode verification log

## Stage 2 — research pipeline (2026-10-01)

### Versions
- vitest 5.0.3, zod ^3.25.76, TanStack Start v1 (see package.json)
- Prompt version: `biocode-research-v1`
- Generative model: `claude-sonnet-5-5` via the official Anthropic Messages API (streamed, accumulated server-side)
- Typed decisions: `typesafe/jev-latest` via Lovable AI Gateway `POST /v1/systemone` (resolved live to `typesafe/jev-1.13-20260917`)

### Live provider checks (actual results)
| Check | Result |
|---|---|
| Gateway `/v1/messages` with `anthropic/claude-sonnet-5-5` | **400 invalid model** — gateway offers only `claude-sonnet-5`, `opus-5`, `opus-5-5`, `fable-5-1`, `haiku-4-5` |
| Anthropic adapter without key | Fails fast with `missing_config: ANTHROPIC_API_KEY is not configured` (no fallback, no sample output) |
| Anthropic adapter with key, ping | OK — model `claude-sonnet-5-5`, 20 in / 4 out tokens |
| Methods-critic role on 3 live Europe PMC abstracts | OK — schema valid, 4 items, 5/5 citations verified verbatim; 1340 in / 1608 out tokens |
| Jev choice+noul+score request | OK — domain `longevity` p=1.0; biomedical noul 0.98; score 1.94/2 |
| Jev claim-support noul | OK — 0.90 for a supporting excerpt |
| Europe PMC search | OK — 3 results with abstracts |
| arXiv search | OK — 3 results with abstracts |
| Crossref search | OK — 3 results (often metadata only; labeled as such) |

### Automated tests (`bunx vitest run`)
6/6 passed: role output schema validation, fenced-JSON extraction, verbatim citation verification, unknown-source flagging, input limits (unknown role, path-traversal upload path, oversize question), markdown escaping in exports.

### Typecheck
`tsgo --noEmit` — clean.

### Security / ownership
- `research_runs`: owner SELECT/INSERT(only as queued, no results)/DELETE; UPDATE revoked from clients — status, results, errors only written server-side after an RLS ownership read.
- `research_sources`, `research_steps`, `research_findings`: owner SELECT only; writes only by server.
- PDFs in private `research-uploads` bucket, path must start with the user's id (storage RLS + server check).
- Paper fetching only from a fixed host allowlist (api.crossref.org, www.ebi.ac.uk, export.arxiv.org) with timeouts and size caps.
- Limits: 10 runs/24h, 1 active run, 12 papers, 50k chars text, 10 MB PDF, depth-bounded tokens.

### Blocked / untested
- Full signed-in browser run not executed: the project has no test user, and sign-up requires a confirmable email.
- PDF document input to Claude untested (depends on the key).
