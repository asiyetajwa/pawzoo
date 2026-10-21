// Pawzoo for Fire TV. Home shows the day at a glance; the player runs the 7 PM reel with a moment
// rail the remote moves through; Alexa+ can cast the reel or a moment; an escape takes over the screen.
// With no Pawzoo server in reach the app runs the sample day built into it, so it is never empty.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useTVEventHandler,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Video, { type ReactVideoSource } from 'react-native-video';
import { DEFAULT_SERVER, getDay, hostOf, listen, normalizeServer, type Chapter, type Day } from './api';
import { SAMPLE_ALERT, SAMPLE_DAY, SAMPLE_MEDIA } from './sample';
import { color, font } from './theme';

type Screen = { name: 'home' } | { name: 'player'; index: number } | { name: 'connect' };
type Link = { kind: 'connecting'; server: string } | { kind: 'live'; server: string; lost: boolean } | { kind: 'sample'; note: string | null };
type Alert = { message: string; eventId: string };

/** A bundled clip is a require() number, which react-native-video takes as `uri` (it resolves the asset). */
const videoSource = (src: ImageSourcePropType): ReactVideoSource =>
  typeof src === 'number' ? { uri: src as unknown as NodeRequire } : { uri: (src as { uri: string }).uri };

const SERVER_KEY = 'pawzoo.server';

const props = {
  ball: require('../assets/props/ball.png'),
  bone: require('../assets/props/bone.png'),
  cushion: require('../assets/props/cushion.png'),
  house: require('../assets/props/house.png'),
  leash: require('../assets/props/leash.png'),
  logo: require('../assets/props/logo.png'),
};

