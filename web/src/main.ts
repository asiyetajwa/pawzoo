// Pawzoo, simulated as an Alexa+ add-on on a screen device.
// The page is a real MCP client: it connects to the Pawzoo server, lists its tools, calls them,
// and renders the MCP Apps card the server returns. An assistant endpoint chooses the tools
// (Amazon Bedrock when configured, rules otherwise), standing in for Alexa+ itself.

import type { Client } from '@modelcontextprotocol/client';
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import { connect, onWire, type WireEntry } from './mcp.js';

type Any = Record<string, any>;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const transcript = $('#transcript');
const cardHost = $('#card');
const input = $<HTMLInputElement>('#utterance');
const mic = $<HTMLButtonElement>('#mic');
const wire = $('#wire');
const session = $('#session');
const clockEl = $('#clock');
const banner = $('#banner');
const lightbar = $('#lightbar');
const stage = $('#stage');
const display = $('#display');
const topic = $('#topic');
const propsEl = $('#props');

// ---------- Scenes: each kind of answer gets its own colour, title and props ----------

type Prop = { src: string; x: number; y: number; w: number; rot?: number; soft?: boolean };
type Scene = { title: [string, string]; topic: string; props: Prop[] };

const SCENES: Record<string, Scene> = {
  day: { title: ["Biscuit's", 'Day'], topic: 'How was<br>her day', props: [
    { src: 'ball', x: 30, y: 44, w: 19 }, { src: 'bone', x: 5, y: 66, w: 15, rot: -14, soft: true }, { src: 'cushion', x: 33, y: 2, w: 10, rot: 12, soft: true } ] },
  walk: { title: ['The', 'Walk'], topic: 'Seen by the<br>front door', props: [
    { src: 'leash', x: 29, y: 42, w: 20, rot: -6 }, { src: 'ball', x: 7, y: 66, w: 9, soft: true }, { src: 'house', x: 35, y: 2, w: 10, rot: 8, soft: true } ] },
  food: { title: ['Food', 'Check'], topic: 'Her bowl,<br>handled', props: [
    { src: 'bowl', x: 27, y: 46, w: 24, rot: -4 }, { src: 'bone', x: 33, y: 4, w: 12, rot: 18, soft: true }, { src: 'ball', x: 6, y: 68, w: 8, soft: true } ] },
  confirm: { title: ['Needs', 'Your OK'], topic: 'Nothing happens<br>without a yes', props: [
    { src: 'cushion', x: 31, y: 46, w: 17, rot: -14 }, { src: 'bone', x: 5, y: 66, w: 14, soft: true } ] },
  slots: { title: ['Book', 'Grooming'], topic: 'Open slots<br>this week', props: [
    { src: 'cushion', x: 31, y: 46, w: 17, rot: 8 }, { src: 'ball', x: 35, y: 4, w: 9, soft: true }, { src: 'bone', x: 6, y: 66, w: 13, soft: true } ] },
  moments: { title: ['Found', 'It'], topic: 'Moments<br>on camera', props: [
    { src: 'ball', x: 31, y: 46, w: 17 }, { src: 'leash', x: 5, y: 64, w: 13, soft: true } ] },
  alert: { title: ["She's", 'Out'], topic: 'Front door,<br>no person', props: [
    { src: 'house', x: 30, y: 44, w: 19, rot: -6 }, { src: 'leash', x: 6, y: 64, w: 12, soft: true } ] },
};

let currentScene = '';

function setScene(name: string): void {
  const scene = SCENES[name] ?? SCENES.day;
  if (name === currentScene) return;
  currentScene = name;
  stage.dataset.scene = name in SCENES ? name : 'day';
  display.innerHTML = scene.title.map((t) => `<span>${esc(t)}</span>`).join('');
  topic.innerHTML = scene.topic;
  propsEl.querySelectorAll('.prop').forEach((el) => {
    el.classList.add('leave');
    setTimeout(() => el.remove(), 450);
  });
  scene.props.forEach((p, i) => {
    const img = document.createElement('img');
    img.className = `prop${p.soft ? ' soft' : ''}`;
    img.src = `props/${p.src}.svg`;
    img.alt = '';
    img.style.left = `${p.x}%`;
    img.style.top = `${p.y}%`;
    img.style.width = `${p.w}%`;
    img.style.rotate = `${p.rot ?? 0}deg`;
    img.style.animationDelay = `${0.08 * i}s, ${0.8 + 0.4 * i}s`;
    propsEl.appendChild(img);
  });
}

