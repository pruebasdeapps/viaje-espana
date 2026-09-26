import { h, fmtMoney, fmtDateLong, todayISO } from '../ui.js';
import { list as storeList } from '../store.js';
import { all as settingsAll, get as getSetting } from '../settings.js';
import { section, row, list } from './common.js';
import { create as addActividad } from './itinerario.js';
import { create as addGasto, toBase } from './gastos.js';
import { create as addLugar } from './lugares.js';
import { openArchivo, archivoLabel } from './documentos.js';
import { forecast, coordsForCity } from '../weather.js';
import { CITY_COUNTRY } from '../geo.js';

export const meta = { key: 'hoy', label: 'Hoy', icon: 'sol' };

export function subtitle() {
  const d = fmtDateLong(todayISO());
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function timeToMinutes(t) {
  if (!t) return 9999;
  const [hh, mm] = t.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

function cityFromText(text) {
  if (!text) return null;
  for (const city of Object.keys(CITY_COUNTRY)) if (text.includes(city)) return city;
  return null;
}

function weatherRow(ciudad, fecha) {
  const r = row({ iconName: 'sol', iconColor: 'tint', title: 'Clima', sub: ciudad || '', detail: '…' });
  const detail = r.querySelector('.row__detail');
  const c = coordsForCity(ciudad);
  if (!c) {
    detail.textContent = '—';
    return r;
  }
  forecast(c.lat, c.lng, fecha)
    .then((w) => {
      detail.textContent = w ? `${w.desc} · ${Math.round(w.tmin)}°/${Math.round(w.tmax)}°` : 'Sin datos';
    })
    .catch(() => {
      detail.textContent = '—';
    });
  return r;
}

function daysBetween(a, b) {
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  const utc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(d1) - utc(d2)) / 86400000);
}

function countdownHero(startStr, endStr) {
  const hoy = todayISO();
  const days = daysBetween(startStr, hoy);
  let label, value, msg;

  if (days > 0) {
    label = 'Faltan';
    value = days + (days === 1 ? ' día' : ' días');
    msg = 'para que empiece la aventura por España y Europa. ¡Empieza a soñar!';
  } else if (days === 0) {
    label = '¡Hoy empieza!';
    value = 'Buen viaje';
    msg = 'España y Europa os esperan. ¡A disfrutar cada día!';
  } else if (endStr && daysBetween(endStr, hoy) < 0) {
    label = 'Viaje completado';
    value = 'Gracias';
    msg = 'Guardad los recuerdos y hasta la próxima aventura.';
  } else {
    const dayNum = 1 - days;
    label = 'Día ' + dayNum + ' de viaje';
    value = 'España · Europa';
    msg = 'Seguid disfrutando de cada parada del recorrido.';
  }

  return h(
    'div',
    { class: 'hero hero--countdown', style: { marginBottom: '26px' } },
    h('span', { class: 'hero__label' }, label),
    h('span', { class: 'hero__value' }, value),
    h('span', { style: { opacity: 0.92, fontSize: '14px' } }, msg)
  );
}

