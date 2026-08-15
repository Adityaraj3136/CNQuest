/**
 * Learn — unit and topic browser.
 * Mastery percentages arrive with ProgressService in Phase 9; the layout already reserves room.
 */

import type { Page } from '@/types/page';
import { getQuestions, getSyllabus, contentSource } from '@/services/content.service';
import { escapeHtml, qs } from '@/utils/dom';
import { loaderHtml, stateHtml } from '@/components/loader';
import type { Topic, Unit } from '@/models/content';
import '@/styles/learn.css';

const ROOT_ID = 'cn-learn-root';

function topicRowHtml(topic: Topic, index: number, questionCount: number): string {
  return `
    <a class="cn-topic-row" href="#/learn/${escapeHtml(topic.id)}">
      <span class="cn-topic-row__index">${String(index + 1).padStart(2, '0')}</span>
      <h3 class="cn-topic-row__title">${escapeHtml(topic.title)}</h3>
      <p class="cn-topic-row__desc">${escapeHtml(topic.description)}</p>
      <span class="cn-topic-row__meta">
        <span class="cn-chip">${topic.estimatedMinutes} min</span>
        <span class="cn-chip">${questionCount} Q</span>
      </span>
    </a>
  `;
}

function unitHtml(unit: Unit, topics: Topic[], countFor: (topicId: string) => number): string {
  return `
    <section class="cn-unit" id="unit-${escapeHtml(unit.id)}" aria-labelledby="unit-${escapeHtml(unit.id)}-title">
      <header class="cn-unit__head">
        <span class="cn-unit__number">${String(unit.number).padStart(2, '0')}</span>
        <h2 class="cn-unit__title" id="unit-${escapeHtml(unit.id)}-title">${escapeHtml(unit.title)}</h2>
        <p class="cn-unit__desc">${escapeHtml(unit.description)}</p>
      </header>
      <div class="cn-topic-list">
        ${topics.map((topic, index) => topicRowHtml(topic, index, countFor(topic.id))).join('')}
      </div>
    </section>
  `;
}

async function bodyHtml(): Promise<string> {
  const [syllabus, questions] = await Promise.all([getSyllabus(), getQuestions()]);

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

  const topicTotal = syllabus.reduce((sum, entry) => sum + entry.topics.length, 0);

  return `
    <header class="cn-learn__head cn-rise cn-rise-1">
      <div>
        <span class="cn-label cn-label--marked">Computer Networks</span>
        <h1 class="cn-section__title mt-2">Syllabus</h1>
        <p class="cn-label mt-2">
          ${syllabus.length} units · ${topicTotal} topics · ${questions.length} questions
        </p>
      </div>
      <span class="cn-chip">
        <i class="bi ${contentSource() === 'firestore' ? 'bi-cloud-check' : 'bi-hdd'}" aria-hidden="true"></i>
        ${contentSource() === 'firestore' ? 'Live content' : 'Offline content'}
      </span>
    </header>

    ${syllabus
      .map(({ unit, topics }) => unitHtml(unit, topics, (topicId) => counts.get(topicId) ?? 0))
      .join('')}
  `;
}

const learnPage: Page = {
  title: 'Learn',

  render() {
    return `
      <section class="cn-learn">
        <div class="cn-container" id="${ROOT_ID}">${loaderHtml('Loading the syllabus')}</div>
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