function sceneFor(tool: string, result: Any): string | null {
  const card = result.structuredContent?.card as string | undefined;
  if (tool === 'get_alerts' && result.structuredContent?.alerts?.length) return 'alert';
  if (tool === 'remember' && result.structuredContent?.food) return 'food';
  if (!card || card === 'done') return null;
  return card;
}

const memory: { lastConfirmation?: string; firstMoment?: string; recommendedSlot?: string; openAlert?: string; lastWalk?: string } = {};
const history: Array<{ role: 'person' | 'assistant'; text: string }> = [];
let client: Client;
let tools: Any[] = [];
let cardHtml = '';
let speakOn = true;

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function currentTheme(): 'light' | 'dark' {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'dark' || forced === 'light') return forced;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setLight(state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'alert'): void {
  lightbar.dataset.state = state;
}

function say(text: string): void {
  history.push({ role: 'assistant', text });
  transcript.insertAdjacentHTML('beforeend', `<p class="turn assistant">${esc(text)}</p>`);
  transcript.scrollTop = transcript.scrollHeight;
  if (!speakOn || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02;
  u.onstart = () => setLight('speaking');
  u.onend = () => setLight('idle');
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function heard(text: string): void {
  history.push({ role: 'person', text });
  // A screen device shows the current exchange; the full history stays in memory for context.
  transcript.innerHTML = '';
  transcript.insertAdjacentHTML('beforeend', `<p class="turn person">${esc(text)}</p>`);
  transcript.scrollTop = transcript.scrollHeight;
}

// ---------- MCP Apps card ----------

async function showCard(toolName: string, args: Any, result: Any): Promise<void> {
  if (!cardHtml) {
    const res = await client.readResource({ uri: 'ui://pawzoo/card.html' });
    cardHtml = (res.contents[0] as { text?: string }).text ?? '';
  }
  cardHost.innerHTML = '';
  const frame = document.createElement('iframe');
  frame.title = 'Pawzoo card';
  frame.setAttribute('sandbox', 'allow-scripts');
  cardHost.appendChild(frame);

  // No client passed: the host handles the card's tool calls itself, so a tap is logged, remembered and spoken.
  const bridge = new AppBridge(
    null,
    { name: 'Pawzoo Alexa+ simulator', version: '0.1.0' },
    { serverTools: {}, logging: {} },
    { hostContext: { theme: currentTheme(), displayMode: 'inline' } },
  );
  bridge.onsizechange = ({ height }) => {
    if (height) frame.style.height = `${Math.ceil(height)}px`;
  };
  bridge.oninitialized = async () => {
    await bridge.sendToolInput({ arguments: args });
    await bridge.sendToolResult(result as never);
  };
  // A tap on a card button is a tool call too: remember what it returns, and say it.
  bridge.oncalltool = async (params) => {
    const out = (await client.callTool(params)) as Any;
    remember(params.name, out);
    const scene = sceneFor(params.name, out);
    if (scene) setScene(scene);
    const text = out.structuredContent?.say ?? out.content?.[0]?.text;
    if (text) say(text);
    return out as never;
  };
  // Listen before the card loads: the view says hello as soon as its script runs.
  await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  frame.srcdoc = cardHtml;
  console.debug('[card]', toolName);
}

// ---------- Turn handling ----------

function remember(tool: string, result: Any): void {
  const s = result.structuredContent ?? {};
  if (s.action?.id) memory.lastConfirmation = s.action.id;
  if (tool === 'confirm_action') memory.lastConfirmation = undefined;
  if (s.moments?.length) memory.firstMoment = s.moments[0].eventId;
  if (s.recommended) memory.recommendedSlot = s.recommended;
  if (s.report?.walk?.id) memory.lastWalk = s.report.walk.id;
  if (s.alerts?.length) memory.openAlert = s.alerts[0].id;
  if (tool === 'resolve_alert') {
    memory.openAlert = undefined;
    banner.hidden = true;
    setScene('day');
  }
}

function fill(args: Any): Any {
  const map: Record<string, string | undefined> = {
    $last_confirmation: memory.lastConfirmation,
    $first_moment: memory.firstMoment,
    $recommended_slot: memory.recommendedSlot,
    $open_alert: memory.openAlert,
    $last_walk: memory.lastWalk,
  };
  const out: Any = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' && v in map) {
      if (map[v] !== undefined) out[k] = map[v];
    } else out[k] = v;
  }
  return out;
}

