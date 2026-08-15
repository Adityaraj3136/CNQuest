#!/usr/bin/env node
/**
 * Uploads the bundled seed content to Cloud Firestore.
 *
 * The app works without this — it falls back to the same data bundled in the client.
 * Run it when you want content to be editable in the Firebase Console without a redeploy.
 *
 *   node scripts/seed.mjs --dry-run     # show what would be written
 *   node scripts/seed.mjs               # write to Firestore
 *   node scripts/seed.mjs --only=questions,topics
 *
 * Credentials, in order of preference:
 *   1. GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON file
 *   2. ./serviceAccountKey.json in the project root (git-ignored)
 *
 * Never commit the service-account key. It bypasses all security rules.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// pathToFileURL is required on Windows — a bare `c:\...` path is not a valid ESM specifier.
const {
  UNITS,
  TOPICS,
  QUESTIONS,
  RIDDLES,
  DICTIONARY,
  ACHIEVEMENTS,
  MATCHING_SETS,
  WORD_SEARCH_SETS,
  BOSSES,
} = await import(pathToFileURL(resolve(projectRoot, 'src/data/index.ts')).href);

/** Firestore collection name → seed array. Document ids come from each item's `id`. */
const COLLECTIONS = {
  units: UNITS,
  topics: TOPICS,
  questions: QUESTIONS,
  riddles: RIDDLES,
  dictionary: DICTIONARY,
  achievements: ACHIEVEMENTS,
  matchingSets: MATCHING_SETS,
  wordSearchSets: WORD_SEARCH_SETS,
  bosses: BOSSES,
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyArg = args.find((arg) => arg.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : null;

const selected = Object.entries(COLLECTIONS).filter(([name]) => !only || only.includes(name));

if (selected.length === 0) {
  console.error(`No matching collections. Available: ${Object.keys(COLLECTIONS).join(', ')}`);
  process.exit(1);
}

const total = selected.reduce((sum, [, items]) => sum + items.length, 0);
console.log(`CN Quest seed — ${selected.length} collections, ${total} documents.\n`);

for (const [name, items] of selected) {
  console.log(`  ${name.padEnd(16)} ${String(items.length).padStart(4)} documents`);
}

if (dryRun) {
  console.log('\nDry run — nothing was written.');
  process.exit(0);
}

// ---- Credentials ----

function loadCredential() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fallback = resolve(projectRoot, 'serviceAccountKey.json');
  const keyPath = envPath ?? (existsSync(fallback) ? fallback : null);

  if (!keyPath) {
    console.error(
      '\nNo service-account credentials found.\n' +
        'Firebase Console → Project settings → Service accounts → Generate new private key,\n' +
        'save it as serviceAccountKey.json in the project root (it is git-ignored),\n' +
        'or set GOOGLE_APPLICATION_CREDENTIALS to its path.',
    );
    process.exit(1);
  }

  if (!existsSync(keyPath)) {
    console.error(`\nCredential file not found: ${keyPath}`);
    process.exit(1);
  }

  return JSON.parse(readFileSync(keyPath, 'utf8'));
}

const serviceAccount = loadCredential();

let admin;
try {
  admin = await import('firebase-admin/app');
} catch {
  console.error('\nfirebase-admin is not installed. Run: npm install --save-dev firebase-admin');
  process.exit(1);
}

const { cert, initializeApp } = admin;
const { getFirestore } = await import('firebase-admin/firestore');

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

console.log(`\nWriting to project "${serviceAccount.project_id}"…`);

// Firestore batches cap at 500 operations.
const BATCH_LIMIT = 450;

for (const [name, items] of selected) {
  let written = 0;

  for (let start = 0; start < items.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    for (const item of items.slice(start, start + BATCH_LIMIT)) {
      if (!item.id) throw new Error(`Item in "${name}" has no id: ${JSON.stringify(item).slice(0, 80)}`);
      // merge:true so re-seeding updates content without wiping fields added elsewhere.
      batch.set(db.collection(name).doc(item.id), item, { merge: true });
    }
    await batch.commit();
    written += Math.min(BATCH_LIMIT, items.length - start);
  }

  console.log(`  ✓ ${name.padEnd(16)} ${written} documents`);
}

console.log('\nSeed complete. Reload CN Quest — the Learn screen will show "Live content".');
process.exit(0);
