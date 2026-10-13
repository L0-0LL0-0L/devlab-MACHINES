<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Auth state lives in `src/lib/auth.tsx` (AuthProvider); pages stay public and show inline sign-in prompts for private actions — keeps browsing open while RLS protects owner data.
- Cluster + wallet state lives in `src/lib/cluster.tsx`; any cluster-dependent query key must include the literal "cluster" so switching clusters purges it.
- Machine configuration and evidence are publicly readable only for explicitly public machines; historical projects remain separate and private jobs/ledgers remain owner-scoped — prevents accidental registry conversion or data disclosure.
- Shared chrome/primitives (header, footer, PageHeader, EmptyState, SignInPrompt) live in `src/components/site.tsx`.
- Research runs execute one bounded step per `advanceRun` server call, driven by the open run view — keeps each request inside Worker time limits and gives real progress/cancel/retry.
- Research AI writes (sources, steps, findings, run status) go through the admin client only after an RLS ownership read; clients cannot update runs — prevents forged results.
- Jev calls go through the gateway `/v1/systemone`; Claude generation uses the direct Anthropic adapter in `src/lib/ai.server.ts` because the gateway lacks the required model.
- Sign-in is Solana wallet only: server issues a one-use nonce message, verifies the ed25519 signature, then mints a session via an admin one-time login token — no email provider needed.
- Meteora DBC logic lives in `src/lib/dbc.server.ts` (server-only) with thin wrappers in `src/lib/dbc.functions.ts`; projects go live only via `recordLaunch` after on-chain verification — the DB never leads the chain.
- Each launch creates its own DBC config (feeClaimer = creator wallet) via createConfigAndPool; mint/config keypairs are generated and signed in the browser only.
- External mints enter public listings only after a server-side mainnet DBC lookup verifies the SOL quote mint and matching creator/fee claimer — prevents unverified tokens from appearing live.

- Machine lifecycle writes go through authenticated server functions after an RLS owner read; clients receive SELECT-only registry/evidence grants — prevents forged job results and generations.
- Machine domain logic lives in machine-core.ts, GitHub fetches in github.server.ts, RPC in machines.functions.ts and runner callbacks in runner.server.ts — keeps judge rules independently testable and secrets server-only.
- Runner jobs use database-atomic leases and signed callbacks with one-use lease consumption; external execution lives in runner/worker.py with restricted Docker containers — web requests never execute repository commands.
- Optional machine token projects are explicitly linked by owner-authorized preparation; existing token verification/signing stays in dbc modules — the chain never leads the registry nor relabels historical mints.
- Historical research/community/portfolio/launchpad index URLs redirect to the new product; historical data and compatible wallet email identifiers remain untouched — preserves accounts and records while removing old public positioning.
