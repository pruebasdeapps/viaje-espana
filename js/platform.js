import { all as settings } from './settings.js';

export function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

const q = (s) => encodeURIComponent(String(s == null ? '' : s).trim());

function coords(lugar) {
  const lat = lugar && lugar.lat;
  const lng = lugar && lugar.lng;
  return lat != null && lng != null && lat !== '' && lng !== '' ? `${lat},${lng}` : null;
}

function label(lugar) {
  return q(`${lugar.nombre || ''} ${lugar.direccion || ''} ${lugar.ciudad || ''} España`.trim());
}

export function openExternal(url) {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function mapUrl(lugar) {
  const c = coords(lugar);
  if (settings().mapApp === 'apple') {
    return c ? `https://maps.apple.com/?q=${c}` : `https://maps.apple.com/?q=${label(lugar)}`;
  }
  return c
    ? `https://www.google.com/maps/search/?api=1&query=${c}`
    : `https://www.google.com/maps/search/?api=1&query=${label(lugar)}`;
}

export function directionsUrl(lugar) {
  const c = coords(lugar);
  const mode = settings().travelMode || 'driving';
  if (settings().mapApp === 'apple') {
    return c ? `https://maps.apple.com/?daddr=${c}` : `https://maps.apple.com/?daddr=${label(lugar)}`;
  }
  const m = { driving: 'driving', transit: 'transit', walking: 'walking', bicycling: 'bicycling' }[mode] || 'driving';
  return c
    ? `https://www.google.com/maps/dir/?api=1&destination=${c}&travelmode=${m}`
    : `https://www.google.com/maps/dir/?api=1&destination=${label(lugar)}&travelmode=${m}`;
}

export function streetViewUrl(lugar) {
  const c = coords(lugar);
  if (!c) return null;
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c}`;
}

export function photosUrl(lugar) {
  const name = q(`${lugar.nombre || ''} ${lugar.ciudad || ''} ${lugar.direccion || ''}`.trim());
  if (settings().photoSource === 'maps') return mapUrl(lugar);
  return `https://www.google.com/search?tbm=isch&q=${name}`;
}

export function searchUrl(query) {
  return `https://www.google.com/search?q=${q(query)}`;
}

export function mapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${q(query)}`;
}

export function telUrl(phone) {
  return `tel:${String(phone).replace(/[^\d+]/g, '')}`;
}

const pad = (n) => String(n).padStart(2, '0');

function addMinutes(fecha, hora, min) {
  const d = new Date(`${fecha || '1970-01-01'}T${hora || '00:00'}`);
  if (isNaN(d)) return null;
  d.setMinutes(d.getMinutes() + min);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeICS(s) {
  return String(s == null ? '' : s).replace(/([\\,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

export function calendarUrl(act) {
  const start = `${(act.fecha || '').replace(/-/g, '')}T${(act.hora || '').replace(/:/g, '') || '0000'}00`;
  const end = addMinutes(act.fecha, act.hora, 60);
  const u = new URL('https://calendar.google.com/calendar/render');
  u.searchParams.set('action', 'TEMPLATE');
  u.searchParams.set('text', act.titulo || '');
  u.searchParams.set('dates', `${start}/${end}`);
  u.searchParams.set('location', [act.lugar, act.direccion].filter(Boolean).join(', '));
  u.searchParams.set('details', act.nota || '');
  return u.toString();
}

function icsEvent(act) {
  const start = `${(act.fecha || '').replace(/-/g, '')}T${(act.hora || '').replace(/:/g, '') || '0000'}00`;
  const end = addMinutes(act.fecha, act.hora, 60) || start;
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;
  const reminder = settings().defaultReminderMin || 0;
  return [
    'BEGIN:VEVENT',
    `UID:viaje-${act.id || Date.now()}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(act.titulo || '')}`,
    `LOCATION:${escapeICS([act.lugar, act.direccion].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escapeICS(act.nota || '')}`,
    reminder ? 'BEGIN:VALARM' : '',
    reminder ? `TRIGGER:-PT${reminder}M` : '',
    reminder ? 'ACTION:DISPLAY' : '',
    reminder ? 'DESCRIPTION:Recordatorio' : '',
    reminder ? 'END:VALARM' : '',
    'END:VEVENT',
  ].filter((l) => l !== '').join('\r\n');
}

export function ics(act) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Viaje a Espana//ES',
    'CALSCALE:GREGORIAN',
    icsEvent(act),
    'END:VCALENDAR',
  ].join('\r\n');
}

export function icsExport(acts) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Viaje a Espana//ES',
    'CALSCALE:GREGORIAN',
    ...acts.map(icsEvent),
    'END:VCALENDAR',
  ].join('\r\n');
}

export async function share(data) {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (_) {
      /* usuario canceló */
      return false;
    }
  }
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(data.url || data.text || '');
      return 'copied';
    } catch (_) {
      return false;
    }
  }
  return false;
}
