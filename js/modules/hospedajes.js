import { h, openForm, confirmDialog, fmtDate, fmtMoney, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { section, row, list, empty, placeActions } from './common.js';

export const meta = { key: 'hospedajes', label: 'Hospedaje', icon: 'casa' };

const TIPOS = ['Hotel', 'Apartamento', 'Airbnb', 'Hostal', 'Otro'];

const FIELDS = [
  { name: 'nombre', label: 'Nombre', required: true, section: 'Hospedaje' },
  { name: 'ciudad', label: 'Ciudad', required: true, section: 'Hospedaje' },
  { name: 'tipo', label: 'Tipo', type: 'select', options: TIPOS, section: 'Hospedaje' },
  { name: 'fecha_in', label: 'Check-in', type: 'date', section: 'Fechas' },
  { name: 'fecha_out', label: 'Check-out', type: 'date', section: 'Fechas' },
  { name: 'noches', label: 'Noches', type: 'number', section: 'Fechas' },
  { name: 'precio', label: 'Precio total (EUR)', type: 'number', section: 'Detalles' },
  { name: 'direccion', label: 'Dirección', section: 'Detalles' },
  { name: 'url', label: 'Enlace (web / reserva)', type: 'url', section: 'Detalles' },
  { name: 'nota', label: 'Notas', type: 'textarea', section: 'Detalles' },
  { name: 'id', type: 'hidden' },
];

export function create() {
  openForm({
    title: 'Nuevo hospedaje',
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('hospedajes', data);
      toast('Hospedaje guardado', 'success');
    },
  });
}

function edit(item) {
  openForm({
    title: 'Editar hospedaje',
    values: item,
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('hospedajes', data);
      toast('Hospedaje guardado', 'success');
    },
  });
}

async function removeItem(h) {
  if (await confirmDialog('¿Eliminar «' + h.nombre + '»?', { title: 'Eliminar hospedaje' })) {
    await remove(h.id);
    toast('Eliminado', 'success');
  }
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir hospedaje', onClick: create };
}

export function subtitle() {
  const items = storeList('hospedajes');
  const noches = items.reduce((s, h) => s + (Number(h.noches) || 0), 0);
  const total = items.reduce((s, h) => s + (Number(h.precio) || 0), 0);
  return (noches ? noches + ' noches' : '') + (total ? ' · ' + fmtMoney(total) : '');
}

export function render() {
  const items = storeList('hospedajes');
  if (!items.length) {
    return empty('casa', 'Registra los alojamientos del viaje.', 'Añadir hospedaje', create);
  }

  const groups = new Map();
  for (const h of items) {
    const key = h.ciudad || 'Sin ciudad';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(h);
  }

  const fragment = h('div', {});
  for (const [ciudad, listItems] of groups) {
    const rows = listItems.map((h) => {
      const rango = [h.fecha_in, h.fecha_out].filter(Boolean).map(fmtDate).join(' → ') || null;
      const r = row({
        iconName: 'casa',
        iconColor: 'purple',
        title: h.nombre,
        sub: [h.tipo, rango, h.noches ? h.noches + ' noches' : ''].filter(Boolean).join(' · ') || null,
        note: h.nota || null,
        detail: h.precio ? fmtMoney(h.precio) : '',
        detailStrong: true,
        wrap: true,
        onClick: () => edit(h),
      });
      attachContextMenu(r, () =>
        placeActions(
          { nombre: h.nombre, direccion: h.direccion, ciudad: h.ciudad },
          {
            extra: [
              h.url ? { label: 'Abrir enlace', onClick: () => window.open(h.url, '_blank') } : null,
              { label: 'Editar', onClick: () => edit(h) },
              { label: 'Eliminar', danger: true, onClick: () => removeItem(h) },
            ].filter(Boolean),
          }
        )
      );
      return r;
    });
    fragment.append(section(ciudad, list(...rows)));
  }
  return fragment;
}
