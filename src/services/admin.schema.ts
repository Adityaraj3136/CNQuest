/**
 * What each content collection looks like as a form.
 *
 * Declared as data rather than nine hand-written forms: one renderer walks these specs, so
 * adding a field is a line here, not a new template. The shapes mirror `models/content.ts` —
 * when that changes, this changes with it.
 */

// Relative, with the extension: this module is loaded directly by the Node test runner,
// which has no `@/` alias. `models/content.ts` is import-free for the same reason.
import { DICTIONARY_CATEGORIES, DIFFICULTIES, GAME_TYPES } from '../models/content.ts';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'checkboxes'
  | 'list'
  | 'pairs'
  | 'reference';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Shown under the field — say what the value is for, not what the field is called. */
  help?: string;
  /** `select` and `checkboxes`. */
  options?: readonly string[];
  /** `reference`: which collection supplies the dropdown. */
  reference?: 'units' | 'topics';
  /** `pairs`: column headings, e.g. ["Protocol", "Port"]. */
  pairLabels?: readonly [string, string];
  /** `pairs`: the two object keys each row produces. */
  pairKeys?: readonly [string, string];
  rows?: number;
}

const UNIT_REF: FieldSpec = {
  key: 'unitId',
  label: 'Unit',
  kind: 'reference',
  reference: 'units',
  required: true,
};

const TOPIC_REF: FieldSpec = {
  key: 'topicId',
  label: 'Topic',
  kind: 'reference',
  reference: 'topics',
  required: true,
};

const DIFFICULTY: FieldSpec = {
  key: 'difficulty',
  label: 'Difficulty',
  kind: 'select',
  options: DIFFICULTIES,
  required: true,
};

const ICON: FieldSpec = {
  key: 'icon',
  label: 'Icon',
  kind: 'text',
  required: true,
  help: 'A Bootstrap Icons class, e.g. bi-diagram-3. See icons.getbootstrap.com.',
};

