import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { BlurText, Camera, clamp, Cursor, easeOut, popAt, type CamKey, type CursorKey } from '../components/motion';
import boxes from '../../public/pawzoo/boxes.json';

type SceneProps = { duration: number };
type Box = { x: number; y: number; w: number; h: number };
const B = boxes as unknown as Record<string, Box>;
const center = (key: string): [number, number] => {
  const b = B[key] ?? { x: 0, y: 0, w: 0, h: 0 };
  return [b.x + b.w / 2, b.y + b.h / 2];
};

/* ------------------------------------------------------------ the browser window */

// Captures are 1600x900 css px; the window shows them 1500 world units wide.
const WIN = { w: 1500, bar: 46 };
const S = WIN.w / 1600;
const winH = 900 * S + WIN.bar;
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

const Window: React.FC<{ states: State[]; url?: string }> = ({ states, url = '127.0.0.1:8787  ·  Pawzoo, simulated Alexa+ add-on' }) => {
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
      <div style={{ position: 'relative', width: WIN.w, height: 900 * S, background: theme.bg }}>
        {layers.map((l) =>
          l.visible ? (
            <Img key={l.src} src={staticFile(`pawzoo/${l.src}.png`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: l.opacity }} />
          ) : null,
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ the TV */

const TV = { w: 1440, bezel: 18 };
const tvH = (TV.w - TV.bezel * 2) * (900 / 1600) + TV.bezel * 2;

const Television: React.FC<{ states: State[] }> = ({ states }) => {
  const layers = useLayers(states);
  return (
    <div style={{ position: 'absolute', left: -TV.w / 2, top: -tvH / 2 - 30, width: TV.w, height: tvH + 90 }}>
      <div style={{ position: 'absolute', inset: `0 0 90px 0`, borderRadius: 22, background: '#16141c', boxShadow: '0 70px 120px rgba(31,27,46,0.28)' }}>
        <div style={{ position: 'absolute', inset: TV.bezel, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
          {layers.map((l) =>
            l.visible ? (
              <Img key={l.src} src={staticFile(`pawzoo/${l.src}.png`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: l.opacity }} />
            ) : null,
          )}
        </div>
      </div>
      <div style={{ position: 'absolute', left: TV.w / 2 - 22, bottom: 30, width: 44, height: 64, background: '#2a2733' }} />
      <div style={{ position: 'absolute', left: TV.w / 2 - 210, bottom: 14, width: 420, height: 22, borderRadius: 12, background: '#2a2733' }} />
    </div>
  );
};

/* ------------------------------------------------------------ helpers */

/** Camera key that centres a point of the capture at zoom z. */
const at = (f: number, x: number, y: number, z: number): CamKey => ({ f, ...w(x, y), z });
const WIDE = (f: number): CamKey => ({ f, x: 0, y: 30, z: 1.0 });
/** Cursor key on a capture point. */
const cur = (f: number, x: number, y: number, click = false): CursorKey => ({ f, ...w(x, y), click });
const clickOn = (f: number, key: string): CursorKey => cur(f, ...center(key), true);
const ANSWER: [number, number] = [1140, 420];
/** Zoom for reading a card: starts the frame past the blob's title, so no word is sliced. */
const READ = 1.95;

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
      <BlurText text="Your dog's day, on Alexa+" at={34} outAt={duration - 16} style={{ fontFamily: theme.font, fontSize: 44, fontWeight: 400, color: theme.muted }} />
    </AbsoluteFill>
  );
};

export const DayScene: React.FC<SceneProps> = ({ duration }) => {
  const click = 58;
  const cam: CamKey[] = [WIDE(0), WIDE(click + 16), at(150, ...ANSWER, READ), at(duration, ANSWER[0] + 8, ANSWER[1] + 10, READ + 0.06)];
  const cursor: CursorKey[] = [cur(0, 1250, 640), cur(46, ...center('chipDay')), clickOn(click, 'chipDay'), cur(click + 40, 600, 700)];
  return (
    <>
      <Camera keys={cam}>
        <Window states={[{ src: 'sim-start', at: 0 }, { src: 'sim-day', at: click + 8 }]} />
        <Cursor keys={cursor} visibleFrom={4} visibleTo={click + 60} />
      </Camera>
      <Callout text="One question, one answer" at={170} outAt={duration - 20} />
    </>
  );
};

export const WalkScene: React.FC<SceneProps> = ({ duration }) => {
  const click = 44;
  const cam: CamKey[] = [at(0, 900, 560, 1.12), at(click + 10, 900, 560, 1.12), at(150, 1140, 400, READ), at(duration, 1146, 410, READ + 0.06)];
  const cursor: CursorKey[] = [cur(0, 1150, 690), cur(34, ...center('chipWalk')), clickOn(click, 'chipWalk'), cur(click + 40, 1000, 700)];
  return (
    <>
      <Camera keys={cam}>
        <Window states={[{ src: 'sim-day', at: 0 }, { src: 'sim-walk', at: click + 8 }]} />
        <Cursor keys={cursor} visibleFrom={0} visibleTo={click + 50} />
      </Camera>
      <Callout text="Checked against the front door camera" at={160} outAt={duration - 20} />
    </>
  );
};

export const PayScene: React.FC<SceneProps> = ({ duration }) => {
  const tap = 44;
  const confirm = 196;
  const cam: CamKey[] = [at(0, 1140, 470, READ), at(tap + 12, 1140, 470, READ), at(110, 1140, 430, READ), at(confirm + 20, 1140, 430, READ), at(duration, 1146, 400, READ + 0.06)];
  const cursor: CursorKey[] = [cur(0, 1150, 700), cur(34, ...center('cardPayTip')), clickOn(tap, 'cardPayTip'), cur(150, 1000, 560), cur(186, ...center('cardConfirm')), clickOn(confirm, 'cardConfirm'), cur(confirm + 40, 1100, 600)];
  return (
    <>
      <Camera keys={cam}>
        <Window states={[{ src: 'sim-walk', at: 0 }, { src: 'sim-pay', at: tap + 8 }, { src: 'sim-paid', at: confirm + 8 }]} />
        <Cursor keys={cursor} visibleFrom={0} visibleTo={confirm + 50} />
      </Camera>
      <Callout text="Nothing is bought without your yes" at={confirm + 14} outAt={duration - 20} />
    </>
  );
};

export const FoodScene: React.FC<SceneProps> = ({ duration }) => {
  const food = 40;
  const cups = 214;
  const cam: CamKey[] = [
    at(0, 900, 560, 1.12),
    at(food + 12, 900, 560, 1.12),
    at(130, 1140, 470, READ),
    at(cups - 40, 1140, 470, READ),
    at(cups - 6, 900, 560, 1.12),
    at(cups + 14, 900, 560, 1.12),
    at(duration - 40, 1144, 460, READ + 0.04),
  ];
  const cursor: CursorKey[] = [
    cur(0, 1150, 690),
    cur(30, ...center('chipFood')),
    clickOn(food, 'chipFood'),
    cur(food + 50, 1150, 700),
    cur(cups - 12, ...center('chipCups')),
    clickOn(cups, 'chipCups'),
    cur(cups + 40, 1250, 700),
  ];
  return (
    <>
      <Camera keys={cam}>
        <Window states={[{ src: 'sim-paid', at: 0 }, { src: 'sim-food', at: food + 8 }, { src: 'sim-cups', at: cups + 8 }]} />
        <Cursor keys={cursor} visibleFrom={0} visibleTo={cups + 50} />
      </Camera>
      <Callout text="It remembers: 2.5 cups a day" at={cups + 60} outAt={duration - 20} />
    </>
  );
};

export const GroomScene: React.FC<SceneProps> = ({ duration }) => {
  const click = 40;
  const cam: CamKey[] = [at(0, 900, 580, 1.1), at(click + 12, 900, 580, 1.1), at(140, 1172, 440, READ), at(duration, 1176, 450, READ + 0.04)];
  const cursor: CursorKey[] = [cur(0, 1150, 700), cur(30, ...center('chipGroom')), clickOn(click, 'chipGroom'), cur(click + 40, 1000, 740)];
  return (
    <>
      <Camera keys={cam}>
        <Window states={[{ src: 'sim-cups', at: 0 }, { src: 'sim-groom', at: click + 8 }]} />
        <Cursor keys={cursor} visibleFrom={0} visibleTo={click + 50} />
      </Camera>
      <Callout text="The morning slot you asked for" at={150} outAt={duration - 20} />
    </>
  );
};

export const TvScene: React.FC<SceneProps> = ({ duration }) => {
  const cam: CamKey[] = [
    { f: 0, x: 0, y: 0, z: 1.0 },
    { f: 80, x: 0, y: 0, z: 1.0 },
    { f: duration, x: -40, y: 40, z: 1.14 },
  ];
  return (
    <>
      <Camera keys={cam}>
        <Television
          states={[
            { src: 'tv-home', at: 0 },
            { src: 'tv-reel-1', at: 84 },
            { src: 'tv-reel-2', at: 84 + Math.round((duration - 84) / 3) },
            { src: 'tv-reel-3', at: 84 + Math.round(((duration - 84) * 2) / 3) },
          ]}
        />
      </Camera>
      <Callout text="Biscuit's day, on Fire TV" at={96} outAt={duration - 20} />
    </>
  );
};

export const AlertScene: React.FC<SceneProps> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tvIn = popAt(frame, fps, 34, 15);
  const cam: CamKey[] = [{ f: 0, x: 0, y: 0, z: 1.0 }, { f: duration, x: 0, y: 0, z: 1.06 }];
  return (
    <>
      <Camera keys={cam}>
        <div style={{ position: 'absolute', left: -470, top: -40, transform: 'scale(0.6)' }}>
          <Window states={[{ src: 'sim-alert', at: 0 }]} />
        </div>
        <div style={{ position: 'absolute', left: 470, top: -40, transform: `scale(${String(0.56 * (0.9 + 0.1 * tvIn))})`, opacity: tvIn }}>
          <Television states={[{ src: 'tv-alert', at: 0 }]} />
        </div>
      </Camera>
      <Callout text="A dog out alone: every screen, at once" at={70} outAt={duration - 20} />
    </>
  );
};

export const OutroScene: React.FC<SceneProps> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popAt(frame, fps, 2, 13);
  const lines = ['Ring sees.', 'Alexa+ acts.', 'Fire TV shows.'];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, color: theme.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: p, transform: `translateY(${String((1 - p) * 20)}px)` }}>
        <Logo size={110} />
        <span style={{ fontSize: 110, fontWeight: 800, letterSpacing: '-0.04em' }}>Pawzoo</span>
      </div>
      <div style={{ display: 'flex', gap: 26, marginTop: 40 }}>
        {lines.map((l, i) => (
          <BlurText key={l} text={l} at={18 + i * 14} style={{ fontSize: 50, fontWeight: 600, letterSpacing: '-0.02em', color: [theme.text, theme.violet, theme.text][i] }} />
        ))}
      </div>
      <div style={{ marginTop: 54, opacity: interpolate(frame, [70, 90], [0, 1], clamp), fontSize: 24, color: theme.muted, letterSpacing: '0.02em' }}>
        MCP server on Alexa+  ·  Ring API  ·  Fire OS app  ·  Amazon Bedrock (Nova 2 Lite)  ·  Amazon DynamoDB
      </div>
      <div style={{ position: 'absolute', bottom: 40, opacity: interpolate(frame, [80, 100], [0, 1], clamp), fontSize: 18, color: theme.muted }}>
        Simulated Alexa+ add-on. The household, dog and purchases in this film are fictional.
      </div>
    </AbsoluteFill>
  );
};
