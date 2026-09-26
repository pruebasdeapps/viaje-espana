import { h, openForm, confirmDialog, fmtDate, fmtMoney, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { get as getSetting } from '../settings.js';
import { section, row, list, empty, placeActions, mapButton, switchEl } from './common.js';

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
    values: { fecha: new Date().toISOString().slice(0, 10) },
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

function filterChips(paises) {
  const wrap = h('div', { class: 'chips', style: { marginBottom: '14px' } });
  for (const p of ['Todos', ...paises]) {
    wrap.append(
      h('button', { class: 'chip' + (p === paisFilter ? ' chip--active' : ''), onClick: () => { paisFilter = p; refresh(); } }, p)
    );
  }
  return wrap;
}

export function render() {
  const items = storeList('itinerario');
  if (!items.length) {
    return empty('calendario', 'Aún no hay actividades en el itinerario.', 'Añadir actividad', create);
  }

  const doneTotal = items.filter((i) => i.hecho).length;
  const pct = items.length ? Math.round((doneTotal / items.length) * 100) : 0;

  const allPaises = [...new Set(items.map(countryOf))].sort();
  const filtered = paisFilter === 'Todos' ? items : items.filter((it) => countryOf(it) === paisFilter);

  const byPais = new Map();
  for (const it of filtered) {
    const pais = countryOf(it);
    if (!byPais.has(pais)) byPais.set(pais, new Map());
    const byFecha = byPais.get(pais);
    const f = it.fecha || 'Sin fecha';
    if (!byFecha.has(f)) byFecha.set(f, []);
    byFecha.get(f).push(it);
  }

  const order = getSetting('countryOrder') || [];
  const paisOrder = [...byPais.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const fragment = h('div', {});

  fragment.append(
    h(
      'div',
      { class: 'progress', style: { marginBottom: '16px' } },
      h('div', { class: 'progress__bar' }, h('span', { style: { width: pct + '%' } })),
      h('span', { class: 'progress__label' }, `${doneTotal} de ${items.length} actividades completadas (${pct}%)`)
    )
  );

  fragment.append(filterChips(allPaises));

  for (const pais of paisOrder) {
    const byFecha = byPais.get(pais);
    const days = [...byFecha.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    let paisDone = 0;
    let paisTotal = 0;
    for (const [, listItems] of days) {
      paisTotal += listItems.length;
      paisDone += listItems.filter((i) => i.hecho).length;
    }

    const dayBlocks = days.map(([fecha, listItems]) => {
      const rows = listItems.map((it) => {
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
          accessory: h('span', { class: 'row__accessory' }, ...accessories),
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
      });
      return h('div', {}, h('div', { class: 'day-title' }, fmtDate(fecha)), list(...rows));
    });

    fragment.append(
      section(
        `${pais} · ${days.length} ${days.length === 1 ? 'día' : 'días'} · ${paisDone}/${paisTotal}`,
        h('div', { class: 'stack' }, ...dayBlocks)
      )
    );
  }
  return fragment;
}
