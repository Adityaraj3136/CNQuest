/**
 * Boss Battle — trade damage with a networking boss by answering its questions.
 *
 * Correct answers damage the boss (harder question, harder hit); wrong answers cost the
 * student HP. The round ends when either side reaches zero.
 */

import type { Boss, Difficulty, Question } from '../../models/content.ts';
import type { AnsweredQuestion, GameResult, GameSummary } from '../../models/game.ts';
import { BASE_XP, calculateRoundXp, xpForCorrectAnswer } from '../../config/xp.config.ts';

/** Damage dealt to the boss for a correct answer, by question difficulty. */
export const BOSS_DAMAGE: Record<Difficulty, number> = {
  easy: 10,
  medium: 15,
  hard: 20,
};

/** Damage the student takes for a wrong answer or a timeout. */
export const PLAYER_DAMAGE = 10;

export type BossStatus = 'fighting' | 'feedback' | 'victory' | 'defeat';

export interface BossView {
  boss: Boss;
  status: BossStatus;
  bossHp: number;
  bossMaxHp: number;
  playerHp: number;
  playerMaxHp: number;
  bossHpPercent: number;
  playerHpPercent: number;
  question: Question;
  questionNumber: number;
  lastAnswer: AnsweredQuestion | null;
  lastDamage: number;
  currentStreak: number;
}

export interface BossOptions {
  now?: () => number;
}

export class BossEngine {
  private readonly boss: Boss;
  private readonly questions: Question[];
  private readonly now: () => number;
  private readonly startedAt: number;

  private index = 0;
  private status: BossStatus = 'fighting';
  private bossHp: number;
  private playerHp: number;
  private lastDamage = 0;
  private readonly answers: AnsweredQuestion[] = [];
  private currentStreak = 0;
  private bestStreak = 0;
  private finishedAt: number | null = null;

  constructor(boss: Boss, questions: readonly Question[], options: BossOptions = {}) {
    if (questions.length === 0) throw new Error('BossEngine needs at least one question.');

    this.boss = boss;
    this.questions = [...questions];
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
    this.bossHp = boss.hp;
    this.playerHp = boss.playerHp;
  }

  view(): BossView {
    return {
      boss: this.boss,
      status: this.status,
      bossHp: this.bossHp,
      bossMaxHp: this.boss.hp,
      playerHp: this.playerHp,
      playerMaxHp: this.boss.playerHp,
      bossHpPercent: Math.round((this.bossHp / this.boss.hp) * 100),
      playerHpPercent: Math.round((this.playerHp / this.boss.playerHp) * 100),
      question: this.questions[Math.min(this.index, this.questions.length - 1)],
      questionNumber: this.answers.length + (this.status === 'fighting' ? 1 : 0),
      lastAnswer: this.answers.at(-1) ?? null,
      lastDamage: this.lastDamage,
      currentStreak: this.currentStreak,
    };
  }

  isOver(): boolean {
    return this.status === 'victory' || this.status === 'defeat';
  }

  /** Answers the current question and applies damage. `null` means the timer expired. */
  answer(selectedAnswer: number | null): AnsweredQuestion | null {
    if (this.status !== 'fighting') return null;

    const question = this.questions[this.index];
    const isCorrect = selectedAnswer !== null && selectedAnswer === question.correctAnswer;

    if (isCorrect) {
      this.lastDamage = BOSS_DAMAGE[question.difficulty];
      this.bossHp = Math.max(0, this.bossHp - this.lastDamage);
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.lastDamage = PLAYER_DAMAGE;
      this.playerHp = Math.max(0, this.playerHp - this.lastDamage);
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
      timeTakenMs: 0,
      xpEarned: isCorrect ? xpForCorrectAnswer(BASE_XP.quizCorrect, question.difficulty) : 0,
    };

    this.answers.push(recorded);
    this.status = 'feedback';
    return recorded;
  }

  /** Advances to the next question, or ends the battle. */
  next(): BossStatus {
    if (this.status !== 'feedback') return this.status;

    if (this.bossHp <= 0) return this.finish('victory');
    if (this.playerHp <= 0) return this.finish('defeat');

    // Running out of questions with the boss still standing is a defeat, not a hang.
    if (this.index >= this.questions.length - 1) return this.finish('defeat');

    this.index += 1;
    this.status = 'fighting';
    return this.status;
  }

  private finish(status: 'victory' | 'defeat'): BossStatus {
    this.status = status;
    this.finishedAt = this.now();
    return status;
  }

  /** Fleeing the battle counts as a defeat — no XP farming by quitting on a bad run. */
  flee(): void {
    if (this.isOver()) return;
    this.finish('defeat');
  }

  isVictory(): boolean {
    return this.status === 'victory';
  }

  xpBreakdown(): ReturnType<typeof calculateRoundXp> {
    const correct = this.answers.filter((answer) => answer.isCorrect).length;
    const answerXp =
      this.answers.reduce((sum, answer) => sum + answer.xpEarned, 0) +
      (this.isVictory() ? BASE_XP.bossVictory : 0);

    return calculateRoundXp({
      answerXp,
      attempted: this.answers.length,
      correct,
      bestStreak: this.bestStreak,
    });
  }

  summary(): GameSummary {
    const attempted = this.answers.length;
    const correct = this.answers.filter((answer) => answer.isCorrect).length;
    const xp = this.xpBreakdown();
    const endedAt = this.finishedAt ?? this.now();

    const topicIds = new Set(this.answers.map((_, i) => this.questions[i].topicId));

    const result: GameResult = {
      gameType: 'boss',
      topicId: topicIds.size === 1 ? [...topicIds][0] : 'mixed',
      unitId: this.boss.unitId,
      attempted,
      correct,
      wrong: attempted - correct,
      score: correct,
      accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
      xpEarned: xp.total,
      durationSeconds: Math.max(0, Math.round((endedAt - this.startedAt) / 1000)),
      difficulty: 'mixed',
      bestStreak: this.bestStreak,
    };

    return { result, answers: [...this.answers] };
  }
}
