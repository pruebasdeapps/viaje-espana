import { h, openForm, confirmDialog, fmtDate, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { section, row, list, empty } from './common.js';

export const meta = { key: 'notas', label: 'Diario', icon: 'notas' };

const ANIMOS = ['😀', '🙂', '😐', '😕', '😍', '🤩', '😴', '🤒'];

const FIELDS = [
  { name: 'fecha', label: 'Fecha', type: 'date', section: 'Entrada' },
  { name: 'animo', label: 'Ánimo', type: 'select', options: ANIMOS, section: 'Entrada' },
  { name: 'titulo', label: 'Título', required: true, section: 'Entrada' },
  { name: 'contenido', label: 'Contenido', type: 'textarea', section: 'Texto' },
  { name: 'id', type: 'hidden' },
];

export function create() {
  openForm({
    title: 'Nueva nota',
    values: { fecha: new Date().toISOString().slice(0, 10), animo: '🙂' },
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('notas', data);
      toast('Nota guardada', 'success');
    },
  });
}

function edit(item) {
  openForm({
    title: 'Editar nota',
    values: item,
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('notas', data);
      toast('Nota guardada', 'success');
    },
  });
}

async function removeItem(n) {
  if (await confirmDialog('¿Eliminar «' + n.titulo + '»?', { title: 'Eliminar nota' })) {
    await remove(n.id);
    toast('Eliminada', 'success');
  }
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir nota', onClick: create };
}

export function subtitle() {
  const n = storeList('notas').length;
  return n ? n + (n === 1 ? ' entrada' : ' entradas') : '';
}

export function render() {
  const items = storeList('notas').sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  if (!items.length) {
    return empty('notas', 'Escribe el diario del viaje.', 'Añadir nota', create);
  }

  return list(
    ...items.map((n) => {
      const r = row({
        iconName: 'notas',
        iconColor: 'purple',
        title: (n.animo ? n.animo + '  ' : '') + n.titulo,
        sub: n.fecha ? fmtDate(n.fecha) : null,
        note: n.contenido || null,
        wrap: true,
        onClick: () => edit(n),
      });
      attachContextMenu(r, () => [
        { label: 'Editar', onClick: () => edit(n) },
        { label: 'Eliminar', danger: true, onClick: () => removeItem(n) },
      ]);
      return r;
    })
  );
}
