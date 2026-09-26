import { list as storeList } from './store.js';

const CACHE_MS = 3 * 60 * 60 * 1000;
const CODE = {
  0: ['Despejado', 'sol'],
  1: ['Mayormente despejado', 'sol'],
  2: ['Parcialmente nublado', 'parcial'],
  3: ['Nublado', 'nube'],
  45: ['Niebla', 'niebla'],
  48: ['Niebla', 'niebla'],
  51: ['Llovizna', 'lluvia'],
  53: ['Llovizna', 'lluvia'],
  55: ['Llovizna', 'lluvia'],
  61: ['Lluvia', 'lluvia'],
  63: ['Lluvia', 'lluvia'],
  65: ['Lluvia fuerte', 'lluvia'],
  71: ['Nieve', 'nieve'],
  73: ['Nieve', 'nieve'],
  75: ['Nieve fuerte', 'nieve'],
  80: ['Chubascos', 'lluvia'],
  81: ['Chubascos', 'lluvia'],
  82: ['Chubascos fuertes', 'lluvia'],
  95: ['Tormenta', 'tormenta'],
  96: ['Tormenta', 'tormenta'],
  99: ['Tormenta', 'tormenta'],
};

function cacheGet(key) {
  try {
    const raw = localStorage.getItem('weather:' + key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (Date.now() - o.t > CACHE_MS) return null;
    return o.d;
  } catch (_) {
    return null;
  }
}

function cacheSet(key, d) {
  try {
    localStorage.setItem('weather:' + key, JSON.stringify({ t: Date.now(), d }));
  } catch (_) {
    /* almacenamiento lleno */
  }
}

export function coordsForCity(ciudad) {
  if (!ciudad) return null;
  const l = storeList('lugares').find((x) => x.ciudad === ciudad && x.lat && x.lng);
  return l ? { lat: l.lat, lng: l.lng } : null;
}

export async function forecast(lat, lng, fecha) {
  if (lat == null || lng == null || !fecha) return null;
  const key = lat + ',' + lng;
  let data = cacheGet(key);
  if (!data) {
    try {
      const url =
        'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16';
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      data = { time: j.daily.time, code: j.daily.weather_code, tmax: j.daily.temperature_2m_max, tmin: j.daily.temperature_2m_min };
      cacheSet(key, data);
    } catch (_) {
      return null;
    }
  }
  const idx = data.time.indexOf(fecha);
  if (idx === -1) return null;
  const code = data.code[idx];
  const [desc, ico] = CODE[code] || ['—', 'info'];
  return { desc, ico, tmax: data.tmax[idx], tmin: data.tmin[idx], code };
}