/** Fields per collection, in the order they should be shown. `id` is handled separately. */
export const COLLECTION_FIELDS: Readonly<Record<string, readonly FieldSpec[]>> = {
  units: [
    { key: 'number', label: 'Unit number', kind: 'number', required: true },
    { key: 'title', label: 'Title', kind: 'text', required: true },
    { key: 'description', label: 'Description', kind: 'textarea', required: true, rows: 3 },
    ICON,
    { key: 'order', label: 'Sort order', kind: 'number', required: true },
  ],

  topics: [
    UNIT_REF,
    { key: 'title', label: 'Title', kind: 'text', required: true },
    { key: 'description', label: 'Short description', kind: 'textarea', required: true, rows: 2 },
    { key: 'order', label: 'Sort order', kind: 'number', required: true },
    { key: 'estimatedMinutes', label: 'Estimated minutes', kind: 'number', required: true },
    {
      key: 'hook',
      label: 'Hook',
      kind: 'textarea',
      rows: 2,
      help: 'One line naming the problem this topic solves. Shown above the notes.',
    },
    { key: 'overview', label: 'Overview', kind: 'textarea', required: true, rows: 6 },
    { key: 'keyPoints', label: 'Key points', kind: 'list', help: 'One point per line.' },
    {
      key: 'definitions',
      label: 'Definitions',
      kind: 'pairs',
      pairLabels: ['Term', 'Meaning'],
      pairKeys: ['term', 'meaning'],
    },
    { key: 'examples', label: 'Examples', kind: 'list', help: 'One example per line. Optional.' },
    {
      key: 'mediaUrl',
      label: 'Diagram or image URL',
      kind: 'text',
      help: 'Optional. A full https:// address. Leave blank for no image.',
    },
    {
      key: 'mediaCaption',
      label: 'Image caption',
      kind: 'text',
      help: 'Describes the image for anyone who cannot see it. Required if a URL is set.',
    },
    {
      key: 'pitfalls',
      label: 'Where marks get lost',
      kind: 'list',
      help: 'Common mistakes, one per line. Shown after the examples.',
    },
    {
      key: 'relatedTerms',
      label: 'Related dictionary ids',
      kind: 'list',
      help: 'One dictionary term id per line. Optional.',
    },
  ],

  questions: [
    UNIT_REF,
    TOPIC_REF,
    { key: 'question', label: 'Question', kind: 'textarea', required: true, rows: 3 },
    {
      key: 'options',
      label: 'Answer options',
      kind: 'list',
      required: true,
      help: 'One option per line. At least two.',
    },
    {
      key: 'correctAnswer',
      label: 'Correct option number',
      kind: 'number',
      required: true,
      help: 'Counting from 1, matching the list above.',
    },
    { key: 'explanation', label: 'Explanation', kind: 'textarea', required: true, rows: 3 },
    DIFFICULTY,
    {
      key: 'gameTypes',
      label: 'Used by game modes',
      kind: 'checkboxes',
      options: GAME_TYPES,
      required: true,
    },
    { key: 'tags', label: 'Tags', kind: 'list', help: 'One tag per line. Optional.' },
  ],

  riddles: [
    UNIT_REF,
    TOPIC_REF,
    { key: 'question', label: 'Riddle', kind: 'textarea', required: true, rows: 3 },
    { key: 'answer', label: 'Answer', kind: 'text', required: true },
    {
      key: 'acceptedAnswers',
      label: 'Also accept',
      kind: 'list',
      help: 'Alternative spellings or abbreviations, one per line. Case is ignored.',
    },
    { key: 'hints', label: 'Hints', kind: 'list', help: 'One per line. Each hint used lowers the reward.' },
    DIFFICULTY,
  ],

  dictionary: [
    { key: 'term', label: 'Term', kind: 'text', required: true },
    { key: 'definition', label: 'Definition', kind: 'textarea', required: true, rows: 4 },
    {
      key: 'category',
      label: 'Category',
      kind: 'select',
      options: DICTIONARY_CATEGORIES,
      required: true,
    },
    { key: 'examples', label: 'Examples', kind: 'list', help: 'One per line. Optional.' },
    {
      key: 'relatedTerms',
      label: 'Related dictionary ids',
      kind: 'list',
      help: 'One term id per line. Optional.',
    },
  ],

  achievements: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'description', label: 'Description', kind: 'textarea', required: true, rows: 2 },
    ICON,
    {
      key: 'category',
      label: 'Category',
      kind: 'select',
      options: ['progress', 'accuracy', 'streak', 'games', 'exploration'],
      required: true,
    },
    {
      key: 'target',
      label: 'Target',
      kind: 'number',
      required: true,
      help: 'The value the tracked counter must reach to unlock this badge.',
    },
    { key: 'rewardXP', label: 'Reward XP', kind: 'number', required: true },
  ],

  matchingSets: [
    UNIT_REF,
    TOPIC_REF,
    { key: 'title', label: 'Title', kind: 'text', required: true },
    { key: 'leftLabel', label: 'Left column heading', kind: 'text', required: true },
    { key: 'rightLabel', label: 'Right column heading', kind: 'text', required: true },
    {
      key: 'pairs',
      label: 'Pairs',
      kind: 'pairs',
      required: true,
      pairLabels: ['Left', 'Right'],
      pairKeys: ['left', 'right'],
    },
    DIFFICULTY,
  ],

  wordSearchSets: [
    UNIT_REF,
    TOPIC_REF,
    { key: 'title', label: 'Title', kind: 'text', required: true },
    {
      key: 'words',
      label: 'Words',
      kind: 'list',
      required: true,
      help: 'One word per line. Letters only — the grid cannot place spaces or hyphens.',
    },
    DIFFICULTY,
  ],

  bosses: [
    UNIT_REF,
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'title', label: 'Title', kind: 'text', required: true },
    ICON,
    { key: 'intro', label: 'Intro line', kind: 'textarea', required: true, rows: 2 },
    { key: 'defeatLine', label: 'Line when the student loses', kind: 'textarea', required: true, rows: 2 },
    { key: 'victoryLine', label: 'Line when the student wins', kind: 'textarea', required: true, rows: 2 },
    { key: 'hp', label: 'Boss HP', kind: 'number', required: true },
    { key: 'playerHp', label: 'Student HP', kind: 'number', required: true },
    {
      key: 'difficulties',
      label: 'Draws questions from',
      kind: 'checkboxes',
      options: DIFFICULTIES,
      required: true,
    },
  ],
};

export function fieldsFor(collectionId: string): readonly FieldSpec[] {
  return COLLECTION_FIELDS[collectionId] ?? [];
}
