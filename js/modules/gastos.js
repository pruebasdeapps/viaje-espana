import { h, openForm, confirmDialog, fmtMoney, fmtDate, todayISO, toast, attachContextMenu } from '../ui.js';
import { list as storeList, save, remove } from '../store.js';
import { all as settingsAll, get as getSetting } from '../settings.js';
import { section, row, list, empty } from './common.js';

export const meta = { key: 'gastos', label: 'Gastos', icon: 'euro' };

const METODOS_DEFAULT = ['Efectivo', 'Tarjeta', 'Bizum', 'Otro'];
const CATEGORIAS_DEFAULT = ['Transporte', 'Alojamiento', 'Comida', 'Entradas', 'Compras', 'Salud', 'Otros'];
const CAT_STYLE = {
  Transporte: ['mapa', 'teal'],
  Alojamiento: ['lugares', 'purple'],
  Comida: ['estrella', 'orange'],
  Entradas: ['documentos', 'indigo'],
  Compras: ['gastos', 'pink'],
  Salud: ['info', 'red'],
  Otros: ['info', 'gray'],
};
const CAT_COLOR = {
  Transporte: 'var(--teal)',
  Alojamiento: 'var(--purple)',
  Comida: 'var(--orange)',
  Entradas: 'var(--indigo)',
  Compras: 'var(--pink)',
  Salud: 'var(--red)',
  Otros: 'var(--tint)',
};

const baseCurrency = () => settingsAll().currency;
const rates = () => settingsAll().rates;
const people = () => getSetting('people') || [];
const metodos = () => getSetting('metodos') || METODOS_DEFAULT;
const categorias = () => getSetting('gastoCategories') || CATEGORIAS_DEFAULT;

export function toBase(monto, moneda) {
  const r = rates();
  const base = baseCurrency();
  const rate = r[moneda] || 1;
  const baseRate = r[base] || 1;
  return (Number(monto) || 0) * (baseRate / rate);
}

function allPeopleSet(items) {
  const set = new Set(people());
  items.forEach((g) => {
    if (g.pagado_por) set.add(g.pagado_por);
    if (Array.isArray(g.participantes)) g.participantes.forEach((p) => set.add(p));
  });
  return [...set];
}

export function participantsOf(g, all) {
  if (Array.isArray(g.participantes) && g.participantes.length) return g.participantes;
  return all || people();
}

export function paidByPerson(items) {
  const names = allPeopleSet(items);
  return names.map((p) => ({
    label: p,
    value: items.filter((g) => (g.pagado_por || '') === p).reduce((s, g) => s + toBase(g.monto, g.moneda), 0),
  }));
}

export function computeBalances(items) {
  const names = allPeopleSet(items);
  const bal = new Map(names.map((p) => [p, 0]));
  for (const g of items) {
    const amt = toBase(g.monto, g.moneda);
    const payer = g.pagado_por;
    if (payer) bal.set(payer, (bal.get(payer) || 0) + amt);
    const parts = participantsOf(g, names);
    if (parts.length) {
      const share = amt / parts.length;
      for (const p of parts) bal.set(p, (bal.get(p) || 0) - share);
    }
  }
  return bal;
}

export function settle(balances) {
  const debtors = [];
  const creditors = [];
  for (const [name, v] of balances) {
    const r = Math.round(v * 100) / 100;
    if (r < -0.005) debtors.push({ name, v: -r });
    else if (r > 0.005) creditors.push({ name, v: r });
  }
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].v, creditors[j].v);
    transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(pay * 100) / 100 });
    debtors[i].v -= pay;
    creditors[j].v -= pay;
    if (debtors[i].v < 0.005) i++;
    if (creditors[j].v < 0.005) j++;
  }
  return transfers;
}

function styleFor(cat) {
  const [iconName, iconColor] = CAT_STYLE[cat] || CAT_STYLE.Otros;
  return { iconName, iconColor };
}

function distinctCategories(items) {
  const set = new Set(categorias());
  items.forEach((g) => g.categoria && set.add(g.categoria));
  return [...set];
}

function distinctPayers(items) {
  const set = new Set(people());
  items.forEach((g) => g.pagado_por && set.add(g.pagado_por));
  return [...set];
}

