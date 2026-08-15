/**
 * Minimal inline-SVG charts.
 *
 * No charting library: two small chart types do not justify a dependency, and inline SVG
 * inherits the design tokens, scales with the layout and needs no runtime.
 * Both charts carry a text summary for screen readers.
 */

import { escapeHtml } from '@/utils/dom';

const WIDTH = 100;
const HEIGHT = 34;

export interface BarPoint {
  label: string;
  value: number;
}

/**
 * Bars on a 100×34 viewBox, stretched by CSS. Zero-value bars keep a 1-unit stub so an
 * inactive day still reads as a day rather than vanishing.
 */
export function barChartSvg(points: readonly BarPoint[], title: string): string {
  if (points.length === 0) return '';

  const max = Math.max(...points.map((point) => point.value), 1);
  const slot = WIDTH / points.length;
  const barWidth = Math.max(1, slot * 0.62);

  const bars = points
    .map((point, index) => {
      const height = point.value === 0 ? 1 : Math.max(1, (point.value / max) * HEIGHT);
      const x = index * slot + (slot - barWidth) / 2;
      return `<rect x="${x.toFixed(2)}" y="${(HEIGHT - height).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" data-empty="${point.value === 0}"><title>${escapeHtml(point.label)}: ${point.value}</title></rect>`;
    })
    .join('');

  return `
    <svg class="cn-chart cn-chart--bars" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none"
         role="img" aria-label="${escapeHtml(title)}">
      ${bars}
    </svg>
  `;
}

export interface LinePoint {
  label: string;
  /** null renders a gap — a day with no activity is not a zero. */
  value: number | null;
}

/** A 0-100 line chart (accuracy) with gaps preserved and points marked. */
export function lineChartSvg(points: readonly LinePoint[], title: string): string {
  const withValues = points.filter((point) => point.value !== null);
  if (withValues.length === 0) return '';

  const step = points.length > 1 ? WIDTH / (points.length - 1) : 0;
  const toY = (value: number): number => HEIGHT - (Math.max(0, Math.min(100, value)) / 100) * HEIGHT;

  // Split into runs of consecutive readings so gaps are not bridged by a fake line.
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let run: Array<{ x: number; y: number }> = [];

  points.forEach((point, index) => {
    if (point.value === null) {
      if (run.length > 0) runs.push(run);
      run = [];
      return;
    }
    run.push({ x: index * step, y: toY(point.value) });
  });
  if (run.length > 0) runs.push(run);

  const paths = runs
    .filter((entries) => entries.length > 1)
    .map(
      (entries) =>
        `<polyline points="${entries.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" />`,
    )
    .join('');

  const dots = runs
    .flat()
    .map((point) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="1.4" />`)
    .join('');

  return `
    <svg class="cn-chart cn-chart--line" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none"
         role="img" aria-label="${escapeHtml(title)}">
      <line class="cn-chart__grid" x1="0" y1="${(HEIGHT / 2).toFixed(2)}" x2="${WIDTH}" y2="${(HEIGHT / 2).toFixed(2)}" />
      ${paths}
      ${dots}
    </svg>
  `;
}

/** Axis labels shown under a chart: first, middle and last only, to avoid crowding. */
export function axisLabelsHtml(labels: readonly string[]): string {
  if (labels.length === 0) return '';
  const middle = labels[Math.floor(labels.length / 2)];

  return `
    <div class="cn-chart__axis">
      <span>${escapeHtml(labels[0])}</span>
      <span>${escapeHtml(middle)}</span>
      <span>${escapeHtml(labels[labels.length - 1])}</span>
    </div>
  `;
}
