/**
 * Admin dashboard — manage the content that drives Learn, the games and the dictionary.
 *
 * Every collection is edited through real labelled fields, generated from the schema in
 * `admin.schema.ts`. Units and topics appear as dropdowns rather than ids to type, which is
 * where content most often breaks: a mistyped `unitId` saves cleanly and then quietly hides
 * the topic from the unit it belongs to.
 *
 * The raw JSON view is kept behind a disclosure for the rare field a form cannot express.
 *
 * The screen is a convenience, not a control. Firestore rules decide what is actually
 * accepted — a forged visit here produces a dashboard whose every write is refused.
 */

import type { Page, PageContext } from '@/types/page';
import {
  CONTENT_COLLECTIONS,
  collectionById,
  deleteDocument,
  isAdmin,
  listDocuments,
  parseDocumentInput,
  publishBundled,
  saveDocument,
  summarise,
} from '@/services/admin.service';
import type { AdminDocument } from '@/services/admin.service';
import { fieldsFor } from '@/services/admin.schema';
import { buildDocument, suggestId } from '@/services/admin.form.logic';
import { copyId, filterDocuments, previewHref } from '@/services/admin.logic';
import type { SourceFilter } from '@/services/admin.logic';
import { formHtml, readForm, showFieldErrors } from './admin.form';
import type { ReferenceOptions } from './admin.form';
import { contentSource, getTopics, getUnits } from '@/services/content.service';
import { showToast } from '@/components/toast';
import { getPreferences, setPreference } from '@/state/preferences';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import { loaderHtml, stateHtml } from '@/components/loader';
import { mediaTabHtml, mountMediaTab, openMediaPicker } from './admin.media';
import '@/styles/admin.css';

const ROOT_ID = 'cn-admin-root';

let activeCollection = CONTENT_COLLECTIONS[0].id;
let documents: AdminDocument[] = [];
let selectedId: string | null = null;
let references: ReferenceOptions = { units: [], topics: [] };

/** List search and filter; kept while switching documents, reset when switching collection. */
let query = '';
let sourceFilter: SourceFilter = 'all';
/** On phones the list and the editor are separate screens; this says which one is showing. */
let editorOpen = false;
/** A new document prefilled from "Duplicate". */
let draft: { id: string; data: Record<string, unknown> } | null = null;
/** True once the form has been touched since it was opened or saved. */
let dirty = false;

const MEDIA_TAB = 'media';

/** Asks before throwing away edits. Returns true when it is fine to continue. */
function confirmDiscard(): boolean {
  if (!dirty) return true;
  const ok = window.confirm('You have unsaved changes. Discard them?');
  if (ok) dirty = false;
  return ok;
}

function collectionLabel(): string {
  return collectionById(activeCollection)?.label ?? activeCollection;
}

function tabsHtml(): string {
  const collections = CONTENT_COLLECTIONS.map(
    (entry) => `
      <button
        type="button"
        class="cn-admin__tab"
        data-collection="${escapeHtml(entry.id)}"
        aria-pressed="${entry.id === activeCollection}"
      >
        ${escapeHtml(entry.label)}
      </button>
    `,
  ).join('');

  return `${collections}
    <button
      type="button"
      class="cn-admin__tab"
      data-collection="${MEDIA_TAB}"
      aria-pressed="${activeCollection === MEDIA_TAB}"
    >
      Media
    </button>
  `;
}

function visibleDocuments(): AdminDocument[] {
  return filterDocuments(documents, query, sourceFilter);
}

function countHtml(): string {
  const shown = visibleDocuments().length;
  const published = documents.filter((entry) => entry.source === 'firestore').length;
  return shown === documents.length
    ? `${documents.length} total · ${published} published`
    : `${shown} of ${documents.length} shown`;
}

