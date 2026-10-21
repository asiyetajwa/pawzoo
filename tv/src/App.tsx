// Pawzoo for Fire TV. Home shows the day at a glance; the player runs the 7 PM reel with a moment
// rail the remote moves through; Alexa+ can cast the reel or a moment; an escape takes over the screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View, useTVEventHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Video from 'react-native-video';
import { getDay, listen, media, type Chapter, type Day } from './api';
import { color } from './theme';

type Screen = { name: 'home' } | { name: 'player'; index: number };

const props = {
  ball: require('../assets/props/ball.png'),
  bone: require('../assets/props/bone.png'),
  cushion: require('../assets/props/cushion.png'),
  house: require('../assets/props/house.png'),
  logo: require('../assets/props/logo.png'),
};

export default function App() {
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [alert, setAlert] = useState<{ message: string; eventId: string } | null>(null);
  const dayRef = useRef<Day | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await getDay();
      dayRef.current = d;
      setDay(d);
      setError(null);
      return d;
    } catch (e) {
      setError(String((e as Error).message));
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    return listen(async (p) => {
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
  }, [refresh]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen.name === 'player') {
        setScreen({ name: 'home' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen]);

  if (alert) {
    const ev = dayRef.current?.summary.moments.find((m) => m.eventId === alert.eventId);
    return <AlertScreen message={alert.message} snapshot={ev?.snapshot ?? ''} petName={day?.pet.name ?? 'Your dog'} />;
  }
  if (screen.name === 'player' && day?.reel.chapters.length) {
    return <Player chapters={day.reel.chapters} start={screen.index} onDone={() => setScreen({ name: 'home' })} />;
  }
  return <Home day={day} error={error} onPlay={() => setScreen({ name: 'player', index: 0 })} onRetry={refresh} />;
}

function Board({ blob, title, children, art }: { blob: string; title: [string, string]; children: React.ReactNode; art: React.ReactNode }) {
  return (
    <View style={s.page}>
      <StatusBar hidden />
      <View style={s.board}>
        <View style={[s.blob, { backgroundColor: blob }]} />
        <View style={s.display}>
          <Text style={s.displayText}>{title[0]}</Text>
          <Text style={s.displayText}>{title[1]}</Text>
        </View>
        {art}
        <View style={s.side}>{children}</View>
      </View>
    </View>
  );
}

function Home({ day, error, onPlay, onRetry }: { day: Day | null; error: string | null; onPlay: () => void; onRetry: () => void }) {
  const rows = day?.summary.highlights.length ? day.summary.highlights : ['Nothing on camera yet today.'];
  return (
    <Board
      blob={color.violet}
      title={[day ? `${day.pet.name}'s` : 'Pawzoo', 'Day']}
      art={
        <>
          <Image source={props.ball} style={[s.prop, { left: '30%', top: '44%', width: '19%' }]} />
          <Image source={props.bone} style={[s.prop, s.soft, { left: '5%', top: '66%', width: '12%' }]} blurRadius={6} />
          <Image source={props.cushion} style={[s.prop, s.soft, { left: '34%', top: '3%', width: '9%' }]} blurRadius={6} />
          <Image source={props.logo} style={s.avatar} />
        </>
      }
    >
      <Text style={s.kicker}>TODAY ON CAMERA</Text>
      <Text style={s.title}>{'What she\ngot up to'}</Text>
      {error ? (
        <>
          <Text style={s.row}>Can't reach the Pawzoo server. {error}</Text>
          <PlayButton label="Try Again" onPress={onRetry} />
        </>
      ) : (
        <>
          {rows.map((h, i) => (
            <Text key={h} style={[s.row, i % 2 === 0 && s.rowBand]}>
              {h}
            </Text>
          ))}
          {day?.reel.chapters.length ? <PlayButton label="Play the Day" onPress={onPlay} /> : null}
        </>
      )}
    </Board>
  );
}

function PlayButton({ label, onPress }: { label: string; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[s.play, focused && s.playFocused]}
      accessibilityRole="button"
    >
      <Text style={s.playText}>{label}</Text>
      <View style={s.playDot}>
        <Text style={s.playIcon}>{'\u25B6'}</Text>
      </View>
    </Pressable>
  );
}

