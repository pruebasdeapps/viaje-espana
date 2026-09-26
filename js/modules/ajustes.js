import { h, openSheet, confirmDialog, toast, closeSheet, actionSheet, openForm, fmtDate } from '../ui.js';
import { CONFIG, SYNC_ENABLED } from '../config.js';
import { get, set, setRate, all as settingsAll } from '../settings.js';
import { exportJSON, importJSON, resetAll, list as storeList } from '../store.js';
import { login, signup, logout, currentUser, onStatus, syncNow } from '../sync.js';
import { icsExport } from '../platform.js';
import { section, row, list } from './common.js';

export const meta = { key: 'ajustes', label: 'Configuración', icon: 'ajustes' };

const VERSION = '1.1.0';
const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function switchEl(checked, onChange) {
  return h(
    'label',
    { class: 'switch', onClick: (e) => e.stopPropagation() },
    h('input', { type: 'checkbox', checked: !!checked, onChange: (e) => onChange(e.target.checked) }),
    h('span', {})
  );
}

function switchRow({ iconName, iconColor, title, sub, checked, onChange }) {
  return row({ iconName, iconColor, title, sub, accessory: switchEl(checked, onChange) });
}

function pickerRow({ iconName, iconColor, title, value, options, onChange }) {
  const current = options.find((o) => o.value === value);
  return row({
    iconName,
    iconColor,
    title,
    detail: current ? current.label : String(value),
    chevron: true,
    onClick: () => {
      actionSheet({
        items: options.map((o) => ({
          label: (o.value === value ? '✓  ' : '') + o.label,
          onClick: () => {
            onChange(o.value);
            refresh();
          },
        })),
      });
    },
  });
}

function textRow({ iconName, iconColor, title, value, placeholder, onSave }) {
  return row({
    iconName,
    iconColor,
    title,
    detail: value || '',
    chevron: true,
    onClick: () => {
      const input = h('input', { type: 'text', value: value || '', placeholder: placeholder || '' });
      const save = h('button', { class: 'nav-btn' }, 'Guardar');
      save.addEventListener('click', () => {
        onSave(input.value.trim());
        closeSheet();
        refresh();
      });
      const body = h(
        'div',
        {},
        list(h('label', { class: 'field' }, h('span', { class: 'field__label' }, title), input))
      );
      openSheet({ title, body, leading: h('button', { class: 'nav-btn', onClick: closeSheet }, 'Cancelar'), trailing: save });
      setTimeout(() => input.focus(), 150);
    },
  });
}

function dateRow({ iconName, iconColor, title, value, onSave }) {
  return row({
    iconName,
    iconColor,
    title,
    detail: value ? fmtDate(value) : 'Automático',
    chevron: true,
    onClick: () => {
      const input = h('input', { type: 'date', value: value || '' });
      const save = h('button', { class: 'nav-btn' }, 'Guardar');
      save.addEventListener('click', () => {
        onSave(input.value);
        closeSheet();
        refresh();
      });
      const body = h('div', {}, list(h('label', { class: 'field' }, h('span', { class: 'field__label' }, title), input)));
      openSheet({ title, body, leading: h('button', { class: 'nav-btn', onClick: closeSheet }, 'Cancelar'), trailing: save });
    },
  });
}

function openListEditor(key, title, addPlaceholder = 'Nuevo') {
  let items = [...(get(key) || [])];
  const build = () => {
    if (!items.length) return h('p', { class: 'section__footer' }, 'Sin elementos todavía.');
    const rows = items.map((name, i) => {
      const input = h('input', { type: 'text', value: name, onInput: (e) => { items[i] = e.target.value; } });
      const del = h('button', { class: 'icon-btn', title: 'Quitar', onClick: () => { items.splice(i, 1); set(key, [...items]); rebuild(); } }, '✕');
      return h('div', { class: 'field' }, input, del);
    });
    return list(...rows);
  };
  const body = h('div', {});
  const listWrap = h('div', {});
  listWrap.append(build());
  body.append(listWrap);
  const addInput = h('input', { type: 'text', placeholder: addPlaceholder });
  const addBtn = h('button', { class: 'btn btn--block' }, '+ Añadir');
  addBtn.addEventListener('click', () => {
    const v = addInput.value.trim();
    if (v) {
      items.push(v);
      set(key, [...items]);
      addInput.value = '';
      listWrap.replaceChildren(build());
    }
  });
  body.append(h('div', { class: 'row-actions', style: { marginTop: '14px' } }, addBtn), h('div', { style: { marginTop: '8px' } }, addInput));
  const done = h('button', { class: 'nav-btn' }, 'Listo');
  done.addEventListener('click', () => {
    set(key, items.filter(Boolean));
    closeSheet();
    refresh();
  });
  openSheet({ title, body, leading: h('button', { class: 'nav-btn', onClick: () => { closeSheet(); refresh(); } }, 'Cancelar'), trailing: done });
}

