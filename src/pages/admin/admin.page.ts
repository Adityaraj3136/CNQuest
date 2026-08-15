/**
 * Admin dashboard — manage the educational content that drives Learn, the games and the
 * dictionary.
 *
 * One generic document editor rather than nine bespoke forms: the collections have nine
 * different shapes, and hand-built forms would need updating every time `models/content.ts`
 * changes. The bundled copy of each document is the shape reference, one click away.
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
import { contentSource } from '@/services/content.service';
import { showToast } from '@/components/toast';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import { loaderHtml, stateHtml } from '@/components/loader';
import '@/styles/admin.css';

const ROOT_ID = 'cn-admin-root';

/** The collection currently open. Kept in the hash so a reload lands back in the same place. */
let activeCollection = CONTENT_COLLECTIONS[0].id;
let documents: AdminDocument[] = [];
let selectedId: string | null = null;

function tabsHtml(): string {
  return CONTENT_COLLECTIONS.map(
    (entry) => `
      <button
        type="button"
        class="cn-admin__tab"
        data-collection="${escapeHtml(entry.id)}"
        aria-pressed="${entry.id === activeCollection}"
      >
        ${escapeHtml(entry.label)}
        <span class="cn-admin__tab-count">${entry.bundled.length}</span>
      </button>
    `,
  ).join('');
}

