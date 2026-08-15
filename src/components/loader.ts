/** Loading, skeleton and state markup shared across screens. */

import { escapeHtml } from '@/utils/dom';

/** An indeterminate sweeping rule — the system's progress language, not a spinner. */
export function loaderHtml(message = 'Loading'): string {
  return `
    <div class="cn-loader" role="status" aria-live="polite">
      <span class="cn-loader__label">${escapeHtml(message)}</span>
      <div class="cn-loader__track" aria-hidden="true"></div>
    </div>
  `;
}

export function skeletonHtml(count = 3, height = '80px'): string {
  return `
    <div class="cn-stack" aria-hidden="true">
      ${Array.from(
        { length: count },
        () => `<div class="cn-skeleton" style="height:${escapeHtml(height)}"></div>`,
      ).join('')}
    </div>
  `;
}

export interface StateOptions {
  icon?: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

/** Friendly error/empty state. Never shows raw stack traces to students. */
export function stateHtml({
  icon = 'bi-exclamation-diamond',
  title,
  message,
  actionLabel,
  actionHref,
}: StateOptions): string {
  return `
    <div class="cn-state">
      <i class="bi ${escapeHtml(icon)} cn-state__icon" aria-hidden="true"></i>
      <h1 class="cn-section__title">${escapeHtml(title)}</h1>
      <p class="cn-ink-soft cn-measure">${escapeHtml(message)}</p>
      ${
        actionLabel && actionHref
          ? `<a class="btn btn-cn-primary" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>`
          : ''
      }
    </div>
  `;
}