function toolbarHtml(): string {
  const option = (value: SourceFilter, label: string): string =>
    `<option value="${value}"${sourceFilter === value ? ' selected' : ''}>${label}</option>`;
  return `
    <div class="cn-admin__toolbar" role="search">
      <label class="visually-hidden" for="cn-admin-search">Search ${escapeHtml(collectionLabel().toLowerCase())}</label>
      <div class="cn-admin__search">
        <i class="bi bi-search" aria-hidden="true"></i>
        <input class="form-control" id="cn-admin-search" type="search" value="${escapeHtml(query)}"
               placeholder="Search id, title or any text" autocomplete="off" />
      </div>
      <label class="visually-hidden" for="cn-admin-source">Show</label>
      <select class="form-select" id="cn-admin-source">
        ${option('all', 'All')}${option('firestore', 'Published')}${option('bundled', 'Bundle only')}
      </select>
    </div>
  `;
}

function listHtml(): string {
  if (documents.length === 0) {
    return `
      <p class="cn-admin__empty">Nothing in this collection yet. Use <strong>New</strong> to add the first one.</p>
    `;
  }

  const visible = visibleDocuments();
  if (visible.length === 0) {
    return `<p class="cn-admin__empty">No match for that search. Clear it or try another word.</p>`;
  }

  return `
    <ul class="cn-admin__list">
      ${visible
        .map(
          (entry) => `
            <li>
              <button
                type="button"
                class="cn-admin__row"
                data-id="${escapeHtml(entry.id)}"
                aria-pressed="${entry.id === selectedId}"
              >
                <span class="cn-admin__row-summary">${escapeHtml(summarise(entry.data))}</span>
                <span class="cn-admin__row-id">
                  ${escapeHtml(entry.id)}
                  ${entry.source === 'bundled' ? '<span class="cn-admin__unpublished">from app bundle</span>' : ''}
                </span>
              </button>
            </li>
          `,
        )
        .join('')}
    </ul>
  `;
}

function editorHtml(): string {
  const collection = collectionById(activeCollection);
  const selected = documents.find((entry) => entry.id === selectedId);
  const specs = fieldsFor(activeCollection);
  const data = selected?.data ?? draft?.data ?? {};
  const label = collection?.label ?? activeCollection;
  const singular = label.replace(/s$/, '');
  const preview = selected ? previewHref(activeCollection, selected.id) : null;

  return `
    <form class="cn-admin__editor" id="cn-admin-form" novalidate>
      <button type="button" class="cn-admin__back" id="cn-admin-back">
        <i class="bi bi-arrow-left" aria-hidden="true"></i> All ${escapeHtml(label.toLowerCase())}
      </button>
      <header class="cn-admin__editor-head">
        <div>
          <h2 class="cn-admin__subtitle">
            ${selected ? `Editing ${escapeHtml(singular.toLowerCase())}` : `New ${escapeHtml(singular.toLowerCase())}`}
          </h2>
          ${
            selected
              ? `<p class="cn-admin__editing-id">${escapeHtml(selected.id)}${
                  selected.source === 'bundled' ? ' <span class="cn-admin__unpublished">from app bundle</span>' : ''
                }</p>`
              : `<p class="cn-field__hint">${
                  draft ? 'A copy: change the id and anything else, then create it.' : 'The id is filled in from the title — you can change it before saving.'
                }</p>`
          }
        </div>
        ${
          preview
            ? `<a class="btn btn-cn-ghost btn-sm" href="${escapeHtml(preview)}" target="_blank" rel="noopener">
                 <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> View in app
               </a>`
            : ''
        }
      </header>

      <div class="cn-admin__field" data-field="id"${selected ? ' hidden' : ''}>
        <label for="cn-admin-id">Id</label>
        <input
          class="form-control"
          id="cn-admin-id"
          value="${escapeHtml(selectedId ?? draft?.id ?? '')}"
          placeholder="filled in automatically"
          ${selected ? 'readonly' : ''}
        />
        <p class="cn-field__hint">
          Permanent once students' progress refers to it. Renaming later creates a second document.
        </p>
        <p class="cn-field__error" data-error-for="id" role="alert"></p>
      </div>

      ${formHtml(specs, data, references)}

      <details class="cn-admin__raw">
        <summary>Advanced: edit the raw document</summary>
        <p class="cn-field__hint">
          For anything the fields above cannot express. Saving from here ignores the form.
        </p>
        <textarea class="form-control cn-admin__json" id="cn-admin-json" rows="14" spellcheck="false">${escapeHtml(JSON.stringify(data, null, 2))}</textarea>
        <button class="btn btn-cn-ghost btn-sm mt-2" type="button" id="cn-admin-save-json">
          Save raw document
        </button>
        <p class="cn-field__error" id="cn-admin-json-error" role="alert"></p>
      </details>

      <div class="cn-admin__actions">
        <button class="btn btn-cn-primary" type="submit" title="Save (Ctrl+S)">
          <i class="bi bi-check-lg" aria-hidden="true"></i>
          ${selected ? 'Save changes' : `Create ${escapeHtml(singular.toLowerCase())}`}
        </button>
        <span class="cn-admin__dirty" id="cn-admin-dirty" hidden>Unsaved changes</span>
        <button class="btn btn-cn-ghost" type="button" id="cn-admin-duplicate" ${selected ? '' : 'disabled'}>
          <i class="bi bi-copy" aria-hidden="true"></i> Duplicate
        </button>
        <button
          class="btn btn-cn-ghost cn-admin__danger"
          type="button"
          id="cn-admin-delete"
          ${selected ? '' : 'disabled'}
        >
          <i class="bi bi-trash" aria-hidden="true"></i> Delete
        </button>
      </div>
    </form>
  `;
}

