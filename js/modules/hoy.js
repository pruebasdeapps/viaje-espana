import { h, fmtMoney, fmtDateLong, fmtDate, todayISO, icon } from '../ui.js';
import { list as storeList } from '../store.js';
import { all as settingsAll, get as getSetting } from '../settings.js';
import { section, row, list, barChart } from './common.js';
import { create as addActividad, openDay } from './itinerario.js';
import { create as addGasto, toBase, paidByPerson } from './gastos.js';
import { create as addLugar } from './lugares.js';
import { openArchivo, archivoLabel } from './documentos.js';
import { forecast, coordsForCity, cityForMoment } from '../weather.js';
import { CITY_COUNTRY } from '../geo.js';
import { open as openAsistente } from './asistente.js';

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

function daysBetween(a, b) {
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  const utc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(d1) - utc(d2)) / 86400000);
}

function cityFromText(text) {
  if (!text) return null;
  for (const city of Object.keys(CITY_COUNTRY)) if (text.includes(city)) return city;
  return null;
}

function weatherWidget(ciudad, fecha) {
  const iconBox = h('div', { class: 'wx__icon' }, icon('parcial', { size: 46, strokeWidth: 1.5 }));
  const temp = h('div', { class: 'wx__temp' }, '—');
  const desc = h('div', { class: 'wx__desc' }, 'Clima');
  const city = h('div', { class: 'wx__city' }, ciudad || '');
  const card = h('div', { class: 'wx' }, iconBox, h('div', { class: 'wx__info' }, temp, desc), city);
  const c = coordsForCity(ciudad);
  if (c) {
    forecast(c.lat, c.lng, fecha)
      .then((w) => {
        if (!w) {
          desc.textContent = 'Sin pronóstico';
          return;
        }
        iconBox.replaceChildren(icon(w.ico, { size: 46, strokeWidth: 1.5 }));
        temp.textContent = Math.round(w.tmax) + '° / ' + Math.round(w.tmin) + '°';
        desc.textContent = w.desc;
      })
      .catch(() => {});
  } else {
    desc.textContent = 'Clima';
  }
  return card;
}

function quickActions() {
  const items = [
    { ic: 'calendario', lb: 'Actividad', fn: addActividad },
    { ic: 'euro', lb: 'Gasto', fn: addGasto },
    { ic: 'lugares', lb: 'Lugar', fn: addLugar },
    { ic: 'documentos', lb: 'Entradas', fn: () => (location.hash = '#/documentos') },
    { ic: 'maleta', lb: 'Equipaje', fn: () => (location.hash = '#/checklist') },
    { ic: 'carita', lb: 'Papacito', fn: openAsistente },
  ];
  return h(
    'div',
    { class: 'qa' },
    ...items.map((it) =>
      h('button', { class: 'qa__item', onClick: it.fn }, h('span', { class: 'qa__ic' }, icon(it.ic, { size: 22, strokeWidth: 1.8 })), h('span', { class: 'qa__lb' }, it.lb))
    )
  );
}

function thinCountdown(startStr) {
  const days = daysBetween(startStr, todayISO());
  const text = days > 0 ? 'Faltan ' + days + (days === 1 ? ' día' : ' días') : days === 0 ? '¡Hoy empieza el viaje!' : 'En curso';
  return h('div', { class: 'thinbar' }, icon('calendario', { size: 16, strokeWidth: 1.8 }), h('span', {}, text));
}

function nextCard(it) {
  return h(
    'div',
    { class: 'card card--link', style: { marginBottom: '20px' }, onClick: () => openDay(it.fecha) },
    h('div', { class: 'card__top' }, h('span', { class: 'badge' }, fmtDate(it.fecha)), h('strong', {}, it.titulo)),
    it.lugar ? h('p', { class: 'muted small', style: { margin: 0 } }, '📍 ' + it.lugar) : null,
    h('span', { class: 'card__chev' }, icon('chevron', { size: 18, strokeWidth: 2.4 }))
  );
}

function agendaSection(deHoy, siguiente, nowMin) {
  if (!deHoy.length) {
    return section('Hoy', list(row({ iconName: 'sol', iconColor: 'orange', title: 'Día libre', sub: 'Sin actividades programadas' })));
  }
  return section(
    'Hoy',
    list(
      ...deHoy.map((it) => {
        const isNext = siguiente && siguiente.id === it.id;
        let detail = it.hora || '';
        if (isNext && it.hora) {
          const m = timeToMinutes(it.hora) - nowMin;
          if (m > 0) detail = 'en ' + m + ' min';
          else if (m === 0) detail = 'ahora';
        }
        return row({
          iconName: 'reloj',
          iconColor: isNext ? 'tint' : 'gray',
          title: it.titulo,
          sub: it.lugar || '',
          detail,
          detailStrong: true,
          chevron: true,
          onClick: () => openDay(it.fecha),
        });
      })
    )
  );
}

