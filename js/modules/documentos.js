import { h, openForm, confirmDialog, fmtDate, fmtMoney, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { section, row, list, empty, badge } from './common.js';
import { mapUrl, openExternal } from '../platform.js';
import { uploadFile, signedUrl, downloadFile, removeFile as removeStorageFile } from '../storage.js';
import { putFile, getFile, deleteFile as deleteCachedFile } from '../db.js';

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
const FILE_LABEL = { pdf: 'PDF', pkpass: 'Pass', imagen: 'Imagen', otro: 'Archivo' };

function styleFor(t) {
  const [iconName, iconColor] = TYPE_STYLE[t] || TYPE_STYLE.Otro;
  return { iconName, iconColor };
}

function fileTypeOf(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pkpass') return 'pkpass';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].includes(ext)) return 'imagen';
  return 'otro';
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
    if (d.archivo) {
      await removeStorageFile('entradas', d.archivo).catch(() => {});
      await deleteCachedFile(d.archivo).catch(() => {});
    }
    await remove(d.id);
    toast('Eliminada', 'success');
  }
}

function attachFile(d) {
  const input = h('input', { type: 'file', accept: '.pdf,.pkpass,image/*' });
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    toast('Subiendo archivo…');
    try {
      const tipo = fileTypeOf(file.name);
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = (d.id || 'doc') + '-' + Date.now() + '-' + safe;
      const ct = tipo === 'pkpass' ? 'application/vnd.apple.pkpass' : file.type || undefined;
      await uploadFile('entradas', path, file, ct);
      await save('documentos', { ...d, archivo: path, archivo_nombre: file.name, archivo_tipo: tipo });
      toast('Archivo adjuntado', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  input.click();
}

async function openFile(d) {
  try {
    if (d.archivo_tipo === 'pkpass') {
      const url = await signedUrl('entradas', d.archivo);
      if (url) {
        openExternal(url);
        return;
      }
    }
    let blob = (await getFile(d.archivo))?.blob;
    if (!blob) {
      blob = await downloadFile('entradas', d.archivo);
      await putFile({ path: d.archivo, blob, type: d.archivo_tipo, nombre: d.archivo_nombre });
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function removeArchivo(d) {
  if (!(await confirmDialog('¿Quitar el archivo adjunto?', { title: 'Quitar archivo', okText: 'Quitar' }))) return;
  try {
    await removeStorageFile('entradas', d.archivo).catch(() => {});
    await deleteCachedFile(d.archivo).catch(() => {});
    await save('documentos', { ...d, archivo: null, archivo_nombre: null, archivo_tipo: null });
    toast('Archivo quitado', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir reserva', onClick: create };
}

export function render() {
  const items = storeList('documentos');
  if (!items.length) {
    return empty('documentos', 'Guarda aquí vuelos, hoteles y entradas.', 'Añadir reserva', create);
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
        accessory: d.archivo ? h('span', { class: 'row__accessory' }, badge(FILE_LABEL[d.archivo_tipo] || 'Archivo', 'tint')) : null,
        chevron: true,
        wrap: true,
        onClick: () => edit(d),
      });
      attachContextMenu(r, () => {
        const items = [];
        if (d.archivo) items.push({ label: 'Abrir archivo (' + (FILE_LABEL[d.archivo_tipo] || 'Archivo') + ')', onClick: () => openFile(d) });
        items.push({ label: d.archivo ? 'Cambiar archivo' : 'Adjuntar archivo', onClick: () => attachFile(d) });
        if (d.archivo) items.push({ label: 'Quitar archivo', danger: true, onClick: () => removeArchivo(d) });
        if (d.url) items.push({ label: 'Abrir enlace', onClick: () => window.open(d.url, '_blank') });
        if (d.ubicacion) items.push({ label: 'Ver en Google Maps', onClick: () => openExternal(mapUrl({ nombre: d.ubicacion, direccion: d.ubicacion })) });
        items.push({ label: 'Editar', onClick: () => edit(d) });
        items.push({ label: 'Eliminar', danger: true, onClick: () => removeItem(d) });
        return items;
      });
      return r;
    });
    fragment.append(section(tipo, list(...rows)));
  }
  return fragment;
}