export default function App() {
  const [link, setLink] = useState<Link>({ kind: 'connecting', server: DEFAULT_SERVER });
  const [liveDay, setLiveDay] = useState<Day | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [alert, setAlert] = useState<Alert | null>(null);
  const linkRef = useRef(link);
  linkRef.current = link;

  const day = link.kind === 'live' ? liveDay : link.kind === 'sample' ? SAMPLE_DAY : null;
  const server = link.kind === 'live' ? link.server : null;
  const source = useCallback(
    (path: string): ImageSourcePropType | undefined => {
      if (!path) return undefined;
      if (server) return { uri: `${server}/media/${path}` };
      return SAMPLE_MEDIA[path];
    },
    [server],
  );

  /** Tries a server; on success it becomes the live link and is remembered. */
  const connect = useCallback(async (address: string, timeoutMs: number) => {
    const d = await getDay(address, timeoutMs);
    setLiveDay(d);
    setLink({ kind: 'live', server: address, lost: false });
    setAlert(null);
    try {
      await AsyncStorage.setItem(SERVER_KEY, address);
    } catch {
      // not remembered; it still works for this session
    }
    return d;
  }, []);

  // Start: the remembered server, else the emulator's host; the sample day if neither answers.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let saved: string | null = null;
      try {
        saved = await AsyncStorage.getItem(SERVER_KEY);
      } catch {
        saved = null;
      }
      const first = saved ?? DEFAULT_SERVER;
      setLink({ kind: 'connecting', server: first });
      try {
        await connect(first, saved ? 5000 : 2500);
      } catch {
        if (!cancelled) setLink({ kind: 'sample', note: saved ? `Could not reach ${hostOf(saved)}, so this is the sample day.` : null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connect]);

  const refresh = useCallback(async () => {
    const l = linkRef.current;
    if (l.kind !== 'live') return l.kind === 'sample' ? SAMPLE_DAY : null;
    try {
      const d = await getDay(l.server);
      setLiveDay(d);
      if (l.lost) setLink({ ...l, lost: false });
      return d;
    } catch {
      setLink({ ...l, lost: true });
      return null;
    }
  }, []);

  // Live pushes from the server: Alexa+ casting to the TV, alerts, new camera events.
  useEffect(() => {
    if (!server) return;
    return listen(server, async (p) => {
      if (p.type === 'cast') {
        if (p.target === 'home') {
          setAlert(null);
          setScreen({ name: 'home' });
          return;
        }
        const d = await refresh();
        if (!d) return;
        if (p.target === 'day_reel') setScreen({ name: 'player', index: 0 });
        if (p.target === 'moment') {
          const i = d.reel.chapters.findIndex((c) => c.eventId === p.eventId);
          setScreen({ name: 'player', index: Math.max(0, i) });
        }
      }
      if (p.type === 'alert') {
        await refresh();
        setAlert({ message: p.alert.message, eventId: p.alert.eventId });
      }
      if (p.type === 'state' && p.reason === 'alert_resolved') setAlert(null);
      if (p.type === 'event' || p.type === 'state') void refresh();
    });
  }, [server, refresh]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (alert) {
        setAlert(null);
        return true;
      }
      if (screen.name !== 'home') {
        setScreen({ name: 'home' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen, alert]);

  const showSample = () => {
    setLink({ kind: 'sample', note: null });
    setAlert(null);
    setScreen({ name: 'home' });
  };

  if (alert) {
    const ev = day?.summary.moments.find((m) => m.eventId === alert.eventId);
    return <AlertScreen message={alert.message} snapshot={source(ev?.snapshot ?? '')} live={link.kind === 'live'} onDismiss={() => setAlert(null)} />;
  }
  if (screen.name === 'connect') {
    return (
      <ConnectScreen
        current={server ?? (link.kind === 'connecting' ? link.server : null)}
        onConnect={async (address) => {
          await connect(address, 6000);
          setScreen({ name: 'home' });
        }}
        onSample={showSample}
        onBack={() => setScreen({ name: 'home' })}
      />
    );
  }
  if (screen.name === 'player' && day?.reel.chapters.length) {
    return <Player chapters={day.reel.chapters} start={screen.index} source={source} onDone={() => setScreen({ name: 'home' })} />;
  }
  return (
    <Home
      day={day}
      link={link}
      onPlay={() => setScreen({ name: 'player', index: 0 })}
      onAlert={() => setAlert(SAMPLE_ALERT)}
      onConnect={() => setScreen({ name: 'connect' })}
      onSample={showSample}
      onRetry={() => void refresh()}
    />
  );
}

// ------------------------------------------------------------------ layout

/** One scale for every size: 1.0 on a Fire TV (960 × 540 dp), smaller on a phone, portrait stacks. */
function useMetrics() {
  const { width, height } = useWindowDimensions();
  const portrait = height > width;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const u = portrait ? clamp(width / 430, 0.7, 1.5) : clamp(Math.min(width / 960, height / 540), 0.55, 2.2);
  const boardW = width * (portrait ? 0.92 : 0.88);
  const boardH = height * (portrait ? 0.94 : 0.86);
  const blobW = portrait ? boardW : boardW * 0.46;
  return { width, height, portrait, u, boardW, boardH, blobW };
}

type Metrics = ReturnType<typeof useMetrics>;

function makeStyles({ u, portrait, boardW, boardH, blobW }: Metrics) {
  const radius = 40 * u;
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: color.page, alignItems: 'center', justifyContent: 'center' },
    board: { width: boardW, height: boardH, backgroundColor: color.board, borderRadius: radius, overflow: 'hidden', elevation: 18 },
    blob: portrait
      ? { position: 'absolute', left: 0, top: 0, width: blobW, height: boardH * 0.3, borderTopLeftRadius: radius, borderTopRightRadius: radius, borderBottomRightRadius: 160 * u }
      : { position: 'absolute', left: 0, top: 0, width: blobW, height: boardH * 0.8, borderTopLeftRadius: radius, borderTopRightRadius: 150 * u, borderBottomRightRadius: 220 * u },
    display: portrait ? { position: 'absolute', left: boardW * 0.08, top: boardH * 0.06, width: boardW * 0.56 } : { position: 'absolute', left: boardW * 0.07, top: boardH * 0.2, width: blobW * 0.8 },
    prop: { position: 'absolute', resizeMode: 'contain' },
    avatar: { position: 'absolute', right: boardW * 0.05, top: portrait ? boardH * 0.025 : boardH * 0.08, width: 48 * u, height: 48 * u },
    side: portrait
      ? { position: 'absolute', left: boardW * 0.07, right: boardW * 0.07, top: boardH * 0.33, bottom: boardH * 0.03 }
      : { position: 'absolute', left: boardW * 0.47, right: boardW * 0.04, top: boardH * 0.1, bottom: boardH * 0.06 },
    sideScroll: { flex: 1, marginTop: 4 * u },
    sideContent: { paddingBottom: 4 * u },
    footer: { paddingTop: 4 * u },
    kicker: { fontFamily: font.medium, color: color.muted, fontSize: 13 * u, letterSpacing: 2.2 * u, marginBottom: 6 * u },
    title: { fontFamily: font.regular, color: color.ink, fontSize: 30 * u, lineHeight: 36 * u, marginBottom: 10 * u, marginRight: 56 * u },
    row: { fontFamily: font.regular, color: color.ink, fontSize: 17 * u, lineHeight: 22 * u, paddingVertical: 9 * u, paddingHorizontal: 14 * u, borderRadius: 14 * u, overflow: 'hidden' },
    rowBand: { backgroundColor: color.band },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 * u, marginTop: 10 * u },
    note: { fontFamily: font.regular, color: color.muted, fontSize: 13 * u, lineHeight: 18 * u, marginTop: 10 * u },
    noteStrong: { fontFamily: font.semibold, color: color.ink },
    dot: { width: 9 * u, height: 9 * u, borderRadius: 5 * u, marginRight: 8 * u },
    status: { flexDirection: 'row', alignItems: 'center', marginTop: 10 * u },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 10 * u, borderRadius: 999, borderWidth: 3 * u, borderColor: 'transparent', minHeight: 48 * u },
    pillPrimary: { backgroundColor: color.press, paddingVertical: 4 * u, paddingLeft: 18 * u, paddingRight: 4 * u },
    pillSecondary: { backgroundColor: color.band, paddingVertical: 4 * u, paddingHorizontal: 14 * u },
    pillFocused: { borderColor: color.violet, transform: [{ scale: 1.05 }] },
    pillText: { fontFamily: font.medium, fontSize: 16 * u },
    playDot: { width: 36 * u, height: 36 * u, borderRadius: 18 * u, backgroundColor: color.pressInk, alignItems: 'center', justifyContent: 'center' },
    triangle: {
      width: 0,
      height: 0,
      marginLeft: 3 * u,
      borderTopWidth: 7 * u,
      borderBottomWidth: 7 * u,
      borderLeftWidth: 12 * u,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: color.ink,
    },
    input: {
      fontFamily: font.regular,
      fontSize: 22 * u,
      color: color.ink,
      backgroundColor: color.band,
      borderRadius: 16 * u,
      paddingHorizontal: 18 * u,
      paddingVertical: 12 * u,
      borderWidth: 3 * u,
      borderColor: 'transparent',
    },
    inputFocused: { borderColor: color.indigo },
    error: { fontFamily: font.medium, color: color.coral, fontSize: 15 * u, lineHeight: 21 * u, marginTop: 10 * u },
    still: portrait
      ? { width: '100%', aspectRatio: 16 / 9, borderRadius: 18 * u, overflow: 'hidden', backgroundColor: color.band, marginBottom: 10 * u }
      : { height: boardH * 0.38, aspectRatio: 16 / 9, borderRadius: 18 * u, overflow: 'hidden', backgroundColor: color.band, marginBottom: 10 * u },
    alertBody: { fontFamily: font.medium, color: color.ink, fontSize: 19 * u, lineHeight: 26 * u },
    // player
    player: { flex: 1, backgroundColor: '#000' },
    frame: { flex: 1 },
    overlay: { position: 'absolute', left: 32 * u, right: 32 * u, bottom: 22 * u, alignItems: 'flex-start', gap: 8 * u },
    caption: { fontFamily: font.medium, color: color.ink, fontSize: 26 * u, backgroundColor: color.board, paddingHorizontal: 18 * u, paddingVertical: 6 * u, borderRadius: 999, overflow: 'hidden' },
    meta: { fontFamily: font.regular, color: '#ffffff', fontSize: 15 * u, backgroundColor: color.overlay, paddingHorizontal: 12 * u, paddingVertical: 4 * u, borderRadius: 999, overflow: 'hidden' },
    back: { position: 'absolute', left: 24 * u, top: 20 * u },
    rail: { flexGrow: 0, backgroundColor: color.page },
    railContent: { paddingHorizontal: 32 * u, paddingVertical: 14 * u, gap: 14 * u },
    tile: { width: (portrait ? 200 : 260) * u, padding: 6 * u, borderRadius: 20 * u, borderWidth: 4 * u, borderColor: 'transparent', backgroundColor: color.board },
    tileOn: { borderColor: color.press },
    thumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14 * u, backgroundColor: color.band },
    tileTime: { fontFamily: font.medium, color: color.muted, fontSize: 12 * u, letterSpacing: 1.4 * u, marginTop: 6 * u, paddingHorizontal: 4 * u },
    tileCaption: { fontFamily: font.regular, color: color.ink, fontSize: 15 * u, lineHeight: 20 * u, paddingHorizontal: 4 * u, paddingBottom: 4 * u },
  });
}

