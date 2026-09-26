import { h, openForm, confirmDialog, fmtDate, fmtMoney, todayISO, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { get as getSetting, set as setSetting } from '../settings.js';
import { section, row, list, empty, placeActions, switchEl, mapButton } from './common.js';
import { icon } from '../ui.js';

export const meta = { key: 'itinerario', label: 'Itinerario', icon: 'calendario' };

const CATEGORIAS = ['Vuelo', 'Traslado', 'Hotel', 'Cultura', 'Comida', 'Paseo', 'Compras', 'Playa', 'Otro'];
const PAISES = ['España', 'Italia', 'Francia', 'Portugal', 'Reino Unido', 'Alemania', 'Otro'];
const CAT_STYLE = {
  Vuelo: ['navegar', 'tint'],
  Traslado: ['mapa', 'teal'],
  Hotel: ['lugares', 'purple'],
  Cultura: ['documentos', 'indigo'],
  Comida: ['estrella', 'orange'],
  Paseo: ['ubicacion', 'green'],
  Compras: ['gastos', 'pink'],
  Playa: ['sol', 'teal'],
  Otro: ['info', 'gray'],
};

let paisFilter = 'Todos';
const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

function styleFor(cat) {
  const [iconName, iconColor] = CAT_STYLE[cat] || CAT_STYLE.Otro;
  return { iconName, iconColor };
}

function countryOf(it) {
  if (it.pais) return it.pais;
  const f = it.fecha || '';
  if (/^2027-02/.test(f)) {
    const d = Number(f.slice(8, 10));
    if (d <= 8) return 'España';
    if (d <= 12) return 'Italia';
    if (d <= 15) return 'Francia';
    return 'España';
  }
  return 'Sin país';
}

function isExpanded(fecha) {
  return (getSetting('expandedDays') || []).includes(fecha);
}

function setExpanded(fecha, open) {
  const set = new Set(getSetting('expandedDays') || []);
  if (open) set.add(fecha);
  else set.delete(fecha);
  setSetting('expandedDays', [...set]);
}

const FIELDS = [
  { name: 'fecha', label: 'Fecha', type: 'date', required: true, section: 'Cuándo' },
  { name: 'hora', label: 'Hora', type: 'time', section: 'Cuándo' },
  { name: 'titulo', label: 'Actividad', required: true, section: 'Qué' },
  { name: 'categoria', label: 'Categoría', type: 'select', options: CATEGORIAS, section: 'Qué' },
  { name: 'pais', label: 'País', type: 'combobox', options: PAISES, section: 'Qué' },
  { name: 'lugar', label: 'Lugar', section: 'Dónde' },
  { name: 'direccion', label: 'Dirección', section: 'Dónde' },
  { name: 'lat', label: 'Latitud', section: 'Dónde' },
  { name: 'lng', label: 'Longitud', section: 'Dónde' },
  { name: 'costo', label: 'Costo (EUR)', type: 'number', section: 'Detalles' },
  { name: 'nota', label: 'Notas', type: 'textarea', section: 'Detalles' },
  { name: 'hecho', label: 'Terminado', type: 'checkbox', section: 'Detalles' },
  { name: 'id', type: 'hidden' },
];

export function create() {
  openForm({
    title: 'Nueva actividad',
    values: { fecha: todayISO() },
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('itinerario', data);
      toast('Actividad guardada', 'success');
    },
  });
}

function edit(item) {
  openForm({
    title: 'Editar actividad',
    values: item,
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('itinerario', data);
      toast('Actividad guardada', 'success');
    },
  });
}

async function removeItem(it) {
  if (await confirmDialog('¿Eliminar «' + it.titulo + '»?', { title: 'Eliminar actividad' })) {
    await remove(it.id);
    toast('Eliminada', 'success');
  }
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir actividad', onClick: create };
}

export function openDay(fecha) {
  if (fecha) setExpanded(fecha, true);
  location.hash = '#/itinerario';
}

function activityRow(it) {
  const st = styleFor(it.categoria);
  const sub = [it.lugar, it.costo ? fmtMoney(it.costo) : ''].filter(Boolean).join(' · ');
  const place = { nombre: it.lugar, direccion: it.direccion, lat: it.lat, lng: it.lng };
  const accessories = [];
  accessories.push(switchEl(it.hecho, (v) => save('itinerario', { ...it, hecho: v })));
  if (it.lugar || it.direccion || it.lat) accessories.push(mapButton(place));
  const r = row({
    iconName: st.iconName,
    iconColor: st.iconColor,
    title: it.titulo,
    sub: sub || null,
    note: it.nota || null,
    detail: it.hora || '',
    detailStrong: true,
    done: !!it.hecho,
    accessory: h('span', { class: 'row__accessory' }, ...accessories.filter(Boolean)),
    onClick: () => edit(it),
  });
  attachContextMenu(r, () =>
    placeActions(place, {
      calendarItem: it,
      extra: [
        { label: it.hecho ? 'Marcar como pendiente' : 'Marcar como terminada', onClick: () => save('itinerario', { ...it, hecho: !it.hecho }) },
        { label: 'Editar', onClick: () => edit(it) },
        { label: 'Eliminar', danger: true, onClick: () => removeItem(it) },
      ],
    })
  );
  return r;
}

