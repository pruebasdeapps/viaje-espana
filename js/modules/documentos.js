import { h, openForm, confirmDialog, fmtDate, fmtMoney, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { section, row, list, empty, placeActions } from './common.js';

export const meta = { key: 'documentos', label: 'Reservas', icon: 'documentos' };

const TIPOS = ['Vuelo', 'Hotel', 'Tren', 'Seguro', 'Pasaporte', 'Alquiler auto', 'Entrada', 'Otro'];
const TYPE_STYLE = {
  Vuelo: ['navegar', 'tint'],
  Hotel: ['lugares', 'purple'],
  Tren: ['mapa', 'teal'],
  Seguro: ['candado', 'green'],
  Pasaporte: ['persona', 'red'],
  'Alquiler auto': ['navegar', 'indigo'],
  Entrada: ['documentos', 'orange'],
  Otro: ['info', 'gray'],
};

function styleFor(t) {
  const [iconName, iconColor] = TYPE_STYLE[t] || TYPE_STYLE.Otro;
  return { iconName, iconColor };
}

const FIELDS = [
  { name: 'titulo', label: 'Título', required: true, section: 'Documento' },
  { name: 'tipo', label: 'Tipo', type: 'select', options: TIPOS, section: 'Documento' },
  { name: 'numero', label: 'N.º de reserva', section: 'Documento' },
  { name: 'fecha', label: 'Fecha', type: 'date', section: 'Cuándo' },
  { name: 'hora', label: 'Hora', type: 'time', section: 'Cuándo' },
  { name: 'ubicacion', label: 'Ubicación', section: 'Dónde' },
  { name: 'precio', label: 'Precio (EUR)', type: 'number', section: 'Detalles' },
  { name: 'url', label: 'Enlace', type: 'url', section: 'Detalles' },
  { name: 'nota', label: 'Notas', type: 'textarea', section: 'Detalles' },
  { name: 'id', type: 'hidden' },
];

export function create() {
  openForm({
    title: 'Nueva reserva',
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('documentos', data);
      toast('Reserva guardada', 'success');
    },
  });
}

function edit(item) {
  openForm({
    title: 'Editar reserva',
    values: item,
    fields: FIELDS,
    onSubmit: async (data) => {
      await save('documentos', data);
      toast('Reserva guardada', 'success');
    },
  });
}

async function removeItem(d) {
  if (await confirmDialog('¿Eliminar «' + d.titulo + '»?', { title: 'Eliminar reserva' })) {
    await remove(d.id);
    toast('Eliminada', 'success');
  }
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir reserva', onClick: create };
}

export function render() {
  const items = storeList('documentos');
  if (!items.length) {
    return empty('documentos', 'Guarda aquí vuelos, hoteles y seguros.', 'Añadir reserva', create);
  }

  const groups = new Map();
  for (const d of items) {
    const key = d.tipo || 'Otro';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }

  const fragment = h('div', {});
  const order = TIPOS.filter((t) => groups.has(t));
  for (const tipo of order) {
    const listItems = groups.get(tipo);
    const rows = listItems.map((d) => {
      const st = styleFor(d.tipo);
      const r = row({
        iconName: st.iconName,
        iconColor: st.iconColor,
        title: d.titulo,
        sub: [d.numero ? 'Ref ' + d.numero : '', fmtDate(d.fecha), d.hora, d.precio ? fmtMoney(d.precio) : ''].filter(Boolean).join(' · ') || null,
        note: d.ubicacion || null,
        chevron: true,
        wrap: true,
        onClick: () => edit(d),
      });
      attachContextMenu(r, () =>
        placeActions(
          { nombre: d.ubicacion || d.titulo, direccion: d.ubicacion },
          {
            calendarItem: d,
            extra: [
              d.url ? { label: 'Abrir enlace', onClick: () => window.open(d.url, '_blank') } : null,
              { label: 'Editar', onClick: () => edit(d) },
              { label: 'Eliminar', danger: true, onClick: () => removeItem(d) },
            ].filter(Boolean),
          }
        )
      );
      return r;
    });
    fragment.append(section(tipo, list(...rows)));
  }
  return fragment;
}
