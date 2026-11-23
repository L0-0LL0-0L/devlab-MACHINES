import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCluster } from "@/lib/cluster";
import { SignInPrompt } from "@/components/site";
import { usePrivateSession, errText } from "@/components/PrivateVault";
import { createBounty, closeBounty, submitToBounty, listSubmissions, markSubmissionPaid } from "@/lib/bounties.functions";

type Bounty = { id: string; kind: string; title: string; description: string; reward_sol: number; status: string; created_at: string };

export function BountiesSection({ projectId, isOwner }: { projectId: string; isOwner: boolean }) {
  const q = useQuery({
    queryKey: ["bounties", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("bounties").select("id,kind,title,description,reward_sol,status,created_at").eq("project_id", projectId).order("created_at", { ascending: false });
      return (data ?? []) as Bounty[];
    },
  });
  const open = (q.data ?? []).filter((b) => b.status === "open");
  return (
    <section className="panel p-6">
      <p className="eyebrow">private bounties · sealed reviews</p>
      <h2 className="mt-2 text-2xl font-light">Paid research work</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The creator posts tasks (replicate a result, find flaws, review the thesis). Contributors submit with a private receiving address and are paid through Helius Privacy Rings, so the amount and recipient are encrypted on-chain. Reviews are sealed: the creator sees the text, never who wrote it.
      </p>
      {isOwner && <NewBounty projectId={projectId} onDone={() => q.refetch()} />}
      <div className="mt-6 space-y-4">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : open.length === 0 ? <p className="text-sm text-muted-foreground">No open bounties or review requests yet.</p>
          : open.map((b) => <BountyCard key={b.id} b={b} isOwner={isOwner} onChange={() => q.refetch()} />)}
      </div>
    </section>
  );
}

function NewBounty({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const create = useServerFn(createBounty);
  const [kind, setKind] = useState<"bounty" | "review">("bounty");
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [reward, setReward] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="mt-5 space-y-3 border-t border-border pt-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { await create({ data: { projectId, kind, title, description: desc, rewardSol: Number(reward) } }); setTitle(""); setDesc(""); setReward(""); toast.success("Posted"); onDone(); }
      catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
    }}>
      <div className="flex gap-2" role="radiogroup" aria-label="Type">
        {(["bounty", "review"] as const).map((k) => (
          <Button key={k} type="button" size="sm" variant={kind === k ? "default" : "outline"} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === "bounty" ? "Research bounty" : "Sealed review"}</Button>
        ))}
      </div>
      <Input aria-label="Title" placeholder="e.g. Replicate figure 2 with public data" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required />
      <Textarea aria-label="What you need" placeholder="What counts as done, what to submit" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={4000} required />
      <Input aria-label="Reward in SOL" placeholder="Reward (SOL)" inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value)} required />
      <p className="text-xs text-muted-foreground">The reward is a promise, not held in escrow. You pay from your private balance when you accept a submission.</p>
      <Button type="submit" disabled={busy}>{busy ? "Posting…" : "Post"}</Button>
    </form>
  );
}

function BountyCard({ b, isOwner, onChange }: { b: Bounty; isOwner: boolean; onChange: () => void }) {
  const close = useServerFn(closeBounty);
  return (
    <article className="border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">{b.title}</h3>
        <span className="font-mono text-sm text-primary">{b.reward_sol} SOL · {b.kind === "review" ? "sealed review" : "bounty"}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{b.description}</p>
      {isOwner ? (
        <>
          <Submissions bountyId={b.id} reward={String(b.reward_sol)} />
          <Button className="mt-3" size="sm" variant="outline" onClick={async () => { await close({ data: { bountyId: b.id } }); onChange(); }}>Close</Button>
        </>
      ) : <SubmitForm bountyId={b.id} review={b.kind === "review"} />}
    </article>
  );
}

function SubmitForm({ bountyId, review }: { bountyId: string; review: boolean }) {
  const { user } = useAuth();
  const { session, unlock } = usePrivateSession();
  const submit = useServerFn(submitToBounty);
  const [body, setBody] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  if (!user) return <div className="mt-3"><SignInPrompt what={review ? "submit a sealed review" : "submit work"} /></div>;
  if (done) return <p className="mt-3 text-sm">Submitted. If accepted, payment arrives in your private balance.</p>;
  return (
    <div className="mt-4 space-y-3">
      <Textarea aria-label={review ? "Your review" : "Your submission"} placeholder={review ? "Your review (the creator won't see who wrote it)" : "Your result, with links to data or code"} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} />
      {!session ? (
        <Button size="sm" variant="outline" onClick={async () => { try { await unlock(); } catch (e) { toast.error(await errText(e)); } }}><Lock className="mr-1 h-4 w-4" />Open private balance to get paid</Button>
      ) : (
        <Button size="sm" disabled={busy || body.trim().length < 20} onClick={async () => {
          setBusy(true);
          try { await submit({ data: { bountyId, body, receiveAddress: session.shieldedAddress } }); setDone(true); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>{busy ? "Sending…" : review ? "Submit sealed review" : "Submit"}</Button>
      )}
    </div>
  );
}

function Submissions({ bountyId, reward }: { bountyId: string; reward: string }) {
  const { cluster } = useCluster();
  const list = useServerFn(listSubmissions);
  const mark = useServerFn(markSubmissionPaid);
  const qc = useQueryClient();
  const { session, unlock } = usePrivateSession();
  const q = useQuery({ queryKey: ["bounty-subs", bountyId], queryFn: () => list({ data: { bountyId } }) });
  const [phase, setPhase] = useState<string | null>(null);
  if (!q.data?.length) return <p className="mt-3 text-xs text-muted-foreground">No submissions yet.</p>;
  return (
    <ul className="mt-4 space-y-3">
      {q.data.map((s) => (
        <li key={s.id} className="border-l-2 border-primary pl-3 text-sm">
          <p className="eyebrow">{s.label} · {s.status}</p>
          <p className="mt-1 whitespace-pre-wrap">{s.body}</p>
          {s.status === "pending" && (
            <Button className="mt-2" size="sm" disabled={!!phase} onClick={async () => {
              try {
                const sess = session ?? (setPhase("Opening private balance…"), await unlock());
                const m = await import("@/lib/privacy");
                setPhase("Sending private payment…");
                const sig = await m.sendPrivately(sess, s.receive_address, m.toLamports(reward));
                setPhase("Recording…");
                await mark({ data: { submissionId: s.id, cluster, signature: sig } });
                toast.success("Paid privately");
                await qc.invalidateQueries({ queryKey: ["bounty-subs", bountyId] });
              } catch (e) { toast.error(await errText(e)); } finally { setPhase(null); }
            }}>{phase ?? `Pay ${reward} SOL privately`}</Button>
          )}
        </li>
      ))}
    </ul>
  );
}
