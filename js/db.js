const DB_NAME = 'viaje-db';
const DB_VERSION = 2;
const STORE = 'items';
const FILES = 'files';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('collection', 'collection', { unique: false });
        store.createIndex('updated_at', 'updated_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(FILES)) {
        db.createObjectStore(FILES, { keyPath: 'path' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function fileTx(mode) {
  return openDB().then((db) => db.transaction(FILES, mode).objectStore(FILES));
}

export async function allItems() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function putItem(item) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

export async function putItems(items) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const t = store.transaction;
    items.forEach((it) => store.put(it));
    t.oncomplete = () => resolve(items);
    t.onerror = () => reject(t.error);
  });
}

export async function wipe() {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function persistStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch (_) {
    /* noop */
  }
  return false;
}

export async function putFile(record) {
  const store = await fileTx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function getFile(path) {
  const store = await fileTx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(path);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFile(path) {
  const store = await fileTx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(path);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