function useStyles() {
  const m = useMetrics();
  const s = useMemo(() => makeStyles(m), [m.u, m.portrait, m.boardW, m.boardH, m.blobW]);
  return { m, s };
}

type Prop = { image: number; left: number; top: number; size: number; soft?: boolean };

/** The board: a coloured blob with the big title, floating props, and the content panel. */
function Board({
  blob,
  title,
  head,
  children,
  footer,
  art,
}: {
  blob: string;
  title: [string, string];
  head: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  art: { landscape: Prop[]; portrait: Prop[] };
}) {
  const { m, s } = useStyles();
  // The title always fits its blob: sized from the longest line (Outfit ExtraBold runs about 0.6 em a letter).
  const longest = Math.max(title[0].length, title[1].length, 4);
  const room = m.portrait ? m.boardW * 0.56 : m.blobW * 0.8;
  const size = Math.min((m.portrait ? 64 : 84) * m.u, room / (longest * 0.6));
  const display = { fontFamily: font.heavy, color: '#ffffff', fontSize: size, lineHeight: size * 1.02, letterSpacing: -size * 0.02 };
  return (
    <View style={s.page}>
      <StatusBar hidden />
      <View style={s.board}>
        <View style={[s.blob, { backgroundColor: blob }]} />
        <View style={s.display}>
          <Text style={display} numberOfLines={1} adjustsFontSizeToFit>
            {title[0]}
          </Text>
          <Text style={display} numberOfLines={1} adjustsFontSizeToFit>
            {title[1]}
          </Text>
        </View>
        {(m.portrait ? art.portrait : art.landscape).map((p, i) => (
          <Image
            key={i}
            source={p.image}
            blurRadius={p.soft ? 6 : 0}
            style={[s.prop, { left: m.boardW * p.left, top: m.boardH * p.top, width: m.boardW * p.size, height: m.boardW * p.size, opacity: p.soft ? 0.85 : 1 }]}
          />
        ))}
        <Image source={props.logo} style={s.avatar} />
        <View style={s.side}>
          {head}
          <ScrollView style={s.sideScroll} contentContainerStyle={s.sideContent} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={s.footer}>{footer}</View> : null}
        </View>
      </View>
    </View>
  );
}

