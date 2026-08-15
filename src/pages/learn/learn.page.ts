/**
 * Learn — the quest line.
 *
 * Previously a table of topics with identical rows, which told a student what existed but
 * never what to do. Each unit is now a chapter with its own progress, and each topic a
 * numbered quest carrying one of four states, so the next move is visible without reading.
 */

import type { Page } from '@/types/page';
import { getQuestions, getSyllabus } from '@/services/content.service';
import { activeStore } from '@/services/progress.store';
import { rankUnitQuests, summariseUnit } from '@/services/quest.logic';
import type { QuestState, QuestTopic, RankedQuest } from '@/services/quest.logic';
import { escapeHtml, qs } from '@/utils/dom';
import { loaderHtml, stateHtml } from '@/components/loader';
import type { Unit } from '@/models/content';
import '@/styles/learn.css';

const ROOT_ID = 'cn-learn-root';

const STATE_ICON: Record<QuestState, string> = {
  completed: 'bi-check-lg',
  current: 'bi-play-fill',
  available: 'bi-circle',
  locked: 'bi-lock',
};

const STATE_LABEL: Record<QuestState, string> = {
  completed: 'Completed',
  current: 'Continue',
  available: 'Start',
  locked: 'Not started',
};

function questHtml(quest: RankedQuest): string {
  return `
    <a class="cn-quest" href="#/learn/${escapeHtml(quest.id)}" data-state="${quest.state}">
      <span class="cn-quest__marker" aria-hidden="true">
        <i class="bi ${STATE_ICON[quest.state]}"></i>
      </span>

      <span class="cn-quest__body">
        <span class="cn-quest__number">Quest ${String(quest.number).padStart(2, '0')}</span>
        <span class="cn-quest__title">${escapeHtml(quest.title)}</span>
        <span class="cn-quest__meta">
          ${quest.estimatedMinutes} min · ${quest.questionCount} questions · +${quest.rewardXp} XP
        </span>
      </span>

      <span class="cn-quest__state">
        ${quest.state === 'completed' ? `${quest.mastery}%` : escapeHtml(STATE_LABEL[quest.state])}
      </span>
    </a>
  `;
}

function unitHtml(unit: Unit, quests: RankedQuest[], summary: ReturnType<typeof summariseUnit>): string {
  return `
    <section class="cn-unit" id="unit-${escapeHtml(unit.id)}" aria-labelledby="unit-${escapeHtml(unit.id)}-title">
      <header class="cn-unit__head">
        <div class="cn-unit__heading">
          <span class="cn-unit__number">${String(unit.number).padStart(2, '0')}</span>
          <h2 class="cn-unit__title" id="unit-${escapeHtml(unit.id)}-title">${escapeHtml(unit.title)}</h2>
          ${summary.mastered ? '<span class="cn-unit__badge">Mastered</span>' : ''}
        </div>

        <p class="cn-unit__desc">${escapeHtml(unit.description)}</p>

        <div class="cn-unit__meter">
          <div class="cn-unit__bar" data-mastered="${summary.mastered}">
            <span style="width:${summary.mastery}%"></span>
          </div>
          <span class="cn-unit__stats">
            ${summary.completedCount}/${summary.questCount} quests · ${summary.mastery}% mastery
          </span>
        </div>
      </header>

      <div class="cn-quest-line">${quests.map(questHtml).join('')}</div>
    </section>
  `;
}

async function bodyHtml(): Promise<string> {
  const [syllabus, questions, progress] = await Promise.all([
    getSyllabus(),
    getQuestions(),
    activeStore()?.loadAllProgress() ?? Promise.resolve([]),
  ]);

  if (syllabus.length === 0) {
    return stateHtml({
      icon: 'bi-journal-x',
      title: 'No topics available',
      message: 'The syllabus could not be loaded. Check your connection and try again.',
      actionLabel: 'Back to dashboard',
      actionHref: '#/dashboard',
    });
  }

  const counts = new Map<string, number>();
  for (const question of questions) {
    counts.set(question.topicId, (counts.get(question.topicId) ?? 0) + 1);
  }

  const masteryByTopic: Record<string, number> = {};
  for (const entry of progress) masteryByTopic[entry.topicId] = entry.mastery;

  const units = syllabus.map(({ unit, topics }) => {
    const questTopics: QuestTopic[] = topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      estimatedMinutes: topic.estimatedMinutes,
      questionCount: counts.get(topic.id) ?? 0,
    }));

    const summary = summariseUnit(questTopics, masteryByTopic);
    const quests = rankUnitQuests(questTopics, masteryByTopic, { unitStarted: summary.started });
    return { unit, quests, summary };
  });

  const totalQuests = units.reduce((sum, entry) => sum + entry.summary.questCount, 0);
  const doneQuests = units.reduce((sum, entry) => sum + entry.summary.completedCount, 0);

  return `
    <header class="cn-learn__head cn-rise cn-rise-1">
      <h1 class="cn-learn__title">Your quest line</h1>
      <p class="cn-learn__sub">
        ${doneQuests} of ${totalQuests} quests complete across ${units.length} units.
      </p>
    </header>

    ${units.map(({ unit, quests, summary }) => unitHtml(unit, quests, summary)).join('')}
  `;
}

const learnPage: Page = {
  title: 'Learn',

  render() {
    return `
      <section class="cn-learn">
        <div class="cn-container" id="${ROOT_ID}">${loaderHtml('Loading your quests')}</div>
      </section>
    `;
  },

  async mount() {
    const root = qs(`#${ROOT_ID}`);
    if (!root) return;

    try {
      root.innerHTML = await bodyHtml();
    } catch (error) {
      console.error('[learn] failed to load syllabus', error);
      root.innerHTML = stateHtml({
        icon: 'bi-exclamation-triangle',
        title: "We couldn't load the syllabus",
        message: 'Check your connection or try again in a moment.',
        actionLabel: 'Back to dashboard',
        actionHref: '#/dashboard',
      });
    }
  },
};

export default learnPage;
