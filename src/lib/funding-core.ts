import { z } from "zod";
const instruction = z
  .object({
    program: z.string().optional(),
    programId: z.string().optional(),
    parsed: z
      .union([z.string(), z.object({ type: z.string(), info: z.record(z.unknown()) })])
      .optional(),
  })
  .passthrough();
const transactionSchema = z.object({
  slot: z.number().int(),
  meta: z.object({
    err: z.unknown(),
    innerInstructions: z
      .array(z.object({ instructions: z.array(instruction) }))
      .nullable()
      .optional(),
  }),
  transaction: z.object({
    message: z.object({
      accountKeys: z.array(z.object({ pubkey: z.string(), signer: z.boolean() })),
      instructions: z.array(instruction),
    }),
  }),
});
export function verifySolDeposit(value: unknown, machineId: string, recipient: string) {
  const tx = transactionSchema.parse(value);
  if (tx.meta.err !== null) throw new Error("Transaction failed");
  const memo = `devlab:${machineId}`;
  const instructions = tx.transaction.message.instructions;
  if (
    instructions.filter(
      (i) => i.programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" && i.parsed === memo,
    ).length !== 1
  )
    throw new Error("Exact machine memo required");
  const transfers = instructions.filter(
    (i) =>
      i.program === "system" &&
      typeof i.parsed === "object" &&
      i.parsed.type === "transfer" &&
      i.parsed.info["destination"] === recipient,
  );
  if (transfers.length !== 1) throw new Error("One explicit machine SOL transfer required");
  const transfer = transfers[0];
  if (!transfer || typeof transfer.parsed !== "object") throw new Error("Missing transfer");
  const info = transfer.parsed.info;
  const amount = info["lamports"];
  const sender = info["source"];
  if (
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    typeof sender !== "string" ||
    sender === recipient ||
    !tx.transaction.message.accountKeys.some((k) => k.pubkey === sender && k.signer)
  )
    throw new Error("Exact safe amount and signing sender required");
  return { amountLamports: String(amount), sender, recipient, slot: tx.slot, memo };
}
