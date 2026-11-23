import { createFileRoute } from "@tanstack/react-router";

/**
 * Same-origin relay to Helius for the browser privacy client, so the Helius key never reaches the browser.
 * Only the privacy gateway (/v1/spr/*) and a fixed list of Solana RPC methods are forwarded.
 * Prover traffic stays end-to-end encrypted to Helius's attested enclave; this relay only sees ciphertext.
 */
const HOSTS = { devnet: "devnet.helius-rpc.com", mainnet: "mainnet.helius-rpc.com" } as const;
const RPC_METHODS = new Set([
  "getLatestBlockhash", "getAccountInfo", "getMultipleAccounts", "getBalance", "getSlot", "getBlockHeight",
  "getSignatureStatuses", "sendTransaction", "simulateTransaction", "getMinimumBalanceForRentExemption",
  "getTransaction", "getProgramAccounts", "getEpochInfo", "getFeeForMessage", "getRecentPrioritizationFees", "isBlockhashValid",
]);
const MAX_BODY = 512 * 1024;
const FORWARD_HEADERS = ["content-type", "accept"];

async function relay(request: Request, splat: string | undefined): Promise<Response> {
  const key = process.env["HELIUS_API_KEY"];
  if (!key) return Response.json({ error: "Private balances are not configured on this server." }, { status: 503 });
  const parts = (splat ?? "").split("/").filter(Boolean);
  const net = parts.shift();
  if (net !== "devnet" && net !== "mainnet") return Response.json({ error: "Unknown network" }, { status: 404 });
  const path = parts.join("/");
  if (path !== "" && !/^v1\/spr(\/[A-Za-z0-9._-]+)*$/.test(path)) return Response.json({ error: "Path not allowed" }, { status: 403 });

  let body: ArrayBuffer | undefined;
  if (request.method === "POST") {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY) return Response.json({ error: "Request too large" }, { status: 413 });
    if (path === "") {
      let parsed: unknown;
      try { parsed = JSON.parse(new TextDecoder().decode(body)); } catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }
      const calls = Array.isArray(parsed) ? parsed : [parsed];
      if (calls.length > 20) return Response.json({ error: "Batch too large" }, { status: 413 });
      for (const c of calls) {
        const m = (c as { method?: unknown })?.method;
        if (typeof m !== "string" || !RPC_METHODS.has(m)) {
          console.warn("[helius-relay] blocked method", String(m).slice(0, 60));
          return Response.json({ jsonrpc: "2.0", id: (c as { id?: unknown })?.id ?? null, error: { code: -32601, message: "Method not allowed by relay" } }, { status: 200 });
        }
      }
    }
  }

  const src = new URL(request.url);
  const target = new URL(`https://${HOSTS[net]}/${path}`);
  src.searchParams.forEach((v, k) => { if (k !== "api-key") target.searchParams.set(k, v); });
  target.searchParams.set("api-key", key);
  const headers = new Headers();
  for (const h of FORWARD_HEADERS) { const v = request.headers.get(h); if (v) headers.set(h, v); }
  // Encrypted prover channel headers.
  request.headers.forEach((v, k) => { if (k.toLowerCase().startsWith("spr-")) headers.set(k, v); });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const res = await fetch(target, { method: request.method, headers, body: body ?? null, redirect: "manual", signal: ctrl.signal });
    if (res.status >= 300 && res.status < 400) return Response.json({ error: "Upstream redirect refused" }, { status: 502 });
    const out = new Headers({ "cache-control": "no-store" });
    res.headers.forEach((v, k) => { const l = k.toLowerCase(); if (l === "content-type" || l.startsWith("spr-")) out.set(k, v); });
    return new Response(await res.arrayBuffer(), { status: res.status, headers: out });
  } catch (e) {
    console.error("[helius-relay] upstream error", (e as Error).name);
    return Response.json({ error: "Helius did not respond in time." }, { status: 504 });
  } finally { clearTimeout(timer); }
}

export const Route = createFileRoute("/api/public/helius/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => relay(request, params._splat),
      POST: ({ request, params }) => relay(request, params._splat),
    },
  },
});
