import { h, fmtMoney, fmtDateLong, icon, enterOverlay, closeTopOverlay } from '../ui.js';
import { list as storeList } from '../store.js';
import { get as getSetting, all as settingsAll } from '../settings.js';
import { searchUrl, openExternal, mapUrl, mapsSearchUrl } from '../platform.js';
import { CITY_COUNTRY } from '../geo.js';
import { toBase, computeBalances, settle } from './gastos.js';
import { askChat } from '../ai.js';
import { searchPlaces, searchOverpass } from '../search.js';
import { coordsForCity } from '../weather.js';

export const meta = { key: 'asistente', label: 'Papacito', icon: 'info' };

const SUGGESTIONS = ['¿Qué toca el día 6?', '¿Cuánto llevamos gastado?', '¿Quién debe a quién?', '¿Dónde nos alojamos?', 'Restaurantes en Roma'];

const byTime = (a, b) => (a.hora || '99').localeCompare(b.hora || '99');
const cur = () => settingsAll().currency;

function findCity(query) {
  const q = query.toLowerCase();
  for (const city of Object.keys(CITY_COUNTRY)) if (q.includes(city.toLowerCase())) return city;
  return null;
}

function tripDates() {
  return [...new Set(storeList('itinerario').map((i) => i.fecha).filter(Boolean))].sort();
}

function parseDay(text) {
  const q = text.toLowerCase();
  const dates = tripDates();
  const dayN = q.match(/d[ií]a\s+(\d{1,2})/);
  if (dayN) {
    const n = Number(dayN[1]);
    const dm = dates.find((d) => Number(d.slice(8, 10)) === n);
    return dm || dates[n - 1] || null;
  }
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dm2 = q.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)/);
  if (dm2 && meses.indexOf(dm2[2]) !== -1) {
    const dd = String(Number(dm2[1])).padStart(2, '0');
    const mm = String(meses.indexOf(dm2[2]) + 1).padStart(2, '0');
    return dates.find((d) => d.slice(5, 7) === mm && d.slice(8, 10) === dd) || null;
  }
  return null;
}

function dayAnswer(fecha) {
  const acts = storeList('itinerario').filter((i) => i.fecha === fecha).sort(byTime);
  const ents = storeList('documentos').filter((d) => d.fecha === fecha);
  const hosp = storeList('hospedajes').filter((h) => h.fecha_in <= fecha && h.fecha_out >= fecha);
  if (!acts.length && !ents.length && !hosp.length) {
    return { text: 'No tengo nada programado el ' + fmtDateLong(fecha) + '.', matched: true };
  }
  const lines = [fmtDateLong(fecha)];
  if (hosp.length) lines.push('Alojamiento: ' + hosp.map((h) => h.ciudad).join(', '));
  if (acts.length) lines.push('', ...acts.map((a) => `${a.hora ? a.hora + ' · ' : ''}${a.titulo}${a.lugar ? ' — ' + a.lugar : ''}`));
  if (ents.length) lines.push('', 'Entradas/reservas: ' + ents.map((e) => e.titulo).join(', '));
  return { text: lines.join('\n'), matched: true };
}

function gastosAnswer() {
  const g = storeList('gastos');
  if (!g.length) return { text: 'Todavía no habéis registrado gastos.', matched: true };
  const total = g.reduce((s, x) => s + toBase(x.monto, x.moneda), 0);
  const people = [...new Set(g.map((x) => x.pagado_por).filter(Boolean))];
  const per = people.map((p) => `${p}: ${fmtMoney(g.filter((x) => x.pagado_por === p).reduce((s, x) => s + toBase(x.monto, x.moneda), 0), cur())}`);
  return { text: `Total del viaje: ${fmtMoney(total, cur())}\nPagado por persona:\n${per.join('\n')}\n\nPregunta "¿quién debe a quién?" para ver la liquidación.`, matched: true };
}

function debtsAnswer() {
  const g = storeList('gastos');
  if (!g.length) return { text: 'Sin gastos todavía, así que no hay deudas.', matched: true };
  const transfers = settle(computeBalances(g));
  if (!transfers.length) return { text: 'Todo cuadra: nadie debe nada.', matched: true };
  return { text: 'Para quedar a mano:\n' + transfers.map((t) => `${t.from} paga ${fmtMoney(t.amount, cur())} a ${t.to}`).join('\n'), matched: true };
}

function hospedajeAnswer() {
  const hs = storeList('hospedajes').sort((a, b) => (a.fecha_in || '').localeCompare(b.fecha_in || ''));
  if (!hs.length) return { text: 'No hay hospedajes registrados.', matched: true };
  return { text: 'Alojamientos:\n' + hs.map((x) => `${x.nombre} (${x.ciudad}) — ${x.noches || '?'} noches · ${x.fecha_in || '?'} → ${x.fecha_out || '?'}`).join('\n'), matched: true };
}

