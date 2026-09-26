import { h, openForm, confirmDialog, fmtDate, fmtMoney, toast, attachContextMenu, openDocViewer } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { get as getSetting } from '../settings.js';
import { section, row, list, empty, badge } from './common.js';
import { mapUrl, openExternal } from '../platform.js';
import { uploadFile, signedUrl, downloadFile, removeFile as removeStorageFile } from '../storage.js';
import { putFile, getFile, deleteFile as deleteCachedFile } from '../db.js';
import { currentPerson } from '../ui.js';

export const meta = { key: 'documentos', label: 'Reservas', icon: 'documentos' };

const TIPOS = ['Entrada', 'Documento', 'Vuelo', 'Hotel', 'Tren', 'Seguro', 'Pasaporte', 'Alquiler auto', 'Otro'];
const TYPE_STYLE = {
  Entrada: ['documentos', 'orange'],
  Documento: ['clip', 'teal'],
  Vuelo: ['navegar', 'tint'],
  Hotel: ['lugares', 'purple'],
  Tren: ['mapa', 'teal'],
  Seguro: ['candado', 'green'],
  Pasaporte: ['persona', 'red'],
  'Alquiler auto': ['navegar', 'indigo'],
  Otro: ['info', 'gray'],
};
const FILE_LABEL = { pdf: 'PDF', pkpass: 'Pass', imagen: 'Imagen', otro: 'Archivo' };

let tipoFilter = '';
let vistaMios = false;
const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export function archivoLabel(tipo) {
  return FILE_LABEL[tipo] || 'Archivo';
}

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

function prettyName(name) {
  return String(name).replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Documento';
}

function personFromFilename(name) {
  const n = String(name).toLowerCase();
  for (const p of getSetting('people') || []) if (n.includes(p.toLowerCase())) return p;
  return '';
}

function FIELDS() {
  return [
    { name: 'titulo', label: 'Título', required: true, section: 'Documento' },
    { name: 'tipo', label: 'Tipo', type: 'select', options: TIPOS, section: 'Documento' },
    { name: 'asignado', label: 'Asignado a', type: 'combobox', options: getSetting('people') || [], section: 'Documento' },
    { name: 'numero', label: 'N.º de reserva', section: 'Documento' },
    { name: 'fecha', label: 'Fecha', type: 'date', section: 'Cuándo' },
    { name: 'hora', label: 'Hora', type: 'time', section: 'Cuándo' },
    { name: 'ubicacion', label: 'Ubicación', section: 'Dónde' },
    { name: 'precio', label: 'Precio (EUR)', type: 'number', section: 'Detalles' },
    { name: 'url', label: 'Enlace', type: 'url', section: 'Detalles' },
    { name: 'nota', label: 'Notas', type: 'textarea', section: 'Detalles' },
    { name: 'id', type: 'hidden' },
  ];
}

export function create() {
  openForm({
    title: 'Nueva reserva',
    fields: FIELDS(),
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
    fields: FIELDS(),
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

export async function openArchivo(d) {
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
    openDocViewer(blob, { type: d.archivo_tipo === 'imagen' ? 'imagen' : 'pdf', nombre: d.archivo_nombre || d.titulo });
  } catch (e) {
    toast(e.message, 'error');
  }
}

function pickFile(accept, onFile) {
  const input = h('input', { type: 'file', accept, style: { display: 'none' } });
  document.body.append(input);
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (file) onFile(file);
    setTimeout(() => input.remove(), 1000);
  });
  input.click();
}

