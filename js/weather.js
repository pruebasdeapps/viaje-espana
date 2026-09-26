import { list as storeList } from './store.js';
import { CITY_COUNTRY } from './geo.js';

const CACHE_MS = 3 * 60 * 60 * 1000;
const STATIC_COORDS = {
  Lima: { lat: -12.0464, lng: -77.0428 },
  Madrid: { lat: 40.4168, lng: -3.7038 },
  Toledo: { lat: 39.8628, lng: -4.0273 },
  Roma: { lat: 41.9028, lng: 12.4964 },
  Pisa: { lat: 43.7228, lng: 10.4017 },
  Florencia: { lat: 43.7696, lng: 11.2558 },
  'París': { lat: 48.8566, lng: 2.3522 },
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  Granada: { lat: 37.1773, lng: -3.5986 },
};
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
  if (l) return { lat: l.lat, lng: l.lng };
  return STATIC_COORDS[ciudad] || null;
}

function minutesOf(hora) {
  if (!hora) return 0;
  const [hh, mm] = hora.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

function cityFromItinerario(fecha) {
  const acts = storeList('itinerario').filter((i) => i.fecha === fecha);
  for (const a of acts) {
    const text = (a.lugar || '') + ' ' + (a.direccion || '');
    for (const city of Object.keys(CITY_COUNTRY)) if (text.includes(city)) return city;
  }
  return null;
}

function coveringHospedajes(fecha) {
  return storeList('hospedajes').filter((h) => h.fecha_in && h.fecha_out && h.fecha_in <= fecha && h.fecha_out >= fecha);
}

export function cityForMoment(fecha, nowMin) {
  const hosp = coveringHospedajes(fecha);
  if (!hosp.length) return cityFromItinerario(fecha);
  if (hosp.length === 1) return hosp[0].ciudad;
  const outCity = hosp.reduce((a, b) => (a.fecha_out <= b.fecha_out ? a : b));
  const inCity = hosp.reduce((a, b) => (a.fecha_in >= b.fecha_in ? a : b));
  const vuelo = storeList('documentos').find((d) => d.tipo === 'Vuelo' && d.fecha === fecha && d.hora);
  if (vuelo && vuelo.hora) return nowMin < minutesOf(vuelo.hora) ? outCity.ciudad : inCity.ciudad;
  return inCity.ciudad;
}

export function cityForDay(fecha) {
  const hosp = coveringHospedajes(fecha);
  if (!hosp.length) return cityFromItinerario(fecha);
  if (hosp.length === 1) return hosp[0].ciudad;
  return hosp.reduce((a, b) => (a.fecha_in >= b.fecha_in ? a : b)).ciudad;
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
