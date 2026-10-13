import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { configureMachineFunding, reconcileMachineFunding } from "@/lib/funding.functions";
import { Button } from "./ui/button";
import { toast } from "sonner";
export function MachineFunding({
  id,
  cluster,
}: {
  id: string;
  cluster: "devnet" | "mainnet-beta";
}) {
  const configure = useServerFn(configureMachineFunding),
    reconcile = useServerFn(reconcileMachineFunding);
  const [recipient, setRecipient] = useState(""),
    [signature, setSignature] = useState(""),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["funding", "cluster", cluster, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_funding_receipts")
        .select("*")
        .eq("machine_id", id)
        .eq("cluster", cluster);
      if (error) throw error;
      return data;
    },
  });
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await q.refetch();
      toast.success("Saved funding configuration or confirmed receipt");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 border-t border-border pt-5">
      <h3 className="text-xl">Confirmed deposits · {cluster}</h3>
      <p className="text-sm">
        Owner-managed self-hosted funds only. Not hosted credits, automatic wallet spending or pool
        liquidity.
      </p>
      <label className="block text-sm">
        Machine recipient wallet
        <input
          className="field mt-2"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </label>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => act(() => configure({ data: { id, cluster, recipient } }))}
      >
        Save recipient
      </Button>
      <p className="font-mono text-xs break-all">Required transaction memo: devlab:{id}</p>
      <label className="block text-sm">
        Confirmed deposit signature
        <input
          className="field mt-2"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
        />
      </label>
      <Button
        disabled={busy}
        onClick={() => act(() => reconcile({ data: { id, cluster, signature } }))}
      >
        Verify deposit
      </Button>
      {q.error && <p role="alert">{q.error.message}</p>}
      <p className="font-mono">
        Received:{" "}
        {(q.data ?? []).reduce((sum, r) => sum + BigInt(r.amount_lamports), 0n).toString()} lamports
      </p>
      {(q.data ?? []).map((r) => (
        <div key={r.id} className="text-xs font-mono border-t border-border py-3 break-all">
          {r.amount_lamports} lamports · {r.kind}
          <br />
          {r.signature}
          <br />
          {r.sender} → {r.recipient}
        </div>
      ))}
    </div>
  );
}
