import { createFilm } from '../components/Film';
import { SCENES } from './script';
import { AlertScene, DayScene, FoodScene, GroomScene, IntroScene, OutroScene, PayScene, TvScene, WalkScene } from './scenes';

export const pawzooFilm = createFilm('pawzoo', SCENES, {
  intro: IntroScene,
  day: DayScene,
  walk: WalkScene,
  pay: PayScene,
  food: FoodScene,
  groom: GroomScene,
  tv: TvScene,
  alert: AlertScene,
  outro: OutroScene,
});
