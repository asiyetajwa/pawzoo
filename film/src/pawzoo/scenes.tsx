import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { BlurText, Camera, cameraAt, clamp, Cursor, easeOut, popAt, type CamKey, type CursorKey } from '../components/motion';
import boxes from '../../public/pawzoo/boxes.json';
import job from '../../public/pawzoo/job.json';
import calls from '../../public/pawzoo/calls.json';

type SceneProps = { duration: number };
type Box = { x: number; y: number; w: number; h: number };
const B = boxes as unknown as Record<string, Box>;
const center = (key: string): [number, number] => {
  const b = B[key] ?? { x: 0, y: 0, w: 0, h: 0 };
  return [b.x + b.w / 2, b.y + b.h / 2];
};

/* ------------------------------------------------------------ the browser window */

// Captures are 1600 css px wide and as tall as the simulator's tallest answer (boxes.size.h);
// the window shows them 1400 world units wide.
const CAP = (boxes as unknown as { size: { w: number; h: number } }).size;
const WIN = { w: 1400, bar: 46 };
const S = WIN.w / CAP.w;
const winH = CAP.h * S + WIN.bar;
/** World position of a point on the capture (css px). */
const w = (x: number, y: number) => ({ x: -WIN.w / 2 + x * S, y: -winH / 2 + WIN.bar + y * S });

type State = { src: string; at: number };

function useLayers(states: State[]) {
  const frame = useCurrentFrame();
  return states.map((s, i) => {
    const next = states[i + 1];
    const opacity = i === 0 ? 1 : interpolate(frame, [s.at, s.at + 12], [0, 1], { ...clamp, easing: easeOut });
    const visible = frame >= s.at - 1 && (!next || frame < next.at + 14);
    return { ...s, opacity, visible };
  });
}