function fieldsFor(items) {
  return [
    { name: 'fecha', label: 'Fecha', type: 'date', required: true, section: 'Gasto' },
    { name: 'descripcion', label: 'Descripción', required: true, section: 'Gasto' },
    { name: 'categoria', label: 'Tipo de gasto', type: 'combobox', options: distinctCategories(items), required: true, section: 'Gasto' },
    { name: 'monto', label: 'Monto', type: 'number', required: true, section: 'Importe' },
    { name: 'moneda', label: 'Moneda', type: 'select', options: Object.keys(rates()), section: 'Importe' },
    { name: 'metodo', label: 'Método', type: 'select', options: metodos(), section: 'Importe' },
    { name: 'pagado_por', label: 'Pagado por', type: 'combobox', options: distinctPayers(items), section: 'Importe' },
    { name: 'participantes', label: 'Dividir entre', type: 'people', options: distinctPayers(items), section: 'Reparto' },
    { name: 'nota', label: 'Notas', type: 'textarea', section: 'Importe' },
    { name: 'id', type: 'hidden' },
  ];
}

export function create() {
  openForm({
    title: 'Nuevo gasto',
    values: { fecha: todayISO(), moneda: baseCurrency(), pagado_por: getSetting('currentPerson') || '' },
    fields: fieldsFor(storeList('gastos')),
    onSubmit: async (data) => {
      await save('gastos', data);
      toast('Gasto guardado', 'success');
    },
  });
}

function edit(item) {
  openForm({
    title: 'Editar gasto',
    values: item,
    fields: fieldsFor(storeList('gastos')),
    onSubmit: async (data) => {
      await save('gastos', data);
      toast('Gasto guardado', 'success');
    },
  });
}

async function removeItem(g) {
  if (await confirmDialog('¿Eliminar «' + g.descripcion + '»?', { title: 'Eliminar gasto' })) {
    await remove(g.id);
    toast('Eliminado', 'success');
  }
}

export function primaryAction() {
  return { icon: 'plus', label: 'Añadir gasto', onClick: create };
}

let view = 'lista';
const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

function barList(items) {
  const max = Math.max(...items.map((i) => i.value), 0);
  const wrap = h('div', { class: 'list' });
  items.forEach((it, idx) => {
    const pct = max ? Math.round((it.value / max) * 100) : 0;
    wrap.append(
      h(
        'div',
        { class: 'bar-item' + (idx ? ' bar-item--sep' : '') },
        h(
          'div',
          { class: 'bar-item__top' },
          h('span', {}, it.label),
          h('span', { class: 'bar-item__val' }, fmtMoney(it.value, baseCurrency()) + (it.sub ? ' · ' + it.sub : ''))
        ),
        h('div', { class: 'bar' }, h('span', { style: { width: pct + '%', background: it.color || 'var(--tint)' } }))
      )
    );
  });
  return wrap;
}

function weekMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function resumenView(items) {
  const frag = h('div', {});
  const total = items.reduce((s, g) => s + toBase(g.monto, g.moneda), 0);

  frag.append(
    h(
      'div',
      { class: 'hero', style: { marginBottom: '26px' } },
      h('span', { class: 'hero__label' }, 'Total del viaje'),
      h('span', { class: 'hero__value' }, fmtMoney(total, baseCurrency())),
      h('span', { style: { opacity: 0.9, fontSize: '14px' } }, items.length + ' gastos registrados')
    )
  );

  const payers = distinctPayers(items);
  const porPersona = payers
    .map((p) => ({
      label: p,
      value: items.filter((g) => (g.pagado_por || '') === p).reduce((s, g) => s + toBase(g.monto, g.moneda), 0),
      count: items.filter((g) => (g.pagado_por || '') === p).length,
    }))
    .sort((a, b) => b.value - a.value);
  frag.append(
    section('Por persona', barList(porPersona.map((p) => ({ ...p, sub: p.count + ' pagos', color: 'var(--tint)' }))))
  );

  const balances = computeBalances(items);
  const transfers = settle(balances);
  const balRows = [...balances.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, v]) =>
      row({
        iconName: v >= 0 ? 'check' : 'euro',
        iconColor: v >= 0 ? 'green' : 'red',
        title: name,
        sub: v >= 0 ? 'le deben' : 'debe',
        detail: fmtMoney(Math.abs(v), baseCurrency()),
        detailStrong: true,
      })
    );
  const debtRows = transfers.length
    ? list(
        ...transfers.map((t) =>
          row({ iconName: 'euro', iconColor: 'orange', title: t.from + ' → ' + t.to, detail: fmtMoney(t.amount, baseCurrency()), detailStrong: true })
        )
      )
    : list(row({ iconName: 'check', iconColor: 'green', title: 'Todo cuadra', sub: 'No hay deudas pendientes' }));
  frag.append(section('Quién debe a quién', h('div', {}, debtRows, h('div', { style: { height: '12px' } }), list(...balRows))));

  const porTipo = new Map();
  for (const g of items) {
    const k = g.categoria || 'Otros';
    porTipo.set(k, (porTipo.get(k) || 0) + toBase(g.monto, g.moneda));
  }
  frag.append(
    section(
      'Por tipo de gasto',
      barList([...porTipo.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: CAT_COLOR[k] || 'var(--tint)' })))
    )
  );

  const porDia = new Map();
  for (const g of items) {
    const k = g.fecha || 'Sin fecha';
    porDia.set(k, (porDia.get(k) || 0) + toBase(g.monto, g.moneda));
  }
  const dias = [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  frag.append(
    section(
      'Por día',
      list(
        ...dias.map(([fecha, v]) => {
          const n = items.filter((g) => g.fecha === fecha).length;
          return row({ iconName: 'reloj', iconColor: 'gray', title: fmtDate(fecha), sub: n + (n === 1 ? ' gasto' : ' gastos'), detail: fmtMoney(v, baseCurrency()), detailStrong: true });
        })
      )
    )
  );

  const porSemana = new Map();
  for (const g of items) {
    if (!g.fecha) continue;
    const k = weekMonday(g.fecha);
    porSemana.set(k, (porSemana.get(k) || 0) + toBase(g.monto, g.moneda));
  }
  const semanas = [...porSemana.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  frag.append(
    section(
      'Por semana',
      list(
        ...semanas.map(([lunes, v]) => {
          const fin = new Date(lunes + 'T00:00:00');
          fin.setDate(fin.getDate() + 6);
          const label = 'Semana del ' + fmtDate(lunes);
          return row({ iconName: 'calendario', iconColor: 'tint', title: label, sub: fmtDate(lunes) + ' – ' + fmtDate(fin.toISOString().slice(0, 10)), detail: fmtMoney(v, baseCurrency()), detailStrong: true });
        })
      )
    )
  );

  return frag;
}

function listaView(items) {
  const total = items.reduce((s, g) => s + toBase(g.monto, g.moneda), 0);
  const frag = h('div', {});
  const groups = new Map();
  for (const g of items) {
    const key = g.fecha || 'Sin fecha';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  for (const [fecha, listItems] of [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const rows = listItems.map((g) => {
      const st = styleFor(g.categoria);
      const converted = g.moneda && g.moneda !== baseCurrency() ? ' ≈ ' + fmtMoney(toBase(g.monto, g.moneda), baseCurrency()) : '';
      const r = row({
        iconName: st.iconName,
        iconColor: st.iconColor,
        title: g.descripcion,
        sub: [g.categoria, g.pagado_por].filter(Boolean).join(' · ') || null,
        detail: fmtMoney(g.monto, g.moneda || baseCurrency()) + converted,
        onClick: () => edit(g),
      });
      attachContextMenu(r, () => [
        { label: 'Editar', onClick: () => edit(g) },
        { label: 'Eliminar', danger: true, onClick: () => removeItem(g) },
      ]);
      return r;
    });
    frag.append(section(fmtDate(fecha), list(...rows)));
  }
  return frag;
}

export function subtitle() {
  const total = storeList('gastos').reduce((s, g) => s + toBase(g.monto, g.moneda), 0);
  return 'Total: ' + fmtMoney(total, baseCurrency());
}

export function render() {
  const items = storeList('gastos');
  const frag = h('div', {});

  const seg = h(
    'div',
    { class: 'segmented' },
    h('button', { class: view === 'lista' ? 'active' : '', onClick: () => { view = 'lista'; refresh(); } }, 'Lista'),
    h('button', { class: view === 'resumen' ? 'active' : '', onClick: () => { view = 'resumen'; refresh(); } }, 'Resumen')
  );
  frag.append(seg);

  if (!items.length) {
    frag.append(empty('euro', 'Aún no registras gastos.', 'Añadir gasto', create));
    return frag;
  }

  frag.append(view === 'lista' ? listaView(items) : resumenView(items));
  return frag;
}