function listHtml(): string {
  if (documents.length === 0) {
    return `
      <p class="cn-admin__empty">
        Nothing in Firestore for this collection. Students are seeing the bundled copy.
        Use <strong>Publish bundled</strong> to upload it.
      </p>
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
                <span class="cn-admin__row-id">${escapeHtml(entry.id)}</span>
                <span class="cn-admin__row-summary">${escapeHtml(summarise(entry.data))}</span>
              </button>
            </li>
          `,
        )
        .join('')}
    </ul>
  `;
}

function editorHtml(): string {
  const selected = documents.find((entry) => entry.id === selectedId);
  const collection = collectionById(activeCollection);
  const template = collection?.bundled[0];

  const value = selected
    ? JSON.stringify(selected.data, null, 2)
    : JSON.stringify(template ?? { id: '' }, null, 2);

  return `
    <div class="cn-admin__editor">
      <div class="cn-admin__editor-head">
        <label for="cn-admin-id">Document id</label>
        <input
          class="form-control"
          id="cn-admin-id"
          value="${escapeHtml(selectedId ?? '')}"
          placeholder="e.g. topic-osi-model"
          ${selected ? 'readonly' : ''}
        />
      </div>

      <label for="cn-admin-json">Document JSON</label>
      <textarea class="form-control cn-admin__json" id="cn-admin-json" rows="18" spellcheck="false">${escapeHtml(value)}</textarea>
      <p class="cn-field__error" id="cn-admin-error" role="alert"></p>

      <div class="cn-admin__actions">
        <button class="btn btn-cn-primary" type="button" id="cn-admin-save">
          <i class="bi bi-save" aria-hidden="true"></i> Save document
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
    </div>
  `;
}

function panelHtml(): string {
  const collection = collectionById(activeCollection);

  return `
    <div class="cn-admin__panel">
      <div class="cn-admin__list-side">
        <div class="cn-admin__list-head">
          <h2 class="cn-admin__subtitle">
            ${escapeHtml(collection?.label ?? activeCollection)}
            <span class="cn-admin__count">${documents.length} in Firestore</span>
          </h2>
          <button class="btn btn-cn-ghost btn-sm" type="button" id="cn-admin-publish">
            <i class="bi bi-cloud-upload" aria-hidden="true"></i>
            Publish bundled (${collection?.bundled.length ?? 0})
          </button>
        </div>
        ${listHtml()}
      </div>
      ${editorHtml()}
    </div>
  `;
}

function bodyHtml(): string {
  return `
    <header class="cn-admin__head">
      <div>
        <span class="cn-label cn-label--marked">Admin</span>
        <h1 class="cn-section__title mt-2">Content management</h1>
        <p class="cn-label mt-2">
          Students are currently reading <strong>${contentSource()}</strong> content
        </p>
      </div>
    </header>

    <nav class="cn-admin__tabs" aria-label="Content collections">${tabsHtml()}</nav>
    <div id="cn-admin-panel">${panelHtml()}</div>
  `;
}

/** Repaints the list and editor without re-rendering the tab strip. */
function repaintPanel(root: HTMLElement): void {
  const panel = qs('#cn-admin-panel', root);
  if (!panel) return;
  panel.innerHTML = panelHtml();
  bindPanel(root);
}

async function loadCollection(root: HTMLElement): Promise<void> {
  const panel = qs('#cn-admin-panel', root);
  if (panel) panel.innerHTML = loaderHtml('Loading documents');

  try {
    documents = await listDocuments(activeCollection);
  } catch (error) {
    console.error('[admin] could not list documents', error);
    documents = [];
    showToast('Could not read that collection. Check your connection and that you are signed in as the admin.', {
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

  qs<HTMLButtonElement>('#cn-admin-new', root)?.addEventListener('click', () => {
    selectedId = null;
    repaintPanel(root);
    qs<HTMLInputElement>('#cn-admin-id', root)?.focus();
  });

  qs<HTMLButtonElement>('#cn-admin-save', root)?.addEventListener('click', () => {
    void handleSave(root);
  });

  qs<HTMLButtonElement>('#cn-admin-delete', root)?.addEventListener('click', () => {
    void handleDelete(root);
  });

  qs<HTMLButtonElement>('#cn-admin-publish', root)?.addEventListener('click', () => {
    void handlePublish(root);
  });
}

async function handleSave(root: HTMLElement): Promise<void> {
  const idInput = qs<HTMLInputElement>('#cn-admin-id', root);
  const jsonInput = qs<HTMLTextAreaElement>('#cn-admin-json', root);
  const errorEl = qs('#cn-admin-error', root);
  if (!idInput || !jsonInput || !errorEl) return;

  const id = idInput.value.trim();
  if (!id) {
    errorEl.textContent = 'A document id is required.';
    idInput.focus();
    return;
  }

  const result = parseDocumentInput(jsonInput.value, id);
  if ('error' in result) {
    errorEl.textContent = result.error;
    jsonInput.focus();
    return;
  }

  errorEl.textContent = '';
  try {
    await saveDocument(activeCollection, id, result.data);
    showToast(`Saved ${activeCollection}/${id}.`, { variant: 'success' });
    await loadCollection(root);
  } catch (error) {
    console.error('[admin] save failed', error);
    errorEl.textContent =
      'Firestore refused the write. Confirm you are signed in as the admin account.';
  }
}

async function handleDelete(root: HTMLElement): Promise<void> {
  if (!selectedId) return;
  // Deleting content students are reading is worth one deliberate confirmation.
  if (!window.confirm(`Delete ${activeCollection}/${selectedId}? This cannot be undone.`)) return;

  try {
    await deleteDocument(activeCollection, selectedId);
    showToast(`Deleted ${activeCollection}/${selectedId}.`, { variant: 'success' });
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
    `Upload ${collection.bundled.length} bundled ${collection.label.toLowerCase()} to Firestore?\n\n` +
      'Documents with the same id will be overwritten.',
  );
  if (!confirmed) return;

  const button = qs<HTMLButtonElement>('#cn-admin-publish', root);
  if (button) button.disabled = true;

  try {
    const written = await publishBundled(activeCollection);
    showToast(`Published ${written} documents to ${activeCollection}.`, { variant: 'success' });
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

    // `#/admin?collection=questions` reopens where the admin left off.
    const requested = ctx.query.get('collection');
    if (requested && collectionById(requested)) activeCollection = requested;

    root.innerHTML = bodyHtml();

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
  },
};

export default adminPage;
