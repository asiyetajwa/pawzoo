// Talks to the Pawzoo server: the day, the reel, and live pushes (server-sent events over XHR,
// which React Native supports where streaming fetch does not).

import Constants from 'expo-constants';

export const SERVER: string = ((Constants.expoConfig?.extra as { serverUrl?: string } | undefined)?.serverUrl ?? 'http://10.0.2.2:8787').replace(/\/$/, '');

export const media = (path: string) => (path ? `${SERVER}/media/${path}` : '');

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
  summary: { highlights: string[]; moments: Chapter[] };
  reel: Reel;
}

export async function getDay(): Promise<Day> {
  const res = await fetch(`${SERVER}/api/day`);
  if (!res.ok) throw new Error(`Pawzoo server: HTTP ${res.status}`);
  return (await res.json()) as Day;
}

export type Push =
  | { type: 'cast'; target: 'day_reel' | 'moment' | 'alert' | 'home'; eventId?: string }
  | { type: 'alert'; alert: { id: string; message: string; eventId: string } }
  | { type: 'state'; reason: string }
  | { type: 'clock' | 'event' | 'walk'; [k: string]: unknown };

/** Listens to /api/stream and reconnects if the connection drops. Returns a stop function. */
export function listen(onPush: (p: Push) => void): () => void {
  let stopped = false;
  let xhr: XMLHttpRequest | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    if (stopped) return;
    let seen = 0;
    let buffer = '';
    xhr = new XMLHttpRequest();
    xhr.open('GET', `${SERVER}/api/stream`);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.onprogress = () => {
      const text = xhr!.responseText;
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
      if (!stopped) retry = setTimeout(open, 2000);
    };
    xhr.onerror = again;
    xhr.onload = again;
    xhr.send();
  };

  open();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    xhr?.abort();
  };
}
