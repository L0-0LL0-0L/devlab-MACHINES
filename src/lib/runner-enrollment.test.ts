import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import {
  challengeUsable,
  encodeBase64,
  enrollmentMessage,
  keySeparationError,
  parseSigningKey,
  verifyEnrollment,
} from "./runner-enrollment";
import { guardPatch } from "./machine-core";

const kp = nacl.sign.keyPair();
const pub = encodeBase64(kp.publicKey);
const msg = enrollmentMessage({
  challengeId: "c1",
  ownerId: "o1",
  role: "verifier",
  label: "v1",
  publicKey: pub,
  nonce: "n",
  expiresAt: "2030-01-01T00:00:00.000Z",
});
const sign = (m: string, sk = kp.secretKey) =>
  encodeBase64(nacl.sign.detached(new TextEncoder().encode(m), sk));

describe("runner key parsing", () => {
  it("accepts a canonical 32-byte key and normalizes to hex", () => {
    expect(parseSigningKey(pub).normalized).toMatch(/^[0-9a-f]{64}$/);
  });
  it.each([
    ["wrong length", encodeBase64(new Uint8Array(31).fill(7))],
    ["too long", encodeBase64(new Uint8Array(33).fill(7))],
    ["url alphabet", pub.replace(/\+/g, "-").replace(/\//g, "_") + "-_"],
    ["missing padding", pub.slice(0, -1)],
    ["whitespace", " " + pub],
    ["garbage", "not a key at all!!"],
    ["all zero", encodeBase64(new Uint8Array(32))],
  ])("rejects %s", (_, k) => expect(() => parseSigningKey(k)).toThrow());
  it("rejects non-canonical trailing bits", () => {
    // Last char before '=' encodes unused low bits; flip them to get a non-canonical alias.
    const alias = pub.slice(0, 42) + String.fromCharCode(pub.charCodeAt(42) ^ 1) + "=";
    if (alias !== pub && atob(alias) === atob(pub)) expect(() => parseSigningKey(alias)).toThrow();
    else expect(alias).not.toBe(pub);
  });
});

describe("proof of possession", () => {
  it("verifies a real signature over the exact challenge", () => {
    expect(verifyEnrollment(msg, sign(msg), pub).base64).toBe(pub);
  });
  it("rejects a stolen public key signed by another key", () => {
    const thief = nacl.sign.keyPair();
    expect(() => verifyEnrollment(msg, sign(msg, thief.secretKey), pub)).toThrow(/possession/);
  });
  it("rejects signatures over a modified challenge", () => {
    expect(() => verifyEnrollment(msg, sign(msg.replace("verifier", "author")), pub)).toThrow();
  });
  it("rejects wrong-length signatures", () => {
    expect(() => verifyEnrollment(msg, encodeBase64(new Uint8Array(63)), pub)).toThrow();
  });
  it("binds owner, role, label, key and nonce", () => {
    for (const k of ["owner:o1", "role:verifier", 'label:"v1"', "key:" + pub, "nonce:n"])
      expect(msg).toContain(k);
  });
});

describe("challenge state", () => {
  const base = { owner_id: "o1", consumed_at: null, expires_at: "2030-01-01T00:00:00Z" };
  it("allows a fresh owned challenge", () => expect(challengeUsable(base, "o1", 0)).toBeNull());
  it("rejects reused", () =>
    expect(challengeUsable({ ...base, consumed_at: "x" }, "o1", 0)).toMatch(/used/));
  it("rejects expired", () =>
    expect(challengeUsable(base, "o1", Date.parse("2031-01-01"))).toMatch(/expired/));
  it("rejects wrong owner", () => expect(challengeUsable(base, "o2", 0)).toMatch(/another/));
});

describe("replay key separation", () => {
  it("rejects unproven, author-key and reused replay keys", () => {
    expect(keySeparationError(null, "a", [])).toMatch(/proven/);
    expect(keySeparationError("a", "a", [])).toMatch(/author/);
    expect(keySeparationError("b", null, [])).toMatch(/author/);
    expect(keySeparationError("b", "a", ["b"])).toMatch(/already/);
    expect(keySeparationError("c", "a", ["b"])).toBeNull();
  });
});

describe("patch mode guards", () => {
  const ok = "diff --git a/src/a.ts b/src/a.ts\nindex 1234567..89abcde 100644\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-a\n+b\n";
  it("accepts a regular file", () => expect(guardPatch(ok, [])).toContain("src/a.ts"));
  it.each(["120000", "160000", "100755"])("rejects existing mode %s on index line", (m) =>
    expect(() => guardPatch(ok.replace("100644", m), [])).toThrow(),
  );
  it("rejects copies", () =>
    expect(() =>
      guardPatch(ok.replace(/index .*\n/, "similarity index 90%\ncopy from src/b.ts\ncopy to src/a.ts\n"), []),
    ).toThrow(),
  );
});