const Window: React.FC<{ states: State[]; url?: string }> = ({ states, url = 'localhost:8787  ·  Pawzoo' }) => {
  const layers = useLayers(states);
  return (
    <div
      style={{
        position: 'absolute',
        left: -WIN.w / 2,
        top: -winH / 2,
        width: WIN.w,
        height: winH,
        borderRadius: 20,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 60px 120px rgba(31,27,46,0.22), 0 12px 32px rgba(31,27,46,0.10)',
      }}
    >
      <div style={{ height: WIN.bar, background: '#f4f4f7', borderBottom: '1px solid #e6e6ec', display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c }} />
        ))}
        <div style={{ margin: '0 auto', padding: '6px 70px', borderRadius: 9, background: '#ffffff', border: '1px solid #e6e6ec', color: theme.muted, fontFamily: theme.font, fontSize: 15, fontWeight: 500 }}>
          {url}
        </div>
      </div>
      <div style={{ position: 'relative', width: WIN.w, height: CAP.h * S, background: theme.bg }}>
        {layers.map((l) =>
          l.visible ? (
            <Img key={l.src} src={staticFile(`pawzoo/${l.src}.png`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: l.opacity }} />
          ) : null,
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ helpers */

/** Camera key that centres a point of the capture at zoom z. */
const at = (f: number, x: number, y: number, z: number): CamKey => ({ f, ...w(x, y), z });
const WIDE = (f: number): CamKey => ({ f, x: 0, y: 0, z: 1.0 });
/** The whole simulator, a little closer, for clicking the suggestion chips. */
const NEAR = (f: number): CamKey => at(f, CAP.w / 2, CAP.h / 2, 1.06);
/**
 * Reads the answer in a capture: centres its box and zooms as close as fits the whole card, buttons
 * included (never closer than READ). `drift` eases in a touch over the hold.
 */
const read = (f: number, shot: string, drift = 0): CamKey => {
  const answer = B[`answer:${shot}`] ?? { x: 847, y: 237, w: 482, h: 480 };
  // Take in the heading above the answer too ("How was her day"), so no line is cut at the top.
  const headTop = 118;
  const b = { ...answer, y: headTop, h: answer.y + answer.h - headTop };
  // The card sits in the screen above the caption pill (bottom 180px), with a margin all round.
  const top = 40;
  const bottom = 1080 - 180;
  const z = Math.min(READ, (bottom - top) / ((b.h + 40) * S), (1920 * 0.9) / ((b.w + 120) * S)) + drift;
  const lift = (1080 / 2 - (top + bottom) / 2) / (z * S);
  return at(f, b.x + b.w / 2, b.y + b.h / 2 + lift, z);
};
/** Cursor key on a capture point. */
const cur = (f: number, x: number, y: number, click = false): CursorKey => ({ f, ...w(x, y), click });
const clickOn = (f: number, key: string): CursorKey => cur(f, ...center(key), true);
/** Closest zoom for reading a card. */
const READ = 1.95;

/**
 * While the camera reads a card, a soft white veil covers the screen left of the answer column, so
 * the big blob title is never shown sliced in half at the frame edge.
 */
const ReadVeil: React.FC<{ keys: CamKey[] }> = ({ keys }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const c = cameraAt(frame, keys);
  const answerLeft = w((B['answer:sim-food']?.x ?? 847) - 28, 0).x;
  const edge = width / 2 + (answerLeft - c.x) * c.z;
  const opacity = interpolate(c.z, [1.1, 1.35], [0, 1], clamp);
  if (opacity <= 0 || edge <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: edge,
          opacity,
          background: `linear-gradient(90deg, ${theme.bg} 0%, #ffffff ${String(Math.max(0, ((edge - 140) / edge) * 100))}%, rgba(255,255,255,0) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Small caption pill under the action, for the benefit the line names. */
const Callout: React.FC<{ text: string; at: number; outAt: number }> = ({ text, at: start, outAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popAt(frame, fps, start, 15);
  const out = interpolate(frame, [outAt, outAt + 14], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 64, pointerEvents: 'none' }}>
      <div
        style={{
          padding: '16px 30px',
          borderRadius: 999,
          background: theme.text,
          color: '#fff',
          fontFamily: theme.font,
          fontSize: 34,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          opacity: p * (1 - out),
          transform: `translateY(${String((1 - p) * 24 + out * 12)}px)`,
          boxShadow: '0 20px 50px rgba(31,27,46,0.25)',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ scenes */

const Logo: React.FC<{ size: number }> = ({ size }) => <Img src={staticFile('logo.svg')} style={{ width: size, height: size, display: 'block' }} />;


/** Camera key that frames any captured box (css px) as large as fits above the caption pill. */
const frameBox = (f: number, b: Box, zmax = READ): CamKey => {
  const top = 40;
  const bottom = 1080 - 180;
  const z = Math.min(zmax, (bottom - top) / ((b.h + 60) * S), (1920 * 0.9) / ((b.w + 120) * S));
  const lift = (1080 / 2 - (top + bottom) / 2) / (z * S);
  return at(f, b.x + b.w / 2, b.y + b.h / 2 + lift, z);
};

/** The TV view, as its own window over a softened simulator. */
const OverTv: React.FC<{ under: string; tv: string; open: number }> = ({ under, tv, open }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popAt(frame, fps, open, 16);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${String(1 - p * 0.2)})`, opacity: 1 - p * 0.45, filter: p > 0.02 ? `blur(${String(p * 2)}px)` : undefined }}>
        <Window states={[{ src: under, at: 0 }]} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: p, transform: `translate(${String(60 - p * 60)}px, ${String((1 - p) * 60)}px) scale(0.86)` }}>
        <Window states={[{ src: tv, at: 0 }]} url="localhost:8787/tv.html  ·  Pawzoo on the TV" />
      </div>
    </>
  );
};

