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
import { lessonPosition } from '@/services/lesson-nav.logic';
import { questReward } from '@/services/quest.logic';
import type { LessonPosition } from '@/services/lesson-nav.logic';
import { getSyllabus } from '@/services/content.service';
import { activeStore } from '@/services/progress.store';
import type { DictionaryTerm, Question, Topic, Unit } from '@/models/content';
import type { UserProgress } from '@/models/progress';
import '@/styles/learn.css';

const ROOT_ID = 'cn-topic-root';

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

/**
 * Where this quest sits in its unit, shown as a row of nodes.
 *
 * The completed / current / ahead states come from mastery, so the strip answers "where am I"
 * without the student going back to Learn to find out.
 */
function questStripHtml(position: LessonPosition, topicId: string, mastered: ReadonlySet<string>): string {
  return `
    <nav class="cn-lesson__quests" aria-label="Quests in this unit">
      <p class="cn-lesson__unitline">
        Unit ${String(position.unit.number).padStart(2, '0')} · ${escapeHtml(position.unit.title)}
        <span>Quest ${position.index} of ${position.total}</span>
      </p>

      <ol class="cn-questline">
        ${position.siblings
          .map((sibling) => {
            const state =
              sibling.id === topicId ? 'current' : mastered.has(sibling.id) ? 'done' : 'ahead';
            return `
              <li class="cn-questline__item" data-state="${state}">
                <a href="#/learn/${escapeHtml(sibling.id)}">
                  <span class="cn-questline__node" aria-hidden="true"></span>
                  <span class="cn-questline__label">${escapeHtml(sibling.title)}</span>
                </a>
              </li>`;
          })
          .join('')}
      </ol>
    </nav>
  `;
}

/** The one line of metadata worth showing above the fold. */
function metaHtml(topic: Topic, questions: Question[], mastery: number): string {
  const state = mastery === 0 ? 'Not measured' : mastery >= 80 ? 'Mastered' : `${Math.round(mastery)}% mastered`;

  return `
    <p class="cn-lesson__meta">
      <span>${topic.estimatedMinutes} min read</span>
      <span>${questions.length} practice questions</span>
      <span>${escapeHtml(state)}</span>
    </p>
  `;
}

/**
 * The lesson companion.
 *
 * Everything here answers a question a student has mid-lesson: how far through the unit am I,
 * what do I know about this topic, and what do I do when I finish reading. Nothing repeats
 * what the page already says.
 */
function companionHtml(
  topic: Topic,
  position: LessonPosition,
  questions: Question[],
  progress: UserProgress | null,
): string {
  const mastery = progress?.mastery ?? 0;
  const unitPercent = Math.round(((position.index - 1) / position.total) * 100);

  const easy = questions.filter((question) => question.difficulty === 'easy').length;
  const medium = questions.filter((question) => question.difficulty === 'medium').length;
  const hard = questions.filter((question) => question.difficulty === 'hard').length;

  return `
    <aside class="cn-companion">
      <section class="cn-companion__block">
        <p class="cn-companion__label">Unit progress</p>
        <div class="cn-companion__bar"><span style="width:${unitPercent}%"></span></div>
        <p class="cn-companion__value">Quest ${position.index} of ${position.total}</p>
      </section>

      <section class="cn-companion__block">
        <p class="cn-companion__label">Your mastery</p>
        ${
          mastery === 0
            ? `<p class="cn-companion__value">Not measured yet</p>
               <p class="cn-companion__hint">Play one round to establish it.</p>`
            : `<p class="cn-companion__mastery" data-mastered="${mastery >= 80}">
                 ${Math.round(mastery)}%<span>${masteryBand(mastery)}</span>
               </p>`
        }
      </section>

      <section class="cn-companion__block">
        <p class="cn-companion__label">Practice</p>
        <p class="cn-companion__value">${questions.length} questions</p>
        <p class="cn-companion__hint">${easy} easy · ${medium} medium · ${hard} hard</p>
        <a class="btn btn-cn-ghost btn-sm cn-companion__cta"
           href="#/games/quiz?topic=${encodeURIComponent(topic.id)}">
          Start topic challenge
        </a>
      </section>
    </aside>
  `;
}

