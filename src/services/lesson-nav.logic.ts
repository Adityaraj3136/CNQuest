/**
 * Where a lesson sits in the syllabus, and what comes either side of it.
 *
 * Derived from the syllabus ordering rather than hardcoded, so adding or reordering a topic
 * moves the navigation with it. Pure: no DOM, no Firestore.
 *
 * The edge cases are the whole job. First lesson of the first unit has no previous quest but
 * still needs somewhere to go; last lesson of a unit leads into the next unit rather than
 * nowhere; last lesson of the final unit ends the syllabus. Leaving any of those blank is how
 * a student reaches the bottom of a page and stops.
 */

export interface NavTopic {
  id: string;
  title: string;
  unitId: string;
  order: number;
}

export interface NavUnit {
  id: string;
  number: number;
  title: string;
  order: number;
}

export type NeighbourKind = 'topic' | 'unit' | 'syllabus-start' | 'syllabus-end';

export interface Neighbour {
  kind: NeighbourKind;
  /** What the link says, e.g. "OSI Model" or "Physical Layer". */
  label: string;
  /** Small line above the label, e.g. "Next quest" or "Next unit". */
  caption: string;
  href: string;
}

export interface LessonPosition {
  unit: NavUnit;
  /** 1-based position within the unit. */
  index: number;
  total: number;
  /** Every topic in this unit, in order, for the quest strip. */
  siblings: NavTopic[];
  previous: Neighbour;
  next: Neighbour;
}

function byOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

function topicHref(id: string): string {
  return `#/learn/${encodeURIComponent(id)}`;
}

/**
 * Works out the lesson's place in the syllabus.
 *
 * Returns null only when the topic or its unit is genuinely missing, which the page treats as
 * a not-found rather than rendering half a navigation bar.
 */
export function lessonPosition(
  topicId: string,
  units: readonly NavUnit[],
  topics: readonly NavTopic[],
): LessonPosition | null {
  const topic = topics.find((entry) => entry.id === topicId);
  if (!topic) return null;

  const orderedUnits = byOrder(units);
  const unitIndex = orderedUnits.findIndex((entry) => entry.id === topic.unitId);
  if (unitIndex === -1) return null;

  const unit = orderedUnits[unitIndex];
  const siblings = byOrder(topics.filter((entry) => entry.unitId === unit.id));
  const index = siblings.findIndex((entry) => entry.id === topicId);

  const previousTopic = index > 0 ? siblings[index - 1] : null;
  const nextTopic = index < siblings.length - 1 ? siblings[index + 1] : null;

  const previousUnit = unitIndex > 0 ? orderedUnits[unitIndex - 1] : null;
  const nextUnit = unitIndex < orderedUnits.length - 1 ? orderedUnits[unitIndex + 1] : null;

  return {
    unit,
    index: index + 1,
    total: siblings.length,
    siblings,
    previous: previousNeighbour(previousTopic, previousUnit, topics),
    next: nextNeighbour(nextTopic, nextUnit, topics),
  };
}

function previousNeighbour(
  previousTopic: NavTopic | null,
  previousUnit: NavUnit | null,
  topics: readonly NavTopic[],
): Neighbour {
  if (previousTopic) {
    return {
      kind: 'topic',
      caption: 'Previous quest',
      label: previousTopic.title,
      href: topicHref(previousTopic.id),
    };
  }

  // First lesson of a unit: step back into the last lesson of the unit before it.
  if (previousUnit) {
    const last = byOrder(topics.filter((entry) => entry.unitId === previousUnit.id)).at(-1);
    if (last) {
      return {
        kind: 'unit',
        caption: `Back to ${previousUnit.title}`,
        label: last.title,
        href: topicHref(last.id),
      };
    }
  }

  // First lesson of the first unit. There is no previous quest, but there is still a way out.
  return {
    kind: 'syllabus-start',
    caption: 'You are at the start',
    label: 'All units',
    href: '#/learn',
  };
}

function nextNeighbour(
  nextTopic: NavTopic | null,
  nextUnit: NavUnit | null,
  topics: readonly NavTopic[],
): Neighbour {
  if (nextTopic) {
    return {
      kind: 'topic',
      caption: 'Next quest',
      label: nextTopic.title,
      href: topicHref(nextTopic.id),
    };
  }

  if (nextUnit) {
    const first = byOrder(topics.filter((entry) => entry.unitId === nextUnit.id))[0];
    if (first) {
      return {
        kind: 'unit',
        caption: 'Next unit',
        label: nextUnit.title,
        href: topicHref(first.id),
      };
    }
  }

  return {
    kind: 'syllabus-end',
    caption: 'Last quest in the syllabus',
    label: 'Review your progress',
    href: '#/progress',
  };
}
