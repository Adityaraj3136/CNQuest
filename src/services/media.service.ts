/**
 * Lesson media stored in Cloud Storage.
 *
 * Uploading the same diagram twice because there was no way to find the first one is the
 * problem this exists to solve: every upload lands in one folder that the admin can browse,
 * reuse and clean up.
 *
 * Nothing here is a security boundary. `storage.rules` decides what the bucket accepts; these
 * checks exist so an admin gets a useful message instead of an opaque permission error.
 */

import { getFirebaseApp } from '@/config/firebase';

/** Everything lives in one folder, because a lesson diagram has no other home. */
const FOLDER = 'lesson-media';

/** Matches the ceiling in storage.rules. Checked here only to fail early and legibly. */
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export interface MediaItem {
  /** Full storage path, used as the stable identity for delete. */
  path: string;
  /** File name as uploaded, shown in the library. */
  name: string;
  /** Public download URL, which is what a topic stores. */
  url: string;
}

async function storage() {
  const { getStorage } = await import('firebase/storage');
  return getStorage(getFirebaseApp());
}

/**
 * Makes a file name that cannot collide.
 *
 * Two people uploading `diagram.png` a month apart must not overwrite each other, and the
 * original name is kept in front so the library stays browsable rather than a list of ids.
 */
function uniqueName(fileName: string): string {
  const safe = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-60);

  return `${Date.now()}-${safe || 'image'}`;
}

export function validateMediaFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'That file is not an image. Upload a PNG, JPG, SVG or WebP.';
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`;
  }
  return null;
}

/** Uploads one image and returns the item, ready to be used by a lesson. */
export async function uploadMedia(file: File): Promise<MediaItem> {
  const problem = validateMediaFile(file);
  if (problem) throw new Error(problem);

  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const path = `${FOLDER}/${uniqueName(file.name)}`;
  const handle = ref(await storage(), path);

  await uploadBytes(handle, file, { contentType: file.type });

  return { path, name: file.name, url: await getDownloadURL(handle) };
}

/**
 * Everything already uploaded, newest first.
 *
 * The name carries the upload timestamp, so sorting by name descending is the same as sorting
 * by recency without a second metadata read per file.
 */
export async function listMedia(): Promise<MediaItem[]> {
  const { ref, listAll, getDownloadURL } = await import('firebase/storage');
  const folder = ref(await storage(), FOLDER);

  const listing = await listAll(folder);

  const items = await Promise.all(
    listing.items.map(async (entry) => ({
      path: entry.fullPath,
      name: entry.name.replace(/^\d+-/, ''),
      url: await getDownloadURL(entry),
    })),
  );

  return items.sort((a, b) => b.path.localeCompare(a.path));
}

export async function deleteMedia(path: string): Promise<void> {
  const { ref, deleteObject } = await import('firebase/storage');
  await deleteObject(ref(await storage(), path));
}