/** The end of the lesson: one obvious action, with the alternative kept quiet. */
function practiceHtml(topic: Topic, questions: Question[]): string {
  const minutes = Math.max(1, Math.round(questions.length * 0.35));

  return `
    <section class="cn-lesson__practice">
      <h2>Ready to test yourself?</h2>
      <p>${questions.length} questions, about ${minutes} min. Reward +${questReward(questions.length)} XP.</p>

      <div class="cn-lesson__practice-actions">
        <a class="btn btn-cn-primary" href="#/games/quiz?topic=${encodeURIComponent(topic.id)}">
          Start topic challenge
        </a>
        <a class="cn-lesson__alt" href="#/games?topic=${encodeURIComponent(topic.id)}">
          Choose another mode
        </a>
      </div>
    </section>
  `;
}

/**
 * Previous and next, always both present.
 *
 * A student who reaches the bottom of a lesson must never have to go back to the syllabus to
 * carry on, so both sides always carry a destination even at the ends of the syllabus.
 */
function lessonNavHtml(position: LessonPosition): string {
  const link = (neighbour: LessonPosition['previous'], direction: 'prev' | 'next'): string => `
    <a class="cn-lessonnav__link" data-dir="${direction}" href="${escapeHtml(neighbour.href)}">
      <span class="cn-lessonnav__caption">
        ${direction === 'prev' ? '<i class="bi bi-arrow-left" aria-hidden="true"></i>' : ''}
        ${escapeHtml(neighbour.caption)}
        ${direction === 'next' ? '<i class="bi bi-arrow-right" aria-hidden="true"></i>' : ''}
      </span>
      <span class="cn-lessonnav__label">${escapeHtml(neighbour.label)}</span>
    </a>
  `;

  return `
    <nav class="cn-lessonnav" aria-label="Lesson navigation">
      ${link(position.previous, 'prev')}
      ${link(position.next, 'next')}
    </nav>
  `;
}

function bodyHtml(
  topic: Topic,
  unit: Unit | null,
  questions: Question[],
  dictionary: DictionaryTerm[],
  progress: UserProgress | null,
  position: LessonPosition | null,
  mastered: ReadonlySet<string>,
): string {
  return `
    <div class="cn-reading" id="cn-read-progress" aria-hidden="true"><span></span></div>

    <div class="cn-container cn-topic">
      <article class="cn-lesson__article cn-rise cn-rise-1">
        <p class="cn-topic__breadcrumb">
          <a href="#/learn">Learn</a>
          ${unit ? ` <span aria-hidden="true">/</span> <a href="#/learn#unit-${escapeHtml(unit.id)}">${escapeHtml(unit.title)}</a>` : ''}
        </p>

        ${position ? questStripHtml(position, topic.id, mastered) : ''}

        <h1 class="cn-topic__title">${escapeHtml(topic.title)}</h1>
        ${metaHtml(topic, questions, progress?.mastery ?? 0)}
        ${
          topic.hook
            ? `<p class="cn-topic__hook">${escapeHtml(topic.hook)}</p>`
            : ''
        }
        ${topic.overview
            .split(/\n\n+/)
            .map((para) => para.trim())
            .filter(Boolean)
            .map((para) => `<p class="cn-topic__overview">${escapeHtml(para)}</p>`)
            .join('')}

        ${
          topic.media
            ? `<figure class="cn-lesson__figure">
                 <img src="${escapeHtml(topic.media.url)}" alt="${escapeHtml(topic.media.caption)}"
                      loading="lazy" decoding="async" />
                 <figcaption>${escapeHtml(topic.media.caption)}</figcaption>
               </figure>`
            : ''
        }

        <section class="cn-topic__block" style="margin-top: var(--cn-space-7)">
          <h2>What you should know</h2>
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

        ${
          topic.pitfalls && topic.pitfalls.length > 0
            ? `<section class="cn-topic__block cn-pitfalls">
                 <h2>Where marks get lost</h2>
                 <ul class="cn-pitfalls__list">
                   ${topic.pitfalls.map((pitfall) => `<li>${escapeHtml(pitfall)}</li>`).join('')}
                 </ul>
               </section>`
            : ''
        }

        ${relatedTermsHtml(topic, dictionary)}

        ${practiceHtml(topic, questions)}
        ${position ? lessonNavHtml(position) : ''}
      </article>

      ${position ? companionHtml(topic, position, questions, progress) : ''}
    </div>
  `;
}

