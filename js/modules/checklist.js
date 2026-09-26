import { h, openForm, confirmDialog, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { section, row, list, empty } from './common.js';

export const meta = { key: 'checklist', label: 'Equipaje', icon: 'maleta' };

const CATEGORIAS = ['Documentos', 'Ropa', 'Tecnología', 'Salud', 'Aseo', 'Niños', 'Otros'];
const CAT_STYLE = {
  Documentos: ['documentos', 'indigo'],
  Ropa: ['maleta', 'purple'],
  Tecnología: ['ajustes', 'teal'],
  Salud: ['info', 'red'],
  Aseo: ['info', 'tint'],
  Niños: ['persona', 'orange'],
  Otros: ['checklist', 'gray'],
};

function styleFor(c) {
  const [iconName, iconColor] = CAT_STYLE[c] || CAT_STYLE.Otros;
  return { iconName, iconColor };
}

const FIELDS = [
  { name: 'titulo', label: 'Ítem', required: true, section: 'Ítem' },
  { name: 'categoria', label: 'Categoría', type: 'select', options: CATEGORIAS, section: 'Ítem' },
  { name: 'cantidad', label: 'Cantidad', type: 'number', section: 'Detalles' },
  { name: 'asignado', label: 'Asignado a', section: 'Detalles' },
  { name: 'hecho', label: 'Listo / empacado', type: 'checkbox', section: 'Detalles' },
  { name: 'id', type: 'hidden' },
];

export function create() {
  openForm({
    title: 'Nuevo ítem',
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('checklist', data);
      toast('Ítem guardado', 'success');
    },
  });
}

function edit(item) {
  openForm({
    title: 'Editar ítem',
    values: item,
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('checklist', data);
      toast('Ítem guardado', 'success');
    },
  });
}

async function removeItem(it) {
  if (await confirmDialog('¿Eliminar «' + it.titulo + '»?', { title: 'Eliminar ítem' })) {
    await remove(it.id);
    toast('Eliminado', 'success');
  }
}

function switchEl(checked, onChange) {
  return h(
    'label',
    { class: 'switch', onClick: (e) => e.stopPropagation() },
    h('input', { type: 'checkbox', checked: !!checked, onChange: (e) => onChange(e.target.checked) }),
    h('span', {})
  );
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir ítem', onClick: create };
}

export function subtitle() {
  const items = storeList('checklist');
  const done = items.filter((i) => i.hecho).length;
  return items.length ? done + ' de ' + items.length + ' listos' : '';
}

export function render() {
  const items = storeList('checklist');
  if (!items.length) {
    return empty('maleta', 'Tu lista de equipaje está vacía.', 'Añadir ítem', create);
  }

  const done = items.filter((i) => i.hecho).length;
  const pct = Math.round((done / items.length) * 100);

  const fragment = h('div', {});
  fragment.append(
    h(
      'div',
      { class: 'progress', style: { marginBottom: '22px' } },
      h('div', { class: 'progress__bar' }, h('span', { style: { width: pct + '%' } })),
      h('span', { class: 'progress__label' }, done + ' de ' + items.length + ' listos (' + pct + '%)')
    )
  );

  const groups = new Map();
  for (const it of items) {
    const key = it.categoria || 'Otros';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  for (const [cat, listItems] of groups) {
    const rows = listItems.map((it) => {
      const st = styleFor(cat);
      const r = row({
        iconName: st.iconName,
        iconColor: it.hecho ? 'green' : st.iconColor,
        title: it.titulo,
        sub: [it.cantidad ? 'x' + it.cantidad : '', it.asignado].filter(Boolean).join(' · ') || null,
        done: it.hecho,
        accessory: switchEl(it.hecho, (v) => save('checklist', { ...it, hecho: v })),
        onClick: () => edit(it),
      });
      attachContextMenu(r, () => [
        { label: it.hecho ? 'Marcar como pendiente' : 'Marcar como listo', onClick: () => save('checklist', { ...it, hecho: !it.hecho }) },
        { label: 'Editar', onClick: () => edit(it) },
        { label: 'Eliminar', danger: true, onClick: () => removeItem(it) },
      ]);
      return r;
    });
    fragment.append(section(cat, list(...rows)));
  }
  return fragment;
}
