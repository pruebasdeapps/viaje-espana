import { h, openForm, confirmDialog, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { section, row, list, empty } from './common.js';

export const meta = { key: 'enlaces', label: 'Recursos', icon: 'enlaces' };

const CATEGORIAS = ['Transporte', 'Alojamiento', 'Cultura', 'Comida', 'Utilidad', 'Emergencia', 'Otro'];
const CAT_STYLE = {
  Transporte: ['mapa', 'teal'],
  Alojamiento: ['lugares', 'purple'],
  Cultura: ['documentos', 'indigo'],
  Comida: ['estrella', 'orange'],
  Utilidad: ['ajustes', 'gray'],
  Emergencia: ['info', 'red'],
  Otro: ['enlaces', 'tint'],
};

function styleFor(c) {
  const [iconName, iconColor] = CAT_STYLE[c] || CAT_STYLE.Otro;
  return { iconName, iconColor };
}

function normalizeUrl(url) {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}

const FIELDS = [
  { name: 'titulo', label: 'Título', required: true, section: 'Recurso' },
  { name: 'url', label: 'URL', type: 'url', required: true, section: 'Recurso' },
  { name: 'categoria', label: 'Categoría', type: 'select', options: CATEGORIAS, section: 'Recurso' },
  { name: 'nota', label: 'Descripción', type: 'textarea', section: 'Detalles' },
  { name: 'id', type: 'hidden' },
];

export function create() {
  openForm({
    title: 'Nuevo recurso',
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('enlaces', { ...data, url: normalizeUrl(data.url) });
      toast('Recurso guardado', 'success');
    },
  });
}

function edit(item) {
  openForm({
    title: 'Editar recurso',
    values: item,
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('enlaces', { ...data, url: normalizeUrl(data.url) });
      toast('Recurso guardado', 'success');
    },
  });
}

async function removeItem(e) {
  if (await confirmDialog('¿Eliminar «' + e.titulo + '»?', { title: 'Eliminar recurso' })) {
    await remove(e.id);
    toast('Eliminado', 'success');
  }
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir recurso', onClick: create };
}

export function render() {
  const items = storeList('enlaces');
  if (!items.length) {
    return empty('enlaces', 'Guarda webs útiles del viaje.', 'Añadir recurso', create);
  }

  const groups = new Map();
  for (const e of items) {
    const key = e.categoria || 'Otro';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const fragment = h('div', {});
  for (const [cat, listItems] of groups) {
    const rows = listItems.map((e) => {
      const st = styleFor(cat);
      const r = row({
        iconName: st.iconName,
        iconColor: st.iconColor,
        title: e.titulo,
        sub: e.nota || e.url.replace(/^https?:\/\//, ''),
        chevron: true,
        href: e.url,
      });
      attachContextMenu(r, () => [
        { label: 'Abrir enlace', onClick: () => window.open(e.url, '_blank') },
        {
          label: 'Copiar enlace',
          onClick: () => navigator.clipboard && navigator.clipboard.writeText(e.url).then(() => toast('Enlace copiado', 'success')),
        },
        { label: 'Editar', onClick: () => edit(e) },
        { label: 'Eliminar', danger: true, onClick: () => removeItem(e) },
      ]);
      return r;
    });
    fragment.append(section(cat, list(...rows)));
  }
  return fragment;
}
