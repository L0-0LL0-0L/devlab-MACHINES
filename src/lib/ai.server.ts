// Server-only AI adapters.
// - Jev Latest (typed decisions) via Lovable AI Gateway /v1/systemone.
// - Claude Sonnet 5.5 via the official Anthropic Messages API (not offered by the gateway).
import { CLAUDE_MODEL, JEV_MODEL } from "./research-core";

export class AiError extends Error {
  constructor(message: string, public code: "missing_config" | "denied" | "refusal" | "rate_limited" | "credits" | "bad_output" | "upstream", public status?: number) {
    super(message);
  }
}

type JevQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type JevAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: "score"; score: number; confidence: number; probabilities: Record<string, number> };

export async function jev(state: string | Record<string, unknown>, questions: Record<string, JevQuestion>) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError("LOVABLE_API_KEY is not configured", "missing_config");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: JEV_MODEL, state, questions }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw statusError("Jev", res.status, await res.text());
  const j = (await res.json()) as { model: string; answers: Record<string, JevAnswer>; usage?: { input_tokens: number; output_tokens: number; cost?: number } };
  return j;
}

export type ClaudeContent =
  | { type: "text"; text: string }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

/** Streams from Anthropic and accumulates the final text server-side. */
export async function claude(opts: { system: string; content: ClaudeContent[]; maxTokens: number }) {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new AiError(`ANTHROPIC_API_KEY is not configured. Claude Sonnet 5.5 (${CLAUDE_MODEL}) is not offered by the Lovable AI Gateway, so every generative role requires an Anthropic API key.`, "missing_config");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: opts.maxTokens, system: opts.system, stream: true, messages: [{ role: "user", content: opts.content }] }),
    signal: AbortSignal.timeout(110000),
  });
  if (!res.ok || !res.body) throw statusError("Claude", res.status, await res.text());
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", stop: string | null = null, model = CLAUDE_MODEL;
  const usage = { input_tokens: 0, output_tokens: 0 };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data) continue;
      const ev = JSON.parse(data) as { type: string; message?: { model: string; usage?: { input_tokens: number } }; delta?: { type?: string; text?: string; stop_reason?: string }; usage?: { output_tokens: number }; error?: { type: string; message: string } };
      if (ev.type === "message_start" && ev.message) { model = ev.message.model; usage.input_tokens = ev.message.usage?.input_tokens ?? 0; }
      else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text ?? "";
      else if (ev.type === "message_delta") { stop = ev.delta?.stop_reason ?? stop; usage.output_tokens = ev.usage?.output_tokens ?? usage.output_tokens; }
      else if (ev.type === "error") throw new AiError(`Claude stream error: ${ev.error?.message ?? "unknown"}`, ev.error?.type === "permission_error" ? "denied" : "upstream");
    }
  }
  if (stop === "refusal") throw new AiError("Claude declined this request.", "refusal");
  return { text, model, usage, stop };
}

function statusError(who: string, status: number, body: string) {
  let msg = body.slice(0, 300);
  try { const j = JSON.parse(body); msg = j?.error?.message ?? j?.message ?? j?.title ?? msg; } catch { /* keep raw */ }
  const code = status === 401 ? "missing_config" : status === 402 ? "credits" : status === 403 ? "denied" : status === 429 ? "rate_limited" : "upstream";
  return new AiError(`${who} request failed (${status}): ${String(msg).slice(0, 300)}`, code, status);
}
