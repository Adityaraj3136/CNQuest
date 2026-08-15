/**
 * Level progression configuration.
 * Phase 5's LevelService consumes these values; the dashboard reads them to draw the XP bar.
 */

/** Cumulative XP needed to reach the given level: 100 * (level - 1)^2. Level 1 starts at 0 XP. */
export function xpRequiredForLevel(level: number): number {
  const target = Math.max(1, Math.floor(level));
  return 100 * (target - 1) ** 2;
}

/** Highest level whose XP threshold the student has crossed. */
export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export const LEVEL_TITLES: readonly string[] = [
  'Network Rookie',
  'Packet Learner',
  'Protocol Explorer',
  'Routing Adventurer',
  'Network Specialist',
  'Network Expert',
  'Protocol Master',
  'Network Champion',
];

export function levelTitle(level: number): string {
  const index = Math.min(Math.max(level, 1), LEVEL_TITLES.length) - 1;
  return LEVEL_TITLES[index];
}

export interface LevelProgress {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForLevel: number;
  percent: number;
}

/** XP progress within the current level, for progress bars. */
export function levelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  const floor = xpRequiredForLevel(level);
  const ceiling = xpRequiredForLevel(level + 1);
  const xpForLevel = ceiling - floor;
  const xpIntoLevel = Math.max(0, totalXp - floor);

  return {
    level,
    title: levelTitle(level),
    xpIntoLevel,
    xpForLevel,
    percent: xpForLevel === 0 ? 0 : Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100)),
  };
}