function dayBlock(fecha, listItems, startOpen) {
  const rows = listItems.map(activityRow);
  const body = h('div', { class: 'day-body' }, list(...rows));
  const doneCount = listItems.filter((i) => i.hecho).length;
  const open = startOpen || isExpanded(fecha);
  if (open) body.classList.add('day-body--open');

  const head = h(
    'div',
    { class: 'day-head' + (open ? ' day-head--open' : '') },
    h('span', { class: 'day-head__chev' }, icon('chevron', { size: 16, strokeWidth: 2.4 })),
    h('span', { class: 'day-head__date' }, fmtDate(fecha)),
    h('span', { class: 'day-head__sum' }, `${doneCount}/${listItems.length}`)
  );
  head.addEventListener('click', () => {
    const nowOpen = body.classList.toggle('day-body--open');
    head.classList.toggle('day-head--open', nowOpen);
    setExpanded(fecha, nowOpen);
  });
  return h('div', { class: 'day' }, head, body);
}

function groupByPais(items) {
  const byPais = new Map();
  for (const it of items) {
    const pais = countryOf(it);
    if (!byPais.has(pais)) byPais.set(pais, new Map());
    const byFecha = byPais.get(pais);
    const f = it.fecha || 'Sin fecha';
    if (!byFecha.has(f)) byFecha.set(f, []);
    byFecha.get(f).push(it);
  }
  return byPais;
}

function paisOrder(byPais) {
  const order = getSetting('countryOrder') || [];
  return [...byPais.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function filterChips(paises, showPast) {
  const wrap = h('div', { class: 'chips', style: { marginBottom: '14px' } });
  for (const p of ['Todos', ...paises]) {
    wrap.append(h('button', { class: 'chip' + (p === paisFilter ? ' chip--active' : ''), onClick: () => { paisFilter = p; refresh(); } }, p));
  }
  wrap.append(
    h('button', { class: 'chip' + (showPast ? ' chip--active' : ''), onClick: () => { setSetting('showPastDays', !showPast); refresh(); } }, showPast ? 'Ocultar pasados' : 'Ver pasados')
  );
  return wrap;
}

function renderPaises(items) {
  const byPais = groupByPais(items);
  const fragment = h('div', {});
  for (const pais of paisOrder(byPais)) {
    const byFecha = byPais.get(pais);
    const days = [...byFecha.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let paisDone = 0;
    let paisTotal = 0;
    for (const [, listItems] of days) {
      paisTotal += listItems.length;
      paisDone += listItems.filter((i) => i.hecho).length;
    }
    const blocks = days.map(([fecha, listItems]) => dayBlock(fecha, listItems));
    fragment.append(
      section(`${pais} · ${days.length} ${days.length === 1 ? 'día' : 'días'} · ${paisDone}/${paisTotal}`, h('div', { class: 'stack' }, ...blocks))
    );
  }
  return fragment;
}

export function render() {
  const items = storeList('itinerario');
  if (!items.length) {
    return empty('calendario', 'Aún no hay actividades en el itinerario.', 'Añadir actividad', create);
  }

  const hoy = todayISO();
  const showPast = !!getSetting('showPastDays');
  const isPast = (f) => f && f < hoy;

  const doneTotal = items.filter((i) => i.hecho).length;
  const pct = items.length ? Math.round((doneTotal / items.length) * 100) : 0;

  const allPaises = [...new Set(items.map(countryOf))].sort();
  let filtered = paisFilter === 'Todos' ? items : items.filter((it) => countryOf(it) === paisFilter);
  if (!showPast) filtered = filtered.filter((it) => !isPast(it.fecha));

  const fragment = h('div', {});
  fragment.append(
    h(
      'div',
      { class: 'progress', style: { marginBottom: '16px' } },
      h('div', { class: 'progress__bar' }, h('span', { style: { width: pct + '%' } })),
      h('span', { class: 'progress__label' }, `${doneTotal} de ${items.length} actividades completadas (${pct}%)`)
    )
  );
  fragment.append(filterChips(allPaises, showPast));

  if (!filtered.length) {
    fragment.append(h('div', { class: 'empty' }, h('p', {}, 'No hay días por mostrar. Toca «Ver pasados» para ver el histórico.')));
    return fragment;
  }
  fragment.append(renderPaises(filtered));
  return fragment;
}

export function renderHistory() {
  const hoy = todayISO();
  const past = storeList('itinerario').filter((i) => i.fecha && i.fecha < hoy);
  if (!past.length) return h('div', { class: 'empty' }, h('p', {}, 'Todavía no hay días pasados.'));
  return renderPaises(past);
}
