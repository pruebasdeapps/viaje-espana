import { h, openForm, confirmDialog, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { section, row, list, empty, stars, placeActions, mapButton } from './common.js';

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

const FIELDS = [
  { name: 'nombre', label: 'Nombre', required: true, section: 'Lugar' },
  { name: 'categoria', label: 'Categoría', type: 'select', options: CATEGORIAS, section: 'Lugar' },
  { name: 'ciudad', label: 'Ciudad', section: 'Lugar' },
  { name: 'direccion', label: 'Dirección', section: 'Ubicación' },
  { name: 'telefono', label: 'Teléfono', type: 'tel', section: 'Ubicación' },
  { name: 'lat', label: 'Latitud', section: 'Ubicación' },
  { name: 'lng', label: 'Longitud', section: 'Ubicación' },
  { name: 'rating', label: 'Valoración (1-5)', type: 'number', section: 'Opinión' },
  { name: 'url', label: 'Enlace web', type: 'url', section: 'Opinión' },
  { name: 'nota', label: 'Recomendaciones', type: 'textarea', section: 'Opinión' },
  { name: 'id', type: 'hidden' },
];

export function create() {
  openForm({
    title: 'Nuevo lugar',
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('lugares', data);
      toast('Lugar guardado', 'success');
    },
  });
}

function edit(item) {
  openForm({
    title: 'Editar lugar',
    values: item,
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('lugares', data);
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

  const groups = new Map();
  for (const l of items) {
    const key = l.ciudad || 'Sin ciudad';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }

  for (const [ciudad, listItems] of groups) {
    const rows = listItems.map((l) => {
      const st = styleFor(l.categoria);
      const r = row({
        iconName: st.iconName,
        iconColor: st.iconColor,
        title: l.nombre,
        sub: [l.categoria, l.direccion].filter(Boolean).join(' · ') || null,
        note: l.nota || null,
        accessory: h('span', { class: 'row__accessory' }, mapButton(l), stars(l.rating)),
        wrap: true,
        onClick: () => edit(l),
      });
      attachContextMenu(r, () =>
        placeActions(l, {
          extra: [
            l.url ? { label: 'Abrir enlace', onClick: () => window.open(l.url, '_blank') } : null,
            { label: 'Editar', onClick: () => edit(l) },
            { label: 'Eliminar', danger: true, onClick: () => removeItem(l) },
          ].filter(Boolean),
        })
      );
      return r;
    });
    fragment.append(section(ciudad, list(...rows)));
  }
  return fragment;
}
