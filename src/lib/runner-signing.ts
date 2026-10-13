import nacl from "tweetnacl";
import { z } from "zod";
export const envelopeSchema = z
  .object({ payload: z.string().min(2).max(350000), signature: z.string().max(100) })
  .strict();
/** v2: Ed25519 signs the exact UTF-8 payload string, never reserialized JSON. */
export function verifyEnvelope(input: unknown, key: string) {
  const e = envelopeSchema.parse(input);
  let valid = false;
  try {
    valid = nacl.sign.detached.verify(
      new TextEncoder().encode(e.payload),
      Uint8Array.from(atob(e.signature), (x) => x.charCodeAt(0)),
      Uint8Array.from(atob(key), (x) => x.charCodeAt(0)),
    );
  } catch {
    valid = false;
  }
  if (!valid) throw new Error("Invalid signature");
  const body: unknown = JSON.parse(e.payload);
  return { ...e, body };
}
