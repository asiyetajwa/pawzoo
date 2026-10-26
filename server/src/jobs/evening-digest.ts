// The evening digest as a standalone job: read the day from a running Pawzoo, have Nemotron 3 Nano phrase it, and
// deliver it back, where Pawzoo pushes it to the TV and the voice assistant. Built to run on a schedule outside
// the server, for example as a Nebius Serverless Job from the container in the repo's Dockerfile:
//   PAWZOO_URL=https://your-pawzoo PAWZOO_JOB_TOKEN=... NEBIUS_API_KEY=... PAWZOO_BUDGET_USD=0.05 node dist/jobs/evening-digest.js

import { writeDigest } from '../digest.js';
import type { DaySummary } from '../agent.js';

const base = (process.env.PAWZOO_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const token = process.env.PAWZOO_JOB_TOKEN;
if (!token) throw new Error('Set PAWZOO_JOB_TOKEN (the same value the Pawzoo server has) so the server accepts the digest.');

const day = (await (await fetch(`${base}/api/day`)).json()) as { summary: DaySummary };
const clock = (await (await fetch(`${base}/api/clock`)).json()) as { now: string };
const local = new Date(clock.now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' });
const digest = await writeDigest(day.summary, 'digest job');
const res = await fetch(`${base}/api/digest/deliver`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ ...digest, date: day.summary.date, local, trigger: 'job' }),
});
if (!res.ok) throw new Error(`Pawzoo refused the digest: ${String(res.status)} ${await res.text()}`);
console.log(`Delivered (${digest.source}${digest.modelId ? `, ${digest.modelId}` : ''}): ${digest.text}`);