export function render() {
  const hoy = todayISO();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const itinerario = storeList('itinerario');
  const deHoy = itinerario.filter((i) => i.fecha === hoy).sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));
  const proximas = itinerario
    .filter((i) => i.fecha && i.fecha > hoy)
    .sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
  const siguiente = deHoy.find((i) => timeToMinutes(i.hora) >= nowMin) || proximas[0] || null;

  const gastos = storeList('gastos');
  const totalViaje = gastos.reduce((s, g) => s + toBase(g.monto, g.moneda), 0);
  const totalHoy = gastos.filter((g) => g.fecha === hoy).reduce((s, g) => s + toBase(g.monto, g.moneda), 0);

  const checklist = storeList('checklist');
  const listos = checklist.filter((c) => c.hecho).length;

  const entradasHoy = storeList('documentos').filter((d) => d.fecha === hoy);

  const refAct = deHoy[0] || proximas[0] || null;
  const ciudadHoy = cityFromText(refAct && refAct.lugar) || cityFromText(refAct && refAct.direccion);
  const climaFecha = deHoy.length ? hoy : proximas[0] ? proximas[0].fecha : hoy;

  const fragment = h('div', {});

  const fechas = itinerario.map((i) => i.fecha).filter(Boolean).sort();
  const tripStart = getSetting('tripStart') || fechas[0];
  const tripEnd = fechas.length ? fechas[fechas.length - 1] : null;
  if (tripStart) fragment.append(countdownHero(tripStart, tripEnd));

  if (siguiente) {
    const esHoy = siguiente.fecha === hoy;
    fragment.append(
      h(
        'div',
        { class: 'hero', style: { marginBottom: '26px' } },
        h('span', { class: 'hero__label' }, esHoy ? 'Siguiente hoy' : 'Próxima parada'),
        h('span', { class: 'hero__value', style: { fontSize: '24px' } }, siguiente.hora ? siguiente.hora + ' · ' : '', siguiente.titulo),
        siguiente.lugar ? h('span', { style: { opacity: 0.9, fontSize: '15px' } }, siguiente.lugar) : null,
        !esHoy ? h('span', { class: 'chip' }, fmtDateLong(siguiente.fecha)) : null
      )
    );
  }

  fragment.append(
    section(
      'Hoy',
      deHoy.length
        ? list(
            ...deHoy.map((it) =>
              row({
                iconName: 'reloj',
                iconColor: 'tint',
                title: it.titulo,
                sub: it.lugar || '',
                detail: it.hora || '',
                detailStrong: true,
                chevron: true,
                onClick: () => (location.hash = '#/itinerario'),
              })
            )
          )
        : list(
            row({
              iconName: 'sol',
              iconColor: 'orange',
              title: 'Día libre',
              sub: proximas.length ? 'Próxima: ' + proximas[0].titulo : 'Sin actividades programadas',
            })
          )
    )
  );

  if (entradasHoy.length) {
    fragment.append(
      section(
        'Entradas y reservas de hoy',
        list(
          ...entradasHoy.map((d) =>
            row({
              iconName: d.archivo_tipo === 'pkpass' ? 'candado' : 'documentos',
              iconColor: 'orange',
              title: d.titulo,
              sub: [d.tipo, d.hora].filter(Boolean).join(' · ') || null,
              detail: d.archivo ? archivoLabel(d.archivo_tipo) : '',
              chevron: true,
              onClick: () => (d.archivo ? openArchivo(d) : (location.hash = '#/documentos')),
            })
          )
        )
      )
    );
  }

  fragment.append(
    section(
      'Resumen del viaje',
      list(
        weatherRow(ciudadHoy, climaFecha),
        row({ iconName: 'euro', iconColor: 'green', title: 'Gastado hoy', detail: fmtMoney(totalHoy, settingsAll().currency), detailStrong: true }),
        row({ iconName: 'euro', iconColor: 'indigo', title: 'Total del viaje', detail: fmtMoney(totalViaje, settingsAll().currency), detailStrong: true }),
        row({
          iconName: 'checklist',
          iconColor: 'orange',
          title: 'Equipaje listo',
          detail: `${listos}/${checklist.length}`,
          detailStrong: true,
          chevron: true,
          onClick: () => (location.hash = '#/checklist'),
        }),
        row({ iconName: 'calendario', iconColor: 'tint', title: 'Actividades planeadas', detail: String(itinerario.length), detailStrong: true })
      )
    )
  );

  fragment.append(
    section(
      'Acciones rápidas',
      list(
        row({ iconName: 'calendario', iconColor: 'tint', title: 'Añadir actividad', onClick: addActividad }),
        row({ iconName: 'euro', iconColor: 'green', title: 'Registrar gasto', onClick: addGasto }),
        row({ iconName: 'lugares', iconColor: 'red', title: 'Guardar lugar', onClick: addLugar }),
        row({ iconName: 'maleta', iconColor: 'orange', title: 'Ver equipaje', chevron: true, onClick: () => (location.hash = '#/checklist') }),
        row({ iconName: 'documentos', iconColor: 'indigo', title: 'Ver entradas', chevron: true, onClick: () => (location.hash = '#/documentos') })
      )
    )
  );

  return fragment;
}