function Player({ chapters, start, onDone }: { chapters: Chapter[]; start: number; onDone: () => void }) {
  const [index, setIndex] = useState(start);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const rail = useRef<ScrollView>(null);
  const c = chapters[index];

  useEffect(() => setIndex(start), [start]);
  useEffect(() => {
    setFailed(false);
    rail.current?.scrollTo({ x: Math.max(0, index * 300 - 600), animated: true });
  }, [index]);

  const next = useCallback(() => {
    if (index + 1 < chapters.length) setIndex(index + 1);
    else onDone();
  }, [index, chapters.length, onDone]);

  // A clip that will not play falls back to its snapshot for the highlight length.
  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(next, c.seconds * 1000);
    return () => clearTimeout(t);
  }, [failed, c, next]);

  useTVEventHandler((evt) => {
    if (evt.eventType === 'playPause') setPaused((p) => !p);
    if (evt.eventType === 'fastForward') next();
    if (evt.eventType === 'rewind') setIndex(Math.max(0, index - 1));
  });

  return (
    <View style={s.player}>
      <StatusBar hidden />
      <View style={s.frame}>
        {failed || !c.clip ? (
          <Image source={{ uri: media(c.snapshot) }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <Video
            key={c.eventId}
            source={{ uri: media(c.clip) }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            paused={paused}
            muted
            onEnd={next}
            onError={() => setFailed(true)}
          />
        )}
        <View style={s.overlay}>
          <Text style={s.caption}>{c.caption}</Text>
          <Text style={s.meta}>
            {c.time} · {c.camera} camera
          </Text>
        </View>
      </View>
      <ScrollView ref={rail} horizontal style={s.rail} contentContainerStyle={s.railContent} showsHorizontalScrollIndicator={false}>
        {chapters.map((ch, i) => (
          <ChapterTile key={ch.eventId} chapter={ch} active={i === index} preferred={i === start} onPress={() => setIndex(i)} />
        ))}
      </ScrollView>
    </View>
  );
}

function ChapterTile({ chapter, active, preferred, onPress }: { chapter: Chapter; active: boolean; preferred: boolean; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[s.tile, (focused || active) && s.tileOn]}
    >
      <Image source={{ uri: media(chapter.snapshot) }} style={s.thumb} />
      <Text style={s.tileTime}>{chapter.time.toUpperCase()}</Text>
      <Text style={s.tileCaption} numberOfLines={2}>
        {chapter.caption}
      </Text>
    </Pressable>
  );
}

function AlertScreen({ message, snapshot }: { message: string; snapshot: string; petName: string }) {
  return (
    <Board blob={color.coral} title={["She's", 'Out']} art={<Image source={props.house} style={[s.prop, { left: '30%', top: '44%', width: '18%' }]} />}>
      <Text style={s.kicker}>FRONT DOOR CAMERA</Text>
      <View style={s.still}>{snapshot ? <Image source={{ uri: media(snapshot) }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}</View>
      <Text style={s.alertBody}>{message}</Text>
      <Text style={s.hint}>Say "She's back inside" when she's home.</Text>
    </Board>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.page, alignItems: 'center', justifyContent: 'center' },
  board: { width: '86%', height: '80%', backgroundColor: color.board, borderRadius: 40, overflow: 'hidden', elevation: 18 },
  blob: { position: 'absolute', left: 0, top: 0, width: '46%', height: '80%', borderTopLeftRadius: 40, borderTopRightRadius: 150, borderBottomRightRadius: 220 },
  display: { position: 'absolute', left: '9%', top: '22%' },
  displayText: { color: '#ffffff', fontSize: 84, fontWeight: '800', lineHeight: 84, letterSpacing: -1.5 },
  prop: { position: 'absolute', aspectRatio: 1, height: undefined, resizeMode: 'contain' },
  soft: { opacity: 0.85 },
  avatar: { position: 'absolute', right: '5%', top: '9%', width: 48, height: 48 },
  side: { position: 'absolute', left: '54%', right: '5%', top: '10%', bottom: '10%' },
  kicker: { color: color.muted, fontSize: 13, letterSpacing: 2.4, marginBottom: 8 },
  title: { color: color.ink, fontSize: 34, lineHeight: 40, marginBottom: 22 },
  row: { color: color.ink, fontSize: 20, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14 },
  rowBand: { backgroundColor: color.band },
  play: { marginTop: 'auto', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: color.press, borderRadius: 999, paddingVertical: 8, paddingLeft: 26, paddingRight: 8, borderWidth: 4, borderColor: 'transparent' },
  playFocused: { borderColor: color.violet, transform: [{ scale: 1.05 }] },
  playText: { color: color.pressInk, fontSize: 22, fontWeight: '500' },
  playDot: { width: 46, height: 46, borderRadius: 23, backgroundColor: color.pressInk, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: color.ink, fontSize: 18, marginLeft: 3 },
  player: { flex: 1, backgroundColor: '#000' },
  frame: { flex: 1 },
  overlay: { position: 'absolute', left: 48, bottom: 28, alignItems: 'flex-start', gap: 8 },
  caption: { color: color.ink, fontSize: 28, fontWeight: '500', backgroundColor: color.board, paddingHorizontal: 18, paddingVertical: 6, borderRadius: 999 },
  meta: { color: '#ffffff', fontSize: 16, backgroundColor: color.overlay, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  rail: { flexGrow: 0, backgroundColor: color.page },
  railContent: { paddingHorizontal: 40, paddingVertical: 18, gap: 16 },
  tile: { width: 280, padding: 6, borderRadius: 20, borderWidth: 4, borderColor: 'transparent', backgroundColor: color.board },
  tileOn: { borderColor: color.press },
  thumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: color.band },
  tileTime: { color: color.muted, fontSize: 12, letterSpacing: 1.6, marginTop: 6, paddingHorizontal: 4 },
  tileCaption: { color: color.ink, fontSize: 16, paddingHorizontal: 4, paddingBottom: 4 },
  still: { width: '100%', aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000', marginBottom: 18 },
  alertBody: { color: color.ink, fontSize: 24, lineHeight: 32 },
  hint: { color: color.muted, fontSize: 18, marginTop: 14 },
});
