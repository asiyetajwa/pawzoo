// The proactive evening digest: at 19:00 on Pawzoo's clock, without anyone asking, Pawzoo writes the day's update
// (facts from agent.ts, phrased by Nemotron 3 Nano) and pushes it to the TV and the voice assistant.
// The same work also runs as a standalone job (src/jobs/evening-digest.ts) that can be scheduled outside the server,
// for example as a Nebius Serverless Job; it delivers its digest to POST /api/digest/deliver.

import { daySummary } from './agent.js';
import { writeDigest, type DigestResult } from './digest.js';
import { localParts } from './time.js';
import { TIME_ZONE } from './seed.js';
import type { Runtime } from './runtime.js';

export interface DeliveredDigest extends DigestResult {
  date: string;
  /** Local time it was written, HH:MM. */
  local: string;
  trigger: 'schedule' | 'job' | 'manual';
}

export class EveningDigest {
  last: DeliveredDigest | null = null;
  private lastLocal: string | null = null;
  private running = false;

  constructor(
    private readonly rt: Runtime,
    readonly at = process.env.PAWZOO_DIGEST_AT ?? '19:00',
  ) {}

  /** Called on every clock change: fires once when the local time crosses the digest time. */
  async tick(): Promise<void> {
    const { date, time } = localParts(this.rt.now(), TIME_ZONE);
    const before = this.lastLocal;
    this.lastLocal = `${date} ${time}`;
    if (!before) return;
    const crossed = before < `${date} ${this.at}` && this.lastLocal >= `${date} ${this.at}`;
    if (crossed && this.last?.date !== date) await this.run('schedule');
  }

  async run(trigger: DeliveredDigest['trigger']): Promise<DeliveredDigest | null> {
    if (this.running) return null;
    this.running = true;
    try {
      const now = this.rt.now();
      const { date, time } = localParts(now, TIME_ZONE);
      const summary = await this.rt.read((s) => daySummary(s, date, now));
      const digest = await writeDigest(summary, `digest ${trigger}`);
      return this.deliver({ ...digest, date, local: time, trigger });
    } finally {
      this.running = false;
    }
  }

  deliver(d: DeliveredDigest): DeliveredDigest {
    this.last = d;
    this.rt.push({ type: 'digest', digest: d });
    return d;
  }
}
