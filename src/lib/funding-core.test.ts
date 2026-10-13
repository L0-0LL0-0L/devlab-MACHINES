import { it, expect } from "vitest";
import { verifySolDeposit } from "./funding-core";
const tx = () => ({
  slot: 10,
  meta: { err: null },
  transaction: {
    message: {
      accountKeys: [{ pubkey: "sender", signer: true }],
      instructions: [
        { programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", parsed: "devlab:machine" },
        {
          program: "system",
          parsed: {
            type: "transfer",
            info: { source: "sender", destination: "recipient", lamports: 123456789 },
          },
        },
      ],
    },
  },
});
it("preserves exact base units and signing sender", () =>
  expect(verifySolDeposit(tx(), "machine", "recipient").amountLamports).toBe("123456789"));
it("rejects failed receipt", () => {
  const t = tx();
  (t.meta as { err: unknown }).err = { failure: true };
  expect(() => verifySolDeposit(t, "machine", "recipient")).toThrow();
});
it("rejects different machine memo", () =>
  expect(() => verifySolDeposit(tx(), "other", "recipient")).toThrow());
it("rejects recipient mismatch", () =>
  expect(() => verifySolDeposit(tx(), "machine", "other")).toThrow());
it("rejects non-signing sender", () => {
  const t = tx();
  const k = t.transaction.message.accountKeys[0];
  if (k) k.signer = false;
  expect(() => verifySolDeposit(t, "machine", "recipient")).toThrow();
});