function panelHtml(): string {
  if (activeCollection === MEDIA_TAB) return mediaTabHtml();

  return `
    <div class="cn-admin__panel" data-view="${editorOpen ? 'editor' : 'list'}">
      <div class="cn-admin__list-side">
        <div class="cn-admin__list-head">
          <h2 class="cn-admin__subtitle">
            ${escapeHtml(collectionLabel())}
            <span class="cn-admin__count" id="cn-admin-count">${countHtml()}</span>
          </h2>
          <div class="cn-admin__list-actions">
            <button class="btn btn-cn-primary btn-sm" type="button" id="cn-admin-new">
              <i class="bi bi-plus-lg" aria-hidden="true"></i> New
            </button>
            <button class="btn btn-cn-ghost btn-sm" type="button" id="cn-admin-publish" title="Upload the app's built-in copies to Firestore">
              <i class="bi bi-cloud-upload" aria-hidden="true"></i> Publish bundled
            </button>
          </div>
        </div>
        ${toolbarHtml()}
        <div id="cn-admin-list">${listHtml()}</div>
      </div>
      ${editorHtml()}
    </div>
  `;
}

function bodyHtml(): string {
  const source = contentSource();

  return `
    <header class="cn-admin__head">
      <div>
        <span class="cn-label cn-label--marked">Admin</span>
        <h1 class="cn-section__title mt-2">Content management</h1>
        <p class="cn-label mt-2">
          Students are reading <strong>${escapeHtml(source)}</strong> content
        </p>
      </div>

      <label class="cn-admin__mode" for="cn-admin-mode-toggle">
        <input type="checkbox" id="cn-admin-mode-toggle" ${getPreferences().adminMode ? 'checked' : ''} />
        <span>
          <strong>Edit while browsing</strong>
          Adds an "Edit this" button to topics and dictionary entries as you read them.
        </span>
      </label>
    </header>

    <nav class="cn-admin__tabs" aria-label="Content collections">${tabsHtml()}</nav>
    <div id="cn-admin-panel">${panelHtml()}</div>
  `;
}

function repaintPanel(root: HTMLElement): void {
  const panel = qs('#cn-admin-panel', root);
  if (!panel) return;
  panel.innerHTML = panelHtml();
  bindPanel(root);
}

/** Updates only the list and its count, so the search box keeps focus while typing. */
function repaintList(root: HTMLElement): void {
  const list = qs('#cn-admin-list', root);
  const count = qs('#cn-admin-count', root);
  if (list) list.innerHTML = listHtml();
  if (count) count.textContent = countHtml();
  bindRows(root);
}

function bindRows(root: HTMLElement): void {
  qsa<HTMLButtonElement>('.cn-admin__row', root).forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.id === selectedId && editorOpen) return;
      if (!confirmDiscard()) return;
      selectedId = button.dataset.id ?? null;
      draft = null;
      editorOpen = true;
      repaintPanel(root);
      qs('#cn-admin-form', root)?.scrollIntoView({ block: 'start' });
    });
  });
}

