/**
 * Rapid Fire — one 60-second clock, as many questions as you can answer.
 *
 * Differences from Quiz Blitz: the timer is global rather than per question, there is no
 * explanation pause, and the round ends the moment the clock does. Pure logic, no DOM.
 */

import type { Difficulty, Question } from '../../models/content.ts';
import type { AnsweredQuestion, GameResult, GameSummary } from '../../models/game.ts';
import { BASE_XP, calculateRoundXp, xpForCorrectAnswer } from '../../config/xp.config.ts';

export const RAPID_FIRE_DEFAULTS = {
  durationSeconds: 60,
  /** Questions loaded per round — generous, since a fast player gets through many. */
  questionPool: 40,
} as const;

export interface RapidFireOptions {
  durationSeconds?: number;
  now?: () => number;
  topicId?: string;
  unitId?: string;
}

export interface RapidFireView {
  question: Question;
  answeredCount: number;
  score: number;
  currentStreak: number;
  bestStreak: number;
  secondsLeft: number;
  finished: boolean;
}

export class RapidFireEngine {
  private readonly questions: Question[];
  private readonly now: () => number;
  private readonly startedAt: number;
  private readonly endsAt: number;
  private readonly topicId: string;
  private readonly unitId: string | undefined;

  private index = 0;
  private readonly answers: AnsweredQuestion[] = [];
  private currentStreak = 0;
  private bestStreak = 0;
  private questionStartedAt: number;
  private stoppedAt: number | null = null;

  constructor(questions: readonly Question[], options: RapidFireOptions = {}) {
    if (questions.length === 0) throw new Error('RapidFireEngine needs at least one question.');

    this.questions = [...questions];
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
    this.endsAt =
      this.startedAt + (options.durationSeconds ?? RAPID_FIRE_DEFAULTS.durationSeconds) * 1000;
    this.questionStartedAt = this.startedAt;

    const topicIds = new Set(this.questions.map((question) => question.topicId));
    const unitIds = new Set(this.questions.map((question) => question.unitId));
    this.topicId = options.topicId ?? (topicIds.size === 1 ? [...topicIds][0] : 'mixed');
    this.unitId = options.unitId ?? (unitIds.size === 1 ? [...unitIds][0] : undefined);
  }

  secondsLeft(): number {
    if (this.stoppedAt !== null) return 0;
    return Math.max(0, Math.ceil((this.endsAt - this.now()) / 1000));
  }

  millisLeft(): number {
    if (this.stoppedAt !== null) return 0;
    return Math.max(0, this.endsAt - this.now());
  }

  isFinished(): boolean {
    // Running out of questions ends the round too — better than looping the same ones.
    return this.stoppedAt !== null || this.millisLeft() === 0 || this.index >= this.questions.length;
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
    };
  }

  /**
   * Records an answer and immediately advances — there is no feedback pause.
   * Answers arriving after the buzzer are rejected, so a late click cannot score.
   */
  answer(selectedAnswer: number | null): AnsweredQuestion | null {
    if (this.isFinished()) return null;

    const question = this.questions[this.index];
    const isCorrect = selectedAnswer !== null && selectedAnswer === question.correctAnswer;

    if (isCorrect) {
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.currentStreak = 0;
    }

    const recorded: AnsweredQuestion = {
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
    };

    this.answers.push(recorded);
    this.index += 1;
    this.questionStartedAt = this.now();
    return recorded;
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
