// One place for model calls: NVIDIA Nemotron on Nebius Token Factory, shared by the digest and the simulator's
// assistant. It replaces the Bedrock module at the same boundary: everything else in Pawzoo (the day, the food
// forecast, quotes, bookings, the MCP tools) is plain code and never calls a model.
//
// Routing, by job:
//   - tools: Nemotron 3 Super picks Pawzoo tools from the live MCP tools/list (OpenAI-style tool calling).
//   - phrase: Nemotron 3 Nano turns the day's facts into two to four spoken sentences.
// Every call goes through the spend guard (published prices, worst case reserved before sending, real cost in a
// ledger, refused past PAWZOO_BUDGET_USD, halted on any billing error) and is recorded with its tokens, cost and
// time for the cost and latency panel. Without NEBIUS_API_KEY, Pawzoo answers with rules and templates.

import { join } from 'node:path';
import { fetchPrices, GuardedTransport, SpendGuard } from './nebius/budget.js';
import { HttpTransport, TokenFactory, type ChatMessage, type ChatResult } from './nebius/client.js';
import { Telemetry, type CallRecord } from './nebius/telemetry.js';

export const MODELS = {
  tools: process.env.PAWZOO_TOOLS_MODEL?.trim() || 'nvidia/nemotron-3-super-120b-a12b',
  phrase: process.env.PAWZOO_PHRASE_MODEL?.trim() || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
};

export const LABELS: Record<string, string> = {
  'nvidia/nemotron-3-super-120b-a12b': 'Nemotron 3 Super',
  'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B': 'Nemotron 3 Nano',
  'nvidia/Nemotron-3-Ultra-550b-a55b': 'Nemotron 3 Ultra',
  'nvidia/Nemotron-3_5-Lightning': 'Nemotron 3.5 Lightning',
};

export const modelLabel = (id: string) => LABELS[id] ?? id.split('/').pop() ?? id;

const telemetry = new Telemetry();
let tf: TokenFactory | null | undefined;
let guard: SpendGuard | null = null;

/** The Token Factory client, or null when Pawzoo runs offline (no key, or PAWZOO_NEMOTRON=off). */
export function nemotron(): TokenFactory | null {
  if (tf !== undefined) return tf;
  const key = process.env.NEBIUS_API_KEY?.trim();
  if (!key || process.env.PAWZOO_NEMOTRON === 'off') return (tf = null);
  const baseUrl = process.env.NEBIUS_BASE_URL?.trim() || undefined;
  guard = new SpendGuard(Number(process.env.PAWZOO_BUDGET_USD ?? 0), process.env.PAWZOO_LEDGER?.trim() || join(process.cwd(), '.pawzoo-ledger.jsonl'));
  tf = new TokenFactory(new GuardedTransport(new HttpTransport(key, baseUrl, Number(process.env.PAWZOO_TIMEOUT_MS ?? 30_000)), guard, () => fetchPrices(key, baseUrl)), telemetry);
  return tf;
}

/** For tests: forget the client so the next call reads the environment again. */
export function resetNemotron(): void {
  tf = undefined;
  guard = null;
}

/** Money spent so far on this ledger, for the panel. */
export function spentUsd(): number {
  nemotron();
  return guard?.spent() ?? 0;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Nemotron 3 Super chooses tools. `scope` groups calls for the panel (a conversation turn, a digest). */
export async function chooseTools(system: string, user: string, tools: ToolSpec[], scope: string): Promise<ChatResult> {
  const client = nemotron();
  if (!client) throw new Error('NEBIUS_API_KEY is not set');
  return client.chat({
    step: scope,
    role: 'tools',
    model: MODELS.tools,
    maxTokens: 400,
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    extraBody: { tools: tools.map((t) => ({ type: 'function', function: t })), tool_choice: 'auto' },
  });
}

/** Nemotron 3 Nano writes short spoken text from facts. */
export async function phrase(system: string, user: string, scope: string): Promise<string> {
  const client = nemotron();
  if (!client) throw new Error('NEBIUS_API_KEY is not set');
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  const out = await client.chat({ step: scope, role: 'phrase', model: MODELS.phrase, maxTokens: 220, temperature: 0.4, messages });
  return out.text.trim();
}

export interface PanelCall {
  at: string;
  scope: string;
  job: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd: number;
  ok: boolean;
}

/** The last calls, newest first, for the cost and latency panel. */
export function recentCalls(limit = 30): PanelCall[] {
  return telemetry.calls
    .slice(-limit)
    .reverse()
    .map((c: CallRecord) => ({ at: c.at, scope: c.step, job: c.role, model: modelLabel(c.model), tokensIn: c.tokensIn, tokensOut: c.tokensOut, latencyMs: c.latencyMs, costUsd: c.costUsd, ok: c.ok }));
}

/** Totals by scope kind ("conversation", "digest"): calls, tokens, cost and median time. */
export function totals(): Record<string, { calls: number; tokens: number; costUsd: number; medianMs: number }> {
  const out: Record<string, { calls: number; tokens: number; costUsd: number; ms: number[] }> = {};
  for (const c of telemetry.calls) {
    if (!c.ok) continue;
    const kind = c.step.split(' ')[0] ?? 'other';
    out[kind] ??= { calls: 0, tokens: 0, costUsd: 0, ms: [] };
    const t = out[kind];
    t.calls += 1;
    t.tokens += c.tokensIn + c.tokensOut;
    t.costUsd += c.costUsd;
    t.ms.push(c.latencyMs);
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => {
      const ms = [...v.ms].sort((a, b) => a - b);
      return [k, { calls: v.calls, tokens: v.tokens, costUsd: v.costUsd, medianMs: ms[Math.floor(ms.length / 2)] ?? 0 }];
    }),
  );
}
