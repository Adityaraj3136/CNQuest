/**
 * The media library.
 *
 * Two jobs: a tab where uploads are managed, and a picker that drops an existing image into
 * the topic editor. Both render the same grid, because an admin choosing an image and an
 * admin tidying up are looking at the same thing and should see it the same way.
 */

import { deleteMedia, listMedia, uploadMedia } from '@/services/media.service';
import type { MediaItem } from '@/services/media.service';
import { showToast } from '@/components/toast';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import { loaderHtml } from '@/components/loader';

/** Cached so opening the picker after visiting the tab does not re-list the bucket. */
let cache: MediaItem[] | null = null;

export function invalidateMediaCache(): void {
  cache = null;
}

async function loadMedia(force = false): Promise<MediaItem[]> {
  if (!force && cache) return cache;
  cache = await listMedia();
  return cache;
}

function emptyHtml(context: 'library' | 'picker'): string {
  return `
    <div class="cn-media__empty">
      <p class="cn-media__emptytitle">No images yet</p>
      <p class="cn-media__emptylead">
        ${
          context === 'library'
            ? 'Upload a diagram and it becomes available to every lesson.'
            : 'Upload one from the Media tab and it will appear here.'
        }
      </p>
    </div>
  `;
}

function gridHtml(items: readonly MediaItem[], context: 'library' | 'picker'): string {
  if (items.length === 0) return emptyHtml(context);

  return `
    <ul class="cn-media__grid">
      ${items
        .map(
          (item) => `
            <li class="cn-media__item">
              <img src="${escapeHtml(item.url)}" alt="" loading="lazy" decoding="async" />
              <p class="cn-media__name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</p>

              <div class="cn-media__actions">
                <button type="button" class="cn-media__use" data-url="${escapeHtml(item.url)}"
                        data-name="${escapeHtml(item.name)}">
                  ${context === 'picker' ? 'Use this' : 'Copy URL'}
                </button>
                ${
                  context === 'library'
                    ? `<button type="button" class="cn-media__delete" data-path="${escapeHtml(item.path)}">
                         Delete
                       </button>`
                    : ''
                }
              </div>
            </li>`,
        )
        .join('')}
    </ul>
  `;
}

// ---------------------------------------------------------------- library tab

export function mediaTabHtml(): string {
  return `
    <section class="cn-media">
      <header class="cn-media__head">
        <div>
          <h2 class="cn-admin__subtitle">Media library</h2>
          <p class="cn-media__hint">
            Images available to every lesson. Upload once, reuse anywhere.
          </p>
        </div>

        <label class="btn btn-cn-primary btn-sm cn-media__upload">
          Upload image
          <input type="file" accept="image/*" id="cn-media-file" hidden />
        </label>
      </header>

      <div id="cn-media-grid">${loaderHtml('Loading media')}</div>
    </section>
  `;
}

export async function mountMediaTab(root: HTMLElement): Promise<void> {
  const grid = qs('#cn-media-grid', root);
  if (!grid) return;

  const paint = async (force = false): Promise<void> => {
    try {
      grid.innerHTML = gridHtml(await loadMedia(force), 'library');
      bindGrid(grid, paint);
    } catch (error) {
      console.error('[media] could not list media', error);
      grid.innerHTML = `
        <p class="cn-media__error">
          Could not read the media library. If this is the first upload, enable Storage in the
          Firebase console and deploy the storage rules.
        </p>
      `;
    }
  };

  qs<HTMLInputElement>('#cn-media-file', root)?.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    void (async () => {
      try {
        showToast(`Uploading ${file.name}…`, { variant: 'info' });
        await uploadMedia(file);
        invalidateMediaCache();
        await paint(true);
        showToast('Uploaded. It is now available to every lesson.', { variant: 'success' });
      } catch (error) {
        console.error('[media] upload failed', error);
        showToast(error instanceof Error ? error.message : 'Upload failed.', {
          title: 'Upload failed',
          variant: 'error',
        });
      } finally {
        // Clearing lets the same file be chosen again after a failure.
        input.value = '';
      }
    })();
  });

  await paint();
}

function bindGrid(root: HTMLElement, repaint: (force?: boolean) => Promise<void>): void {
  qsa<HTMLButtonElement>('.cn-media__use', root).forEach((button) => {
    button.addEventListener('click', () => {
      void navigator.clipboard?.writeText(button.dataset.url ?? '');
      showToast('URL copied.', { variant: 'success' });
    });
  });

  qsa<HTMLButtonElement>('.cn-media__delete', root).forEach((button) => {
    button.addEventListener('click', () => {
      const path = button.dataset.path;
      if (!path) return;

      // A lesson may already point at this image, and deleting it breaks that lesson silently.
      if (!window.confirm('Delete this image? Any lesson using it will lose its diagram.')) return;

      void (async () => {
        try {
          await deleteMedia(path);
          invalidateMediaCache();
          await repaint(true);
          showToast('Deleted.', { variant: 'success' });
        } catch (error) {
          console.error('[media] delete failed', error);
          showToast('Could not delete that image.', { title: 'Delete failed', variant: 'error' });
        }
      })();
    });
  });
}

// ---------------------------------------------------------------- picker

/**
 * Opens the library over the editor and fills the media fields with whatever is chosen.
 *
 * This is the whole point of the feature: an admin adding a diagram to a second lesson should
 * pick the one already uploaded rather than uploading it again under a new name.
 */
export async function openMediaPicker(onPick: (item: MediaItem) => void): Promise<void> {
  const existing = qs('#cn-media-picker');
  existing?.remove();

  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <div class="cn-picker" id="cn-media-picker" role="dialog" aria-modal="true"
           aria-label="Choose an image">
        <div class="cn-picker__panel">
          <header class="cn-picker__head">
            <h2>Choose an image</h2>
            <button type="button" class="cn-picker__close" aria-label="Close">
              <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </header>

          <div class="cn-picker__body" id="cn-picker-grid">${loaderHtml('Loading media')}</div>
        </div>
      </div>
    `,
  );

  const dialog = qs<HTMLElement>('#cn-media-picker');
  const close = (): void => dialog?.remove();

  qs('.cn-picker__close', dialog ?? undefined)?.addEventListener('click', close);
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  document.addEventListener('keydown', function escape(event) {
    if (event.key !== 'Escape') return;
    close();
    document.removeEventListener('keydown', escape);
  });

  const grid = qs<HTMLElement>('#cn-picker-grid');
  if (!grid) return;

  try {
    const items = await loadMedia();
    grid.innerHTML = gridHtml(items, 'picker');

    qsa<HTMLButtonElement>('.cn-media__use', grid).forEach((button) => {
      button.addEventListener('click', () => {
        onPick({
          path: '',
          name: button.dataset.name ?? '',
          url: button.dataset.url ?? '',
        });
        close();
      });
    });
  } catch (error) {
    console.error('[media] picker failed', error);
    grid.innerHTML = '<p class="cn-media__error">Could not load the media library.</p>';
  }
}