/** Opens an empty editor, or one prefilled with a copy. */
function openNew(root: HTMLElement, copy: typeof draft = null): void {
  selectedId = null;
  draft = copy;
  editorOpen = true;
  dirty = Boolean(copy); // a copy is unsaved work from the start
  repaintPanel(root);
  if (copy) setDirtyBadge(root);
  qs<HTMLInputElement>('#cn-admin-id', root)?.focus();
}

function setDirtyBadge(root: HTMLElement): void {
  const badge = qs('#cn-admin-dirty', root);
  if (badge) badge.hidden = !dirty;
}

async function loadCollection(root: HTMLElement, keepId: string | null = null): Promise<void> {
  const panel = qs('#cn-admin-panel', root);
  if (panel) panel.innerHTML = loaderHtml('Loading');

  // The media library has no documents to list; it loads its own contents.
  if (activeCollection === MEDIA_TAB) {
    if (panel) {
      panel.innerHTML = panelHtml();
      await mountMediaTab(panel);
    }
    return;
  }

  try {
    documents = await listDocuments(activeCollection);
  } catch (error) {
    console.error('[admin] could not list documents', error);
    documents = [];
    showToast('Could not read that collection. Check you are signed in as the admin account.', {
      title: 'Load failed',
      variant: 'error',
    });
  }

  // After a save, stay on the document just saved rather than dropping back to an empty form.
  selectedId = keepId && documents.some((entry) => entry.id === keepId) ? keepId : null;
  editorOpen = selectedId !== null;
  draft = null;
  dirty = false;
  repaintPanel(root);
}

function bindPanel(root: HTMLElement): void {
  bindRows(root);

  const form = qs<HTMLFormElement>('#cn-admin-form', root);
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSave(root);
  });
  const markDirty = (): void => {
    if (dirty) return;
    dirty = true;
    setDirtyBadge(root);
  };
  form?.addEventListener('input', markDirty);
  form?.addEventListener('change', markDirty);

  qs<HTMLInputElement>('#cn-admin-search', root)?.addEventListener('input', (event) => {
    query = (event.target as HTMLInputElement).value;
    repaintList(root);
  });
  qs<HTMLSelectElement>('#cn-admin-source', root)?.addEventListener('change', (event) => {
    sourceFilter = (event.target as HTMLSelectElement).value as SourceFilter;
    repaintList(root);
  });

  qs<HTMLButtonElement>('#cn-admin-new', root)?.addEventListener('click', () => {
    if (confirmDiscard()) openNew(root);
  });

  qs<HTMLButtonElement>('#cn-admin-back', root)?.addEventListener('click', () => {
    if (!confirmDiscard()) return;
    editorOpen = false;
    repaintPanel(root);
    qs(`.cn-admin__row[data-id="${CSS.escape(selectedId ?? '')}"]`, root)?.scrollIntoView({ block: 'center' });
  });

  qs<HTMLButtonElement>('#cn-admin-duplicate', root)?.addEventListener('click', () => {
    const source = documents.find((entry) => entry.id === selectedId);
    if (!source || !confirmDiscard()) return;
    const id = copyId(source.id, new Set(documents.map((entry) => entry.id)));
    openNew(root, { id, data: { ...source.data, id } });
    showToast(`Copied to "${id}". Change what differs, then create it.`, { variant: 'info' });
  });

  qs<HTMLButtonElement>('#cn-admin-delete', root)?.addEventListener('click', () => {
    void handleDelete(root);
  });

  qs<HTMLButtonElement>('#cn-admin-publish', root)?.addEventListener('click', () => {
    void handlePublish(root);
  });

  qs<HTMLButtonElement>('#cn-admin-save-json', root)?.addEventListener('click', () => {
    void handleSaveRaw(root);
  });

  bindIdSuggestion(root);
  bindMediaPicker(root);
}

/**
 * Puts a "Choose from library" control beside the media URL field.
 *
 * Without it the only way to add a diagram is to paste a URL, which in practice means
 * uploading the same image again because finding the first one is harder than re-uploading.
 */
