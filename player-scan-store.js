// player-scan-store.js
// Persist large player scan results locally so the UI (and stats tools) can query them later.
// Uses IndexedDB to avoid localStorage size limits.

const DB_NAME = "fogo_fishing";
const DB_VERSION = 1;
const STORE = "player_scans";
const KEY_LATEST = "latest";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const st = tx.objectStore(store);
    const req = st.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, store, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const st = tx.objectStore(store);
    const req = st.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const st = tx.objectStore(store);
    const req = st.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save the latest scan.
 *
 * `rows` should be minimal objects: { owner: string, unprocessedFishRaw: string }
 * `global` should be minimal objects: { totalUnprocessedFishRaw?: string }
 */
export async function savePlayerScan({ fetchedAt, rows, global }) {
  const db = await openDb();
  const payload = {
    fetchedAt: fetchedAt ?? Date.now(),
    rows: Array.isArray(rows) ? rows : [],
    global: global ?? null,
  };
  await idbPut(db, STORE, KEY_LATEST, payload);
}

/** Load the latest scan (or null). */
export async function loadPlayerScan() {
  const db = await openDb();
  return await idbGet(db, STORE, KEY_LATEST);
}

/** Clear the cached scan. */
export async function clearPlayerScan() {
  const db = await openDb();
  await idbDelete(db, STORE, KEY_LATEST);
}