function openPeopleSheet() {
  openListEditor('people', 'Personas del grupo', 'Nuevo nombre');
}

function openRatesSheet() {
  const rates = settingsAll().rates;
  const rows = Object.keys(rates).map((code) =>
    h(
      'label',
      { class: 'field' },
      h('span', { class: 'field__label' }, '1 EUR = ' + code),
      h('input', {
        type: 'number',
        step: 'any',
        inputmode: 'decimal',
        value: rates[code],
        onInput: (e) => setRate(code, e.target.value),
      })
    )
  );
  const add = h('button', { class: 'btn btn--block' }, '+ Añadir moneda');
  add.addEventListener('click', () => {
    closeSheet();
    openForm({
      title: 'Añadir moneda',
      fields: [
        { name: 'code', label: 'Código (ej. MXN)', required: true, section: 'Moneda' },
        { name: 'rate', label: '1 EUR = cuántos', type: 'number', required: true, section: 'Moneda' },
      ],
      onSubmit: async (data) => {
        setRate(data.code.toUpperCase(), Number(data.rate));
        toast('Moneda añadida', 'success');
        refresh();
      },
    });
  });
  const body = h('div', {}, list(...rows), h('div', { class: 'row-actions', style: { marginTop: '16px' } }, add));
  openSheet({
    title: 'Tasas de cambio',
    body,
    leading: h('button', { class: 'nav-btn', onClick: () => { closeSheet(); refresh(); } }, 'Listo'),
    trailing: h('button', { class: 'nav-btn', onClick: closeSheet }, ''),
  });
}

