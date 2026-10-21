// Pawzoo for Fire TV. Home shows the day at a glance; the player runs the 7 PM reel with a moment
// rail the remote moves through; Alexa+ can cast the reel or a moment; an escape takes over the screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View, useTVEventHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Video from 'react-native-video';
import { getDay, listen, media, type Chapter, type Day } from './api';
import { color } from './theme';

type Screen = { name: 'home' } | { name: 'player'; index: number };

const logo = require('../assets/icon.png');

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

function Home({ day, error, onPlay, onRetry }: { day: Day | null; error: string | null; onPlay: () => void; onRetry: () => void }) {
  return (
    <View style={s.home}>
      <StatusBar hidden />
      <Image source={logo} style={s.logo} />
      <Text style={s.h1}>{day ? `${day.pet.name}'s Day` : 'Pawzoo'}</Text>
      {error ? (
        <>
          <Text style={s.muted}>Can't reach the Pawzoo server. {error}</Text>
          <FocusButton label="Try Again" onPress={onRetry} preferred />
        </>
      ) : (
        <>
          {(day?.summary.highlights.length ? day.summary.highlights : ['Nothing on camera yet today.']).map((h) => (
            <Text key={h} style={s.highlight}>
              {h}
            </Text>
          ))}
          {day?.reel.chapters.length ? <FocusButton label="Play the Day" onPress={onPlay} preferred /> : null}
        </>
      )}
    </View>
  );
}

function FocusButton({ label, onPress, preferred }: { label: string; onPress: () => void; preferred?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[s.button, focused && s.buttonFocused]}
      accessibilityRole="button"
    >
      <Text style={s.buttonText}>{label}</Text>
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
      <Text style={s.tileTime}>{chapter.time}</Text>
      <Text style={s.tileCaption} numberOfLines={2}>
        {chapter.caption}
      </Text>
    </Pressable>
  );
}

function AlertScreen({ message, snapshot, petName }: { message: string; snapshot: string; petName: string }) {
  return (
    <View style={s.alert}>
      <StatusBar hidden />
      <View style={s.alertMedia}>{snapshot ? <Image source={{ uri: media(snapshot) }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}</View>
      <View style={s.alertText}>
        <Text style={s.alertTitle}>{petName} Is Outside</Text>
        <Text style={s.alertBody}>{message}</Text>
        <Text style={s.muted}>Say "She's back inside" when she's home.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  home: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: 48 },
  logo: { width: 84, height: 84, borderRadius: 42, marginBottom: 20 },
  h1: { color: color.ink, fontSize: 56, fontWeight: '700', marginBottom: 18 },
  highlight: { color: color.muted, fontSize: 24, marginVertical: 4, textAlign: 'center' },
  muted: { color: color.muted, fontSize: 20, marginTop: 16, textAlign: 'center' },
  button: { marginTop: 28, backgroundColor: color.accent, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 36, borderWidth: 4, borderColor: 'transparent' },
  buttonFocused: { borderColor: color.ink, transform: [{ scale: 1.06 }] },
  buttonText: { color: color.bg, fontSize: 24, fontWeight: '700' },
  player: { flex: 1, backgroundColor: color.bg },
  frame: { flex: 1, backgroundColor: '#000' },
  overlay: { position: 'absolute', left: 48, bottom: 28, right: 48 },
  caption: { alignSelf: 'flex-start', color: '#fff', fontSize: 34, fontWeight: '600', backgroundColor: color.overlay, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  meta: { alignSelf: 'flex-start', color: '#e7dccf', fontSize: 18, marginTop: 6, backgroundColor: color.overlay, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  rail: { flexGrow: 0, backgroundColor: color.surface },
  railContent: { paddingHorizontal: 40, paddingVertical: 18, gap: 16 },
  tile: { width: 280, padding: 6, borderRadius: 16, borderWidth: 4, borderColor: 'transparent' },
  tileOn: { borderColor: color.accent },
  thumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: color.raised },
  tileTime: { color: color.muted, fontSize: 15, marginTop: 6 },
  tileCaption: { color: color.ink, fontSize: 17 },
  alert: { flex: 1, backgroundColor: color.warnBg, flexDirection: 'row', alignItems: 'center', padding: 64, gap: 48 },
  alertMedia: { flex: 1.2, aspectRatio: 16 / 9, borderRadius: 18, borderWidth: 5, borderColor: color.warn, overflow: 'hidden', backgroundColor: '#000' },
  alertText: { flex: 1 },
  alertTitle: { color: color.warn, fontSize: 52, fontWeight: '700', marginBottom: 16 },
  alertBody: { color: color.ink, fontSize: 28, lineHeight: 38 },
});
