// Pawzoo film: scene order, voiceover lines and minimum on-screen time.
// The screens are stills of the real app (scripts/capture.mjs). Voiceover: npm run voiceover
// Written for the ear: "Alexa plus", not "Alexa+". <break time="0.4s" /> is an ElevenLabs pause tag.

export type SceneId = 'intro' | 'day' | 'walk' | 'pay' | 'food' | 'groom' | 'tv' | 'alert' | 'outro';

export type SceneSpec = {
  id: SceneId;
  voiceover: string;
  /** Length in seconds the choreography needs; audio can only extend it. */
  minSeconds: number;
  /** A sound after the line, e.g. the closing bark (public/sfx, made with ElevenLabs Sound Effects). */
  after?: { file: string; gap: number; seconds: number; volume: number };
};

export const SCENES: SceneSpec[] = [
  { id: 'intro', voiceover: 'This is Pawzoo. It turns your Ring cameras into a helper for your dog, right inside Alexa plus.', minSeconds: 4.4 },
  { id: 'day', voiceover: "Just ask how Biscuit's day went. Pawzoo reads the day off your cameras and sums it up: her walk, her meals, and when her food runs out.", minSeconds: 6.4 },
  { id: 'walk', voiceover: 'Tap the walk, and Pawzoo checks it against the front door camera. Dana kept her out for thirty-five minutes, and this week only Tuesday came up short.', minSeconds: 7.0 },
  { id: 'pay', voiceover: 'Pay Dana and add a tip right from the card. Pawzoo shows you the total first, and nothing is paid until you say yes.', minSeconds: 6.4 },
  { id: 'food', voiceover: "Running low on food? Pawzoo tracks the bag and offers a reorder before it's empty. Tell it she's eating less now, and the forecast updates.", minSeconds: 7.2 },
  { id: 'groom', voiceover: 'Need grooming? It finds open slots and puts Saturday morning first, because you told it that is when Biscuit is calmest.', minSeconds: 5.6 },
  { id: 'tv', voiceover: "In the evening, the family gathers round Fire TV to relive her day. Pawzoo cuts the camera footage into a keepsake reel, one chapter for every moment, so the little things she did today become memories you get to keep.", minSeconds: 5.6 },
  { id: 'alert', voiceover: 'And if Biscuit ever slips out the front door alone, Pawzoo speaks up right away, on your speaker and your TV.', minSeconds: 5.8 },
  { id: 'outro', voiceover: 'Pawzoo. <break time="0.4s" /> Ring sees, Alexa plus acts, and Fire TV shows.', minSeconds: 4.4, after: { file: 'sfx/bark.mp3', gap: 0.35, seconds: 1.4, volume: 0.3 } },
];
