import { allItems, putItem, putItems, wipe } from './db.js';
import { uid } from './ui.js';

const listeners = new Set();
let cache = new Map();
let syncHook = null;

async function loadSeed() {
  let data = [];
  try {
    const m = await import('./seed.js');
    if (m.seedData) data = m.seedData;
  } catch (_) {
    /* sin seed.js */
  }
  try {
    const m = await import('./seed.local.js');
    if (m.seedData && m.seedData.length) data = m.seedData;
  } catch (_) {
    /* sin datos locales */
  }
  return data;
}

export function setSyncHook(fn) {
  syncHook = fn;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

function notify(item) {
  if (typeof syncHook === 'function') {
    Promise.resolve(syncHook(item)).catch((e) => console.warn('sync push', e));
  }
}

function normalize(raw) {
  const now = new Date().toISOString();
  return {
    id: raw.id || uid(),
    created_at: raw.created_at || now,
    updated_at: raw.updated_at || now,
    deleted: false,
    ...raw,
  };
}

async function seed(data) {
  for (const raw of data) {
    const item = normalize(raw);
    cache.set(item.id, item);
    await putItem(item);
  }
}

export async function initStore() {
  const items = await allItems();
  cache = new Map(items.map((i) => [i.id, i]));
  if (cache.size === 0) {
    const data = await loadSeed();
    if (data.length) await seed(data);
  }
  emit();
}

function sortFor(collection, a, b) {
  const val = (x) => (x.fecha || '') + ' ' + (x.hora || '');
  if (collection === 'itinerario') return val(a).localeCompare(val(b));
  if (collection === 'gastos') return val(b).localeCompare(val(a));
  if (collection === 'documentos') return val(a).localeCompare(val(b));
  return (a.created_at || '').localeCompare(b.created_at || '');
}

export function list(collection) {
  return [...cache.values()]
    .filter((i) => i.collection === collection && !i.deleted)
    .sort((a, b) => sortFor(collection, a, b));
}

export function get(id) {
  return cache.get(id);
}

export function allLocal() {
  return [...cache.values()];
}

export async function save(collection, data) {
  const now = new Date().toISOString();
  const id = data.id || uid();
  const existing = cache.get(id) || {};
  const item = {
    ...existing,
    ...data,
    id,
    collection,
    deleted: false,
    created_at: existing.created_at || now,
    updated_at: now,
  };
  cache.set(id, item);
  await putItem(item);
  notify(item);
  emit();
  return item;
}

export async function remove(id) {
  const existing = cache.get(id);
  if (!existing) return;
  const item = { ...existing, deleted: true, updated_at: new Date().toISOString() };
  cache.set(id, item);
  await putItem(item);
  notify(item);
  emit();
}

export async function applyRemote(remoteItems) {
  let changed = false;
  const toStore = [];
  for (const remote of remoteItems) {
    const local = cache.get(remote.id);
    const remoteTime = new Date(remote.updated_at || 0).getTime();
    const localTime = local ? new Date(local.updated_at || 0).getTime() : 0;
    if (!local || remoteTime > localTime) {
      const merged = { ...(local || {}), ...remote };
      cache.set(remote.id, merged);
      toStore.push(merged);
      changed = true;
    }
  }
  if (toStore.length) {
    await putItems(toStore);
    emit();
  }
  return changed;
}

export function exportJSON() {
  return JSON.stringify(
    {
      app: 'viaje',
      version: 1,
      exported_at: new Date().toISOString(),
      items: allLocal(),
    },
    null,
    2
  );
}

export async function importJSON(text) {
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) throw new Error('Archivo no válido');
  const now = new Date().toISOString();
  const normalized = items.map((raw) => ({
    ...raw,
    id: raw.id || uid(),
    updated_at: now,
    created_at: raw.created_at || now,
    deleted: !!raw.deleted,
  }));
  await putItems(normalized);
  for (const item of normalized) cache.set(item.id, item);
  emit();
  return normalized.length;
}

export async function resetAll() {
  await wipe();
  cache = new Map();
  const data = await loadSeed();
  if (data.length) await seed(data);
  emit();
}