export const IntroScene: React.FC<SceneProps> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popAt(frame, fps, 4, 13);
  const zoom = interpolate(frame, [0, duration], [1.04, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${String(zoom)})` }}>
      <div style={{ transform: `scale(${String(0.6 + p * 0.4)})`, opacity: p, marginBottom: 34 }}>
        <Logo size={150} />
      </div>
      <BlurText text="Pawzoo" at={12} outAt={duration - 18} style={{ fontFamily: theme.font, fontSize: 150, fontWeight: 800, letterSpacing: '-0.04em', color: theme.text, lineHeight: 1 }} />
      <div style={{ height: 26 }} />
      <BlurText text="Your dog's day, with NVIDIA Nemotron on Nebius" at={34} outAt={duration - 16} style={{ fontFamily: theme.font, fontSize: 44, fontWeight: 400, color: theme.muted }} />
    </AbsoluteFill>
  );
};

export const AskScene: React.FC<SceneProps> = ({ duration }) => {
  const click = 58;
  const cam: CamKey[] = [WIDE(0), WIDE(click + 16), read(150, 'sim-day'), read(duration, 'sim-day', 0.05)];
  const cursor: CursorKey[] = [cur(0, 1250, 760), cur(46, ...center('chipDay')), clickOn(click, 'chipDay'), cur(click + 40, 600, 800)];
  return (
    <>
      <Camera keys={cam}>
        <Window states={[{ src: 'sim-start', at: 0 }, { src: 'sim-day', at: click + 8 }]} />
        <Cursor keys={cursor} visibleFrom={4} visibleTo={click + 60} />
      </Camera>
      <ReadVeil keys={cam} />
      <Callout text="Nemotron 3 Super picks the tools · Nemotron 3 Nano writes the words" at={170} outAt={duration - 20} />
    </>
  );
};

export const FoodScene: React.FC<SceneProps> = ({ duration }) => {
  const click = 44;
  const cam: CamKey[] = [NEAR(0), NEAR(click + 10), read(140, 'sim-food'), read(duration, 'sim-food', 0.05)];
  const cursor: CursorKey[] = [cur(0, 1150, 800), cur(34, ...center('chipFood')), clickOn(click, 'chipFood'), cur(click + 40, 1000, 800)];
  return (
    <>
      <Camera keys={cam}>
        <Window states={[{ src: 'sim-day', at: 0 }, { src: 'sim-food', at: click + 8 }]} />
        <Cursor keys={cursor} visibleFrom={0} visibleTo={click + 50} />
      </Camera>
      <ReadVeil keys={cam} />
      <Callout text="The forecast is Pawzoo's own math, not the model's" at={150} outAt={duration - 20} />
    </>
  );
};

export const TvScene: React.FC<SceneProps> = ({ duration }) => {
  const click = 44;
  const tvAt = Math.round(duration * 0.5);
  const cam: CamKey[] = [NEAR(0), NEAR(click + 10), read(tvAt - 30, 'sim-walker'), { f: tvAt + 10, x: 0, y: 0, z: 1.0 }, { f: duration, x: 0, y: 0, z: 1.04 }];
  const cursor: CursorKey[] = [cur(0, 1150, 800), cur(34, ...center('chipWalker')), clickOn(click, 'chipWalker'), cur(click + 40, 1000, 800)];
  return (
    <>
      <Camera keys={cam}>
        <OverTv under="sim-walker" tv="tv-walker" open={tvAt} />
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: useCurrentFrame() < tvAt ? 1 : 0 }}>
          <Window states={[{ src: 'sim-food', at: 0 }, { src: 'sim-walker', at: click + 8 }]} />
        </div>
        <Cursor keys={cursor} visibleFrom={0} visibleTo={click + 50} />
      </Camera>
      <Callout text="Step 1: find the moments" at={click + 40} outAt={tvAt - 10} />
      <Callout text="Step 2: Nemotron sees the results and plays it on the TV" at={tvAt + 20} outAt={duration - 20} />
    </>
  );
};

export const PanelScene: React.FC<SceneProps> = ({ duration }) => {
  const nemo = B.nemo ?? { x: 1100, y: 400, w: 460, h: 300 };
  const cam: CamKey[] = [WIDE(0), WIDE(30), frameBox(80, nemo, 1.7), frameBox(duration, nemo, 1.75)];
  const c = calls as unknown as { totals: Record<string, { calls: number; costUsd: number; medianMs: number }> };
  const q = c.totals.conversation;
  return (
    <>
      <Camera keys={cam}>
        <Window states={[{ src: 'sim-walker', at: 0 }, { src: 'hood-calls', at: 14 }]} />
      </Camera>
      <Callout text={`Every call metered: about $${q ? (q.costUsd / q.calls).toFixed(4) : '0.0006'} and ${q ? String(q.medianMs) : '1000'} ms a step`} at={90} outAt={duration - 20} />
    </>
  );
};

export const EveningScene: React.FC<SceneProps> = ({ duration }) => {
  const click = 50;
  const tvAt = Math.round(duration * 0.55);
  const step = center('step7p');
  const cam: CamKey[] = [NEAR(0), NEAR(click + 10), read(tvAt - 40, 'sim-evening'), { f: tvAt + 10, x: 0, y: 0, z: 1.0 }, { f: duration, x: 0, y: 0, z: 1.04 }];
  const cursor: CursorKey[] = [cur(0, 900, 760), cur(click - 12, ...step), cur(click, ...step, true), cur(click + 40, 700, 820)];
  const frame = useCurrentFrame();
  return (
    <>
      <Camera keys={cam}>
        <OverTv under="sim-evening" tv="tv-evening" open={tvAt} />
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: frame < tvAt ? 1 : 0 }}>
          <Window states={[{ src: 'sim-walker', at: 0 }, { src: 'sim-evening', at: click + 30 }]} />
        </div>
        <Cursor keys={cursor} visibleFrom={0} visibleTo={click + 50} />
      </Camera>
      <Callout text="7:00 PM: the evening update, unasked" at={click + 50} outAt={tvAt - 10} />
      <Callout text="On the TV too" at={tvAt + 20} outAt={duration - 20} />
    </>
  );
};

/** A terminal with the job's real command and output. */
export const JobScene: React.FC<SceneProps> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const j = job as { command: string; output: string };
  const p = popAt(frame, fps, 6, 16);
  const cmd = `$ ${j.command}`;
  const typed = cmd.slice(0, Math.max(0, Math.floor((frame - 20) * 1.6)));
  const outAt = 20 + Math.ceil(cmd.length / 1.6) + 20;
  const o = popAt(frame, fps, outAt, 18);
  const swap = Math.round(duration * 0.62);
  const s2 = popAt(frame, fps, swap, 16);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', opacity: 1 - s2 * 0.0, transform: `translateY(${String(-s2 * 170)}px) scale(${String(1 - s2 * 0.12)})` }}>
        <div style={{ width: 1440, borderRadius: 22, overflow: 'hidden', background: '#16141f', boxShadow: '0 60px 120px rgba(31,27,46,0.30)', opacity: p, transform: `translateY(${String((1 - p) * 40)}px)` }}>
          <div style={{ height: 46, background: '#211e2c', display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px' }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <span key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c }} />
            ))}
            <span style={{ margin: '0 auto', color: '#9b97ab', fontFamily: theme.font, fontSize: 16 }}>evening-digest job  ·  container image</span>
          </div>
          <div style={{ padding: '30px 36px 36px', fontFamily: "'DejaVu Sans Mono', monospace", fontSize: 26, lineHeight: 1.55, color: '#e9e6f5', minHeight: 260 }}>
            <div>{typed}<span style={{ opacity: frame % 40 < 20 ? 1 : 0 }}>▍</span></div>
            <div style={{ marginTop: 16, opacity: o, color: '#c4b5fd', whiteSpace: 'pre-wrap' }}>{j.output}</div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 40, opacity: s2, transform: `translateY(${String((1 - s2) * 60)}px) scale(0.5)`, transformOrigin: 'bottom center' }}>
        <div style={{ position: 'relative', width: 0, height: 0 }}>
          <Window states={[{ src: 'sim-job', at: 0 }]} />
        </div>
      </div>
      <Callout text="Ready to schedule as a Nebius Serverless Job" at={swap + 30} outAt={duration - 20} />
    </AbsoluteFill>
  );
};

export const CostScene: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = (v: string, l: string, o: number) => {
    const p = popAt(frame, fps, o, 16);
    return (
      <div style={{ width: 470, padding: '40px 40px', borderRadius: 34, background: '#fff', boxShadow: '0 40px 80px rgba(31,27,46,0.12)', opacity: p, transform: `translateY(${String((1 - p) * 30)}px)`, fontFamily: theme.font }}>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: '-0.04em', color: theme.text }}>{v}</div>
        <div style={{ fontSize: 26, color: theme.muted, marginTop: 6 }}>{l}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 40 }}>
      <div style={{ display: 'flex', gap: 30 }}>
        {card('$0.0012', 'a question, two steps', 6)}
        {card('$0.00005', 'an evening digest', 18)}
        {card('$0.36', 'a household, a month', 30)}
      </div>
      <div style={{ fontFamily: theme.font, fontSize: 24, color: theme.muted, opacity: interpolate(frame, [50, 70], [0, 1], clamp) }}>
        Measured on Nebius Token Factory: 10 questions a day plus the evening digest
      </div>
    </AbsoluteFill>
  );
};

export const OutroScene: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popAt(frame, fps, 2, 13);
  const lines = ['It sees her day.', 'It speaks up first.'];
  const lineAt = [50, 95];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, color: theme.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: p, transform: `translateY(${String((1 - p) * 20)}px)` }}>
        <Logo size={110} />
        <span style={{ fontSize: 110, fontWeight: 800, letterSpacing: '-0.04em' }}>Pawzoo</span>
      </div>
      <div style={{ display: 'flex', gap: 26, marginTop: 40 }}>
        {lines.map((l, i) => (
          <BlurText key={l} text={l} at={lineAt[i] ?? 0} style={{ fontSize: 50, fontWeight: 600, letterSpacing: '-0.02em', color: [theme.text, theme.violet][i] }} />
        ))}
      </div>
      <div style={{ marginTop: 54, opacity: interpolate(frame, [150, 180], [0, 1], clamp), fontSize: 24, color: theme.muted, letterSpacing: '0.02em' }}>
        MCP server  ·  NVIDIA Nemotron 3 Super and Nano  ·  Nebius Token Factory
      </div>
      <div style={{ position: 'absolute', bottom: 40, opacity: interpolate(frame, [170, 200], [0, 1], clamp), fontSize: 18, color: theme.muted }}>
        The household, dog and businesses in this film are fictional. Nothing is charged.
      </div>
    </AbsoluteFill>
  );
};
