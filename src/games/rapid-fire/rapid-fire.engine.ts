/**
 * Rapid Fire — one 60-second clock, as many questions as you can answer.
 *
 * Differences from Quiz Blitz: the timer is global rather than per question, there is no
 * explanation pause, and the round ends the moment the clock does. Pure logic, no DOM.
 */

import type { Difficulty, Question } from '../../models/content.ts';
import type { AnsweredQuestion, GameResult, GameSummary } from '../../models/game.ts';
import { BASE_XP, calculateRoundXp, xpForCorrectAnswer } from '../../config/xp.config.ts';
import { promoteChoice, type AdaptivePicker } from '../../services/adaptive/skill.engine.ts';

export const RAPID_FIRE_DEFAULTS = {
  durationSeconds: 60,
  /** Questions loaded per round — generous, since a fast player gets through many. */
  questionPool: 40,
  /** Positive time in seconds awarded for a correct answer */
  correctBonusSeconds: 2,
  /** Negative time in seconds deducted for a wrong answer */
  wrongPenaltySeconds: 3,
  /** Consecutive correct answers threshold to earn extra streak bonus */
  streakBonusThreshold: 3,
  /** Extra bonus time awarded when on a streak */
  extraStreakBonusSeconds: 1,
  /** Maximum time cap so user cannot accumulate infinite time */
  maxDurationSeconds: 90,
  /** Seconds that count as a slow answer for adaptive difficulty (there is no per-question clock). */
  adaptiveReferenceSeconds: 10,
} as const;

export interface RapidFireOptions {
  durationSeconds?: number;
  correctBonusSeconds?: number;
  wrongPenaltySeconds?: number;
  maxDurationSeconds?: number;
  now?: () => number;
  topicId?: string;
  unitId?: string;
  /** Adaptive difficulty: hears every answer and picks each next question from the pool. */
  adaptive?: AdaptivePicker;
}

export interface RapidFireAnswerResult extends AnsweredQuestion {
  timeDeltaSeconds: number;
  exhausted: boolean;
}

export interface RapidFireView {
  question: Question;
  answeredCount: number;
  score: number;
  currentStreak: number;
  bestStreak: number;
  secondsLeft: number;
  finished: boolean;
  exhausted: boolean;
  topicId: string;
}

export class RapidFireEngine {
  private readonly questions: Question[];
  private readonly now: () => number;
  private readonly startedAt: number;
  private endsAt: number;
  private readonly topicId: string;
  private readonly unitId: string | undefined;
  private readonly correctBonusSeconds: number;
  private readonly wrongPenaltySeconds: number;
  private readonly maxDurationSeconds: number;
  private readonly adaptive: AdaptivePicker | undefined;

  private index = 0;
  private readonly answers: AnsweredQuestion[] = [];
  private currentStreak = 0;
  private bestStreak = 0;
  private questionStartedAt: number;
  private stoppedAt: number | null = null;
  private isExhaustedFlag = false;

  constructor(questions: readonly Question[], options: RapidFireOptions = {}) {
    if (questions.length === 0) throw new Error('RapidFireEngine needs at least one question.');

    this.questions = [...questions];
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
    const duration = options.durationSeconds ?? RAPID_FIRE_DEFAULTS.durationSeconds;
    this.endsAt = this.startedAt + duration * 1000;
    this.questionStartedAt = this.startedAt;

    this.correctBonusSeconds = options.correctBonusSeconds ?? RAPID_FIRE_DEFAULTS.correctBonusSeconds;
    this.wrongPenaltySeconds = options.wrongPenaltySeconds ?? RAPID_FIRE_DEFAULTS.wrongPenaltySeconds;
    this.maxDurationSeconds = options.maxDurationSeconds ?? RAPID_FIRE_DEFAULTS.maxDurationSeconds;
    this.adaptive = options.adaptive;
    this.promoteNext();

    const topicIds = new Set(this.questions.map((question) => question.topicId));
    const unitIds = new Set(this.questions.map((question) => question.unitId));
    this.topicId = options.topicId ?? (topicIds.size === 1 ? [...topicIds][0] : 'mixed');
    this.unitId = options.unitId ?? (unitIds.size === 1 ? [...unitIds][0] : undefined);
  }

  secondsLeft(): number {
    if (this.isExhaustedFlag || (this.stoppedAt !== null && this.endsAt <= this.stoppedAt)) return 0;
    if (this.stoppedAt !== null) {
      return Math.max(0, Math.ceil((this.endsAt - this.stoppedAt) / 1000));
    }
    return Math.max(0, Math.ceil((this.endsAt - this.now()) / 1000));
  }

