import { describe, expect, it } from "vitest";
import { githubFetch } from "./github.server";

describe("GitHub edge-compatible fetch", () => {
  it("uses redirect manual (edge runtimes reject 'error')", async () => {
    let seen: RequestInit | undefined;
    const f = (async (_u: string, init: RequestInit) => {
      seen = init;
      return new Response('{"ok":1}', { status: 200 });
    }) as unknown as typeof fetch;
    expect(await githubFetch("/repos/a/b", false, f)).toBe('{"ok":1}');
    expect(seen?.redirect).toBe("manual");
  });
  it("rejects 3xx redirects", async () => {
    const f = (async () =>
      new Response(null, { status: 301, headers: { location: "https://evil.example/" } })) as unknown as typeof fetch;
    await expect(githubFetch("/repos/a/b", false, f)).rejects.toThrow(/301: unexpected redirect/);
  });
  it("keeps honest rate-limit error", async () => {
    const f = (async () => new Response("x", { status: 403 })) as unknown as typeof fetch;
    await expect(githubFetch("/repos/a/b", false, f)).rejects.toThrow(/rate limited/);
  });
});
