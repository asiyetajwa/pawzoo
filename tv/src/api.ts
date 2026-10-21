// Talks to a Pawzoo server: the day, the reel, and live pushes (server-sent events over XHR,
// which React Native supports where streaming fetch does not). The address is chosen at runtime
// (the Connect screen) and every request has a timeout, so a missing server never hangs the app.

import Constants from 'expo-constants';

/** Where the Android TV emulator reaches the computer it runs on. Tried quietly at start. */
export const DEFAULT_SERVER: string = ((Constants.expoConfig?.extra as { serverUrl?: string } | undefined)?.serverUrl ?? 'http://10.0.2.2:8787').replace(/\/$/, '');

/** "192.168.1.20" → "http://192.168.1.20:8787"; keeps a scheme or port the person typed. */
export function normalizeServer(input: string): string {
  let s = input.trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  const hostPart = s.replace(/^https?:\/\//i, '');
  if (!/:\d+$/.test(hostPart.split('/')[0] ?? '')) {
    const [host, ...rest] = hostPart.split('/');
    s = `${s.startsWith('https') ? 'https' : 'http'}://${host ?? ''}:8787${rest.length ? `/${rest.join('/')}` : ''}`;
  }
  return s;
}

/** "http://192.168.1.20:8787" → "192.168.1.20:8787", for labels. */
export const hostOf = (server: string) => server.replace(/^https?:\/\//i, '');

export interface Chapter {
  eventId: string;
  time: string;
  camera: string;
  tag: string;
  caption: string;
  clip: string;
  snapshot: string;
  seconds: number;
  startsAt: number;
}

export interface Reel {
  title: string;
  date: string;
  totalSeconds: number;
  chapters: Chapter[];
}

export interface Day {
  pet: { name: string };
  summary: { highlights: string[]; moments: Omit<Chapter, 'startsAt'>[] };
  reel: Reel;
}

export async function getDay(server: string, timeoutMs = 5000): Promise<Day> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${server}/api/day`, { signal: controller.signal });
    if (!res.ok) throw new Error(`The server answered HTTP ${String(res.status)}.`);
    const day = (await res.json()) as Day;
    if (!day?.reel?.chapters) throw new Error('That address answered, but it is not a Pawzoo server.');
    return day;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`No answer from ${hostOf(server)} after ${String(timeoutMs / 1000)} seconds.`);
    if (e instanceof SyntaxError) throw new Error('That address answered, but it is not a Pawzoo server.');
    if ((e as Error).message.startsWith('Network request failed')) throw new Error(`Could not reach ${hostOf(server)}.`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export type Push =
  | { type: 'cast'; target: 'day_reel' | 'moment' | 'alert' | 'home'; eventId?: string }
  | { type: 'alert'; alert: { id: string; message: string; eventId: string } }
  | { type: 'state'; reason: string }
  | { type: 'clock' | 'event' | 'walk'; [k: string]: unknown };

/** Listens to /api/stream and reconnects if the connection drops. Returns a stop function. */
export function listen(server: string, onPush: (p: Push) => void): () => void {
  let stopped = false;
  let xhr: XMLHttpRequest | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    if (stopped) return;
    let seen = 0;
    let buffer = '';
    const req = new XMLHttpRequest();
    xhr = req;
    req.open('GET', `${server}/api/stream`);
    req.setRequestHeader('Accept', 'text/event-stream');
    req.onprogress = () => {
      const text = req.responseText;
      buffer += text.slice(seen);
      seen = text.length;
      let cut: number;
      while ((cut = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        const data = block
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        if (data) {
          try {
            onPush(JSON.parse(data) as Push);
          } catch {
            // ignore a malformed push
          }
        }
      }
    };
    const again = () => {
      if (!stopped) retry = setTimeout(open, 3000);
    };
    req.onerror = again;
    req.onload = again;
    req.send();
  };

  open();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    xhr?.abort();
  };
}