function documentosAnswer(city) {
  let ds = storeList('documentos');
  if (city) ds = ds.filter((d) => ((d.ubicacion || '') + ' ' + (d.titulo || '')).toLowerCase().includes(city.toLowerCase()));
  if (!ds.length) return { text: 'No tengo entradas o reservas' + (city ? ' de ' + city : '') + '.', matched: true };
  return { text: 'Reservas y entradas:\n' + ds.map((d) => `${d.tipo || ''} · ${d.titulo}${d.fecha ? ' — ' + d.fecha : ''}${d.precio ? ' · ' + fmtMoney(d.precio, cur()) : ''}`).join('\n'), matched: true };
}

function checklistAnswer() {
  const c = storeList('checklist');
  if (!c.length) return { text: 'La lista de equipaje está vacía.', matched: true };
  const done = c.filter((x) => x.hecho).length;
  return { text: `Equipaje (${done}/${c.length}):\n` + c.map((x) => `${x.hecho ? '✔' : '·'} ${x.titulo}`).join('\n'), matched: true };
}

function notasAnswer() {
  const n = storeList('notas').sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  if (!n.length) return { text: 'No hay notas en el diario.', matched: true };
  return { text: 'Diario:\n' + n.slice(0, 8).map((x) => `${x.fecha || ''} ${x.titulo}: ${(x.contenido || '').slice(0, 60)}`).join('\n'), matched: true };
}

function enlacesAnswer() {
  const e = storeList('enlaces');
  if (!e.length) return { text: 'No hay recursos guardados.', matched: true };
  return { text: 'Recursos:\n' + e.map((x) => `${x.titulo} — ${x.url}`).join('\n'), matched: true };
}

function rutaAnswer() {
  const order = getSetting('countryOrder') || [];
  const dates = tripDates();
  const rango = dates.length ? `${fmtDateLong(dates[0])} → ${fmtDateLong(dates[dates.length - 1])}` : '';
  return { text: `Ruta: ${order.join(' → ')}${rango ? '\n' + rango : ''}`, matched: true };
}

function placesAnswer(city, text) {
  const q = text.toLowerCase();
  let lugares = storeList('lugares');
  if (city) lugares = lugares.filter((l) => (l.ciudad || '').toLowerCase() === city.toLowerCase());
  if (/(comer|comida|restaurant|carbonara|pasta|pizza|tapa)/.test(q)) lugares = lugares.filter((l) => ['Restaurante', 'Bar / Tapas', 'Comida'].includes(l.categoria));
  else if (/(museo)/.test(q)) lugares = lugares.filter((l) => l.categoria === 'Museo');
  if (!lugares.length) return { text: city ? `No tengo lugares guardados en ${city}.` : 'No tengo lugares que coincidan.', matched: true };
  return { text: `Lugares guardados${city ? ' en ' + city : ''}:\n` + lugares.map((l) => `${l.nombre}${l.categoria ? ' (' + l.categoria + ')' : ''}`).join('\n'), matched: true };
}

function itinerarioAnswer() {
  const items = storeList('itinerario');
  if (!items.length) return { text: 'El itinerario está vacío.', matched: true };
  const byDay = new Map();
  for (const i of items) {
    const k = i.fecha || 'Sin fecha';
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(i);
  }
  const lines = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([f, arr]) => `${f} — ${arr.length} actividades`);
  return { text: `Itinerario (${items.length} actividades, ${byDay.size} días):\n${lines.join('\n')}\n\nPregunta "qué toca el día 6" para el detalle.`, matched: true };
}

function helpAnswer() {
  return {
    text: 'Puedo responderte con lo que hay en tu app:\n• "¿Qué toca el día 6?"\n• "¿Cuánto llevamos gastado?" / "¿Quién debe a quién?"\n• "¿Dónde nos alojamos?"\n• "Entradas" / "equipaje" / "diario" / "recursos"\n• "Lugares en Roma"\n\nY si pides una categoría ("restaurantes en Roma"), busco sitios reales y abro Maps.',
    matched: true,
  };
}

function answer(text) {
  const q = text.toLowerCase();
  const has = (words) => words.some((w) => q.includes(w));
  const city = findCity(text);
  const fecha = parseDay(text);

  if (fecha) return dayAnswer(fecha);
  if (has(['debe', 'deben', 'liquidar', 'saldos', 'quién debe', 'quien debe', 'quién paga', 'quien paga'])) return debtsAnswer();
  if (has(['gasto', 'gastado', 'cuánto', 'cuanto', 'presupuesto', 'dinero', 'total'])) return gastosAnswer();
  if (has(['hotel', 'hospedaje', 'alojamiento', 'dormir', 'alojamos', 'quedamos', 'dónde dormimos', 'donde dormimos'])) return hospedajeAnswer();
  if (has(['entrada', 'entradas', 'ticket', 'reserva', 'vuelo', 'vuelos'])) return documentosAnswer(city);
  if (has(['equipaje', 'empacar', 'maleta', 'checklist', 'qué llevar', 'que llevar'])) return checklistAnswer();
  if (has(['nota', 'notas', 'diario'])) return notasAnswer();
  if (has(['recurso', 'enlace', 'enlaces', 'link'])) return enlacesAnswer();
  if (has(['ruta', 'recorrido', 'país', 'pais', 'ciudades'])) return rutaAnswer();
  if (city || has(['comer', 'ver', 'visitar', 'museo', 'restaurante', 'actividad', 'actividades', 'lugares'])) return placesAnswer(city, text);
  if (has(['itinerario', 'programa', 'plan', 'agenda', 'cronograma'])) return itinerarioAnswer();
  if (has(['hola', 'ayuda', 'qué puedes', 'que puedes', 'qué haces', 'que haces'])) return helpAnswer();
  return { text: 'No encontré eso en tu viaje. Prueba: "¿Qué toca el día 6?", "¿Cuánto llevamos gastado?", "¿Dónde nos alojamos?", "Entradas", "Equipaje".', matched: false };
}

