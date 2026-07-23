/**
 * Local project + version storage on IndexedDB — the data layer behind
 * Fusion-style autosave, version history, and the recent-projects list.
 *
 * Records are small JSON payloads (the same StructurePayload/ExpressPayload
 * shapes as project files), so quota is a non-issue in practice. Every public
 * function degrades gracefully (empty results / no-ops) when IndexedDB is
 * unavailable, so the builders never crash from storage problems.
 */

export type ProjectKind = 'structure' | 'express';

export type ProjectMeta = {
  id: string;
  name: string;
  kind: ProjectKind;
  createdAt: string;
  updatedAt: string;
};

export type VersionRecord = {
  id: string;
  projectId: string;
  kind: ProjectKind;
  savedAt: string;
  /** True for debounced autosaves; false for manual checkpoints. */
  auto: boolean;
  /** User-given checkpoint name. Labeled versions are never pruned. */
  label?: string;
  payload: unknown;
};

/** How many autosaves to keep per project (manual checkpoints keep forever). */
export const AUTOSAVE_KEEP = 50;

const DB_NAME = 'profile-builder-projects';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('versions')) {
          const store = db.createObjectStore('versions', { keyPath: 'id' });
          store.createIndex('byProject', 'projectId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    });
    // A failed open should be retryable, not cached forever.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function requestAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    const db = await openDb();
    const all = await requestAsPromise(
      db.transaction('projects').objectStore('projects').getAll() as IDBRequest<
        ProjectMeta[]
      >,
    );
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function getProject(id: string): Promise<ProjectMeta | null> {
  try {
    const db = await openDb();
    const rec = await requestAsPromise(
      db.transaction('projects').objectStore('projects').get(id) as IDBRequest<
        ProjectMeta | undefined
      >,
    );
    return rec ?? null;
  } catch {
    return null;
  }
}

export async function putProject(meta: ProjectMeta): Promise<void> {
  try {
    const db = await openDb();
    await requestAsPromise(
      db.transaction('projects', 'readwrite').objectStore('projects').put(meta),
    );
  } catch {
    /* storage unavailable — skip */
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await openDb();
    const versions = await listVersions(id);
    const tx = db.transaction(['projects', 'versions'], 'readwrite');
    tx.objectStore('projects').delete(id);
    const vStore = tx.objectStore('versions');
    for (const v of versions) vStore.delete(v.id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('delete failed'));
    });
  } catch {
    /* storage unavailable — skip */
  }
}

/** All versions of a project, newest first. */
export async function listVersions(projectId: string): Promise<VersionRecord[]> {
  try {
    const db = await openDb();
    const all = await requestAsPromise(
      db
        .transaction('versions')
        .objectStore('versions')
        .index('byProject')
        .getAll(projectId) as IDBRequest<VersionRecord[]>,
    );
    return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export async function getVersion(id: string): Promise<VersionRecord | null> {
  try {
    const db = await openDb();
    const rec = await requestAsPromise(
      db.transaction('versions').objectStore('versions').get(id) as IDBRequest<
        VersionRecord | undefined
      >,
    );
    return rec ?? null;
  } catch {
    return null;
  }
}

export async function addVersion(record: VersionRecord): Promise<void> {
  try {
    const db = await openDb();
    await requestAsPromise(
      db.transaction('versions', 'readwrite').objectStore('versions').put(record),
    );
  } catch {
    /* storage unavailable — skip */
  }
}

/** Update a stored version (e.g. to label/promote an autosave). */
export async function updateVersion(
  id: string,
  patch: Partial<Pick<VersionRecord, 'label' | 'auto'>>,
): Promise<void> {
  const existing = await getVersion(id);
  if (!existing) return;
  await addVersion({ ...existing, ...patch });
}

/**
 * Which versions should be pruned: autosaves beyond the newest `keep`,
 * counting only unlabeled autosaves. Manual/labeled checkpoints are kept
 * forever. Pure — exported for tests. Input order does not matter.
 */
export function pruneCandidates(
  versions: Pick<VersionRecord, 'id' | 'savedAt' | 'auto' | 'label'>[],
  keep: number,
): string[] {
  return versions
    .filter((v) => v.auto && !v.label)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(Math.max(0, keep))
    .map((v) => v.id);
}

/** Delete old autosaves beyond the retention window. */
export async function pruneAutosaves(
  projectId: string,
  keep = AUTOSAVE_KEEP,
): Promise<void> {
  try {
    const versions = await listVersions(projectId);
    const doomed = pruneCandidates(versions, keep);
    if (doomed.length === 0) return;
    const db = await openDb();
    const tx = db.transaction('versions', 'readwrite');
    const store = tx.objectStore('versions');
    for (const id of doomed) store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('prune failed'));
    });
  } catch {
    /* storage unavailable — skip */
  }
}

/** "just now", "4 min ago", "2 h ago", "yesterday", or a local date. Pure. */
export function relativeTime(iso: string, nowMs: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const sec = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${Math.max(1, min)} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString();
}