function Pill({ label, onPress, primary, preferred }: { label: string; onPress: () => void; primary?: boolean; preferred?: boolean }) {
  const { s } = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[s.pill, primary ? s.pillPrimary : s.pillSecondary, focused && s.pillFocused]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[s.pillText, { color: primary ? color.pressInk : color.ink }]}>{label}</Text>
      {primary ? (
        <View style={s.playDot}>
          <View style={s.triangle} />
        </View>
      ) : null}
    </Pressable>
  );
}

// ------------------------------------------------------------------ screens

const HOME_ART = {
  landscape: [
    { image: props.ball, left: 0.31, top: 0.44, size: 0.11 },
    { image: props.bone, left: 0.05, top: 0.66, size: 0.08, soft: true },
    { image: props.cushion, left: 0.33, top: 0.04, size: 0.06, soft: true },
  ],
  portrait: [
    { image: props.ball, left: 0.66, top: 0.12, size: 0.24 },
    { image: props.bone, left: 0.08, top: 0.22, size: 0.13, soft: true },
  ],
};

function Home({
  day,
  link,
  onPlay,
  onAlert,
  onConnect,
  onSample,
  onRetry,
}: {
  day: Day | null;
  link: Link;
  onPlay: () => void;
  onAlert: () => void;
  onConnect: () => void;
  onSample: () => void;
  onRetry: () => void;
}) {
  const { s } = useStyles();
  const name = day?.pet.name ?? '';
  const chapters = day?.reel.chapters.length ?? 0;
  const rows = day ? (day.summary.highlights.length ? day.summary.highlights.slice(0, 3) : ['Nothing on camera yet today.']) : [];
  const head = (
    <>
      <Text style={s.kicker}>{link.kind === 'sample' ? 'SAMPLE DAY' : 'TODAY ON CAMERA'}</Text>
      <Text style={s.title}>{day ? `What ${name}\ngot up to` : 'Getting the\nday ready'}</Text>
    </>
  );
  if (link.kind === 'connecting') {
    return (
      <Board blob={color.violet} title={['Pawzoo', 'TV']} art={HOME_ART} head={head}>
        <View style={s.status}>
          <ActivityIndicator color={color.violet} />
          <Text style={[s.note, { marginTop: 0, marginLeft: 12, flex: 1 }]}>Looking for your Pawzoo server at {hostOf(link.server)}</Text>
        </View>
      </Board>
    );
  }
  return (
    <Board
      blob={color.violet}
      title={[`${name}'s`, 'Day']}
      art={HOME_ART}
      head={head}
      footer={
        <>
          <View style={s.actions}>
            {chapters ? <Pill primary preferred label="Play the Day" onPress={onPlay} /> : null}
            {link.kind === 'sample' ? <Pill label="Show an Alert" onPress={onAlert} /> : null}
            {link.kind === 'live' && !chapters ? <Pill preferred label="Watch the Sample Day" onPress={onSample} /> : null}
            {link.kind === 'live' && link.lost ? <Pill label="Reconnect" onPress={onRetry} /> : null}
            <Pill label={link.kind === 'live' ? 'Change Server' : 'Connect'} onPress={onConnect} />
          </View>
          <Status link={link} />
        </>
      }
    >
      {rows.map((h, i) => (
        <Text key={h} style={[s.row, i % 2 === 0 && s.rowBand]}>
          {h}
        </Text>
      ))}
    </Board>
  );
}

