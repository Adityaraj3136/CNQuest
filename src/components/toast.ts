/** Accessible, dismissible notifications rendered into #toast-region. */

import { escapeHtml, requireEl } from '@/utils/dom';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

const ICONS: Record<ToastVariant, string> = {
  success: 'bi-check-circle-fill',
  error: 'bi-exclamation-octagon-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill',
};

const DEFAULT_DURATION_MS = 5000;

export interface ToastOptions {
  title?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. Pass 0 to keep the toast until dismissed. */
  durationMs?: number;
}

export function showToast(message: string, options: ToastOptions = {}): void {
  const { title, variant = 'info', durationMs = DEFAULT_DURATION_MS } = options;
  const region = requireEl('#toast-region');

  const toast = document.createElement('div');
  toast.className = `cn-toast cn-toast--${variant}`;
  toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
  toast.innerHTML = `
    <i class="bi ${ICONS[variant]}" aria-hidden="true"></i>
    <div class="cn-toast__body">
      ${title ? `<span class="cn-toast__title">${escapeHtml(title)}</span>` : ''}
      <span>${escapeHtml(message)}</span>
    </div>
    <button type="button" class="cn-toast__close" aria-label="Dismiss notification">&times;</button>
  `;

  const dismiss = (): void => {
    window.clearTimeout(timer);
    toast.remove();
  };

  requireEl<HTMLButtonElement>('.cn-toast__close', toast).addEventListener('click', dismiss);
  region.appendChild(toast);

  const timer = durationMs > 0 ? window.setTimeout(dismiss, durationMs) : 0;
}