  millisLeft(): number {
    if (this.isExhaustedFlag || (this.stoppedAt !== null && this.endsAt <= this.stoppedAt)) return 0;
    if (this.stoppedAt !== null) {
      return Math.max(0, this.endsAt - this.stoppedAt);
    }
    return Math.max(0, this.endsAt - this.now());
  }

  isFinished(): boolean {
    return this.isExhaustedFlag || this.stoppedAt !== null || this.millisLeft() <= 0 || this.index >= this.questions.length;
  }

  isExhausted(): boolean {
    return this.isExhaustedFlag || this.millisLeft() <= 0;
  }

  view(): RapidFireView {
    return {
      question: this.questions[Math.min(this.index, this.questions.length - 1)],
      answeredCount: this.answers.length,
      score: this.correctCount(),
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      secondsLeft: this.secondsLeft(),
      finished: this.isFinished(),
      exhausted: this.isExhausted(),
      topicId: this.topicId,
    };
  }

  /**
   * Records an answer and immediately applies positive time for correct answer
   * or negative time penalty for wrong answer. If time drops to 0, timer exhausts immediately.
   */
  answer(selectedAnswer: number | null): RapidFireAnswerResult | null {
    if (this.isFinished()) return null;

    const question = this.questions[this.index];
    const isCorrect = selectedAnswer !== null && selectedAnswer === question.correctAnswer;

    let timeDeltaSeconds = 0;
    if (isCorrect) {
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
      const bonus = this.currentStreak >= RAPID_FIRE_DEFAULTS.streakBonusThreshold
        ? this.correctBonusSeconds + RAPID_FIRE_DEFAULTS.extraStreakBonusSeconds
        : this.correctBonusSeconds;
      timeDeltaSeconds = bonus;
      const cap = this.now() + this.maxDurationSeconds * 1000;
      this.endsAt = Math.min(cap, this.endsAt + bonus * 1000);
    } else {
      this.currentStreak = 0;
      timeDeltaSeconds = -this.wrongPenaltySeconds;
      this.endsAt = this.endsAt - this.wrongPenaltySeconds * 1000;
      if (this.endsAt <= this.now()) {
        this.endsAt = this.now();
        this.stoppedAt = this.now();
        this.isExhaustedFlag = true;
      }
    }

    const recorded: RapidFireAnswerResult = {
      questionId: question.id,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      selectedAnswer,
      isCorrect,
      explanation: question.explanation,
      difficulty: question.difficulty,
      timeTakenMs: Math.max(0, this.now() - this.questionStartedAt),
      xpEarned: isCorrect ? xpForCorrectAnswer(BASE_XP.rapidFireCorrect, question.difficulty) : 0,
      timeDeltaSeconds,
      exhausted: this.isExhausted(),
    };

    this.answers.push(recorded);
    this.adaptive?.record(
      question.difficulty,
      isCorrect,
      Math.min(1, recorded.timeTakenMs / (RAPID_FIRE_DEFAULTS.adaptiveReferenceSeconds * 1000)),
    );
    this.index += 1;
    this.promoteNext();
    this.questionStartedAt = this.now();
    return recorded;
  }

  private promoteNext(): void {
    const adaptive = this.adaptive;
    if (adaptive) promoteChoice(this.questions, this.index, (rest) => adaptive.chooseNext(rest));
  }

  /** Ends the round early (student quit, or the clock ran out). */
  stop(): void {
    this.stoppedAt ??= this.now();
  }

  private correctCount(): number {
    return this.answers.filter((answer) => answer.isCorrect).length;
  }

  private roundDifficulty(): Difficulty | 'mixed' {
    const levels = new Set(this.answers.map((answer) => answer.difficulty));
    return levels.size === 1 ? ([...levels][0] as Difficulty) : 'mixed';
  }

  xpBreakdown(): ReturnType<typeof calculateRoundXp> {
    return calculateRoundXp({
      answerXp: this.answers.reduce((sum, answer) => sum + answer.xpEarned, 0),
      attempted: this.answers.length,
      correct: this.correctCount(),
      bestStreak: this.bestStreak,
    });
  }

  summary(): GameSummary {
    const attempted = this.answers.length;
    const correct = this.correctCount();
    const xp = this.xpBreakdown();
    const endedAt = this.stoppedAt ?? Math.min(this.now(), this.endsAt);

    const result: GameResult = {
      gameType: 'rapid-fire',
      topicId: this.topicId,
      ...(this.unitId ? { unitId: this.unitId } : {}),
      attempted,
      correct,
      wrong: attempted - correct,
      score: correct,
      accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
      xpEarned: xp.total,
      durationSeconds: Math.max(0, Math.round((endedAt - this.startedAt) / 1000)),
      difficulty: this.roundDifficulty(),
      bestStreak: this.bestStreak,
    };

    return { result, answers: [...this.answers] };
  }
}
