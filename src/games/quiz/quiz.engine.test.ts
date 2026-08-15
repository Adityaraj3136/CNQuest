/**
 * Quiz Blitz engine self-checks. Run with: npm run test:units
 *
 * These cover the rules a player would notice if they broke: scoring, streaks, the
 * timeout-counts-as-wrong rule, XP totals, and the shape of the produced GameResult.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { QuizEngine } from './quiz.engine.ts';
import { BASE_XP, DIFFICULTY_BONUS, ROUND_BONUS, calculateRoundXp } from '../../config/xp.config.ts';
import type { Difficulty, Question } from '../../models/content.ts';

function makeQuestion(id: string, correctAnswer = 0, difficulty: Difficulty = 'easy'): Question {
  return {
    id,
    unitId: 'unit-1',
    topicId: 'osi-model',
    question: `Question ${id}?`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer,
    explanation: 'Because that is how it works.',
    difficulty,
    gameTypes: ['quiz'],
  };
}

/** Controllable clock so duration assertions are deterministic. */
function fakeClock(startMs = 0) {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

/** Plays a whole round, answering correctly where `correct[i]` is true. */
function play(engine: QuizEngine, correct: boolean[]): void {
  for (const shouldBeCorrect of correct) {
    const { question } = engine.view();
    const wrongOption = (question.correctAnswer + 1) % question.options.length;
    engine.answer(shouldBeCorrect ? question.correctAnswer : wrongOption);
    engine.next();
  }
}

const threeQuestions = [makeQuestion('a'), makeQuestion('b', 2), makeQuestion('c', 3)];

test('a new round starts on question 1 with a clean score', () => {
  const view = new QuizEngine(threeQuestions).view();

  assert.equal(view.status, 'asking');
  assert.equal(view.questionNumber, 1);
  assert.equal(view.totalQuestions, 3);
  assert.equal(view.score, 0);
  assert.equal(view.lastAnswer, null);
});

test('an empty question set is rejected rather than rendering a broken round', () => {
  assert.throws(() => new QuizEngine([]), /at least one question/);
});

test('a correct answer scores, and a wrong answer does not', () => {
  const engine = new QuizEngine(threeQuestions);

  const first = engine.answer(0);
  assert.equal(first?.isCorrect, true);
  assert.equal(engine.view().score, 1);

  engine.next();
  const second = engine.answer(0); // correct is 2
  assert.equal(second?.isCorrect, false);
  assert.equal(engine.view().score, 1);
});

test('a timeout is recorded as an unanswered wrong answer', () => {
  const engine = new QuizEngine(threeQuestions);
  const answer = engine.answer(null);

  assert.equal(answer?.selectedAnswer, null);
  assert.equal(answer?.isCorrect, false);
  assert.equal(answer?.xpEarned, 0);
});

test('the same question cannot be answered twice', () => {
  const engine = new QuizEngine(threeQuestions);

  assert.ok(engine.answer(0));
  assert.equal(engine.answer(1), null, 'a second answer must be ignored');
  assert.equal(engine.summary().result.attempted, 1);
});

test('next() only advances from the feedback state', () => {
  const engine = new QuizEngine(threeQuestions);

  assert.equal(engine.next(), 'asking', 'cannot skip an unanswered question');
  assert.equal(engine.view().questionNumber, 1);

  engine.answer(0);
  assert.equal(engine.next(), 'asking');
  assert.equal(engine.view().questionNumber, 2);
});

test('the round finishes after the last question', () => {
  const engine = new QuizEngine(threeQuestions);
  play(engine, [true, true, true]);

  assert.equal(engine.isFinished(), true);
  assert.equal(engine.view().status, 'finished');
});

test('streaks reset on a wrong answer and the best run is remembered', () => {
  const questions = Array.from({ length: 6 }, (_, i) => makeQuestion(`q${i}`));
  const engine = new QuizEngine(questions);

  play(engine, [true, true, false, true, true, true]);

  const { result } = engine.summary();
  assert.equal(result.bestStreak, 3, 'the later run of 3 is the best');
  assert.equal(result.correct, 5);
  assert.equal(result.wrong, 1);
});

test('harder questions are worth more XP per correct answer', () => {
  const engine = new QuizEngine([
    makeQuestion('easy', 0, 'easy'),
    makeQuestion('medium', 0, 'medium'),
    makeQuestion('hard', 0, 'hard'),
  ]);

  const easy = engine.answer(0);
  engine.next();
  const medium = engine.answer(0);
  engine.next();
  const hard = engine.answer(0);

  assert.equal(easy?.xpEarned, BASE_XP.quizCorrect + DIFFICULTY_BONUS.easy);
  assert.equal(medium?.xpEarned, BASE_XP.quizCorrect + DIFFICULTY_BONUS.medium);
  assert.equal(hard?.xpEarned, BASE_XP.quizCorrect + DIFFICULTY_BONUS.hard);
});

test('a perfect round earns the answer XP plus every bonus', () => {
  const questions = Array.from({ length: 5 }, (_, i) => makeQuestion(`q${i}`));
  const engine = new QuizEngine(questions);
  play(engine, [true, true, true, true, true]);

  const breakdown = engine.xpBreakdown();
  const expectedAnswerXp = 5 * BASE_XP.quizCorrect;

  assert.equal(breakdown.answerXp, expectedAnswerXp);
  assert.equal(breakdown.perfectBonus, ROUND_BONUS.perfectRound);
  assert.equal(breakdown.accuracyBonus, 20, '100% accuracy hits the top tier');
  assert.equal(breakdown.streakBonus, 15, 'a run of 5 hits the middle streak tier');
  assert.equal(engine.summary().result.xpEarned, breakdown.total);
});

test('a round with no correct answers earns nothing', () => {
  const engine = new QuizEngine(threeQuestions);
  play(engine, [false, false, false]);

  const { result } = engine.summary();
  assert.equal(result.xpEarned, 0);
  assert.equal(result.accuracy, 0);
  assert.equal(result.correct, 0);
});

test('the result reports accuracy, duration and difficulty', () => {
  const clock = fakeClock(1_000);
  const engine = new QuizEngine(
    [makeQuestion('a', 0, 'easy'), makeQuestion('b', 0, 'hard'), makeQuestion('c', 0, 'easy')],
    { now: clock.now },
  );

  clock.advance(4_000);
  engine.answer(0);
  engine.next();
  clock.advance(3_000);
  engine.answer(1); // wrong
  engine.next();
  clock.advance(5_000);
  engine.answer(0);
  engine.next();

  const { result, answers } = engine.summary();

  assert.equal(result.gameType, 'quiz');
  assert.equal(result.topicId, 'osi-model');
  assert.equal(result.unitId, 'unit-1');
  assert.equal(result.attempted, 3);
  assert.equal(result.correct, 2);
  assert.equal(result.accuracy, 67, '2/3 rounds to 67%');
  assert.equal(result.durationSeconds, 12);
  assert.equal(result.difficulty, 'mixed');
  assert.equal(answers.length, 3);
  assert.equal(answers[1].isCorrect, false);
});

test('a single-difficulty round reports that difficulty, not "mixed"', () => {
  const engine = new QuizEngine([makeQuestion('a', 0, 'hard'), makeQuestion('b', 0, 'hard')]);
  play(engine, [true, false]);

  assert.equal(engine.summary().result.difficulty, 'hard');
});

test('a round spanning topics reports topicId "mixed"', () => {
  const engine = new QuizEngine([
    { ...makeQuestion('a'), topicId: 'osi-model' },
    { ...makeQuestion('b'), topicId: 'subnetting' },
  ]);
  play(engine, [true, true]);

  assert.equal(engine.summary().result.topicId, 'mixed');
});

test('abandoning mid-round still produces a valid result for what was answered', () => {
  const engine = new QuizEngine(Array.from({ length: 10 }, (_, i) => makeQuestion(`q${i}`)));
  play(engine, [true, true]);
  engine.abandon();

  const { result } = engine.summary();
  assert.equal(engine.isFinished(), true);
  assert.equal(result.attempted, 2, 'unasked questions are not counted as wrong');
  assert.equal(result.accuracy, 100);
});

test('calculateRoundXp awards no bonuses for an empty round', () => {
  const breakdown = calculateRoundXp({ answerXp: 0, attempted: 0, correct: 0, bestStreak: 0 });

  assert.equal(breakdown.total, 0);
  assert.equal(breakdown.perfectBonus, 0, '0 of 0 is not a perfect round');
});