/**
 * Reading progress, driven by IntersectionObserver rather than a scroll listener.
 *
 * A scroll handler fires on every frame and janks on a phone; a sentinel at the foot of the
 * article tells us the same thing for free. Progress is deliberately not treated as
 * completion: reaching the bottom of a page is not evidence anyone learned anything.
 */
let progressObserver: IntersectionObserver | null = null;
let keyHandler: ((event: KeyboardEvent) => void) | null = null;

function trackReading(root: HTMLElement): void {
  const bar = qs<HTMLElement>('#cn-read-progress span', root);
  const article = qs<HTMLElement>('.cn-lesson__article', root);
  if (!bar || !article || typeof IntersectionObserver === 'undefined') return;

  const marks = Array.from(article.querySelectorAll<HTMLElement>('h2'));
  if (marks.length === 0) return;

  let seen = 0;
  progressObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        seen = Math.max(seen, marks.indexOf(entry.target as HTMLElement) + 1);
      }
      bar.style.width = `${Math.round((seen / marks.length) * 100)}%`;
    },
    { rootMargin: '0px 0px -60% 0px' },
  );

  marks.forEach((mark) => progressObserver?.observe(mark));
}

/** Alt plus arrow moves between quests. Plain arrows are left alone for normal scrolling. */
function bindShortcuts(position: LessonPosition | null): void {
  if (!position) return;

  keyHandler = (event: KeyboardEvent): void => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      window.location.hash = position.previous.href.replace(/^#/, '');
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      window.location.hash = position.next.href.replace(/^#/, '');
    }
  };

  window.addEventListener('keydown', keyHandler);
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

      const [unit, questions, dictionary, progress, syllabus, allProgress] = await Promise.all([
        getUnit(topic.unitId),
        getQuestions({ topicId: topic.id }),
        getDictionary(),
        loadTopicProgress(topic.id),
        getSyllabus(),
        activeStore()?.loadAllProgress() ?? Promise.resolve([]),
      ]);

      const navUnits = syllabus.map((entry) => ({
        id: entry.unit.id,
        number: entry.unit.number,
        title: entry.unit.title,
        order: entry.unit.order,
      }));
      const navTopics = syllabus.flatMap((entry) =>
        entry.topics.map((item) => ({
          id: item.id,
          title: item.title,
          unitId: item.unitId,
          order: item.order,
        })),
      );

      const position = lessonPosition(topic.id, navUnits, navTopics);
      const mastered = new Set(
        allProgress.filter((entry) => entry.mastery >= 80).map((entry) => entry.topicId),
      );

      this.title = topic.title;
      document.title = `${topic.title} · CN Quest`;
      root.innerHTML =
        bodyHtml(topic, unit, questions, dictionary, progress, position, mastered) +
        editAffordanceHtml({ collection: 'topics', id: topic.id, label: 'topic' });

      trackReading(root);
      bindShortcuts(position);
      // A new lesson starts at the top; the previous one's scroll position is not this one's.
      window.scrollTo({ top: 0, behavior: 'auto' });
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

  unmount() {
    progressObserver?.disconnect();
    progressObserver = null;

    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
  },
};

export default topicPage;