async function turn(utterance: string): Promise<void> {
  const text = utterance.trim();
  if (!text) return;
  heard(text);
  setLight('thinking');
  const plan = (await (
    await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        utterance: text,
        tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
        history: history.slice(-6),
      }),
    })
  ).json()) as { calls: Array<{ name: string; arguments: Any }>; say?: string; source: string; modelId?: string };
  $('#brain').textContent = plan.source === 'bedrock' ? `Amazon Bedrock (${plan.modelId ?? 'model'})` : 'rules (offline)';

  if (!plan.calls.length) {
    say(plan.say ?? 'Sorry, I missed that.');
    return;
  }
  let spoken = '';
  for (const call of plan.calls) {
    const args = fill(call.arguments);
    if (call.name === 'confirm_action' && !args.confirmation_id) {
      say("There's nothing waiting for a yes right now.");
      return;
    }
    const result = (await client.callTool({ name: call.name, arguments: args })) as Any;
    remember(call.name, result);
    if (call.name === 'get_pet_day') {
      const sc = result.structuredContent ?? {};
      $('#digest').textContent = sc.digestSource === 'bedrock' ? `Amazon Bedrock (${sc.digestModel})` : 'template (Bedrock off or failed)';
    }
    const scene = sceneFor(call.name, result);
    if (scene) setScene(scene);
    const line = result.structuredContent?.say ?? result.content?.[0]?.text ?? '';
    if (result.isError) {
      say(line || 'That did not work.');
      return;
    }
    spoken = spoken ? `${spoken} ${line}` : line;
    const tool = tools.find((t) => t.name === call.name);
    if (tool?._meta?.ui?.resourceUri) await showCard(call.name, args, result);
  }
  say(spoken);
}

// ---------- Voice ----------

type Recognition = { start(): void; stop(): void; lang: string; interimResults: boolean; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };
const SpeechRec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
let rec: Recognition | null = null;

mic.addEventListener('click', () => {
  if (!SpeechRec) {
    input.focus();
    input.placeholder = 'Voice input needs Chrome or Edge. Type instead.';
    return;
  }
  if (rec) {
    rec.stop();
    return;
  }
  rec = new SpeechRec() as Recognition;
  rec.lang = 'en-US';
  rec.interimResults = true;
  setLight('listening');
  mic.setAttribute('aria-pressed', 'true');
  rec.onresult = (e: any) => {
    const r = e.results[e.results.length - 1];
    input.value = r[0].transcript;
    if (r.isFinal) {
      const t = input.value;
      input.value = '';
      void turn(t);
    }
  };
  rec.onend = () => {
    rec = null;
    mic.setAttribute('aria-pressed', 'false');
    if (lightbar.dataset.state === 'listening') setLight('idle');
  };
  rec.onerror = () => rec?.stop();
  rec.start();
});

$('#ask').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = input.value;
  input.value = '';
  void turn(t);
});

document.querySelectorAll<HTMLButtonElement>('[data-say]').forEach((b) =>
  b.addEventListener('click', () => void turn(b.dataset.say!)),
);