function entradasSection(entradasHoy) {
  return section(
    'Entradas de hoy',
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
  );
}

function equipajeSection(checklist) {
  const done = checklist.filter((c) => c.hecho).length;
  const pct = checklist.length ? Math.round((done / checklist.length) * 100) : 0;
  return section(
    'Equipaje',
    h(
      'div',
      {},
      h(
        'div',
        { class: 'progress', style: { margin: '0 16px 10px' } },
        h('div', { class: 'progress__bar' }, h('span', { style: { width: pct + '%' } })),
        h('span', { class: 'progress__label' }, done + ' de ' + checklist.length + ' listos')
      ),
      list(row({ iconName: 'maleta', iconColor: 'orange', title: 'Ver equipaje', sub: 'Con sugerencias de IA', chevron: true, onClick: () => (location.hash = '#/checklist') }))
    )
  );
}

function resumenSection(gastos, itinerario, checklist) {
  const totalViaje = gastos.reduce((s, g) => s + toBase(g.monto, g.moneda), 0);
  const totalHoy = gastos.filter((g) => g.fecha === todayISO()).reduce((s, g) => s + toBase(g.monto, g.moneda), 0);
  const listos = checklist.filter((c) => c.hecho).length;
  return section(
    'Resumen',
    list(
      row({ iconName: 'euro', iconColor: 'green', title: 'Gastado hoy', detail: fmtMoney(totalHoy, settingsAll().currency), detailStrong: true }),
      row({ iconName: 'euro', iconColor: 'indigo', title: 'Total del viaje', detail: fmtMoney(totalViaje, settingsAll().currency), detailStrong: true }),
      row({ iconName: 'calendario', iconColor: 'tint', title: 'Actividades planeadas', detail: String(itinerario.length), detailStrong: true }),
      row({ iconName: 'checklist', iconColor: 'orange', title: 'Equipaje listo', detail: listos + '/' + checklist.length, detailStrong: true, chevron: true, onClick: () => (location.hash = '#/checklist') })
    )
  );
}

function gastosChart(gastos) {
  if (!gastos.length) {
    return section('Gastos', list(row({ iconName: 'euro', iconColor: 'gray', title: 'Sin gastos aún', chevron: true, onClick: () => (location.hash = '#/gastos') })));
  }
  const byPerson = paidByPerson(gastos).filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  return section(
    'Gastos por persona',
    h(
      'div',
      { class: 'chart-wrap' },
      barChart(byPerson.map((p) => ({ label: p.label, value: p.value })), { currency: settingsAll().currency }),
      h('div', { class: 'row-actions', style: { marginTop: '12px' } }, h('button', { class: 'btn btn--small', onClick: () => (location.hash = '#/gastos') }, 'Ver gastos y quién debe a quién'))
    )
  );
}

export function render() {
  const hoy = todayISO();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const itinerario = storeList('itinerario');
  const fechas = itinerario.map((i) => i.fecha).filter(Boolean).sort();
  const tripStart = getSetting('tripStart') || fechas[0] || null;
  const tripEnd = fechas.length ? fechas[fechas.length - 1] : null;
  const phase = !tripStart ? 'before' : hoy < tripStart ? 'before' : hoy > tripEnd ? 'after' : 'during';

  const deHoy = itinerario.filter((i) => i.fecha === hoy).sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));
  const proximas = itinerario.filter((i) => i.fecha && i.fecha > hoy).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
  const siguiente = deHoy.find((i) => timeToMinutes(i.hora) >= nowMin) || proximas[0] || null;

  const gastos = storeList('gastos');
  const checklist = storeList('checklist');
  const entradasHoy = storeList('documentos').filter((d) => d.fecha === hoy);

  const ciudad = phase === 'during' ? cityForMoment(hoy, nowMin) : 'Lima';
  const climaFecha = hoy;

  const fragment = h('div', {});

  fragment.append(weatherWidget(ciudad, climaFecha));
  fragment.append(quickActions());

  if (phase === 'before' && tripStart) fragment.append(thinCountdown(tripStart));

  if (phase === 'during') {
    fragment.append(agendaSection(deHoy, siguiente, nowMin));
    if (entradasHoy.length) fragment.append(entradasSection(entradasHoy));
    fragment.append(equipajeSection(checklist));
  } else {
    if (siguiente) fragment.append(nextCard(siguiente));
    if (phase === 'before' && checklist.length) fragment.append(equipajeSection(checklist));
    if (entradasHoy.length) fragment.append(entradasSection(entradasHoy));
  }

  fragment.append(resumenSection(gastos, itinerario, checklist));
  fragment.append(gastosChart(gastos));

  return fragment;
}
