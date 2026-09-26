import { icon } from './icons.js';

export { icon };

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function appendKids(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'on' && typeof value === 'object') {
      for (const [ev, fn] of Object.entries(value)) el.addEventListener(ev, fn);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in el && key !== 'list') {
      try {
        el[key] = value;
      } catch (_) {
        el.setAttribute(key, value);
      }
    } else {
      el.setAttribute(key, value);
    }
  }
  appendKids(el, kids);
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function fmtMoney(value, currency = 'EUR') {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n);
  } catch (_) {
    return n.toFixed(2) + ' ' + currency;
  }
}

export function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value);
  if (isNaN(d)) return value;
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtDateLong(value) {
  const d = value ? new Date(value.length <= 10 ? value + 'T00:00:00' : value) : new Date();
  if (isNaN(d)) return value || '';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function escapeHTML(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer = null;
export function toast(message, kind = 'info') {
  let box = document.querySelector('.toast');
  if (!box) {
    box = h('div', { class: 'toast' });
    document.body.append(box);
  }
  box.className = 'toast toast--' + kind + ' toast--show';
  box.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = 'toast toast--' + kind), 2400);
}

function lockScroll() {
  document.body.classList.add('modal-open');
}
function unlockScroll() {
  if (!document.querySelector('.sheet-overlay')) document.body.classList.remove('modal-open');
}

export function closeSheet() {
  const overlay = document.querySelector('.sheet-overlay');
  if (overlay) overlay.remove();
  unlockScroll();
}

function mountOverlay(overlay, { dismissible = true } = {}) {
  if (dismissible) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeSheet();
    });
  }
  const onKey = (e) => {
    if (e.key === 'Escape') {
      closeSheet();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  lockScroll();
  return overlay;
}

export function actionSheet({ title, items = [] } = {}) {
  const group = h('div', { class: 'action-sheet__group' });
  if (title) group.append(h('div', { class: 'action-sheet__title' }, title));
  for (const item of items) {
    group.append(
      h(
        'button',
        {
          class: 'action-sheet__item' + (item.danger ? ' action-sheet__item--danger' : ''),
          onClick: () => {
            closeSheet();
            if (item.onClick) setTimeout(() => item.onClick(), 10);
          },
        },
        item.label
      )
    );
  }
  const wrap = h(
    'div',
    { class: 'action-sheet', onClick: (e) => e.stopPropagation() },
    group,
    h('button', { class: 'action-sheet__cancel', onClick: closeSheet }, 'Cancelar')
  );
  const overlay = h('div', { class: 'sheet-overlay' }, wrap);
  overlay.style.alignItems = 'flex-end';
  return mountOverlay(overlay);
}

export function openSheet({ title, body, leading, trailing, dismissible = true } = {}) {
  const sheet = h(
    'div',
    { class: 'sheet' },
    h('div', { class: 'sheet__grabber' }),
    h(
      'div',
      { class: 'sheet__nav' },
      leading || h('span', {}),
      h('div', { class: 'sheet__title' }, title || ''),
      trailing || h('span', {})
    ),
    h('div', { class: 'sheet__body' }, body)
  );
  const overlay = h('div', { class: 'sheet-overlay' }, sheet);
  mountOverlay(overlay, { dismissible });
  return sheet;
}

export function confirmDialog(message, { title, okText = 'Eliminar', danger = true } = {}) {
  return new Promise((resolve) => {
    actionSheet({
      title: title || message,
      items: [
        {
          label: okText,
          danger,
          onClick: () => resolve(true),
        },
        { label: 'Cancelar', onClick: () => resolve(false) },
      ],
    });
    const overlay = document.querySelector('.sheet-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) resolve(false);
      });
    }
  });
}

export function attachContextMenu(el, getItems) {
  let timer = null;
  const suppress = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const start = () => {
    timer = setTimeout(() => {
      timer = null;
      navigator.vibrate && navigator.vibrate(8);
      const items = typeof getItems === 'function' ? getItems() : getItems;
      if (items && items.length) {
        el.addEventListener('click', suppress, true);
        setTimeout(() => el.removeEventListener('click', suppress, true), 700);
        actionSheet({ title: null, items });
      }
    }, 480);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointermove', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const items = typeof getItems === 'function' ? getItems() : getItems;
    if (items && items.length) actionSheet({ items });
  });
}

function fieldControl(field, values) {
  const val = values[field.name];
  const common = {
    name: field.name,
    id: 'f_' + field.name,
    required: !!field.required,
    placeholder: field.placeholder || '',
    ...(field.attrs || {}),
  };
  if (field.type === 'textarea') {
    return h('textarea', { ...common, rows: field.rows || 4 }, val || '');
  }
  if (field.type === 'select') {
    return h(
      'select',
      common,
      h('option', { value: '' }, field.placeholder || 'Elegir…'),
      ...(field.options || []).map((opt) => {
        const value = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        return h('option', { value, selected: String(val ?? '') === String(value) }, label);
      })
    );
  }
  if (field.type === 'checkbox') {
    return h('input', { ...common, type: 'checkbox', checked: !!val });
  }
  return h('input', {
    ...common,
    type: field.type || 'text',
    value: val ?? '',
    ...(field.type === 'number' ? { step: field.step || 'any', inputmode: 'decimal' } : {}),
  });
}