function attachFile(d) {
  pickFile('.pdf,.pkpass,image/*', async (file) => {
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

function boardingPass(d) {
  if (d.archivo) return openArchivo(d);
  toast('Adjunta el boarding pass (PDF o .pkpass) o una foto', 'info');
}

export function bulkUpload() {
  const input = h('input', { type: 'file', multiple: true, accept: '.pdf,.pkpass,image/*', style: { display: 'none' } });
  document.body.append(input);
  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    if (!files.length) {
      input.remove();
      return;
    }
    toast('Subiendo ' + files.length + ' archivos…');
    let ok = 0;
    for (const file of files) {
      try {
        const tipo = fileTypeOf(file.name);
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = 'bulk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '-' + safe;
        const ct = tipo === 'pkpass' ? 'application/vnd.apple.pkpass' : file.type || undefined;
        await uploadFile('entradas', path, file, ct);
        await save('documentos', {
          titulo: prettyName(file.name),
          tipo: tipo === 'pkpass' ? 'Entrada' : 'Documento',
          asignado: personFromFilename(file.name),
          archivo: path,
          archivo_nombre: file.name,
          archivo_tipo: tipo,
        });
        ok++;
      } catch (e) {
        console.error('bulk', e);
      }
    }
    toast('Subidos ' + ok + ' de ' + files.length, ok ? 'success' : 'error');
    input.remove();
    refresh();
  });
  input.click();
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir reserva', onClick: create };
}

export function openEntradas() {
  tipoFilter = 'Entrada';
  vistaMios = false;
  if ((location.hash || '').startsWith('#/documentos')) refresh();
  else location.hash = '#/documentos';
}

export function render() {
  const all = storeList('documentos');
  const person = currentPerson();
  const fragment = h('div', {});

  const seg = h('div', { class: 'segmented' });
  if (tipoFilter === '') {
    if (person) {
      seg.append(
        h('button', { class: vistaMios ? 'active' : '', onClick: () => { vistaMios = true; refresh(); } }, 'Míos'),
        h('button', { class: !vistaMios ? 'active' : '', onClick: () => { vistaMios = false; refresh(); } }, 'Todos')
      );
    } else {
      seg.append(h('button', { class: 'active' }, 'Todos'));
    }
  } else {
    seg.append(h('button', { class: 'active', onClick: () => { tipoFilter = ''; refresh(); } }, 'Entradas ✕'));
  }
  fragment.append(seg);

  fragment.append(
    section(
      null,
      list(
        row({ iconName: 'clip', iconColor: 'tint', title: 'Subir varios (admin)', sub: 'Asigna cada archivo a una persona por su nombre', chevron: true, onClick: bulkUpload })
      )
    )
  );

  if (!all.length) {
    fragment.append(empty('documentos', 'Guarda aquí vuelos, hoteles y entradas.', 'Añadir reserva', create));
    return fragment;
  }

  let items = all;
  if (tipoFilter === 'Entrada') items = items.filter((d) => d.tipo === 'Entrada');
  if (vistaMios && person) items = items.filter((d) => d.asignado === person);

  if (!items.length) {
    fragment.append(empty('buscar', vistaMios ? 'No tienes documentos asignados.' : 'No hay documentos de ese tipo.'));
    return fragment;
  }

  const groups = new Map();
  for (const d of items) {
    const key = d.tipo || 'Otro';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }

  const order = TIPOS.filter((t) => groups.has(t));
  for (const tipo of order) {
    const rows = groups.get(tipo).map((d) => {
      const st = styleFor(d.tipo);
      const accessories = [];
      if (d.archivo) accessories.push(badge(archivoLabel(d.archivo_tipo), 'tint'));
      if (d.asignado) accessories.push(badge(d.asignado, 'soft'));
      const r = row({
        iconName: st.iconName,
        iconColor: st.iconColor,
        title: d.titulo,
        sub: [d.numero ? 'Ref ' + d.numero : '', fmtDate(d.fecha), d.hora, d.precio ? fmtMoney(d.precio) : ''].filter(Boolean).join(' · ') || null,
        note: d.ubicacion || null,
        accessory: accessories.length ? h('span', { class: 'row__accessory' }, ...accessories) : null,
        chevron: true,
        wrap: true,
        onClick: () => (d.archivo ? openArchivo(d) : edit(d)),
      });
      attachContextMenu(r, () => {
        const items2 = [];
        if (d.archivo) items2.push({ label: 'Abrir archivo (' + archivoLabel(d.archivo_tipo) + ')', onClick: () => openArchivo(d) });
        if (d.tipo === 'Vuelo') items2.push({ label: 'Boarding pass', onClick: () => boardingPass(d) });
        items2.push({ label: d.archivo ? 'Cambiar archivo' : 'Adjuntar archivo', onClick: () => attachFile(d) });
        if (d.archivo) items2.push({ label: 'Quitar archivo', danger: true, onClick: () => removeArchivo(d) });
        if (d.url) items2.push({ label: 'Abrir enlace', onClick: () => window.open(d.url, '_blank') });
        if (d.ubicacion) items2.push({ label: 'Ver en Google Maps', onClick: () => openExternal(mapUrl({ nombre: d.ubicacion, direccion: d.ubicacion })) });
        items2.push({ label: 'Editar', onClick: () => edit(d) });
        items2.push({ label: 'Eliminar', danger: true, onClick: () => removeItem(d) });
        return items2;
      });
      return r;
    });
    fragment.append(section(tipo, list(...rows)));
  }
  return fragment;
}
