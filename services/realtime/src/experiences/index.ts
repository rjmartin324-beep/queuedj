import type { ExperienceModule, ExperienceType } from "@partyglue/shared-types";
import { DJExperience } from "./dj";
import { TriviaExperience } from "./trivia";
import { UnpopularOpinionsExperience } from "./unpopular-opinions";
import { ScrapbookSabotageExperience } from "./scrapbook-sabotage";
import { TheGlitchExperience } from "./the-glitch";
import { CopyrightInfringementExperience } from "./copyright-infringement";
import { DrawbackExperience } from "./drawback";
import { ScavengerSnapExperience } from "./scavenger-snap";
import { GeoGuesserExperience } from "./geo-guesser";

// ─────────────────────────────────────────────────────────────────────────────
// Experience Registry
//
// Single place that knows about every experience.
// To add a new experience (raffle, karaoke, etc.):
//   1. Create services/realtime/src/experiences/raffle/index.ts
//   2. Implement ExperienceModule
//   3. Register it here — one line
//   4. Done. Platform routes it automatically.
// ─────────────────────────────────────────────────────────────────────────────

const registry = new Map<ExperienceType, ExperienceModule>([
  ["dj",                     new DJExperience()],
  ["trivia",                 new TriviaExperience()],
  ["unpopular_opinions",     new UnpopularOpinionsExperience()],
  ["scrapbook_sabotage",     new ScrapbookSabotageExperience()],
  ["the_glitch",             new TheGlitchExperience()],
  ["copyright_infringement", new CopyrightInfringementExperience()],
  ["drawback",               new DrawbackExperience()],
  ["scavenger_snap",         new ScavengerSnapExperience()],
  ["geo_guesser",            new GeoGuesserExperience()],
]);

export function getExperience(type: ExperienceType): ExperienceModule {
  const experience = registry.get(type);
  if (!experience) throw new Error(`Unknown experience: ${type}`);
  return experience;
}

export function isValidExperience(type: string): type is ExperienceType {
  return registry.has(type as ExperienceType);
}