function buildForm(fields, values) {
  const form = h('form', { class: 'form', novalidate: true });
  let currentSection = null;
  let list = null;

  const addField = (field) => {
    if (field.type === 'hidden') {
      form.append(h('input', { type: 'hidden', name: field.name, value: values[field.name] ?? '' }));
      return;
    }
    if (field.type === 'combobox') {
      const listId = 'dl_' + field.name + '_' + Math.random().toString(36).slice(2, 6);
      const input = h('input', {
        name: field.name,
        id: 'f_' + field.name,
        type: 'text',
        value: values[field.name] ?? '',
        placeholder: field.placeholder || '',
        list: listId,
        ...(field.attrs || {}),
      });
      const options = (field.options || []).map((o) =>
        h('option', { value: typeof o === 'string' ? o : o.value })
      );
      const dl = h('datalist', { id: listId }, ...options);
      list.append(
        h(
          'label',
          { class: 'field', for: input.id },
          h('span', { class: 'field__label' }, field.label, field.required ? h('em', {}, ' *') : null),
          input,
          dl
        )
      );
      if (field.help) list.append(h('div', { class: 'field__help' }, field.help));
      return;
    }
    const control = fieldControl(field, values);
    let row;
    if (field.type === 'textarea') {
      row = h(
        'label',
        { class: 'field field--stack', for: control.id },
        h('span', { class: 'field__label' }, field.label, field.required ? h('em', {}, ' *') : null),
        control
      );
    } else if (field.type === 'checkbox') {
      row = h(
        'label',
        { class: 'field field--check', for: control.id },
        h('span', { class: 'field__label' }, field.label),
        h('span', { class: 'switch' }, control, h('span', {}))
      );
    } else {
      row = h(
        'label',
        { class: 'field', for: control.id },
        h('span', { class: 'field__label' }, field.label, field.required ? h('em', {}, ' *') : null),
        control
      );
    }
    list.append(row);
    if (field.help) list.append(h('div', { class: 'field__help' }, field.help));
  };

  for (const field of fields) {
    const section = field.section || null;
    if (!list || section !== currentSection) {
      currentSection = section;
      const wrap = h('section', { class: 'section' });
      if (section) wrap.append(h('div', { class: 'section__header' }, section));
      list = h('div', { class: 'list' });
      wrap.append(list);
      form.append(wrap);
    }
    addField(field);
  }
  return form;
}

export function openForm({ title, fields, values = {}, onSubmit, submitText = 'Guardar' }) {
  const form = buildForm(fields, values);
  const formId = 'sheetform_' + Math.random().toString(36).slice(2, 8);
  form.setAttribute('id', formId);

  const cancel = h('button', { class: 'nav-btn', type: 'button', onClick: closeSheet }, 'Cancelar');
  const done = h('button', { class: 'nav-btn', type: 'submit' }, submitText);
  done.setAttribute('form', formId);
  const sheet = h(
    'div',
    { class: 'sheet' },
    h('div', { class: 'sheet__grabber' }),
    h('div', { class: 'sheet__nav' }, cancel, h('div', { class: 'sheet__title' }, title || ''), done),
    h('div', { class: 'sheet__body' }, form)
  );
  const overlay = h('div', { class: 'sheet-overlay' }, sheet);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    for (const field of fields) {
      const input = form.elements[field.name];
      if (!input) continue;
      if (field.type === 'checkbox') data[field.name] = input.checked;
      else if (field.type === 'number') data[field.name] = input.value === '' ? '' : Number(input.value);
      else data[field.name] = input.value.trim();
    }
    for (const field of fields) {
      if (field.required && (data[field.name] === '' || data[field.name] == null)) {
        toast('Completa: ' + field.label, 'error');
        form.elements[field.name]?.focus();
        return;
      }
    }
    done.disabled = true;
    try {
      const result = await onSubmit(data);
      if (result !== false) closeSheet();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Error al guardar', 'error');
    } finally {
      done.disabled = false;
    }
  });

  mountOverlay(overlay);
  const first = sheet.querySelector('input:not([type=hidden]),select,textarea');
  if (first && window.innerWidth >= 640) setTimeout(() => first.focus(), 120);
  return form;
}

export function mapsUrl(lugar) {
  const { lat = '', lng = '', direccion = '', nombre = '' } = lugar || {};
  const hasCoords = lat !== '' && lng !== '' && lat != null && lng != null;
  const query = hasCoords ? `${lat},${lng}` : `${nombre} ${direccion} España`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function emptyState(iconName, message, actionLabel, action) {
  return h(
    'div',
    { class: 'empty' },
    icon(iconName || 'mapa', { size: 44, strokeWidth: 1.4, cls: 'empty__icon' }),
    h('p', {}, message),
    actionLabel ? h('button', { class: 'btn btn--primary', onClick: action }, actionLabel) : null
  );
}