function bindMediaPicker(root: HTMLElement): void {
  const urlField = qs<HTMLInputElement>('[name="mediaUrl"]', root);
  if (!urlField || qs('#cn-media-pick', root)) return;

  urlField.insertAdjacentHTML(
    'afterend',
    `<button type="button" class="btn btn-cn-ghost btn-sm cn-admin__pick" id="cn-media-pick">
       Choose from library
     </button>`,
  );

  qs<HTMLButtonElement>('#cn-media-pick', root)?.addEventListener('click', () => {
    void openMediaPicker((item) => {
      urlField.value = item.url;

      // A caption is required whenever a URL is set, so the file name seeds one rather than
      // leaving the admin with an error they did not cause.
      const caption = qs<HTMLInputElement>('[name="mediaCaption"]', root);
      if (caption && !caption.value.trim()) caption.value = item.name.replace(/\.[a-z0-9]+$/i, '');
    });
  });
}

/** Fills the id from the title while creating, until the admin types their own. */
function bindIdSuggestion(root: HTMLElement): void {
  const idInput = qs<HTMLInputElement>('#cn-admin-id', root);
  if (!idInput || idInput.readOnly) return;

  const titleKey = fieldsFor(activeCollection).some((spec) => spec.key === 'title')
    ? 'title'
    : fieldsFor(activeCollection).some((spec) => spec.key === 'term')
      ? 'term'
      : 'name';
  const titleInput = qs<HTMLInputElement>(`[name="${titleKey}"]`, root);
  if (!titleInput) return;

  let touched = false;
  idInput.addEventListener('input', () => {
    touched = true;
  });

  titleInput.addEventListener('input', () => {
    if (touched) return;
    idInput.value = suggestId(activeCollection, titleInput.value);
  });
}

async function handleSave(root: HTMLElement): Promise<void> {
  const form = qs<HTMLFormElement>('#cn-admin-form', root);
  const idInput = qs<HTMLInputElement>('#cn-admin-id', root);
  if (!form || !idInput) return;

  const specs = fieldsFor(activeCollection);
  const id = idInput.value.trim();
  const { data, errors } = buildDocument(specs, id, readForm(specs, form));

  if (Object.keys(errors).length > 0) {
    showFieldErrors(form, errors);
    return;
  }
  showFieldErrors(form, {});

  try {
    await saveDocument(activeCollection, id, data);
    showToast(`Saved. Students will see this on their next load.`, { variant: 'success' });
    await loadCollection(root, id);
  } catch (error) {
    console.error('[admin] save failed', error);
    showToast('Firestore refused the write. Confirm you are signed in as the admin account.', {
      title: 'Save failed',
      variant: 'error',
    });
  }
}

/** The escape hatch: saves exactly what is in the JSON box, bypassing the form. */
async function handleSaveRaw(root: HTMLElement): Promise<void> {
  const idInput = qs<HTMLInputElement>('#cn-admin-id', root);
  const jsonInput = qs<HTMLTextAreaElement>('#cn-admin-json', root);
  const errorEl = qs('#cn-admin-json-error', root);
  if (!idInput || !jsonInput || !errorEl) return;

  const id = idInput.value.trim();
  if (!id) {
    errorEl.textContent = 'An id is required.';
    return;
  }

  const result = parseDocumentInput(jsonInput.value, id);
  if ('error' in result) {
    errorEl.textContent = result.error;
    return;
  }

  errorEl.textContent = '';
  try {
    await saveDocument(activeCollection, id, result.data);
    showToast('Saved.', { variant: 'success' });
    await loadCollection(root, id);
  } catch (error) {
    console.error('[admin] raw save failed', error);
    errorEl.textContent = 'Firestore refused the write.';
  }
}

async function handleDelete(root: HTMLElement): Promise<void> {
  if (!selectedId) return;
  const label = documents.find((entry) => entry.id === selectedId);
  const name = label ? summarise(label.data) : selectedId;

  // Deleting content students are reading is worth one deliberate confirmation.
  if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

  try {
    await deleteDocument(activeCollection, selectedId);
    showToast('Deleted.', { variant: 'success' });
    await loadCollection(root);
  } catch (error) {
    console.error('[admin] delete failed', error);
    showToast('Firestore refused the delete.', { title: 'Delete failed', variant: 'error' });
  }
}