const CATS = [
  { re: /(restaurant|comer|cenar|almorzar|comida|carbonara|pasta|pizza|trattoria|ristorante|tapa)/, tag: ['amenity', 'restaurant'] },
  { re: /(bar|copas|cerveza|birra)/, tag: ['amenity', 'bar'] },
  { re: /(caf[eé]|desayuno|brunch)/, tag: ['amenity', 'cafe'] },
  { re: /(museo|museum)/, tag: ['tourism', 'museum'] },
  { re: /(hotel|hostal|hostel)/, tag: ['tourism', 'hotel'] },
  { re: /(supermercado|mercado|supermarket)/, tag: ['shop', 'supermarket'] },
  { re: /(farmacia|pharmacy)/, tag: ['amenity', 'pharmacy'] },
  { re: /(monumento|atracci[oó]n|tur[ií]stico)/, tag: ['tourism', 'attraction'] },
];

function categoryTag(text) {
  const q = text.toLowerCase();
  for (const c of CATS) if (c.re.test(q)) return c.tag;
  return null;
}

function searchQueryFor(text) {
  const city = findCity(text);
  const q = text.toLowerCase();
  if (city && /(comer|comida|restaurant|cenar|almorzar|tapa|bar|cafe)/.test(q)) return 'restaurantes ' + city;
  if (city) return text.replace(/[¿?¡!]/g, '').trim();
  return text.replace(/[¿?¡!]/g, '').trim();
}

async function findPlaces(text) {
  const city = findCity(text);
  const tag = categoryTag(text);
  const coords = city ? coordsForCity(city) : null;
  if (tag && coords) {
    const list = await searchOverpass(tag[0], tag[1], coords.lat, coords.lng);
    if (list.length) return list;
  }
  if (city) return searchPlaces(searchQueryFor(text));
  return [];
}

export function open() {
  if (document.querySelector('.chat-overlay')) return;
  const overlay = h('div', { class: 'chat-overlay' });
  const head = h(
    'div',
    { class: 'chat__head' },
    h('div', { class: 'chat__title' }, 'Papacito'),
    h('button', { class: 'nav-btn', onClick: closeTopOverlay }, 'Listo')
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
  enterOverlay(overlay);

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
      setGoogle: (qq) => {
        wrap.append(h('button', { class: 'msg__link', onClick: () => openExternal(searchUrl(qq)) }, 'Buscar en Google'));
        scroll();
      },
      setResults: (results) => {
        const box = h('div', { class: 'msg__results' });
        for (const r of results || []) {
          box.append(
            h('button', { class: 'msg__result', onClick: () => openExternal(mapUrl({ lat: r.lat, lng: r.lng, nombre: r.name })) }, h('b', {}, r.name), r.address ? h('small', {}, r.address) : null)
          );
        }
        wrap.append(box);
        scroll();
      },
      setMaps: (qq) => {
        wrap.append(h('button', { class: 'msg__link', onClick: () => openExternal(mapsSearchUrl(qq)) }, 'Ver en Google Maps'));
        scroll();
      },
    };
  }

  const ask = (text) => {
    if (!text || !text.trim()) return;
    bubble('user', text);
    const ans = answer(text);
    bubble('bot', ans.text);

    if (!ans.matched) {
      setTimeout(async () => {
        const loading = bubble('bot', 'Consultando…');
        try {
          const r = await askChat(text);
          loading.setText(r || 'No obtuve respuesta.');
          loading.setGoogle(text);
        } catch (e) {
          loading.setText('No pude consultar la IA.');
          loading.setGoogle(text);
        }
      }, 250);
    }

    if (categoryTag(text)) {
      setTimeout(async () => {
        try {
          const results = await findPlaces(text);
          const m = bubble('bot', results.length ? 'Sitios encontrados (toca para ir en Maps):' : 'Ábrelo en el mapa:');
          if (results.length) m.setResults(results);
          m.setMaps(searchQueryFor(text));
        } catch (_) {
          /* sin resultados */
        }
      }, 600);
    }
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

  bubble('bot', 'Hola, soy Papacito. Pregúntame por tu itinerario, un día concreto, gastos, deudas, alojamiento, entradas, equipaje, diario o lugares. Si pides una categoría ("restaurantes en Roma") te busco sitios reales.');
  setTimeout(() => input.focus(), 200);
}