$('#speak').addEventListener('change', (e) => {
  speakOn = (e.target as HTMLInputElement).checked;
  if (!speakOn) speechSynthesis.cancel();
});

$('#hood-toggle').addEventListener('click', () => {
  document.body.classList.toggle('hood-open');
});

// ---------- Demo controls ----------

document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((b) =>
  b.addEventListener('click', async () => {
    await fetch('/api/demo/time', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ time: b.dataset.time }) });
  }),
);
$('#escape').addEventListener('click', () => void fetch('/api/demo/escape', { method: 'POST' }));
$('#reset').addEventListener('click', async () => {
  await fetch('/api/demo/reset', { method: 'POST' });
  transcript.innerHTML = '';
  cardHost.innerHTML = '';
  banner.hidden = true;
  setScene('day');
  Object.keys(memory).forEach((k) => delete (memory as Any)[k]);
});

// ---------- Live pushes ----------

function listen(): void {
  const es = new EventSource('/api/stream');
  es.onmessage = (m) => {
    const p = JSON.parse(m.data) as Any;
    if (p.type === 'clock') {
      const d = new Date(p.now);
      clockEl.textContent = d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
      const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' });
      let active: HTMLElement | null = null;
      document.querySelectorAll<HTMLElement>('.step').forEach((b) => {
        b.removeAttribute('aria-current');
        if (b.dataset.time! <= hm) active = b;
      });
      (active as HTMLElement | null)?.setAttribute('aria-current', 'true');
    }
    if (p.type === 'event') {
      const e = p.event;
      $('#events').insertAdjacentHTML(
        'afterbegin',
        `<li><span>${new Date(e.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}</span> <b>${esc(e.ringType)}</b> ${esc(e.subjects.join('+'))} &middot; ${esc(e.cameraId)} &rarr; <i>${esc(e.tag)}</i></li>`,
      );
    }
    if (p.type === 'alert') {
      memory.openAlert = p.alert.id;
      banner.hidden = false;
      banner.textContent = p.alert.message;
      setScene('alert');
      setLight('alert');
      say(`Heads up. ${p.alert.message} It's on the TV now.`);
    }
  };
}

function renderWire(e: WireEntry): void {
  const req = e.request as Any;
  const params = req?.params?.name ? ` ${req.params.name}` : '';
  wire.insertAdjacentHTML(
    'afterbegin',
    `<details><summary><code>${esc(e.method)}${esc(params)}</code><span>${e.status} &middot; ${e.ms} ms</span></summary><pre>${esc(JSON.stringify({ request: e.request, response: e.response }, null, 2).slice(0, 4000))}</pre></details>`,
  );
}

// ---------- Boot ----------

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (params.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
  if (params.get('hood') === '1') document.body.classList.add('hood-open');
  onWire(renderWire);
  setScene('day');
  client = await connect(new URL('/mcp', location.href));
  const listed = await client.listTools();
  tools = listed.tools as Any[];
  const info = client.getServerVersion();
  session.innerHTML = `<dt>Server</dt><dd>${esc(info?.name)} ${esc(info?.version)}</dd>
    <dt>Protocol</dt><dd>${esc(client.getNegotiatedProtocolVersion())}</dd>
    <dt>Transport</dt><dd>Streamable HTTP</dd>
    <dt>Tools</dt><dd>${tools.length} (${tools.filter((t) => t._meta?.ui?.resourceUri).length} with MCP Apps cards)</dd>`;
  const status = (await (await fetch('/api/status')).json()) as Any;
  session.insertAdjacentHTML('beforeend', `<dt>State</dt><dd>${status.store === 'dynamodb' ? 'Amazon DynamoDB' : 'local file'}</dd><dt>Ring</dt><dd>${status.ring === 'live' ? 'live account' : 'replay'}</dd>`);
  listen();
  setLight('idle');
}

boot().catch((err) => {
  session.textContent = `Could not reach the Pawzoo server: ${String(err)}`;
});