function openAuth() {
  const email = h('input', { type: 'email', autocomplete: 'username', placeholder: 'correo@familia.com' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Contraseña' });
  const entrar = h('button', { class: 'btn btn--primary btn--block' }, 'Entrar');
  const crear = h('button', { class: 'btn btn--block' }, 'Crear cuenta');
  entrar.addEventListener('click', async () => {
    try {
      await login(email.value.trim(), pass.value);
      toast('Sesión iniciada', 'success');
      closeSheet();
      await syncNow();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  crear.addEventListener('click', async () => {
    try {
      await signup(email.value.trim(), pass.value);
      toast('Cuenta creada', 'success');
      closeSheet();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  const body = h(
    'div',
    {},
    list(
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Correo'), email),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Contraseña'), pass)
    ),
    h('div', { class: 'row-actions', style: { marginTop: '18px' } }, entrar, crear),
    h('p', { class: 'section__footer' }, 'Todos los miembros con cuenta ven el mismo viaje.')
  );
  openSheet({ title: 'Cuenta familiar', body, leading: h('button', { class: 'nav-btn', onClick: closeSheet }, 'Cancelar') });
}

function openStorage() {
  let info = h('p', { class: 'section__footer' }, 'Consultando…');
  const rows = [row({ iconName: 'nube', iconColor: 'tint', title: 'Almacenamiento', sub: 'IndexedDB (offline)' })];
  const body = h('div', {}, list(...rows), info);
  const persistedRow = row({ iconName: 'candado', iconColor: 'green', title: 'Persistente', detail: '…' });
  const estimateRow = row({ iconName: 'info', iconColor: 'gray', title: 'Uso', detail: '…' });
  body.append(list(persistedRow, estimateRow));
  const pedir = h('button', { class: 'btn btn--block' }, 'Pedir almacenamiento persistente');
  pedir.addEventListener('click', async () => {
    if (navigator.storage && navigator.storage.persist) {
      const ok = await navigator.storage.persist();
      toast(ok ? 'Almacenamiento persistente activado' : 'No se pudo activar', ok ? 'success' : 'error');
      persistedRow.querySelector('.row__detail').textContent = ok ? 'Sí' : 'No';
    }
  });
  body.append(h('div', { class: 'row-actions', style: { marginTop: '16px' } }, pedir));
  (async () => {
    if (navigator.storage && navigator.storage.persisted) {
      const p = await navigator.storage.persisted();
      persistedRow.querySelector('.row__detail').textContent = p ? 'Sí' : 'No';
    }
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      const mb = ((e.usage || 0) / 1024 / 1024).toFixed(2);
      estimateRow.querySelector('.row__detail').textContent = mb + ' MB';
    }
  })();
  openSheet({ title: 'Almacenamiento', body, leading: h('button', { class: 'nav-btn', onClick: closeSheet }, 'Listo') });
}

function cuentaSection() {
  const user = currentUser();
  const rows = [];
  if (!SYNC_ENABLED) {
    rows.push(row({ iconName: 'info', iconColor: 'gray', title: 'Sync no configurado', sub: 'La app funciona solo en este dispositivo', wrap: true }));
  } else if (user) {
    rows.push(row({ iconName: 'persona', iconColor: 'green', title: user.email || 'Sesión activa', sub: 'Sincronizado entre dispositivos' }));
    rows.push(
      switchRow({
        iconName: 'refrescar',
        iconColor: 'tint',
        title: 'Sincronización automática',
        sub: 'Subir/bajar cambios en segundo plano',
        checked: get('autoSync'),
        onChange: (v) => set('autoSync', v),
      }),
      switchRow({
        iconName: 'wifi',
        iconColor: 'teal',
        title: 'Solo con Wi-Fi',
        sub: 'Evitar datos móviles',
        checked: get('syncWifiOnly'),
        onChange: (v) => set('syncWifiOnly', v),
      })
    );
    const statusRow = row({ iconName: 'info', iconColor: 'gray', title: 'Estado', detail: '…' });
    onStatus((s) => {
      statusRow.querySelector('.row__detail').textContent = s.message || s.state;
    });
    rows.push(statusRow);
    rows.push(row({ iconName: 'refrescar', iconColor: 'indigo', title: 'Sincronizar ahora', onClick: () => syncNow(), chevron: true }));
    rows.push(
      row({
        iconName: 'tache',
        iconColor: 'red',
        title: 'Cerrar sesión',
        onClick: async () => {
          if (await confirmDialog('¿Cerrar la sesión en este dispositivo?', { title: 'Cerrar sesión', okText: 'Cerrar sesión' })) {
            await logout();
            toast('Sesión cerrada');
            window.dispatchEvent(new CustomEvent('viaje:auth'));
          }
        },
      })
    );
  } else {
    rows.push(row({ iconName: 'candado', iconColor: 'tint', title: 'Iniciar sesión o crear cuenta', sub: 'Para compartir el viaje con la familia', chevron: true, onClick: openAuth }));
  }
  return section('Sincronización', list(...rows));
}

export function render() {
  const fragment = h('div', {});
  const rates = settingsAll().rates;
  const base = get('currency');

  fragment.append(
    section(
      'General',
      list(
        textRow({
          iconName: 'info',
          iconColor: 'tint',
          title: 'Nombre del viaje',
          value: get('tripName'),
          placeholder: 'Mi viaje',
          onSave: (v) => set('tripName', v || CONFIG.appName),
        }),
        pickerRow({
          iconName: 'tema',
          iconColor: 'purple',
          title: 'Tema',
          value: get('theme'),
          options: [
            { value: 'system', label: 'Sistema' },
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Oscuro' },
          ],
          onChange: (v) => set('theme', v),
        }),
        dateRow({
          iconName: 'calendario',
          iconColor: 'tint',
          title: 'Inicio del viaje',
          value: get('tripStart'),
          onSave: (v) => set('tripStart', v || '2027-02-04'),
        })
      )
    )
  );

  fragment.append(
    section(
      'Monedas',
      list(
        pickerRow({
          iconName: 'euro',
          iconColor: 'green',
          title: 'Moneda base',
          value: base,
          options: Object.keys(rates).map((c) => ({ value: c, label: c })),
          onChange: (v) => set('currency', v),
        }),
        row({ iconName: 'euro', iconColor: 'indigo', title: 'Editar tasas de cambio', sub: '1 EUR = …', chevron: true, onClick: openRatesSheet })
      )
    )
  );

  fragment.append(
    section(
      'Personas',
      list(
        row({
          iconName: 'personas',
          iconColor: 'orange',
          title: 'Personas del grupo',
          sub: 'Para «quién paga» y el desglose',
          detail: String((get('people') || []).length),
          chevron: true,
          onClick: openPeopleSheet,
        })
      )
    )
  );

  fragment.append(
    section(
      'Gastos',
      list(
        row({
          iconName: 'gastos',
          iconColor: 'pink',
          title: 'Tipos de gasto',
          sub: 'Transporte, Comida, Entradas…',
          detail: String((get('gastoCategories') || []).length),
          chevron: true,
          onClick: () => openListEditor('gastoCategories', 'Tipos de gasto'),
        }),
        row({
          iconName: 'gastos',
          iconColor: 'teal',
          title: 'Métodos de pago',
          sub: 'Efectivo, Tarjeta, Bizum…',
          detail: String((get('metodos') || []).length),
          chevron: true,
          onClick: () => openListEditor('metodos', 'Métodos de pago'),
        })
      )
    )
  );

  fragment.append(
    section(
      'Ruta',
      list(
        row({
          iconName: 'mapa',
          iconColor: 'indigo',
          title: 'Orden de países',
          sub: 'España, Italia, Francia…',
          detail: String((get('countryOrder') || []).length),
          chevron: true,
          onClick: () => openListEditor('countryOrder', 'Orden de países'),
        })
      )
    )
  );

  fragment.append(
    section(
      'Mapas y navegación',
      list(
        pickerRow({
          iconName: 'mapa',
          iconColor: 'teal',
          title: 'App de mapas',
          value: get('mapApp'),
          options: [
            { value: 'google', label: 'Google Maps' },
            { value: 'apple', label: 'Apple Maps' },
          ],
          onChange: (v) => set('mapApp', v),
        }),
        pickerRow({
          iconName: 'navegar',
          iconColor: 'tint',
          title: 'Transporte por defecto',
          value: get('travelMode'),
          options: [
            { value: 'driving', label: 'En auto' },
            { value: 'transit', label: 'Transporte público' },
            { value: 'walking', label: 'A pie' },
            { value: 'bicycling', label: 'En bicicleta' },
          ],
          onChange: (v) => set('travelMode', v),
        }),
        switchRow({ iconName: 'ubicacion', iconColor: 'orange', title: 'Mostrar Street View', sub: 'En el menú de cada lugar', checked: get('showStreetView'), onChange: (v) => set('showStreetView', v) })
      )
    )
  );

  fragment.append(
    section(
      'Fotos y búsqueda',
      list(
        pickerRow({
          iconName: 'camara',
          iconColor: 'pink',
          title: 'Fuente de fotos',
          value: get('photoSource'),
          options: [
            { value: 'images', label: 'Google Imágenes' },
            { value: 'maps', label: 'Google Maps' },
          ],
          onChange: (v) => set('photoSource', v),
        })
      )
    )
  );

  fragment.append(
    section(
      'Calendario',
      list(
        pickerRow({
          iconName: 'reloj',
          iconColor: 'orange',
          title: 'Recordatorio por defecto',
          value: get('defaultReminderMin'),
          options: [
            { value: 0, label: 'Sin recordatorio' },
            { value: 10, label: '10 minutos antes' },
            { value: 15, label: '15 minutos antes' },
            { value: 30, label: '30 minutos antes' },
            { value: 60, label: '1 hora antes' },
          ],
          onChange: (v) => set('defaultReminderMin', v),
        }),
        row({
          iconName: 'calendario',
          iconColor: 'tint',
          title: 'Exportar itinerario a .ics',
          sub: 'Importar en Apple Calendar o Google',
          onClick: () => {
            const acts = storeList('itinerario');
            if (!acts.length) {
              toast('No hay actividades que exportar', 'error');
              return;
            }
            download('viaje.ics', icsExport(acts), 'text/calendar');
            toast('Calendario descargado', 'success');
          },
        })
      )
    )
  );

  fragment.append(cuentaSection());

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    style: { display: 'none' },
    onChange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const n = await importJSON(await file.text());
        toast('Importados ' + n + ' registros', 'success');
        refresh();
      } catch (err) {
        toast(err.message || 'Archivo no válido', 'error');
      }
      e.target.value = '';
    },
  });

  fragment.append(
    section(
      'Datos',
      list(
        row({
          iconName: 'compartir',
          iconColor: 'tint',
          title: 'Exportar datos',
          sub: 'Descarga un archivo JSON',
          onClick: () => {
            download('viaje-' + new Date().toISOString().slice(0, 10) + '.json', exportJSON());
            toast('Respaldo descargado', 'success');
          },
        }),
        row({ iconName: 'importar', iconColor: 'indigo', title: 'Importar datos', onClick: () => fileInput.click() }),
        row({ iconName: 'nube', iconColor: 'teal', title: 'Almacenamiento', chevron: true, onClick: openStorage }),
        fileInput
      ),
      'Haz un respaldo antes de volar: iOS puede borrar los datos de apps poco usadas.'
    )
  );

  fragment.append(
    section(
      'Acerca de',
      list(
        row({ iconName: 'info', iconColor: 'gray', title: 'Aplicación', detail: get('tripName') || CONFIG.appName, detailStrong: true }),
        row({ iconName: 'info', iconColor: 'gray', title: 'Versión', detail: VERSION, detailStrong: true }),
        row({ iconName: 'euro', iconColor: 'gray', title: 'Moneda base', detail: base, detailStrong: true }),
        row({ iconName: 'nube', iconColor: 'gray', title: 'Modo', detail: SYNC_ENABLED ? 'Local + nube' : 'Solo local', detailStrong: true })
      )
    )
  );

  fragment.append(
    section(
      'Zona peligrosa',
      list(
        row({
          iconName: 'basura',
          iconColor: 'red',
          title: 'Borrar datos locales',
          sub: 'Restaura el itinerario por defecto',
          onClick: async () => {
            if (await confirmDialog('Se borrarán tus datos y se restaurará el itinerario por defecto. ¿Continuar?', { title: 'Reiniciar datos', okText: 'Restaurar' })) {
              await resetAll();
              toast('Datos restaurados', 'success');
              refresh();
            }
          },
        })
      )
    )
  );

  return fragment;
}