async function handlePublish(root: HTMLElement): Promise<void> {
  const collection = collectionById(activeCollection);
  if (!collection) return;

  const confirmed = window.confirm(
    `Upload the ${collection.bundled.length} bundled ${collection.label.toLowerCase()} to Firestore?\n\n` +
      'Anything with a matching id is overwritten.',
  );
  if (!confirmed) return;

  const button = qs<HTMLButtonElement>('#cn-admin-publish', root);
  if (button) button.disabled = true;

  try {
    const written = await publishBundled(activeCollection);
    showToast(`Published ${written} documents. They are editable now.`, { variant: 'success' });
    await refreshReferences();
    await loadCollection(root);
  } catch (error) {
    console.error('[admin] publish failed', error);
    showToast('Firestore refused the upload. Confirm you are signed in as the admin account.', {
      title: 'Publish failed',
      variant: 'error',
    });
    if (button) button.disabled = false;
  }
}

/** Units and topics power the dropdowns, so they are loaded once per visit. */
async function refreshReferences(): Promise<void> {
  try {
    const [units, topics] = await Promise.all([getUnits(), getTopics()]);
    references = {
      units: units.map((unit) => ({ id: unit.id, title: unit.title })),
      topics: topics.map((topic) => ({ id: topic.id, title: topic.title })),
    };
  } catch (error) {
    // The reference fields fall back to plain text inputs rather than blocking the screen.
    console.error('[admin] could not load unit/topic options', error);
  }
}

const adminPage: Page = {
  title: 'Admin',

  render() {
    return `
      <section class="cn-admin">
        <div class="cn-container" id="${ROOT_ID}">${loaderHtml('Opening the dashboard')}</div>
      </section>
    `;
  },

  async mount(ctx: PageContext) {
    const root = qs(`#${ROOT_ID}`);
    if (!root) return;

    if (!isAdmin()) {
      root.innerHTML = stateHtml({
        icon: 'bi-shield-lock',
        title: 'Admin access only',
        message:
          'This screen manages the course content. It is available to the course owner’s account.',
        actionLabel: 'Back to dashboard',
        actionHref: '#/dashboard',
      });
      return;
    }

    const requested = ctx.query.get('collection');
    if (requested && (collectionById(requested) || requested === MEDIA_TAB)) activeCollection = requested;
    // Set by the "Edit this" button students never see; opens the document being viewed.
    const requestedId = ctx.query.get('id');

    await refreshReferences();
    root.innerHTML = bodyHtml();

    qs<HTMLInputElement>('#cn-admin-mode-toggle', root)?.addEventListener('change', (event) => {
      const on = (event.target as HTMLInputElement).checked;
      setPreference('adminMode', on);
      showToast(
        on
          ? 'Open any topic or dictionary entry and you will see an "Edit this" button.'
          : 'Edit buttons hidden. You now see the app exactly as a student does.',
        { title: on ? 'Editing on' : 'Editing off', variant: 'info' },
      );
    });

    qsa<HTMLButtonElement>('.cn-admin__tab', root).forEach((tab) => {
      tab.addEventListener('click', () => {
        if (tab.dataset.collection === activeCollection || !confirmDiscard()) return;
        activeCollection = tab.dataset.collection ?? activeCollection;
        query = '';
        sourceFilter = 'all';
        qsa<HTMLButtonElement>('.cn-admin__tab', root).forEach((other) => {
          other.setAttribute('aria-pressed', String(other === tab));
        });
        void loadCollection(root);
      });
    });

    document.addEventListener('keydown', onKeydown);
    window.addEventListener('beforeunload', onBeforeUnload);

    await loadCollection(root, requestedId);
    if (selectedId) qs('#cn-admin-form', root)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  unmount() {
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('beforeunload', onBeforeUnload);
    dirty = false;
    editorOpen = false;
    draft = null;
  },
};

/** Ctrl+S / Cmd+S saves the open document instead of saving the web page. */
function onKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
  const form = qs<HTMLFormElement>('#cn-admin-form');
  if (!form) return;
  event.preventDefault();
  form.requestSubmit();
}

/** Closing or reloading the tab with unsaved edits asks first. */
function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
}

export default adminPage;
