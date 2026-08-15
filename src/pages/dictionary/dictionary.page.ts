/**
 * Networking Dictionary — search, category filter, A-Z index and term detail.
 *
 * Deep-linkable: `#/dictionary?term=dns` opens that entry, and selecting a term rewrites the
 * URL with replaceState so the link is shareable without re-running the router.
 */

import type { Page, PageContext } from '@/types/page';
import { getDictionary } from '@/services/content.service';
import { searchDictionary } from '@/services/content.filters';
import { loadViewedTerms, recordTermView } from '@/services/dictionary.service';
import { DICTIONARY_CATEGORIES } from '@/models/content';
import { showToast } from '@/components/toast';
import { loaderHtml, stateHtml } from '@/components/loader';
import { editAffordanceHtml } from '@/components/edit-affordance';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import type { DictionaryCategory, DictionaryTerm } from '@/models/content';
import '@/styles/dictionary.css';

const ROOT_ID = 'cn-dict-root';
const ALL = 'All';

let terms: DictionaryTerm[] = [];
let viewed = new Set<string>();
let query = '';
let category: DictionaryCategory | typeof ALL = ALL;
let selectedId: string | null = null;

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
              <span class="cn-chip">${escapeHtml(term.category)}</span>
              <span class="cn-dict__gloss">${escapeHtml(term.definition)}</span>
              ${viewed.has(term.id) ? '<span class="cn-dict__seen" title="Already read">read</span>' : ''}
            </button>`,
        )
        .join('')}
    </div>
  `;
}

function detailHtml(): string {
  const term = terms.find((entry) => entry.id === selectedId);

  if (!term) {
    return `
      <aside class="cn-dict__detail" aria-live="polite">
        <span class="cn-label cn-label--marked">Definition</span>
        <p class="cn-ink-soft mt-3">Select a term to read its full entry.</p>
      </aside>
    `;
  }

  const related = (term.relatedTerms ?? [])
    .map((id) => terms.find((entry) => entry.id === id))
    .filter((entry): entry is DictionaryTerm => Boolean(entry));

  return `
    ${editAffordanceHtml({ collection: 'dictionary', id: term.id, label: 'term' })}
    <aside class="cn-dict__detail" aria-live="polite">
      <span class="cn-label cn-label--marked">${escapeHtml(term.category)}</span>
      <h2 class="cn-dict__title">${escapeHtml(term.term)}</h2>
      <p class="cn-dict__definition">${escapeHtml(term.definition)}</p>

      ${
        term.examples && term.examples.length > 0
          ? `<div class="cn-dict__block">
               <span class="cn-label">Example${term.examples.length > 1 ? 's' : ''}</span>
               ${term.examples.map((example) => `<p class="cn-example">${escapeHtml(example)}</p>`).join('')}
             </div>`
          : ''
      }

      ${
        related.length > 0
          ? `<div class="cn-dict__block">
               <span class="cn-label">Related</span>
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
        <span class="cn-label cn-label--marked">Reference</span>
        <h1 class="cn-section__title mt-2">Networking Dictionary</h1>
      </div>
      <span class="cn-label">
        ${results.length} of ${terms.length} terms · ${viewed.size} read
      </span>
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
  qsa<HTMLButtonElement>('.cn-dict__row, .cn-dict__related').forEach((button) => {
    button.addEventListener('click', () => void selectTerm(button.dataset.term!));
  });
}

function bindControls(): void {
  const search = qs<HTMLInputElement>('#cn-dict-search');
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
      const [entries, alreadyViewed] = await Promise.all([getDictionary(), loadViewedTerms()]);
      terms = entries;
      viewed = new Set(alreadyViewed);

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
    selectedId = null;
    query = '';
  },
};

export default dictionaryPage;
