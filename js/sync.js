import { CONFIG, SYNC_ENABLED } from './config.js';
import { applyRemote, allLocal, setSyncHook, getVersion } from './store.js';
import { get as getSetting } from './settings.js';
import { toast } from './ui.js';

const TABLE = 'trip_items';
const listeners = new Set();
let status = { state: SYNC_ENABLED ? 'idle' : 'disabled', last: null, message: '' };
let pushing = false;
let pushTimer = null;
let lastPushedVersion = 0;

function baseUrl() {
  return CONFIG.supabaseUrl.replace(/\/$/, '');
}

function headers(extra = {}) {
  const token = authToken();
  return {
    apikey: CONFIG.supabaseAnonKey,
    Authorization: `Bearer ${token || CONFIG.supabaseAnonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export function authToken() {
  try {
    const raw = localStorage.getItem('viaje.session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.access_token) return null;
    if (session.expires_at && Date.now() > session.expires_at - 30000) {
      refreshSession(session).catch(() => {});
    }
    return session.access_token;
  } catch (_) {
    return null;
  }
}

export function setStatus(next) {
  status = { ...status, ...next };
  for (const fn of listeners) fn(status);
}

export function onStatus(fn) {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

export async function signup(email, password) {
  const res = await fetch(`${baseUrl()}/auth/v1/signup`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || 'No se pudo registrar');
  if (data.access_token) saveSession(data);
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Credenciales inválidas');
  saveSession(data);
  setStatus({ state: 'idle', message: 'Sesión iniciada' });
  return data;
}

export async function logout() {
  localStorage.removeItem('viaje.session');
  setStatus({ state: SYNC_ENABLED ? 'idle' : 'disabled', message: 'Sesión cerrada' });
}

export function currentUser() {
  try {
    const raw = localStorage.getItem('viaje.session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s.user || null;
  } catch (_) {
    return null;
  }
}

function saveSession(data) {
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: data.user,
  };
  localStorage.setItem('viaje.session', JSON.stringify(session));
}

async function refreshSession(session) {
  const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) throw new Error('refresh failed');
  saveSession(await res.json());
}

async function rest(path, options = {}) {
  if (!SYNC_ENABLED) throw new Error('Sync no configurado');
  const res = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch (_) {
      /* noop */
    }
    throw new Error(`Supabase ${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function pull() {
  if (!SYNC_ENABLED) return false;
  if (!currentUser()) return false;
  setStatus({ state: 'syncing', message: 'Descargando…' });
  try {
    const rows = await rest(`${TABLE}?select=id,collection,deleted,updated_at,created_at,data`);
    const remote = (rows || []).map((row) => ({
      ...(row.data || {}),
      id: row.id,
      collection: row.collection,
      updated_at: row.updated_at,
      created_at: row.created_at,
      deleted: row.deleted,
    }));
    await applyRemote(remote);
    setStatus({ state: 'ok', message: 'Sincronizado', last: new Date() });
    return true;
  } catch (e) {
    setStatus({ state: 'error', message: e.message });
    return false;
  }
}

function rowFor(item) {
  const data = { ...item };
  delete data.id;
  delete data.collection;
  delete data.updated_at;
  delete data.created_at;
  delete data.deleted;
  return {
    id: item.id,
    collection: item.collection,
    deleted: !!item.deleted,
    updated_at: item.updated_at,
    created_at: item.created_at,
    data,
  };
}

export async function pushItem(item) {
  if (!SYNC_ENABLED || !currentUser() || !item) return;
  if (!getSetting('autoSync')) return;
  if (!networkAllowed()) return;
  schedulePush();
}

function networkAllowed() {
  if (!getSetting('syncWifiOnly')) return true;
  const c = navigator.connection;
  if (!c || !c.type) return true;
  return c.type === 'wifi' || c.type === 'ethernet';
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushAll, 1200);
}

export async function pushAll() {
  if (!SYNC_ENABLED || !currentUser() || pushing) return;
  pushing = true;
  try {
    setStatus({ state: 'syncing', message: 'Subiendo…' });
    const items = allLocal().filter((i) => i.updated_at);
    const rows = items.map(rowFor);
    if (rows.length) {
      await rest(`${TABLE}?on_conflict=id`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
    }
    setStatus({ state: 'ok', message: 'Sincronizado', last: new Date() });
    lastPushedVersion = getVersion();
  } catch (e) {
    setStatus({ state: 'error', message: e.message });
  } finally {
    pushing = false;
  }
}

export async function syncNow() {
  if (!SYNC_ENABLED) {
    toast('Configura Supabase en js/config.js', 'error');
    return;
  }
  if (!currentUser()) {
    toast('Inicia sesión para sincronizar', 'error');
    return;
  }
  await pushAll();
  await pull();
  toast('Sincronización completada', 'success');
}

export function initSync() {
  setSyncHook(pushItem);
  if (!SYNC_ENABLED) {
    setStatus({ state: 'disabled', message: 'Solo local' });
    return;
  }
  addEventListener('online', () => {
    if (currentUser() && getSetting('autoSync') && networkAllowed()) pull();
    if (currentUser() && getSetting('autoSync') && networkAllowed()) pushAll();
  });
  if (currentUser()) pull();

  setInterval(() => {
    if (!SYNC_ENABLED || !currentUser() || !getSetting('autoSync') || !networkAllowed()) return;
    if (getVersion() <= lastPushedVersion) return;
    pushAll();
  }, 5000);
}
