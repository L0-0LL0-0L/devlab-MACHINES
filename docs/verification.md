# devlab MACHINES — verification, 2026-10-13

## Implemented and actually checked
- Official uploaded JPEG used unchanged through the project asset pointer; derived square 64px favicon in public/favicon.png. No replacement artwork generated.
- All rebuilt public routes loaded: /, /explorer, /machines, /repositories, /generations, /analytics, /launch, /desk, /docs, /profile. /research → /machines and /community → /explorer verified in browser. /portfolio and /launchpad index redirect to Profile and Launch. Existing token pages and creator fee controls retained.
- Desktop 1280×1800 and phone 390×844 screenshots reviewed; phone menu works, no horizontal overflow, artwork no longer overlaps text. Screenshots in /tmp/browser/devlab during this verification.
- New generated local test wallet signed a free authentication message. Account creation/sign-in completed and navigated to Profile. No user funds or transactions were signed.
- Full six-step launch created **private verification machines** using https://github.com/units-agents/units-recipes. GitHub returned branch main, commit 997d1b0e86293f6897090f20159bc858e8550e3b, Rust, Apache-2.0 and a real README. Verification records remain private and clearly named; no public demo records were seeded.
- Real Claude working-soul generation returned substantive text; editable soul save/reload persisted correctly.
- On-demand live provider health: Claude returned READY, model claude-sonnet-5-5, 21 input/4 output tokens, 1471ms. Jev responded using typesafe/jev-1.13-20260917, 276 input/20 output tokens, 407ms. No model substitutions.
- Run without an author runner recorded blocked status and explicit setup reason. Registering a real local test signing identity allowed a retry job to be leased.
- Runner contract exercised with real credentials and signatures: lease succeeded; invalid signature → 403; signed failure (Docker unavailable in verification environment) → 200; replaying the consumed callback → 409. Unauthenticated lease and callback → 401. No fake successful execution or replay evidence inserted.
- Follow persisted. Explicit publication made the test machine readable anonymously; making it private removed anonymous access. No test machine left public.
- Optional machine token preparation saved a private linked token draft and opened its existing Meteora token page. No transaction signed, token deployed, fees claimed or funds spent.
- Client attempt to update machine status was denied after explicit write privilege revocation. No direct client writes to job/results/generations/ledger. Owner access enforced through RLS plus server ownership checks.
- Desk showed the user's real saved machine. Machine/panel choices are persisted. Confirmed SOL and both legacy/Token-2022 holdings are implemented via on-chain reads; funded holdings not available for the generated test wallet.
- Browser flow reported zero page errors.

## Automated checks
- `bunx vitest run src/lib/machine-core.test.ts src/lib/research-core.test.ts`: **23/23 passed** (17 new domain tests + 6 preserved historical research tests).
- Concrete rules: GitHub host/protocol/root restrictions; protected/traversal patches; two independent verifier identities; author/same-owner/duplicate owner exclusion; missing/NaN metrics; failed tests/equivalence; guard regression; minimum improvement; digest/signature mismatch; canonical snapshot ordering.
- Runner Python syntax parsed successfully. Docker execution was **not run**: Docker is not installed in this verification environment.
- Harness typecheck and build latest observed output: **build OK**, 2026-10-13 20:04:16 UTC. No manual build/typecheck invoked because platform checks run automatically.

## Architecture and security
- Additive migrations 0005–0007 retain all historical records. Registry entries are never auto-created from old projects.
- Registry/results/status/financial writes are server-only after ownership or runner authentication. Public reads depend on explicit machine visibility. Jobs and ledger stay private.
- PostgreSQL leasing uses row locking + SKIP LOCKED, three bounded attempts, 10-minute lease, independent owner/identity selection, and one-use callback consumption.
- Replay signature payloads and evidence digests are stored. Stored signatures/digests are revalidated before judge decisions. Single-parent generation uniqueness prevents two accepted heads for the same parent.
- Patched repository tests, benchmark directories, environment files, .github, runner files, unsafe paths and binary/symlink/mode changes are blocked. Operators still must protect all imported measurement/equivalence dependencies in their recipe.
- Execution lives in runner/worker.py, never in browser workers or web requests. Docker sandbox is non-root, network-disabled, read-only root, capabilities dropped, memory/CPU/pid/time limited; git metadata is hidden from commands. Dedicated host/VM outer isolation is recommended.
- No upstream Units code vendored, so no third-party license files introduced. Public behavior was used as a product reference, not copied private services or metrics.

## Explicit blockers and remaining limitations
1. **Hosted compute/desktop:** no external hosted runner/desktop/billing integration exists. Hosted jobs remain blocked, no live desktop shown.
2. **Independent execution:** install the supplied runnable runner package on real dedicated Docker hosts, configure pinned dependency-ready images, and register an author plus two verifiers owned by distinct accounts. Until actual baseline/candidate replays pass, this is **not a fully operational verifier network**.
3. **Autonomous author loop:** Claude proposes patches from selected pinned files; the self-hosted author measures a supplied real diff via DEVLAB_PATCH_FILE. A full autonomous repository-wide planner/publisher is not implemented.
4. **Accepted generation progression:** accepted-generation decisions and parent chain persist, but pushing candidate commits to GitHub and advancing repository baseline across remotely published candidate commits is not configured.
5. **Funding automation:** ledger schema and private accounting display exist; no automatic SOL deposit reconciliation, fee-to-compute routing, billing debits or priced runway. Actual wallet-signed Meteora rail remains separate. No fabricated credit balance.
6. **Financial end-to-end:** live launch/buy/sell/claim/migration not executed; these require a funded wallet and real pool. No funds were requested or spent.
7. **Runner callback persistence:** lease consumption is atomic; subsequent candidate/replay/event writes are separate checked operations, not one database transaction. An infrastructure failure after lease consumption may need operator reconciliation; do not claim exactly-once entire pipeline delivery.
8. **Public content SSR:** routes have app-specific metadata; registry/detail reads currently hydrate through client queries. Dynamic public snapshots are inspectable in the UI, not fully prerendered evidence pages.
9. **Editor project name:** no project-rename tool was available. The app, metadata, favicon and documentation use devlab MACHINES; existing published hostname/editor project label were not changed. User handles publishing.

## Main affected files
src/styles.css; src/components/Logo.tsx, site.tsx, machine-list.tsx, registry-page.tsx, machine-detail.tsx; src/routes/index.tsx, __root.tsx, auth.tsx, launch.tsx, explorer.tsx, machines*.tsx, repositories.tsx, generations.tsx, analytics.tsx, desk.tsx, profile.tsx, docs.tsx and compatibility routes; src/lib/machine-core.ts/.test.ts, github.server.ts, machines.functions.ts, runner.server.ts, token-machine.functions.ts, holdings.functions.ts, page-meta.ts; runner/*; drizzle/migrations/0005–0007; README.md; AGENTS.md.
