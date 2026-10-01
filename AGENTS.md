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
- All user tables (profiles, projects, watchlist, research_runs) are owner-only via RLS on auth.uid(); no public reads until a publish flow exists.
- Shared chrome/primitives (header, footer, PageHeader, EmptyState, SignInPrompt) live in `src/components/site.tsx`.
