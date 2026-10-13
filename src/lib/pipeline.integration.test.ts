import { it, expect } from "vitest";
it("rolls back injected partial candidate writes and atomically deduplicates receipts", async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("test_machine_pipeline_atomicity");
  expect(error).toBeNull();
  expect(data).toEqual({
    fixturesPersisted: false,
    failureInjectionRollback: true,
    conflictingReceiptRejected: true,
    idempotentCandidateAndQueue: true,
  });
});
it("atomically advances immutable heads and separates duplicate receipts across networks", async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("test_machine_head_and_receipts");
  expect(error).toBeNull();
  expect(data).toEqual({
    fixturesPersisted: false,
    immutableAncestry: true,
    networkSeparation: true,
    receiptIdempotency: true,
    receiptConflictRejected: true,
    atomicHeadAndIdempotentGeneration: true,
  });
});
it("enrolls runners only through unused, unexpired, owner-bound challenges with globally unique keys", async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("test_runner_enrollment" as never);
  expect(error).toBeNull();
  expect(data).toEqual({
    enrolled: true,
    reusedRejected: true,
    expiredRejected: true,
    wrongOwnerRejected: true,
    keyMismatchRejected: true,
    duplicateKeyRejected: true,
    unprovenReplaced: true,
    authorKeyReplayRejected: true,
    fixturesPersisted: false,
  });
});
