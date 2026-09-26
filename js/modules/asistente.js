import { h, fmtMoney, icon } from '../ui.js';
import { list as storeList } from '../store.js';
import { get as getSetting, all as settingsAll } from '../settings.js';
import { searchUrl, openExternal } from '../platform.js';
import { CITY_COUNTRY } from '../geo.js';
import { toBase } from './gastos.js';

export const meta = { key: 'asistente', label: 'Asistente', icon: 'info' };

const SUGGESTIONS = ['¿Qué comer en Roma?', '¿Qué ver en París?', '¿Qué toca el día 6?', '¿Cuánto llevamos gastado?', '¿Dónde nos alojamos?'];

function findCity(query) {
  const q = query.toLowerCase();
  for (const city of Object.keys(CITY_COUNTRY)) if (q.includes(city.toLowerCase())) return city;
  return null;
}

function placesList(title, places) {
  if (!places.length) {
    return { text: title + ': no tengo lugares de ese tipo todavía. Prueba con otra ciudad o categoría.', google: title };
  }
  const lines = places.slice(0, 8).map((p) => `• ${p.nombre}${p.ciudad ? ' — ' + p.ciudad : ''}${p.direccion ? ' (' + p.direccion + ')' : ''}`);
  return { text: title + ':\n' + lines.join('\n'), google: title };
}

function answer(query) {
  const q = query.toLowerCase();
  const city = findCity(query);
  const has = (words) => words.some((w) => q.includes(w));

  if (has(['comer', 'comida', 'restaurante', 'cenar', 'almorzar', 'tapa', 'bar'])) {
    let places = storeList('lugares').filter((l) => ['Restaurante', 'Bar / Tapas', 'Comida'].includes(l.categoria));
    if (city) places = places.filter((l) => (l.ciudad || '').toLowerCase() === city.toLowerCase());
    return placesList('Restaurantes y comida' + (city ? ' en ' + city : ''), places);
  }
  if (has(['ver', 'visitar', 'qué hacer', 'que hacer', 'atracción', 'atraccion', 'museo', 'turismo'])) {
    let places = storeList('lugares').filter((l) => ['Atracción', 'Atraccion', 'Museo', 'Mirador', 'Parque'].includes(l.categoria));
    if (city) places = places.filter((l) => (l.ciudad || '').toLowerCase() === city.toLowerCase());
    return placesList('Qué visitar' + (city ? ' en ' + city : ''), places);
  }
  if (has(['toca', 'día', 'dia', 'itinerario', 'fecha', 'programa', 'plan']) && /\d{1,2}/.test(query)) {
    const day = query.match(/(\d{1,2})/)[1];
    const fecha = '2027-02-' + day.padStart(2, '0');
    const acts = storeList('itinerario').filter((i) => i.fecha === fecha);
    if (acts.length) {
      return { text: 'Día ' + day + ' (febrero):\n' + acts.map((a) => `• ${a.hora || ''} ${a.titulo}${a.lugar ? ' — ' + a.lugar : ''}`).join('\n'), google: 'itinerario ' + fecha };
    }
    return { text: 'No tengo actividades el día ' + day + ' de febrero.', google: 'itinerario ' + fecha };
  }
  if (has(['gasto', 'cuánto', 'cuanto', 'presupuesto', 'dinero', 'llevamos'])) {
    const g = storeList('gastos');
    const total = g.reduce((s, x) => s + toBase(x.monto, x.moneda), 0);
    if (!g.length) return { text: 'Todavía no habéis registrado gastos. Ve a la pestaña Gastos.', google: 'gastos de viaje' };
    const people = [...new Set(g.map((x) => x.pagado_por).filter(Boolean))];
    const per = people.map((p) => `• ${p}: ${fmtMoney(g.filter((x) => x.pagado_por === p).reduce((s, x) => s + toBase(x.monto, x.moneda), 0), settingsAll().currency)}`);
    return { text: `Lleváis ${fmtMoney(total, settingsAll().currency)} en total.\nPor persona:\n${per.join('\n')}` };
  }
  if (has(['hotel', 'hospedaje', 'alojamiento', 'dormir', 'alojamos', 'quedamos', 'donde dormimos'])) {
    const hs = storeList('hospedajes');
    if (!hs.length) return { text: 'No tengo hospedajes registrados aún.', google: 'hoteles' };
    return { text: 'Alojamientos:\n' + hs.map((x) => `• ${x.nombre} (${x.ciudad}) — ${x.noches || '?'} noches`).join('\n') };
  }
  if (has(['empacar', 'equipaje', 'llevar', 'maleta', 'checklist', 'que llevar'])) {
    const chk = storeList('checklist');
    if (!chk.length) return { text: 'La lista de equipaje está vacía. Añádela en la pestaña Equipaje.' };
    return { text: 'Equipaje:\n' + chk.map((c) => `• ${c.hecho ? '☑' : '☐'} ${c.titulo}`).join('\n') };
  }
  if (has(['ruta', 'orden', 'país', 'pais', 'recorrido', 'ciudades'])) {
    const order = getSetting('countryOrder') || [];
    return { text: 'Ruta del viaje: ' + order.join(' → ') + '.', google: 'ruta ' + order.join(' ') };
  }
  return {
    text: 'Puedo ayudarte con los sitios precargados. Prueba:\n• "¿Qué comer en Roma?"\n• "¿Qué ver en París?"\n• "¿Qué toca el día 6?"\n• "¿Cuánto llevamos gastado?"\n• "¿Dónde nos alojamos?"',
    google: query,
  };
}

export function open() {
  if (document.querySelector('.chat-overlay')) return;
  const overlay = h('div', { class: 'chat-overlay' });
  const head = h(
    'div',
    { class: 'chat__head' },
    h('div', { class: 'chat__title' }, 'Asistente'),
    h('button', { class: 'nav-btn', onClick: () => overlay.remove() }, 'Listo')
  );
  const chips = h(
    'div',
    { class: 'chips', style: { padding: '10px 16px' } },
    ...SUGGESTIONS.map((s) => h('button', { class: 'chip', onClick: () => ask(s) }, s))
  );
  const listEl = h('div', { class: 'chat__list' });
  const input = h('input', { type: 'text', placeholder: 'Pregúntame sobre tu viaje…', enterkeyhint: 'send' });
  const sendBtn = h('button', { class: 'nav-btn', 'aria-label': 'Enviar' }, icon('navegar', { size: 22, strokeWidth: 2 }));
  const inputBar = h('div', { class: 'chat__input' }, input, sendBtn);

  overlay.append(head, chips, listEl, inputBar);
  document.body.append(overlay);

  const add = (role, text, google) => {
    const el = h(
      'div',
      { class: 'msg msg--' + role },
      h(
        'div',
        { class: 'msg__bubble' },
        h('div', { class: 'msg__text' }, text),
        google ? h('button', { class: 'msg__link', onClick: () => openExternal(searchUrl(google)) }, 'Buscar en Google') : null
      )
    );
    listEl.append(el);
    listEl.scrollTop = listEl.scrollHeight;
  };

  const ask = (text) => {
    if (!text.trim()) return;
    add('user', text);
    setTimeout(() => {
      const r = answer(text);
      add('bot', r.text, r.google);
    }, 250);
  };

  sendBtn.addEventListener('click', () => {
    ask(input.value);
    input.value = '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      ask(input.value);
      input.value = '';
    }
  });

  add('bot', 'Hola, soy tu asistente de viaje. Pregúntame sobre lugares, comida, itinerario, gastos o equipaje.');
  setTimeout(() => input.focus(), 200);
}
