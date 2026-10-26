// The Nemotron path against a local stand-in for Nebius Token Factory (OpenAI-compatible): tool choice, the digest,
// the spend cap, the 19:00 schedule and the standalone job's delivery.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

const seen: Array<Record<string, any>> = [];
let fake: Server;
const dir = mkdtempSync(join(tmpdir(), 'pawzoo-nemotron-'));

fake = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url?.startsWith('/v1/models')) {
      res.end(JSON.stringify({ data: ['nvidia/nemotron-3-super-120b-a12b', 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B'].map((id) => ({ id, pricing: { prompt: '0.0000003', completion: '0.0000009' } })) }));
      return;
    }
    const json = JSON.parse(body) as Record<string, any>;
    seen.push(json);
    const message = json.tools
      ? { content: null, tool_calls: [{ function: { name: 'check_food', arguments: '{}' } }, { function: { name: 'not_a_tool', arguments: '{}' } }] }
      : { content: 'Biscuit had a lovely day — a full walk and a long nap.' };
    res.end(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 1000, completion_tokens: 50 } }));
  });
});
fake.listen(0, '127.0.0.1');
await new Promise((r) => fake.once('listening', r));

process.env.NEBIUS_BASE_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}/v1`;
process.env.NEBIUS_API_KEY = 'test-key';
process.env.PAWZOO_BUDGET_USD = '0.01';
process.env.PAWZOO_LEDGER = join(dir, 'ledger.jsonl');
process.env.PAWZOO_NO_LISTEN = '1';
process.env.PAWZOO_DEMO_DATE = '2026-10-22';
process.env.PAWZOO_STATE_FILE = join(dir, 'state.json');
process.env.PAWZOO_ENV_FILE = join(tmpdir(), 'pawzoo-no-env');
process.env.PAWZOO_JOB_TOKEN = 'job-secret';
delete process.env.PAWZOO_NEMOTRON;
delete process.env.ELEVENLABS_API_KEY;

const { app, rt, evening } = await import('../src/index.js');
const { assistantTurn } = await import('../src/assistant.js');
const { writeDigest } = await import('../src/digest.js');
const { recentCalls, spentUsd } = await import('../src/nemotron.js');

let server: Server;
let base: string;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.close();
  fake.close();
});

test('Nemotron 3 Super picks tools; only tools that exist are kept', async () => {
  const plan = await assistantTurn('Do we need dog food?', [{ name: 'check_food', description: 'Food forecast', inputSchema: { $schema: 'x', type: 'object', properties: {} } }], []);
  assert.equal(plan.source, 'nemotron');
  assert.deepEqual(plan.calls, [{ name: 'check_food', arguments: {} }]);
  const req = seen.find((s) => s.tools)!;
  assert.equal(req.model, 'nvidia/nemotron-3-super-120b-a12b');
  assert.equal(req.tools[0].function.parameters.$schema, undefined, 'the $schema keyword is stripped');
});

test('Nemotron 3 Nano phrases the digest from the facts, without em dashes', async () => {
  const summary = await rt.read((s) => (s as any) && { pet: 'Biscuit', date: '2026-10-22', dayName: 'Thursday', moments: [], napMoments: 0, playMoments: 0, openAlerts: [], walk: null, food: { status: 'ok', runsOutDay: 'Friday', daysLeft: 9 } });
  const d = await writeDigest(summary as any, 'digest test');
  assert.equal(d.source, 'nemotron');
  assert.equal(d.text, 'Biscuit had a lovely day, a full walk and a long nap.');
  assert.equal(seen.at(-1)!.model, 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B');
});

test('every call is in the panel with its tokens and cost', async () => {
  const res = await (await fetch(`${base}/api/calls`)).json();
  assert.ok(res.calls.length >= 2);
  assert.ok(res.calls.every((c: any) => c.tokensIn === 1000 && c.costUsd > 0));
  assert.ok(res.totals.conversation.calls >= 1);
  assert.ok(spentUsd() > 0);
  assert.equal(recentCalls()[0]!.scope, 'digest test');
});

test('the evening digest fires once when the clock crosses 19:00, and is pushed', async () => {
  const pushed: any[] = [];
  rt.bus.on('push', (p: any) => p.type === 'digest' && pushed.push(p));
  await rt.setLocalTime('18:30');
  await evening.tick();
  await rt.setLocalTime('19:05');
  await new Promise((r) => setTimeout(r, 50));
  await evening.tick();
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0].digest.trigger, 'schedule');
  assert.equal((await (await fetch(`${base}/api/digest/last`)).json()).last.date, '2026-10-22');
});

test('the standalone job can deliver a digest only with the job token', async () => {
  const body = JSON.stringify({ text: 'From the job.', date: '2026-10-22', local: '19:00', source: 'nemotron' });
  const no = await fetch(`${base}/api/digest/deliver`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer wrong-token' }, body });
  assert.equal(no.status, 401);
  const yes = await fetch(`${base}/api/digest/deliver`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer job-secret' }, body });
  assert.equal(yes.status, 200);
  assert.equal(evening.last?.trigger, 'job');
});

test('a follow-up step shows Nemotron the results so far', async () => {
  await assistantTurn('Show me when the walker came on the TV', [{ name: 'check_food', description: 'x' }], [], [{ name: 'find_moment', said: 'I found 3 moments.' }]);
  const last = seen.filter((s) => s.tools).at(-1)!;
  assert.match(last.messages[1].content, /Tool results so far for this request:\n- find_moment: I found 3 moments\./);
});

test('the spend cap refuses calls and Pawzoo falls back to rules', async () => {
  // Spend recorded earlier (by this or another run on the same ledger) brings it to just under the cap.
  appendFileSync(process.env.PAWZOO_LEDGER!, `${JSON.stringify({ at: new Date().toISOString(), kind: 'chat', model: 'x', usd: 0.01 - spentUsd() - 0.00001 })}\n`);
  const plan = await assistantTurn('Do we need dog food?', [{ name: 'check_food', description: 'Food forecast' }], []);
  assert.equal(plan.source, 'rules');
  assert.ok(spentUsd() <= 0.01);
});