function Status({ link }: { link: Link }) {
  const { s } = useStyles();
  if (link.kind === 'live') {
    return (
      <View style={s.status}>
        <View style={[s.dot, { backgroundColor: link.lost ? color.amber : color.mint }]} />
        <Text style={[s.note, { marginTop: 0, flex: 1 }]}>
          {link.lost ? 'Lost touch with ' : 'Live from '}
          <Text style={s.noteStrong}>{hostOf(link.server)}</Text>
          {link.lost ? '. Showing the last update.' : '. Alexa+ can put moments on this TV.'}
        </Text>
      </View>
    );
  }
  if (link.kind === 'sample') {
    return <Text style={s.note}>{link.note ?? 'Sample day, built into the app.'} Connect a Pawzoo server for live cameras and Alexa+.</Text>;
  }
  return null;
}

function ConnectScreen({ current, onConnect, onSample, onBack }: { current: string | null; onConnect: (address: string) => Promise<void>; onSample: () => void; onBack: () => void }) {
  const { s, m } = useStyles();
  const [text, setText] = useState(current && current !== DEFAULT_SERVER ? hostOf(current) : '');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const address = normalizeServer(text);
    if (!address) {
      setError("Type your computer's address first, for example 192.168.1.20.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConnect(address);
    } catch (e) {
      setError(`${(e as Error).message} Is the server running with npm run start:tv, on the same Wi-Fi?`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Board
      blob={color.indigo}
      title={['Connect', 'Pawzoo']}
      art={{
        landscape: [{ image: props.leash, left: 0.3, top: 0.56, size: 0.1 }],
        portrait: [{ image: props.leash, left: 0.7, top: 0.13, size: 0.2 }],
      }}
      head={
        <>
          <Text style={s.kicker}>PAWZOO SERVER</Text>
          <Text style={s.title}>{'Where is your\nPawzoo server?'}</Text>
        </>
      }
      footer={
        <View style={s.actions}>
          {busy ? <ActivityIndicator color={color.indigo} style={{ marginHorizontal: 20 * m.u }} /> : <Pill primary label="Connect" onPress={() => void submit()} />}
          <Pill label="Use the Sample Day" onPress={onSample} />
          <Pill label="Back" onPress={onBack} />
        </View>
      }
    >
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => void submit()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="192.168.1.20:8787"
        placeholderTextColor={color.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        hasTVPreferredFocus
        style={[s.input, focused && s.inputFocused]}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Text style={s.note}>
        On your computer, start Pawzoo with <Text style={s.noteStrong}>npm run start:tv</Text>. It prints the address to type here.
      </Text>
    </Board>
  );
}

function Player({ chapters, start, source, onDone }: { chapters: Chapter[]; start: number; source: (p: string) => ImageSourcePropType | undefined; onDone: () => void }) {
  const { s, m } = useStyles();
  const [index, setIndex] = useState(start);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const rail = useRef<ScrollView>(null);
  const c = chapters[Math.min(index, chapters.length - 1)] ?? chapters[0];
  const tileStep = ((m.portrait ? 200 : 260) + 14) * m.u;

  useEffect(() => setIndex(start), [start]);
  useEffect(() => {
    setFailed(false);
    rail.current?.scrollTo({ x: Math.max(0, index * tileStep - m.width / 2 + tileStep / 2), animated: true });
  }, [index, tileStep, m.width]);

  const next = useCallback(() => {
    if (index + 1 < chapters.length) setIndex(index + 1);
    else onDone();
  }, [index, chapters.length, onDone]);

  // A clip that will not play falls back to its snapshot for the highlight length.
  useEffect(() => {
    if (!failed || !c) return;
    const t = setTimeout(next, c.seconds * 1000);
    return () => clearTimeout(t);
  }, [failed, c, next]);

  useTVEventHandler((evt) => {
    if (evt.eventType === 'playPause') setPaused((p) => !p);
    if (evt.eventType === 'fastForward') next();
    if (evt.eventType === 'rewind') setIndex(Math.max(0, index - 1));
  });

  if (!c) return null;
  const clip = source(c.clip);
  return (
    <View style={s.player}>
      <StatusBar hidden />
      <View style={s.frame}>
        {/* The snapshot sits under the clip, so a loading or failed clip never shows black. */}
        <Image source={source(c.snapshot)} style={StyleSheet.absoluteFill} resizeMode="contain" />
        {failed || !clip ? null : (
          <Video key={c.eventId} source={videoSource(clip)} style={StyleSheet.absoluteFill} resizeMode="contain" paused={paused} muted onEnd={next} onError={() => setFailed(true)} />
        )}
        <View style={s.overlay}>
          <Text style={s.caption} numberOfLines={2}>
            {c.caption}
          </Text>
          <Text style={s.meta}>
            {c.time} · {c.camera} camera · {String(index + 1)} of {String(chapters.length)}
          </Text>
        </View>
        <View style={s.back}>
          <Pill label="Home" onPress={onDone} />
        </View>
      </View>
      <ScrollView ref={rail} horizontal style={s.rail} contentContainerStyle={s.railContent} showsHorizontalScrollIndicator={false}>
        {chapters.map((ch, i) => (
          <ChapterTile key={ch.eventId} chapter={ch} thumb={source(ch.snapshot)} active={i === index} preferred={i === start} onPress={() => setIndex(i)} />
        ))}
      </ScrollView>
    </View>
  );
}

function ChapterTile({ chapter, thumb, active, preferred, onPress }: { chapter: Chapter; thumb: ImageSourcePropType | undefined; active: boolean; preferred: boolean; onPress: () => void }) {
  const { s } = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[s.tile, (focused || active) && s.tileOn]}
      accessibilityLabel={`${chapter.time}, ${chapter.caption}`}
    >
      <Image source={thumb} style={s.thumb} />
      <Text style={s.tileTime}>{chapter.time.toUpperCase()}</Text>
      <Text style={s.tileCaption} numberOfLines={2}>
        {chapter.caption}
      </Text>
    </Pressable>
  );
}

function AlertScreen({ message, snapshot, live, onDismiss }: { message: string; snapshot: ImageSourcePropType | undefined; live: boolean; onDismiss: () => void }) {
  const { s } = useStyles();
  return (
    <Board
      blob={color.coral}
      title={["She's", 'Out']}
      art={{
        landscape: [{ image: props.house, left: 0.31, top: 0.56, size: 0.1 }],
        portrait: [{ image: props.house, left: 0.7, top: 0.13, size: 0.2 }],
      }}
      head={<Text style={s.kicker}>FRONT DOOR CAMERA</Text>}
      footer={
        <>
          <View style={s.actions}>
            <Pill primary preferred label={live ? 'Dismiss on This TV' : 'Back to the Day'} onPress={onDismiss} />
          </View>
          <Text style={s.note}>
            {live ? 'Tell Alexa+ "she\'s back inside" when she is home, and every screen clears.' : 'In a live home, Alexa+ says this on your speaker and every TV switches to the front door camera.'}
          </Text>
        </>
      }
    >
      <View style={s.still}>{snapshot ? <Image source={snapshot} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}</View>
      <Text style={s.alertBody}>{message}</Text>
    </Board>
  );
}
