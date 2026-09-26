import { h, fmtMoney, icon } from '../ui.js';
import { list as storeList } from '../store.js';
import { get as getSetting, all as settingsAll } from '../settings.js';
import { searchUrl, openExternal } from '../platform.js';
import { CITY_COUNTRY } from '../geo.js';
import { toBase } from './gastos.js';
import { askChat } from '../ai.js';

export const meta = { key: 'asistente', label: 'Papacito', icon: 'info' };

const SUGGESTIONS = ['¿Qué comer en Roma?', '¿Qué ver en París?', '¿Qué toca el día 6?', '¿Cuánto llevamos gastado?', '¿Dónde nos alojamos?'];

function findCity(query) {
  const q = query.toLowerCase();
  for (const city of Object.keys(CITY_COUNTRY)) if (q.includes(city.toLowerCase())) return city;
  return null;
}

function placesList(title, places) {
  if (!places.length) return { text: title + ': no tengo lugares de ese tipo todavía. Consultando la web…' };
  const lines = places.slice(0, 8).map((p) => `• ${p.nombre}${p.ciudad ? ' — ' + p.ciudad : ''}${p.direccion ? ' (' + p.direccion + ')' : ''}`);
  return { text: title + ':\n' + lines.join('\n') };
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
      return { text: 'Día ' + day + ' (febrero):\n' + acts.map((a) => `• ${a.hora || ''} ${a.titulo}${a.lugar ? ' — ' + a.lugar : ''}`).join('\n') };
    }
    return { text: 'No tengo actividades el día ' + day + ' de febrero.' };
  }
  if (has(['gasto', 'cuánto', 'cuanto', 'presupuesto', 'dinero', 'llevamos'])) {
    const g = storeList('gastos');
    const total = g.reduce((s, x) => s + toBase(x.monto, x.moneda), 0);
    if (!g.length) return { text: 'Todavía no habéis registrado gastos. Ve a la pestaña Gastos.' };
    const people = [...new Set(g.map((x) => x.pagado_por).filter(Boolean))];
    const per = people.map((p) => `• ${p}: ${fmtMoney(g.filter((x) => x.pagado_por === p).reduce((s, x) => s + toBase(x.monto, x.moneda), 0), settingsAll().currency)}`);
    return { text: `Lleváis ${fmtMoney(total, settingsAll().currency)} en total.\nPor persona:\n${per.join('\n')}` };
  }
  if (has(['hotel', 'hospedaje', 'alojamiento', 'dormir', 'alojamos', 'quedamos', 'donde dormimos'])) {
    const hs = storeList('hospedajes');
    if (!hs.length) return { text: 'No tengo hospedajes registrados aún.' };
    return { text: 'Alojamientos:\n' + hs.map((x) => `• ${x.nombre} (${x.ciudad}) — ${x.noches || '?'} noches`).join('\n') };
  }
  if (has(['empacar', 'equipaje', 'llevar', 'maleta', 'checklist', 'que llevar'])) {
    const chk = storeList('checklist');
    if (!chk.length) return { text: 'La lista de equipaje está vacía. Añádela en la pestaña Equipaje.' };
    return { text: 'Equipaje:\n' + chk.map((c) => `• ${c.hecho ? '☑' : '☐'} ${c.titulo}`).join('\n') };
  }
  if (has(['ruta', 'orden', 'país', 'pais', 'recorrido', 'ciudades'])) {
    const order = getSetting('countryOrder') || [];
    return { text: 'Ruta del viaje: ' + order.join(' → ') + '.' };
  }
  return {
    text: 'Puedo ayudarte con los sitios precargados o buscando en la web. Prueba:\n• "¿Qué comer en Roma?"\n• "¿Qué ver en París?"\n• "¿Qué toca el día 6?"\n• "¿Cuánto llevamos gastado?"',
  };
}

export function open() {
  if (document.querySelector('.chat-overlay')) return;
  const overlay = h('div', { class: 'chat-overlay' });
  const head = h(
    'div',
    { class: 'chat__head' },
    h('div', { class: 'chat__title' }, 'Papacito'),
    h('button', { class: 'nav-btn', onClick: () => overlay.remove() }, 'Listo')
  );
  const chips = h(
    'div',
    { class: 'chips', style: { padding: '10px 16px' } },
    ...SUGGESTIONS.map((s) => h('button', { class: 'chip', onClick: () => ask(s) }, s))
  );
  const listEl = h('div', { class: 'chat__list' });
  const input = h('input', { type: 'text', placeholder: 'Pregúntale a Papacito…', enterkeyhint: 'send' });
  const sendBtn = h('button', { class: 'nav-btn', 'aria-label': 'Enviar' }, icon('navegar', { size: 22, strokeWidth: 2 }));
  const inputBar = h('div', { class: 'chat__input' }, input, sendBtn);

  overlay.append(head, chips, listEl, inputBar);
  document.body.append(overlay);

  function bubble(role, text) {
    const wrap = h('div', { class: 'msg__bubble' });
    const textEl = h('div', { class: 'msg__text' }, text);
    wrap.append(textEl);
    const el = h('div', { class: 'msg msg--' + role }, wrap);
    listEl.append(el);
    const scroll = () => (listEl.scrollTop = listEl.scrollHeight);
    scroll();
    return {
      setText: (t) => {
        textEl.textContent = t;
        scroll();
      },
      setSources: (sources) => {
        const box = h(
          'div',
          { class: 'msg__sources' },
          ...(sources || []).slice(0, 4).map((s) =>
            h('a', { class: 'msg__source', href: s.uri, target: '_blank', rel: 'noopener' }, (s.title || s.uri).slice(0, 70))
          )
        );
        wrap.append(box);
        scroll();
      },
      setGoogle: (q) => {
        wrap.append(h('button', { class: 'msg__link', onClick: () => openExternal(searchUrl(q)) }, 'Buscar en Google'));
        scroll();
      },
    };
  }

  const ask = (text) => {
    if (!text.trim()) return;
    bubble('user', text);
    const local = answer(text);
    setTimeout(() => bubble('bot', local.text), 200);

    setTimeout(async () => {
      const loading = bubble('bot', 'Consultando…');
      try {
        const r = await askChat(text);
        loading.setText(r || 'No obtuve respuesta.');
        loading.setGoogle(text);
      } catch (e) {
        loading.setText('No pude consultar la IA (' + (e.message || 'error') + ').');
        loading.setGoogle(text);
      }
    }, 350);
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

  bubble('bot', 'Hola, soy Papacito, tu asistente de viaje. Pregúntame sobre lugares, comida, itinerario, gastos o equipaje.');
  setTimeout(() => input.focus(), 200);
}
