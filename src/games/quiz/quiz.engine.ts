/**
 * Quiz Blitz game logic — pure state machine, no DOM and no Firebase.
 *
 * The page renders whatever the engine reports and forwards user input back into it.
 * Keeping the rules here means they can be tested without a browser, and reused by
 * Rapid Fire and Boss Battle in Phase 7.
 *
 * Relative imports only, so the Node test runner can load it.
 */

import type { Difficulty, Question } from '../../models/content.ts';
import type { AnsweredQuestion, GameResult, GameSummary } from '../../models/game.ts';
import { BASE_XP, calculateRoundXp, xpForCorrectAnswer } from '../../config/xp.config.ts';
import { promoteChoice, type AdaptivePicker } from '../../services/adaptive/skill.engine.ts';

export const QUIZ_DEFAULTS = {
  questionCount: 10,
  secondsPerQuestion: 20,
} as const;

export type QuizStatus = 'asking' | 'feedback' | 'finished';

export interface QuizEngineOptions {
  /** Seconds allowed per question before it is auto-submitted as unanswered. */
  secondsPerQuestion?: number;
  /** Injectable clock — tests pass a fake, the page passes Date.now. */
  now?: () => number;
  /** Topic the round was started from; 'mixed' when questions span topics. */
  topicId?: string;
  unitId?: string;
  /** Questions to ask; defaults to all of them. Lets `questions` be a larger pool to choose from. */
  roundLength?: number;
  /** Adaptive difficulty: hears every answer and picks each next question from the pool. */
  adaptive?: AdaptivePicker;
}

export interface QuizView {
  status: QuizStatus;
  questionNumber: number;
  totalQuestions: number;
  question: Question;
  /** Set once the current question has been answered. */
  lastAnswer: AnsweredQuestion | null;
  score: number;
  currentStreak: number;
  bestStreak: number;
  secondsPerQuestion: number;
}

export class QuizEngine {
  private readonly questions: Question[];
  private readonly secondsPerQuestion: number;
  private readonly now: () => number;
  private readonly topicId: string;
  private readonly unitId: string | undefined;
  private readonly total: number;
  private readonly adaptive: AdaptivePicker | undefined;
  private readonly chooseNext: ((rest: readonly Question[]) => number) | undefined;

  private index = 0;
  private status: QuizStatus = 'asking';
  private readonly answers: AnsweredQuestion[] = [];
  private currentStreak = 0;
  private bestStreak = 0;
  private questionStartedAt: number;
  private readonly startedAt: number;
  private finishedAt: number | null = null;

  constructor(questions: readonly Question[], options: QuizEngineOptions = {}) {
    if (questions.length === 0) {
      throw new Error('QuizEngine needs at least one question.');
    }

    this.questions = [...questions];
    this.secondsPerQuestion = options.secondsPerQuestion ?? QUIZ_DEFAULTS.secondsPerQuestion;
    this.now = options.now ?? (() => Date.now());
    this.topicId = options.topicId ?? this.deriveTopicId();
    this.unitId = options.unitId ?? this.deriveUnitId();
    this.total = Math.max(1, Math.min(options.roundLength ?? this.questions.length, this.questions.length));
    this.adaptive = options.adaptive;
    this.chooseNext = options.adaptive && ((rest) => options.adaptive!.chooseNext(rest));
    promoteChoice(this.questions, 0, this.chooseNext);

    this.startedAt = this.now();
    this.questionStartedAt = this.startedAt;
  }

  private deriveTopicId(): string {
    const ids = new Set(this.questions.map((question) => question.topicId));
    return ids.size === 1 ? [...ids][0] : 'mixed';
  }

  private deriveUnitId(): string | undefined {
    const ids = new Set(this.questions.map((question) => question.unitId));
    return ids.size === 1 ? [...ids][0] : undefined;
  }

  /** Everything the UI needs for the current frame. */
  view(): QuizView {
    return {
      status: this.status,
      questionNumber: Math.min(this.index + 1, this.total),
      totalQuestions: this.total,
      question: this.questions[Math.min(this.index, this.total - 1)],
      lastAnswer: this.status === 'asking' ? null : (this.answers[this.answers.length - 1] ?? null),
      score: this.correctCount(),
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      secondsPerQuestion: this.secondsPerQuestion,
    };
  }

  /**
   * Records an answer. Pass `null` when the timer expired — that counts as wrong,
   * which is what keeps the timer honest.
   * Returns the recorded answer, or null if the current question was already answered.
   */
  answer(selectedAnswer: number | null): AnsweredQuestion | null {
    if (this.status !== 'asking') return null;

    const question = this.questions[this.index];
    const isCorrect = selectedAnswer !== null && selectedAnswer === question.correctAnswer;
    const timeTakenMs = Math.max(0, this.now() - this.questionStartedAt);

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
      timeTakenMs,
      xpEarned: isCorrect ? xpForCorrectAnswer(BASE_XP.quizCorrect, question.difficulty) : 0,
    };

    this.answers.push(recorded);
    this.adaptive?.record(question.difficulty, isCorrect, timeTakenMs / (this.secondsPerQuestion * 1000));
    this.status = 'feedback';
    return recorded;
  }

  /** Moves to the next question, or finishes the round. */
  next(): QuizStatus {
    if (this.status !== 'feedback') return this.status;

    if (this.index >= this.total - 1) {
      this.status = 'finished';
      this.finishedAt = this.now();
      return this.status;
    }

    this.index += 1;
    promoteChoice(this.questions, this.index, this.chooseNext);
    this.status = 'asking';
    this.questionStartedAt = this.now();
    return this.status;
  }

  /** Ends the round early — used when the student quits mid-quiz. */
  abandon(): void {
    if (this.status === 'finished') return;
    this.status = 'finished';
    this.finishedAt = this.now();
  }

  isFinished(): boolean {
    return this.status === 'finished';
  }

  private correctCount(): number {
    return this.answers.filter((answer) => answer.isCorrect).length;
  }

  /** Mixed rounds report 'mixed' rather than pretending to be one difficulty. */
  private roundDifficulty(): Difficulty | 'mixed' {
    const levels = new Set(this.answers.map((answer) => answer.difficulty));
    return levels.size === 1 ? ([...levels][0] as Difficulty) : 'mixed';
  }

  /** The standard result object, plus per-question detail for the review screen. */
  summary(): GameSummary {
    const attempted = this.answers.length;
    const correct = this.correctCount();
    const answerXp = this.answers.reduce((sum, answer) => sum + answer.xpEarned, 0);

    const xp = calculateRoundXp({
      answerXp,
      attempted,
      correct,
      bestStreak: this.bestStreak,
    });

    const endedAt = this.finishedAt ?? this.now();

    const result: GameResult = {
      gameType: 'quiz',
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

  /** XP breakdown for the results screen, so the reward is never a mystery number. */
  xpBreakdown(): ReturnType<typeof calculateRoundXp> {
    return calculateRoundXp({
      answerXp: this.answers.reduce((sum, answer) => sum + answer.xpEarned, 0),
      attempted: this.answers.length,
      correct: this.correctCount(),
      bestStreak: this.bestStreak,
    });
  }
}
