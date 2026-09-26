import { h, openForm, confirmDialog, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { get as getSetting } from '../settings.js';
import { CITY_COUNTRY, CITY_ORDER } from '../geo.js';
import { section, row, list, empty, stars, placeActions } from './common.js';
import { mapUrl, openExternal } from '../platform.js';

export const meta = { key: 'lugares', label: 'Lugares', icon: 'lugares' };

const CATEGORIAS = ['Restaurante', 'Bar / Tapas', 'Atracción', 'Museo', 'Parque', 'Compras', 'Playa', 'Mirador', 'Otro'];
const CAT_STYLE = {
  Restaurante: ['estrella', 'orange'],
  'Bar / Tapas': ['gastos', 'pink'],
  Atracción: ['lugares', 'red'],
  Museo: ['documentos', 'indigo'],
  Parque: ['sol', 'green'],
  Compras: ['gastos', 'purple'],
  Playa: ['sol', 'teal'],
  Mirador: ['ubicacion', 'tint'],
  Otro: ['info', 'gray'],
};
let filtro = '';

function styleFor(cat) {
  const [iconName, iconColor] = CAT_STYLE[cat] || CAT_STYLE.Otro;
  return { iconName, iconColor };
}

function countryOf(l) {
  if (l.pais) return l.pais;
  return CITY_COUNTRY[l.ciudad] || 'Sin país';
}

function FIELDS() {
  const paises = getSetting('countryOrder') || [];
  return [
    { name: 'nombre', label: 'Nombre', required: true, section: 'Lugar' },
    { name: 'categoria', label: 'Categoría', type: 'select', options: CATEGORIAS, section: 'Lugar' },
    { name: 'ciudad', label: 'Ciudad', section: 'Lugar' },
    { name: 'pais', label: 'País', type: 'combobox', options: paises, section: 'Lugar' },
    { name: 'direccion', label: 'Dirección', section: 'Ubicación' },
    { name: 'telefono', label: 'Teléfono', type: 'tel', section: 'Ubicación' },
    { name: 'lat', label: 'Latitud', section: 'Ubicación' },
    { name: 'lng', label: 'Longitud', section: 'Ubicación' },
    { name: 'rating', label: 'Valoración (1-5)', type: 'number', section: 'Opinión' },
    { name: 'url', label: 'Enlace web', type: 'url', section: 'Opinión' },
    { name: 'nota', label: 'Recomendaciones', type: 'textarea', section: 'Opinión' },
    { name: 'id', type: 'hidden' },
  ];
}

export function create() {
  openForm({
    title: 'Nuevo lugar',
    fields: FIELDS(),
    onSubmit: async (data) => {
      const maps_url = mapUrl({ nombre: data.nombre, ciudad: data.ciudad, direccion: data.direccion, lat: data.lat, lng: data.lng });
      await save('lugares', { ...data, maps_url });
      toast('Lugar guardado', 'success');
    },
  });
}

function edit(item) {
  openForm({
    title: 'Editar lugar',
    values: item,
    fields: FIELDS(),
    onSubmit: async (data) => {
      const maps_url = mapUrl({ nombre: data.nombre, ciudad: data.ciudad, direccion: data.direccion, lat: data.lat, lng: data.lng });
      await save('lugares', { ...data, maps_url });
      toast('Lugar guardado', 'success');
    },
  });
}

async function removeItem(l) {
  if (await confirmDialog('¿Eliminar «' + l.nombre + '»?', { title: 'Eliminar lugar' })) {
    await remove(l.id);
    toast('Eliminado', 'success');
  }
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir lugar', onClick: create };
}

export function render() {
  const all = storeList('lugares');
  const term = filtro.trim().toLowerCase();
  const items = term
    ? all.filter((l) => [l.nombre, l.ciudad, l.categoria, l.nota, l.direccion].join(' ').toLowerCase().includes(term))
    : all;

  const fragment = h('div', {});

  if (all.length) {
    const search = h('input', {
      class: 'search',
      type: 'search',
      placeholder: 'Buscar lugar, ciudad o categoría…',
      value: filtro,
      onInput: (e) => {
        filtro = e.target.value;
        const page = e.target.closest('.page');
        const content = page.lastChild;
        const next = render();
        page.replaceChild(next, content);
        const input = next.querySelector('.search');
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      },
    });
    fragment.append(h('div', { class: 'search-wrap' }, search));
  }

  if (!items.length) {
    fragment.append(
      all.length
        ? empty('buscar', 'Sin resultados para «' + filtro + '».')
        : empty('lugares', 'Guarda restaurantes y sitios que quieras visitar.', 'Añadir lugar', create)
    );
    return fragment;
  }

  const byPais = new Map();
  for (const l of items) {
    const pais = countryOf(l);
    if (!byPais.has(pais)) byPais.set(pais, new Map());
    const byCity = byPais.get(pais);
    const c = l.ciudad || 'Sin ciudad';
    if (!byCity.has(c)) byCity.set(c, []);
    byCity.get(c).push(l);
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

  for (const pais of paisOrder) {
    const byCity = byPais.get(pais);
    const cityOrder = [...byCity.keys()].sort((a, b) => {
      const ia = CITY_ORDER.indexOf(a);
      const ib = CITY_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    const cityBlocks = cityOrder.map((ciudad) => {
      const rows = byCity.get(ciudad).map((l) => {
        const st = styleFor(l.categoria);
        const r = row({
          iconName: st.iconName,
          iconColor: st.iconColor,
          title: l.nombre,
          sub: [l.categoria, l.direccion].filter(Boolean).join(' · ') || null,
          note: l.nota || null,
          accessory: h('span', { class: 'row__accessory' }, stars(l.rating)),
          wrap: true,
          onClick: () => openExternal(mapUrl(l)),
        });
        attachContextMenu(r, () =>
          placeActions(l, {
            extra: [
              { label: 'Copiar enlace de Maps', onClick: async () => { try { await navigator.clipboard.writeText(l.maps_url || mapUrl(l)); toast('Enlace copiado', 'success'); } catch (_) { toast('No se pudo copiar', 'error'); } } },
              l.url ? { label: 'Abrir enlace', onClick: () => window.open(l.url, '_blank') } : null,
              { label: 'Editar', onClick: () => edit(l) },
              { label: 'Eliminar', danger: true, onClick: () => removeItem(l) },
            ].filter(Boolean),
          })
        );
        return r;
      });
      return h('div', {}, h('div', { class: 'day-title' }, ciudad), list(...rows));
    });

    fragment.append(section(pais, h('div', { class: 'stack' }, ...cityBlocks)));
  }
  return fragment;
}
