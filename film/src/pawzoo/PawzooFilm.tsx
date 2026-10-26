import { createFilm } from '../components/Film';
import { SCENES } from './script';
import { AskScene, CostScene, EveningScene, FoodScene, IntroScene, JobScene, OutroScene, PanelScene, TvScene } from './scenes';

export const pawzooFilm = createFilm('pawzoo', SCENES, {
  intro: IntroScene,
  ask: AskScene,
  food: FoodScene,
  tv: TvScene,
  panel: PanelScene,
  evening: EveningScene,
  job: JobScene,
  cost: CostScene,
  outro: OutroScene,
});
