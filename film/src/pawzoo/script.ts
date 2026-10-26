// Pawzoo Nebius film: scene order, voiceover lines and minimum on-screen time.
// The screens are stills of the real app with live Nemotron calls on Nebius Token Factory, and the job's output is
// a real run (scripts/capture.mjs). Voiceover: npm run voiceover
// Written for the ear: numbers as words, model names hyphenated so the voice reads each as one name.
// <break time="0.4s" /> is an ElevenLabs pause tag.

export type SceneId = 'intro' | 'ask' | 'food' | 'tv' | 'panel' | 'evening' | 'job' | 'cost' | 'outro';

export type SceneSpec = {
  id: SceneId;
  voiceover: string;
  /** Length in seconds the choreography needs; audio can only extend it. */
  minSeconds: number;
  /** A sound after the line (public/sfx, made with ElevenLabs Sound Effects). */
  after?: { file: string; gap: number; seconds: number; volume: number };
};

export const SCENES: SceneSpec[] = [
  { id: 'intro', voiceover: 'This is Pawzoo, now running on NVIDIA Nemotron, on Nebius Token Factory. It knows your dog\'s day, and it speaks up first.', minSeconds: 6.0 },
  { id: 'ask', voiceover: 'Ask how Biscuit\'s day went. Nemotron-Three-Super picks Pawzoo\'s tools from the live tool list, and Nemotron-Three-Nano turns the camera facts into a short update.', minSeconds: 10.0 },
  { id: 'food', voiceover: 'Ask about her food. About fifteen cups left, so she runs out Saturday. The numbers come from Pawzoo\'s own code, never from the model.', minSeconds: 8.0 },
  { id: 'tv', voiceover: 'Ask to see the walker on the TV. Nemotron finds the moments, looks at what came back, and takes a second step: it plays the clip on the TV.', minSeconds: 10.0 },
  { id: 'panel', voiceover: 'Under the hood, every call is on the meter: the model, the tokens, the time, and the cost.', minSeconds: 7.5 },
  { id: 'evening', voiceover: 'At seven in the evening, nobody has to ask. Pawzoo writes the day\'s update on its own, and puts it on the TV and the speaker.', minSeconds: 10.0 },
  { id: 'job', voiceover: 'The same digest also runs as a standalone job, in a container image, ready to schedule as a Nebius Serverless Job.', minSeconds: 9.0 },
  { id: 'cost', voiceover: 'About a tenth of a cent a question, and about thirty-six cents a month for a household.', minSeconds: 6.5 },
  { id: 'outro', voiceover: 'Pawzoo. <break time="0.4s" /> It sees her day, and it speaks up first.', minSeconds: 5.6, after: { file: 'sfx/sting.mp3', gap: 0.3, seconds: 1.8, volume: 0.4 } },
];
