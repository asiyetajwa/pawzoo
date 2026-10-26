// "How was Biscuit's day?" The facts come from agent.ts; NVIDIA Nemotron 3 Nano only phrases them.
// With no Token Factory key, or if the call fails, the template answer is used and the demo still works.

import { MODELS, modelLabel, nemotron, phrase } from './nemotron.js';
import type { DaySummary } from './agent.js';

export interface DigestResult {
  text: string;
  source: 'nemotron' | 'template';
  modelId?: string;
}

export function templateDigest(d: DaySummary): string {
  if (d.moments.length === 0) return `Nothing from ${d.pet} yet today. The cameras haven't seen her move.`;
  const parts: string[] = [];
  if (d.walk) {
    const w = d.walk;
    parts.push(
      `${d.pet} had a ${w.walk.minutes}-minute walk with ${w.walk.walker} this morning${w.walk.minutes >= w.walk.bookedMinutes ? ', the full booking' : `, short of the ${w.walk.bookedMinutes} you booked`}.`,
    );
    if (w.week.short.length) {
      const s = w.week.short[0];
      parts.push(`It's been a good week apart from ${s.day}, when the walk lasted ${s.minutes} minutes.`);
    }
  }
  const rest: string[] = [];
  if (d.napMoments) rest.push('napped through the afternoon');
  if (d.playMoments) rest.push('did backyard zoomies');
  if (rest.length) parts.push(`She ${rest.join(' and ')}.`);
  if (d.openAlerts.length) parts.push(`Heads up: ${d.openAlerts[0].message}`);
  const f = d.food;
  if (f.status === 'order_now' || f.status === 'order_soon') {
    parts.push(`Her food runs out ${f.runsOutDay}. Want me to reorder?`);
  } else if (f.status === 'covered' && f.incoming) {
    parts.push(`More food arrives before she runs out.`);
  }
  return parts.join(' ');
}

const SYSTEM = `You write the evening update a family hears from their voice assistant about their dog's day.
Use only the facts in the JSON. Never invent events, times or numbers. The dog is a girl: always she and her.
Two to four short sentences, warm and plain, for speaking aloud. No lists, no emoji, no em dashes.
Mention the walk and anything unusual. If food status is order_now or order_soon, end by offering to reorder.
Never give medical or veterinary advice.`;

export async function writeDigest(d: DaySummary, scope = 'digest asked'): Promise<DigestResult> {
  const fallback: DigestResult = { text: templateDigest(d), source: 'template' };
  if (!nemotron()) return fallback;
  try {
    const facts = {
      pet: d.pet,
      day: d.dayName,
      moments: d.moments.map((m) => ({ time: m.time, camera: m.camera, what: m.caption })),
      walk: d.walk && {
        minutes: d.walk.walk.minutes,
        booked: d.walk.walk.bookedMinutes,
        walker: d.walk.walk.walker,
        weekAverage: d.walk.week.averageMinutes,
        shortWalksThisWeek: d.walk.week.short,
      },
      food: { status: d.food.status, runsOut: d.food.runsOutDay, daysLeft: d.food.daysLeft },
      openAlerts: d.openAlerts.map((a) => a.message),
    };
    const text = await phrase(`${SYSTEM}\nReply with only the update.`, JSON.stringify(facts), scope);
    if (!text) return fallback;
    return { text: text.replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim(), source: 'nemotron', modelId: modelLabel(MODELS.phrase) };
  } catch (err) {
    console.warn('[digest] Nemotron unavailable, using template:', (err as Error).message);
    return fallback;
  }
}
