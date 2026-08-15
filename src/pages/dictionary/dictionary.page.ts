/**
 * Networking Dictionary — search, category filter, A-Z index and term detail.
 *
 * Deep-linkable: `#/dictionary?term=dns` opens that entry, and selecting a term rewrites the
 * URL with replaceState so the link is shareable without re-running the router.
 */

import type { Page, PageContext } from '@/types/page';
import { getDictionary, getTopics } from '@/services/content.service';
import { searchDictionary } from '@/services/content.filters';
import { loadViewedTerms, recordTermView } from '@/services/dictionary.service';
import { DICTIONARY_CATEGORIES } from '@/models/content';
import { showToast } from '@/components/toast';
import { loaderHtml, stateHtml } from '@/components/loader';
import { editAffordanceHtml } from '@/components/edit-affordance';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import type { DictionaryCategory, DictionaryTerm, Topic } from '@/models/content';
import '@/styles/dictionary.css';

const ROOT_ID = 'cn-dict-root';
const ALL = 'All';

let terms: DictionaryTerm[] = [];
let viewed = new Set<string>();
let query = '';
let category: DictionaryCategory | typeof ALL = ALL;
let selectedId: string | null = null;

/** Topics, held so the detail panel can say where a term appears in the syllabus. */
let allTopics: Topic[] = [];

/**
 * What to offer before a term is chosen.
 *
 * The most recently reviewed terms if there are any, otherwise the first few in the list, so
 * the panel always has something to open rather than sitting blank beside a full page.
 */
let suggestions: DictionaryTerm[] = [];
let slashHandler: ((event: KeyboardEvent) => void) | null = null;

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

/** Search first, then category. Two controls narrow the whole library. */
function visibleTerms(): DictionaryTerm[] {
  let result = searchDictionary(terms, query);
  if (category !== ALL) result = result.filter((term) => term.category === category);
  return result;
}


function controlsHtml(): string {
  return `
    <div class="cn-dict__controls">
      <div class="cn-dict__search">
        <label class="visually-hidden" for="cn-dict-search">Search the library</label>
        <i class="bi bi-search cn-dict__search-icon" aria-hidden="true"></i>
        <input
          class="form-control cn-dict__input"
          id="cn-dict-search"
          type="search"
          value="${escapeHtml(query)}"
          placeholder="Search protocol, device or concept…"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="cn-dict__filters" role="group" aria-label="Filter by category">
        <div class="cn-dict__chips">
          ${[ALL, ...DICTIONARY_CATEGORIES]
            .map(
              (name) => `
                <button type="button" class="cn-chip cn-dict__chip"
                        data-category="${escapeHtml(name)}"
                        aria-pressed="${category === name}">${escapeHtml(name)}</button>`,
            )
            .join('')}
        </div>
      </div>

    </div>
  `;
}

function listHtml(): string {
  const results = visibleTerms();

  if (results.length === 0) {
    return `
      <p class="cn-dict__empty">
        No terms match “${escapeHtml(query)}”. Try a different word, or clear the filters.
      </p>
    `;
  }

  return `
    <div class="cn-dict__list" role="listbox" aria-label="Dictionary terms">
      ${results
        .map(
          (term) => `
            <button
              type="button"
              class="cn-dict__row"
              data-term="${escapeHtml(term.id)}"
              role="option"
              aria-selected="${selectedId === term.id}"
              data-active="${selectedId === term.id}"
            >
              <span class="cn-dict__term">${escapeHtml(term.term)}</span>
              <span class="cn-dict__rowtop">
                <span class="cn-dict__rowterm">${escapeHtml(term.term)}</span>
                <span class="cn-dict__rowcat">${escapeHtml(term.category)}</span>
              </span>
              <span class="cn-dict__gloss">${escapeHtml(firstSentence(term.definition))}</span>
              ${
                viewed.has(term.id)
                  ? '<span class="cn-dict__seen"><i class="bi bi-check2" aria-hidden="true"></i>Reviewed</span>'
                  : ''
              }
            </button>`,
        )
        .join('')}
    </div>
  `;
}

/**
 * Where a term appears in the syllabus, worked out from the topics that reference it.
 *
 * This is a real relationship already in the data: a topic lists the dictionary ids it relates
 * to. Reading it backwards turns the library from a separate glossary into part of the course,
 * and nothing has to be invented to do it.
 */
