import nacl from "tweetnacl";

/** Enrollment v1: runners prove possession of their Ed25519 signing key over a server challenge. */
export const ENROLLMENT_VERSION = "devlab-runner-enrollment-v1";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeBase64Strict(input: string): Uint8Array {
  if (typeof input !== "string" || input.length % 4 !== 0 || !B64.test(input))
    throw new Error("Key must be canonical standard Base64");
  let bin: string;
  try {
    bin = atob(input);
  } catch {
    throw new Error("Key must be canonical standard Base64");
  }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  if (encodeBase64(bytes) !== input) throw new Error("Key must be canonical standard Base64");
  return bytes;
}

export function encodeBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Returns the canonical Base64 key and its lowercase hex normalization (the uniqueness key). */
export function parseSigningKey(input: string) {
  const bytes = decodeBase64Strict(input);
  if (bytes.length !== 32) throw new Error("Ed25519 public key must be exactly 32 bytes");
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  if (/^0+$/.test(hex)) throw new Error("Degenerate signing key");
  return { base64: input, normalized: hex, bytes };
}

export function decodeSignature(input: string) {
  const bytes = decodeBase64Strict(input);
  if (bytes.length !== 64) throw new Error("Ed25519 signature must be exactly 64 bytes");
  return bytes;
}

export function enrollmentMessage(c: {
  challengeId: string;
  ownerId: string;
  role: "author" | "verifier";
  label: string;
  publicKey: string;
  nonce: string;
  expiresAt: string;
  replaceRunnerId?: string | null;
}) {
  return [
    ENROLLMENT_VERSION,
    `challenge:${c.challengeId}`,
    `owner:${c.ownerId}`,
    `role:${c.role}`,
    `label:${JSON.stringify(c.label)}`,
    `key:${c.publicKey}`,
    `nonce:${c.nonce}`,
    `expires:${c.expiresAt}`,
    `replaces:${c.replaceRunnerId ?? "none"}`,
  ].join("\n");
}

export function verifyEnrollment(message: string, signature: string, publicKey: string) {
  const key = parseSigningKey(publicKey);
  const sig = decodeSignature(signature);
  if (!nacl.sign.detached.verify(new TextEncoder().encode(message), sig, key.bytes))
    throw new Error("Proof of possession failed");
  return key;
}

/** Pure challenge-state check mirrored by the transactional SQL enrollment function. */
export function challengeUsable(
  c: { owner_id: string; consumed_at: string | null; expires_at: string },
  ownerId: string,
  now = Date.now(),
) {
  if (c.owner_id !== ownerId) return "Challenge belongs to another account";
  if (c.consumed_at) return "Challenge already used";
  if (Date.parse(c.expires_at) <= now) return "Challenge expired";
  return null;
}

/** Replay keys must differ from the author key and from every key already used on the candidate. */
export function keySeparationError(
  candidateKey: string | null | undefined,
  authorKey: string | null | undefined,
  usedKeys: (string | null | undefined)[],
) {
  if (!candidateKey) return "Runner signing key has not been proven";
  if (!authorKey || candidateKey === authorKey) return "Replay key must differ from author key";
  if (usedKeys.includes(candidateKey)) return "Replay key already used for this candidate";
  return null;
}
