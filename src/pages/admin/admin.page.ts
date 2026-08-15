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

const MEDIA_TAB = 'media';

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

function listHtml(): string {
  if (documents.length === 0) {
    return `
      <p class="cn-admin__empty">Nothing in this collection yet. Use <strong>New</strong> to add the first one.</p>
    `;
  }

  return `
    <ul class="cn-admin__list">
      ${documents
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
  const data = selected?.data ?? {};
  const label = collection?.label ?? activeCollection;
  const singular = label.replace(/s$/, '');

  return `
    <form class="cn-admin__editor" id="cn-admin-form" novalidate>
      <header class="cn-admin__editor-head">
        <h2 class="cn-admin__subtitle">
          ${selected ? `Editing ${escapeHtml(singular.toLowerCase())}` : `New ${escapeHtml(singular.toLowerCase())}`}
        </h2>
        ${
          selected
            ? `<p class="cn-admin__editing-id">${escapeHtml(selected.id)}</p>`
            : '<p class="cn-field__hint">The id is filled in from the title — you can change it before saving.</p>'
        }
      </header>

      <div class="cn-admin__field" data-field="id"${selected ? ' hidden' : ''}>
        <label for="cn-admin-id">Id</label>
        <input
          class="form-control"
          id="cn-admin-id"
          value="${escapeHtml(selectedId ?? '')}"
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
        <button class="btn btn-cn-primary" type="submit">
          <i class="bi bi-check-lg" aria-hidden="true"></i>
          ${selected ? 'Save changes' : `Create ${escapeHtml(singular.toLowerCase())}`}
        </button>
        <button class="btn btn-cn-ghost" type="button" id="cn-admin-new">
          <i class="bi bi-plus-lg" aria-hidden="true"></i> New
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

  const collection = collectionById(activeCollection);

  return `
    <div class="cn-admin__panel">
      <div class="cn-admin__list-side">
        <div class="cn-admin__list-head">
          <h2 class="cn-admin__subtitle">
            ${escapeHtml(collection?.label ?? activeCollection)}
            <span class="cn-admin__count">${documents.length} editable, ${documents.filter((entry) => entry.source === 'firestore').length} published</span>
          </h2>
          <button class="btn btn-cn-ghost btn-sm" type="button" id="cn-admin-publish">
            <i class="bi bi-cloud-upload" aria-hidden="true"></i> Publish bundled
          </button>
        </div>
        ${listHtml()}
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

async function loadCollection(root: HTMLElement): Promise<void> {
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

  selectedId = null;
  repaintPanel(root);
}

function bindPanel(root: HTMLElement): void {
  qsa<HTMLButtonElement>('.cn-admin__row', root).forEach((button) => {
    button.addEventListener('click', () => {
      selectedId = button.dataset.id ?? null;
      repaintPanel(root);
    });
  });

  qs<HTMLFormElement>('#cn-admin-form', root)?.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSave(root);
  });

  qs<HTMLButtonElement>('#cn-admin-new', root)?.addEventListener('click', () => {
    selectedId = null;
    repaintPanel(root);
    qs<HTMLInputElement>('#cn-admin-id', root)?.focus();
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
    await loadCollection(root);
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
    await loadCollection(root);
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
        activeCollection = tab.dataset.collection ?? activeCollection;
        qsa<HTMLButtonElement>('.cn-admin__tab', root).forEach((other) => {
          other.setAttribute('aria-pressed', String(other === tab));
        });
        void loadCollection(root);
      });
    });

    await loadCollection(root);

    if (requestedId && documents.some((entry) => entry.id === requestedId)) {
      selectedId = requestedId;
      repaintPanel(root);
      qs('#cn-admin-form', root)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },
};

export default adminPage;
