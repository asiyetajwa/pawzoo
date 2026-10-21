// Pawzoo film: scene order, voiceover lines and minimum on-screen time.
// The screens are stills of the real app (scripts/capture.mjs). Voiceover: npm run voiceover
// Written for the ear: "Alexa plus", not "Alexa+".

export type SceneId = 'intro' | 'day' | 'walk' | 'pay' | 'food' | 'groom' | 'tv' | 'alert' | 'outro';

export type SceneSpec = {
  id: SceneId;
  voiceover: string;
  /** Length in seconds the choreography needs; audio can only extend it. */
  minSeconds: number;
};

export const SCENES: SceneSpec[] = [
  { id: 'intro', voiceover: 'Meet Pawzoo, for Alexa plus.', minSeconds: 2.8 },
  { id: 'day', voiceover: "Ask how your dog's day went. Pawzoo reads your Ring cameras and answers in a sentence.", minSeconds: 5.6 },
  { id: 'walk', voiceover: 'It checks the dog walker against the front door camera. Thirty-five minutes, and only one short walk all week.', minSeconds: 6.2 },
  { id: 'pay', voiceover: 'Pay and tip in a tap. Nothing is bought without your yes.', minSeconds: 5.6 },
  { id: 'food', voiceover: 'It knows when the food runs out, and remembers what you tell it.', minSeconds: 6.4 },
  { id: 'groom', voiceover: 'It books the groomer on the morning slot you said works best.', minSeconds: 4.8 },
  { id: 'tv', voiceover: 'At night, the family watches the whole day on Fire TV.', minSeconds: 5.4 },
  { id: 'alert', voiceover: 'And if she ever slips out alone, every screen knows at once.', minSeconds: 5.2 },
  { id: 'outro', voiceover: 'Pawzoo. Ring sees. Alexa plus acts. Fire TV shows.', minSeconds: 4.4 },
];
