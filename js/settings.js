import { CONFIG } from './config.js';

const KEY = 'viaje.settings.v1';

const DEFAULTS = {
  tripName: CONFIG.appName,
  tripStart: '',
  theme: 'system',
  locale: 'es-ES',
  currency: CONFIG.baseCurrency,
  rates: { ...CONFIG.rates },
  people: ['Sebastian', 'Claudia', 'Roberto', 'Marcela', 'Leonor'],
  currentPerson: '',
  gastoCategories: ['Transporte', 'Alojamiento', 'Comida', 'Entradas', 'Compras', 'Salud', 'Otros'],
  metodos: ['Efectivo', 'Tarjeta', 'Bizum', 'Otro'],
  countryOrder: ['España', 'Italia', 'Francia'],
  mapApp: 'google',
  openInApp: true,
  travelMode: 'driving',
  showStreetView: true,
  photoSource: 'images',
  searchEngine: 'google',
  defaultReminderMin: 30,
  autoSync: true,
  syncWifiOnly: false,
  syncInterval: 'manual',
  pullInterval: 60,
  expandedDays: [],
  showPastDays: false,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, rates: { ...DEFAULTS.rates, ...(parsed.rates || {}) } };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

let cache = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (_) {
    /* almacenamiento lleno o bloqueado */
  }
}

function emit() {
  for (const fn of listeners) fn({ ...cache });
}

export function get(key) {
  return cache[key];
}

export function all() {
  return { ...cache, rates: { ...cache.rates } };
}

export function set(key, value) {
  cache[key] = value;
  persist();
  emit();
}

export function setMany(obj) {
  cache = { ...cache, ...obj };
  persist();
  emit();
}

export function setRate(code, value) {
  cache.rates = { ...cache.rates, [code]: Number(value) || 0 };
  persist();
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reset() {
  cache = { ...DEFAULTS, rates: { ...DEFAULTS.rates } };
  persist();
  emit();
}

export function defaults() {
  return { ...DEFAULTS, rates: { ...DEFAULTS.rates } };
}