function topicsForTerm(termId: string): Topic[] {
  return allTopics.filter((topic) => (topic.relatedTerms ?? []).includes(termId));
}

/** The first sentence, for the list preview. Cutting mid-word is what produced "band...". */
function firstSentence(text: string): string {
  const stop = text.indexOf('. ');
  return stop === -1 ? text : text.slice(0, stop + 1);
}

function detailHtml(): string {
  const term = terms.find((entry) => entry.id === selectedId);

  if (!term) {
    return `
      <aside class="cn-dict__detail cn-dict__detail--empty" aria-live="polite">
        <h2 class="cn-dict__emptytitle">Choose a networking term</h2>
        <p class="cn-dict__emptylead">Every entry gives you the definition, an example where one helps, and where the term appears in the syllabus.</p>

        ${
          suggestions.length > 0
            ? `<p class="cn-dict__emptylabel">Start with</p>
               <div class="cn-dict__suggestions">
                 ${suggestions
                   .map(
                     (entry) =>
                       `<button type="button" class="cn-dict__suggestion" data-term="${escapeHtml(entry.id)}">${escapeHtml(entry.term)}</button>`,
                   )
                   .join('')}
               </div>`
            : ''
        }
      </aside>
    `;
  }

  const related = (term.relatedTerms ?? [])
    .map((id) => terms.find((entry) => entry.id === id))
    .filter((entry): entry is DictionaryTerm => Boolean(entry));

  const appearsIn = topicsForTerm(term.id);

  return `
    ${editAffordanceHtml({ collection: 'dictionary', id: term.id, label: 'term' })}
    <aside class="cn-dict__detail" aria-live="polite">
      <p class="cn-dict__cat">${escapeHtml(term.category)}</p>
      <h2 class="cn-dict__title">${escapeHtml(term.term)}</h2>
      <p class="cn-dict__definition">${escapeHtml(term.definition)}</p>

      ${
        term.examples && term.examples.length > 0
          ? `<div class="cn-dict__block">
               <p class="cn-dict__blocklabel">Example${term.examples.length > 1 ? 's' : ''}</p>
               ${term.examples.map((example) => `<p class="cn-example">${escapeHtml(example)}</p>`).join('')}
             </div>`
          : ''
      }

      ${
        appearsIn.length > 0
          ? `<div class="cn-dict__block">
               <p class="cn-dict__blocklabel">Appears in</p>
               <div class="cn-dict__lessons">
                 ${appearsIn
                   .map(
                     (topic) => `
                       <a class="cn-dict__lesson" href="#/learn/${escapeHtml(topic.id)}">
                         <span>${escapeHtml(topic.title)}</span>
                         <i class="bi bi-arrow-right" aria-hidden="true"></i>
                       </a>`,
                   )
                   .join('')}
               </div>
             </div>
             <a class="btn btn-cn-primary btn-sm cn-dict__practice"
                href="#/games/quiz?topic=${encodeURIComponent(appearsIn[0].id)}">
               Practise this topic
             </a>`
          : ''
      }

      ${
        related.length > 0
          ? `<div class="cn-dict__block">
               <p class="cn-dict__blocklabel">Related terms</p>
               <div class="cn-termlist">
                 ${related
                   .map(
                     (entry) =>
                       `<button type="button" class="cn-chip cn-dict__related" data-term="${escapeHtml(entry.id)}">${escapeHtml(entry.term)}</button>`,
                   )
                   .join('')}
               </div>
             </div>`
          : ''
      }
    </aside>
  `;
}

function bodyHtml(): string {
  const results = visibleTerms();

  return `
    <header class="cn-dict__head">
      <div>
        <h1 class="cn-dict__pagetitle">Networking Library</h1>
        <p class="cn-dict__pagesub">
          ${
            query.trim() || category !== ALL
              ? `${results.length} ${results.length === 1 ? 'result' : 'results'}`
              : `${terms.length} terms for quick revision`
          }
        </p>
      </div>
      ${
        viewed.size > 0
          ? `<p class="cn-dict__reviewed">${viewed.size} reviewed</p>`
          : ''
      }
    </header>

    ${controlsHtml()}

    <div class="cn-dict">
      <div id="cn-dict-list">${listHtml()}</div>
      <div id="cn-dict-detail">${detailHtml()}</div>
    </div>
  `;
}

