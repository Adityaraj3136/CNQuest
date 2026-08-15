/**
 * Topic detail — revision notes, definitions, examples and practice entry points.
 * Mastery and attempt statistics are wired up in Phase 9.
 */

import type { Page, PageContext } from '@/types/page';
import { getDictionary, getQuestions, getTopic, getUnit } from '@/services/content.service';
import { loadTopicProgress } from '@/services/progress-report.service';
import { masteryBand } from '@/services/mastery.logic';
import { escapeHtml, qs } from '@/utils/dom';
import { loaderHtml, stateHtml } from '@/components/loader';
import { editAffordanceHtml } from '@/components/edit-affordance';
import type { DictionaryTerm, Question, Topic, Unit } from '@/models/content';
import type { UserProgress } from '@/models/progress';
import '@/styles/learn.css';

const ROOT_ID = 'cn-topic-root';

function difficultyBreakdown(questions: Question[]): string {
  return (['easy', 'medium', 'hard'] as const)
    .map((difficulty) => {
      const count = questions.filter((question) => question.difficulty === difficulty).length;
      return `<span class="cn-chip cn-chip--${difficulty}">${count} ${difficulty}</span>`;
    })
    .join('');
}

function relatedTermsHtml(topic: Topic, dictionary: DictionaryTerm[]): string {
  const ids = topic.relatedTerms ?? [];
  const terms = ids
    .map((id) => dictionary.find((entry) => entry.id === id))
    .filter((entry): entry is DictionaryTerm => Boolean(entry));

  if (terms.length === 0) return '';

  return `
    <div class="cn-topic__block">
      <h2>Related terminology</h2>
      <ul class="cn-termlist">
        ${terms
          .map(
            (term) =>
              `<li><a class="cn-chip" href="#/dictionary?term=${encodeURIComponent(term.id)}">${escapeHtml(term.term)}</a></li>`,
          )
          .join('')}
      </ul>
    </div>
  `;
}

function bodyHtml(
  topic: Topic,
  unit: Unit | null,
  questions: Question[],
  dictionary: DictionaryTerm[],
  progress: UserProgress | null,
): string {
  return `
    <div class="cn-container cn-topic">
      <article class="cn-rise cn-rise-1">
        <p class="cn-topic__breadcrumb">
          <a href="#/learn">Learn</a>
          ${unit ? ` / <a href="#/learn#unit-${escapeHtml(unit.id)}">Unit ${String(unit.number).padStart(2, '0')} · ${escapeHtml(unit.title)}</a>` : ''}
        </p>
        <h1 class="cn-topic__title">${escapeHtml(topic.title)}</h1>
        <p class="cn-topic__overview">${escapeHtml(topic.overview)}</p>

        <section class="cn-topic__block" style="margin-top: var(--cn-space-7)">
          <h2>Key points</h2>
          <ul class="cn-keypoints">
            ${topic.keyPoints
              .map(
                (point, index) =>
                  `<li data-n="${String(index + 1).padStart(2, '0')}"><span>${escapeHtml(point)}</span></li>`,
              )
              .join('')}
          </ul>
        </section>

        <section class="cn-topic__block">
          <h2>Important definitions</h2>
          <dl class="cn-deflist">
            ${topic.definitions
              .map(
                (definition) => `
                  <div class="cn-deflist__row">
                    <dt class="cn-deflist__term">${escapeHtml(definition.term)}</dt>
                    <dd class="cn-deflist__meaning mb-0">${escapeHtml(definition.meaning)}</dd>
                  </div>`,
              )
              .join('')}
          </dl>
        </section>

        ${
          topic.examples && topic.examples.length > 0
            ? `<section class="cn-topic__block">
                 <h2>Examples</h2>
                 <div class="cn-stack">
                   ${topic.examples.map((example) => `<p class="cn-example">${escapeHtml(example)}</p>`).join('')}
                 </div>
               </section>`
            : ''
        }

        ${relatedTermsHtml(topic, dictionary)}
      </article>

      <aside class="cn-topic__aside cn-rise cn-rise-2">
        <section>
          <h2>Your mastery</h2>
          <div class="cn-progress cn-progress--accent">
            <div class="cn-progress__bar" style="width: ${progress?.mastery ?? 0}%"></div>
          </div>
          ${
            progress && progress.attempted > 0
              ? `<p class="cn-ink-soft mb-0" style="font-size: var(--cn-text-xs)">
                   ${progress.mastery}% · ${escapeHtml(masteryBand(progress.mastery))} ·
                   ${progress.correct}/${progress.attempted} correct (${progress.accuracy}%)
                 </p>`
              : `<p class="cn-ink-soft mb-0" style="font-size: var(--cn-text-xs)">
                   Not started — play a round on this topic to begin tracking mastery.
                 </p>`
          }
        </section>

        <section>
          <h2>Practice · ${questions.length} questions</h2>
          <div class="cn-termlist">${difficultyBreakdown(questions)}</div>
          <div class="cn-topic__actions">
            <a class="btn btn-cn-primary" href="#/games/quiz?topic=${encodeURIComponent(topic.id)}">
              <i class="bi bi-lightning-charge" aria-hidden="true"></i> Start Quiz Blitz
            </a>
            <a class="btn btn-cn-ghost" href="#/games?topic=${encodeURIComponent(topic.id)}">
              All game modes
            </a>
          </div>
        </section>

        <section>
          <h2>Study time</h2>
          <p class="cn-ink-soft mb-0" style="font-size: var(--cn-text-sm)">
            About ${topic.estimatedMinutes} minutes to read and revise.
          </p>
        </section>
      </aside>
    </div>
  `;
}

const topicPage: Page = {
  title: 'Topic',

  render() {
    return `<section id="${ROOT_ID}"><div class="cn-container">${loaderHtml('Loading topic')}</div></section>`;
  },

  async mount(ctx: PageContext) {
    const root = qs(`#${ROOT_ID}`);
    if (!root) return;

    try {
      const topic = await getTopic(ctx.params.topicId);

      if (!topic) {
        root.innerHTML = `<div class="cn-container">${stateHtml({
          icon: 'bi-journal-x',
          title: 'Topic not found',
          message: 'That topic does not exist in the current syllabus.',
          actionLabel: 'Browse all topics',
          actionHref: '#/learn',
        })}</div>`;
        return;
      }

      const [unit, questions, dictionary, progress] = await Promise.all([
        getUnit(topic.unitId),
        getQuestions({ topicId: topic.id }),
        getDictionary(),
        loadTopicProgress(topic.id),
      ]);

      this.title = topic.title;
      document.title = `${topic.title} · CN Quest`;
      root.innerHTML =
        bodyHtml(topic, unit, questions, dictionary, progress) +
        editAffordanceHtml({ collection: 'topics', id: topic.id, label: 'topic' });
    } catch (error) {
      console.error('[topic] failed to load', error);
      root.innerHTML = `<div class="cn-container">${stateHtml({
        icon: 'bi-exclamation-triangle',
        title: "We couldn't load this topic",
        message: 'Check your connection or try again in a moment.',
        actionLabel: 'Back to Learn',
        actionHref: '#/learn',
      })}</div>`;
    }
  },
};

export default topicPage;
