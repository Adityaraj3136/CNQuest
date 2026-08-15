/**
 * Mastery and streak configuration.
 *
 * The mastery formula is deliberately simple and readable — a student (or an examiner)
 * should be able to see exactly why a topic sits at 69%.
 */

/** mastery = ACCURACY_WEIGHT × accuracy + COMPLETION_WEIGHT × completion */
export const MASTERY_WEIGHTS = {
  accuracy: 0.7,
  completion: 0.3,
} as const;

export type MasteryBand = 'Beginner' | 'Learning' | 'Proficient' | 'Mastered';

/** Checked highest first. */
export const MASTERY_BANDS: ReadonlyArray<{ min: number; band: MasteryBand }> = [
  { min: 80, band: 'Mastered' },
  { min: 60, band: 'Proficient' },
  { min: 40, band: 'Learning' },
  { min: 0, band: 'Beginner' },
];

/** A topic counts as "complete" once this share of its question bank has been attempted. */
export const COMPLETION_TARGET_RATIO = 1;

/** Mastery at or above this counts a unit as mastered for the Network Expert achievement. */
export const UNIT_MASTERED_THRESHOLD = 80;

/** A day only counts towards the streak once this many questions have been answered. */
export const STREAK_MIN_QUESTIONS = 1;