/** Re-renders only the list and detail — the search box keeps focus and caret position. */
function repaintResults(): void {
  const list = qs('#cn-dict-list');
  const detail = qs('#cn-dict-detail');
  if (list) list.innerHTML = listHtml();
  if (detail) detail.innerHTML = detailHtml();
  bindResultHandlers();
  updateCount();
}

function updateCount(): void {
  const counter = qs('.cn-dict__head .cn-label:last-child');
  if (counter) {
    counter.textContent = `${visibleTerms().length} of ${terms.length} terms · ${viewed.size} read`;
  }
}

async function selectTerm(termId: string): Promise<void> {
  selectedId = termId;
  repaintResults();

  // Keep the URL shareable without re-running the router (replaceState fires no hashchange).
  history.replaceState(null, '', `#/dictionary?term=${encodeURIComponent(termId)}`);

  qs('#cn-dict-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const outcome = await recordTermView(termId);
  if (!outcome.isNew) return;

  viewed.add(termId);
  updateCount();
  for (const achievement of outcome.unlockedAchievements) {
    showToast(`${achievement.name} · +${achievement.rewardXP} XP`, {
      title: 'Achievement unlocked',
      variant: 'success',
    });
  }
}

function bindResultHandlers(): void {
  qsa<HTMLButtonElement>('.cn-dict__row, .cn-dict__related, .cn-dict__suggestion').forEach((button) => {
    button.addEventListener('click', () => void selectTerm(button.dataset.term!));
  });
}

function bindControls(): void {
  const search = qs<HTMLInputElement>('#cn-dict-search');

  // Slash focuses search, the convention in reference tools. Ignored while already typing.
  slashHandler = (event: KeyboardEvent): void => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    qs<HTMLInputElement>('#cn-dict-search')?.focus();
  };
  window.addEventListener('keydown', slashHandler);
  search?.addEventListener('input', () => {
    query = search.value;
    repaintResults();
  });

  qsa<HTMLButtonElement>('.cn-dict__chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      category = chip.dataset.category as DictionaryCategory | typeof ALL;
      qsa('.cn-dict__chip').forEach((entry) =>
        entry.setAttribute('aria-pressed', String(entry === chip)),
      );
      repaintResults();
    });
  });

}

const dictionaryPage: Page = {
  title: 'Networking Dictionary',

  render() {
    return `
      <section class="cn-dict-page">
        <div class="cn-container" id="${ROOT_ID}">${loaderHtml('Loading the dictionary')}</div>
      </section>
    `;
  },

  async mount(ctx: PageContext) {
    const container = root();
    if (!container) return;

    query = '';
    category = ALL;

    try {
      const [entries, alreadyViewed, topics] = await Promise.all([
        getDictionary(),
        loadViewedTerms(),
        getTopics(),
      ]);
      terms = entries;
      viewed = new Set(alreadyViewed);
      allTopics = topics;

      // Reviewed terms first, so returning to the library offers what you were last reading.
      const reviewed = entries.filter((entry) => viewed.has(entry.id)).slice(-3).reverse();
      suggestions = reviewed.length > 0 ? reviewed : entries.slice(0, 3);

      const requested = ctx.query.get('term');
      selectedId = requested && terms.some((term) => term.id === requested) ? requested : null;

      container.innerHTML = bodyHtml();
      bindControls();
      bindResultHandlers();

      // A deep-linked term counts as read, exactly like clicking it.
      if (selectedId) void selectTerm(selectedId);
    } catch (error) {
      console.error('[dictionary] failed to load', error);
      container.innerHTML = stateHtml({
        icon: 'bi-journal-x',
        title: "We couldn't load the dictionary",
        message: 'Check your connection or try again in a moment.',
        actionLabel: 'Back to dashboard',
        actionHref: '#/dashboard',
      });
    }
  },

  unmount() {
    if (slashHandler) {
      window.removeEventListener('keydown', slashHandler);
      slashHandler = null;
    }
    selectedId = null;
    query = '';
  },
};

export default dictionaryPage;
