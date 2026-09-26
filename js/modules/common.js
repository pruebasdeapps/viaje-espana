import { h, icon, toast } from '../ui.js';
import { mapUrl, directionsUrl, streetViewUrl, photosUrl, telUrl, share, calendarUrl, openExternal } from '../platform.js';
import { get as getSetting } from '../settings.js';

export function iconTile(name, color = 'tint') {
  return h('span', { class: 'row__icon row__icon--' + color }, icon(name, { size: 18, strokeWidth: 2 }));
}

export function badge(text, kind) {
  if (text == null || text === '') return null;
  return h('span', { class: 'badge' + (kind ? ' badge--' + kind : '') }, text);
}

export function list(...rows) {
  const el = h('div', { class: 'list' });
  for (const r of rows.flat()) if (r) el.append(r);
  return el;
}

export function section(title, content, footer) {
  return h(
    'section',
    { class: 'section' },
    title ? h('div', { class: 'section__header' }, title) : null,
    content,
    footer ? h('div', { class: 'section__footer' }, footer) : null
  );
}

export function row({
  iconName,
  iconColor = 'tint',
  title,
  sub,
  note,
  detail,
  detailStrong = false,
  chevron = false,
  onClick,
  accessory,
  wrap = false,
  done = false,
  className = '',
  href,
} = {}) {
  const tag = href ? 'a' : onClick ? 'button' : 'div';
  const props = {
    class:
      'row' +
      (onClick || href ? ' row--link' : '') +
      (tag === 'button' ? ' row--btn' : '') +
      (wrap ? ' row--wrap' : '') +
      (className ? ' ' + className : ''),
  };
  if (href) {
    props.href = href;
    props.target = '_blank';
    props.rel = 'noopener';
  } else if (onClick) {
    props.type = 'button';
    props.onClick = onClick;
  }
  return h(
    tag,
    props,
    iconName ? iconTile(iconName, iconColor) : null,
    h(
      'div',
      { class: 'row__main' },
      title != null ? h('div', { class: 'row__title' + (done ? ' row__title--done' : '') }, title) : null,
      sub != null ? h('div', { class: 'row__sub' }, sub) : null,
      note != null ? h('div', { class: 'row__note' }, note) : null
    ),
    detail != null ? h('span', { class: 'row__detail' + (detailStrong ? ' row__detail--strong' : '') }, detail) : null,
    accessory || null,
    chevron ? h('span', { class: 'row__chevron' }, icon('chevron', { size: 17, strokeWidth: 2.4 })) : null
  );
}

export function stars(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  if (!n) return null;
  return h('span', { class: 'stars' }, ...Array.from({ length: 5 }, (_, i) => icon(i < n ? 'estrellaLlena' : 'estrella', { size: 13, fill: i < n })));
}

export function empty(iconName, message, actionLabel, action) {
  return h(
    'div',
    { class: 'empty' },
    icon(iconName || 'mapa', { size: 42, strokeWidth: 1.4, cls: 'empty__icon' }),
    h('p', {}, message),
    actionLabel ? h('button', { class: 'btn btn--primary', onClick: action }, actionLabel) : null
  );
}

export function placeActions(lugar, { calendarItem, extra = [] } = {}) {
  const items = [];
  items.push({ label: 'Cómo llegar', onClick: () => openExternal(directionsUrl(lugar)) });
  items.push({ label: 'Ver en el mapa', onClick: () => openExternal(mapUrl(lugar)) });
  if (getSetting('showStreetView')) {
    const sv = streetViewUrl(lugar);
    if (sv) items.push({ label: 'Street View', onClick: () => openExternal(sv) });
  }
  items.push({ label: 'Ver fotos', onClick: () => openExternal(photosUrl(lugar)) });
  if (lugar.telefono) items.push({ label: 'Llamar', onClick: () => openExternal(telUrl(lugar.telefono)) });
  if (lugar.direccion) {
    items.push({
      label: 'Copiar dirección',
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(lugar.direccion);
          toast('Dirección copiada', 'success');
        } catch (_) {
          toast('No se pudo copiar', 'error');
        }
      },
    });
  }
  items.push({
    label: 'Compartir',
    onClick: async () => {
      const r = await share({
        title: lugar.nombre || 'Lugar',
        text: [lugar.nombre, lugar.direccion].filter(Boolean).join(' · '),
        url: mapUrl(lugar),
      });
      if (r === 'copied') toast('Enlace copiado', 'success');
    },
  });
  if (calendarItem) items.push({ label: 'Añadir al calendario', onClick: () => openExternal(calendarUrl(calendarItem)) });
  return [...items, ...extra];
}

export function mapButton(lugar) {
  return h(
    'button',
    {
      class: 'icon-btn',
      title: 'Abrir en Google Maps',
      type: 'button',
      'aria-label': 'Abrir en Google Maps',
      onClick: (e) => {
        e.stopPropagation();
        openExternal(mapUrl(lugar));
      },
    },
    icon('navegar', { size: 20, strokeWidth: 1.9 })
  );
}
