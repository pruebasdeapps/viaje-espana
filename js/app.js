import { CONFIG, SYNC_ENABLED } from './config.js';
import { initStore, subscribe } from './store.js';
import { get as getSetting, subscribe as onSetting } from './settings.js';
import { initSync, onStatus, currentUser, syncNow, login, signup } from './sync.js';
import { persistStorage } from './db.js';
import { h, clear, toast, icon } from './ui.js';

import * as hoy from './modules/hoy.js';
import * as itinerario from './modules/itinerario.js';
import * as lugares from './modules/lugares.js';
import * as gastos from './modules/gastos.js';
import * as hospedajes from './modules/hospedajes.js';
import * as mas from './modules/mas.js';
import * as documentos from './modules/documentos.js';
import * as checklist from './modules/checklist.js';
import * as notas from './modules/notas.js';
import * as enlaces from './modules/enlaces.js';
import * as ajustes from './modules/ajustes.js';
import { open as openAsistente } from './modules/asistente.js';

const MODULES = { hoy, itinerario, lugares, gastos, hospedajes, mas, documentos, checklist, notas, enlaces, ajustes };

const TABS = [
  { key: 'hoy', label: 'Hoy', icon: 'sol' },
  { key: 'itinerario', label: 'Itinerario', icon: 'calendario' },
  { key: 'lugares', label: 'Lugares', icon: 'lugares' },
  { key: 'gastos', label: 'Gastos', icon: 'euro' },
  { key: 'mas', label: 'Más', icon: 'mas' },
];

const SECONDARY = ['documentos', 'checklist', 'notas', 'enlaces', 'hospedajes', 'ajustes'];

function currentRoute() {
  const key = (location.hash.replace(/^#\/?/, '') || 'hoy').split('/')[0];
  return MODULES[key] ? key : 'hoy';
}

function activeTab(key) {
  return SECONDARY.includes(key) ? 'mas' : key;
}

function renderTabbar() {
  const nav = document.getElementById('tabbar');
  clear(nav);
  const active = activeTab(currentRoute());
  for (const item of TABS) {
    nav.append(
      h(
        'a',
        { class: 'tab' + (item.key === active ? ' tab--active' : ''), href: '#/' + item.key },
        icon(item.icon, { size: 26, strokeWidth: item.key === active ? 2.1 : 1.8 }),
        h('span', { class: 'tab__label' }, item.label)
      )
    );
  }
}

function navButton(label, onClick, { iconName, ariaLabel } = {}) {
  return h(
    'button',
    { class: 'nav-btn' + (iconName ? ' nav-btn--icon' : ''), onClick, 'aria-label': ariaLabel || label, type: 'button' },
    iconName ? icon(iconName, { size: 24, strokeWidth: 1.9 }) : null,
    label || null
  );
}

function renderAppbar() {
  const header = document.getElementById('appbar');
  clear(header);
  const key = currentRoute();
  const mod = MODULES[key];

  const leading = h('div', { class: 'appbar__leading' });
  if (SECONDARY.includes(key)) {
    leading.append(navButton('Más', () => (location.hash = '#/mas')));
  }

  const dot = h('span', { class: 'dot dot--idle', title: 'Estado' });
  const user = currentUser();
  onStatus((s) => {
    dot.className = 'dot dot--' + s.state;
    dot.title = s.message || s.state;
  });

  const trailing = h('div', { class: 'appbar__trailing' });
  const action = mod.primaryAction && mod.primaryAction();
  if (action) {
    trailing.append(navButton('', action.onClick, { iconName: action.icon || 'plus', ariaLabel: action.label || 'Añadir' }));
  }
  trailing.append(dot);
  trailing.append(
    navButton('', () => (user ? syncNow() : (location.hash = '#/ajustes')), {
      iconName: user ? 'refrescar' : 'persona',
      ariaLabel: user ? 'Sincronizar' : 'Cuenta',
    })
  );

  header.append(
    h('div', { class: 'appbar__bar' }, leading, h('div', { class: 'appbar__compact' }, mod.meta.label), trailing)
  );
}

function renderView() {
  if (gated) return;
  const key = currentRoute();
  const mod = MODULES[key];
  const view = document.getElementById('view');
  clear(view);

  const titleWrap = h(
    'div',
    { class: 'large-title-wrap' },
    h('div', {}, h('h1', { class: 'large-title' }, mod.meta.label), mod.subtitle ? h('p', { class: 'large-sub' }, mod.subtitle()) : null)
  );

  view.append(h('div', { class: 'page' }, titleWrap, mod.render()));
}

function updateScrolled() {
  const header = document.getElementById('appbar');
  if (!header) return;
  header.classList.toggle('is-scrolled', window.scrollY > 28);
}

let gated = false;
let defaultLogin = null;
let fab = null;

function ensureFab() {
  if (fab) return;
  fab = h(
    'button',
    { class: 'fab', 'aria-label': 'Pregúntale a Papacito', 'data-tip': 'Pregúntale a Papacito', title: 'Pregúntale a Papacito', type: 'button', onClick: openAsistente },
    icon('info', { size: 26, strokeWidth: 1.8 })
  );
  document.body.append(fab);
}

function setFabVisible(visible) {
  if (fab) fab.style.display = visible ? 'grid' : 'none';
}

async function loadDefaultLogin() {
  try {
    const m = await import('./auth.local.js');
    if (m.DEFAULT_LOGIN) defaultLogin = m.DEFAULT_LOGIN;
  } catch (_) {
    /* sin credenciales por defecto */
  }
}

function showApp() {
  gated = false;
  ensureFab();
  setFabVisible(true);
  document.getElementById('tabbar').style.display = 'flex';
  renderTabbar();
  renderAppbar();
  renderView();
}

function renderLoginGate() {
  gated = true;
  setFabVisible(false);
  document.getElementById('tabbar').style.display = 'none';
  clear(document.getElementById('appbar'));
  const view = document.getElementById('view');
  clear(view);

  const email = h('input', { type: 'email', autocomplete: 'username', placeholder: 'correo@familia.com' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Contraseña' });
  if (defaultLogin) {
    email.value = defaultLogin.email || '';
    pass.value = defaultLogin.password || '';
  }
  const error = h('p', { class: 'gate__error' });
  const entrar = h('button', { class: 'btn btn--primary btn--block' }, 'Entrar');
  const crear = h('button', { class: 'btn btn--block' }, 'Crear cuenta');

  const entrarFn = async () => {
    entrar.disabled = true;
    error.textContent = '';
    try {
      await login(email.value.trim(), pass.value);
      toast('Bienvenido', 'success');
      await syncNow();
      showApp();
    } catch (e) {
      error.textContent = e.message || 'No se pudo iniciar sesión';
    } finally {
      entrar.disabled = false;
    }
  };
  entrar.addEventListener('click', entrarFn);
  pass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrarFn();
  });

  crear.addEventListener('click', async () => {
    crear.disabled = true;
    error.textContent = '';
    try {
      await signup(email.value.trim(), pass.value);
      toast('Cuenta creada', 'success');
      await syncNow();
      showApp();
    } catch (e) {
      error.textContent = e.message || 'No se pudo crear la cuenta';
    } finally {
      crear.disabled = false;
    }
  });

  view.append(
    h(
      'div',
      { class: 'gate' },
      h(
        'div',
        { class: 'gate__card' },
        h('div', { class: 'gate__logo' }, icon('navegar', { size: 42, strokeWidth: 1.5 })),
        h('h1', { class: 'gate__title' }, CONFIG.appName),
        h('p', { class: 'gate__sub' }, 'Inicia sesión para ver tu viaje.'),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Correo'), email),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Contraseña'), pass),
        h('div', { class: 'gate__actions' }, entrar, crear),
        error
      )
    )
  );
}

function applyTheme() {
  const t = getSetting('theme');
  const root = document.documentElement;
  if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  document.title = getSetting('tripName') || CONFIG.appName;
}

let renderQueued = false;
function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderView();
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  });
}

async function boot() {
  document.getElementById('view').append(h('div', { class: 'loading' }, 'Cargando viaje…'));

  persistStorage();
  await initStore();
  initSync();

  applyTheme();
  onSetting(() => applyTheme());

  await loadDefaultLogin();

  if (SYNC_ENABLED && !currentUser()) {
    renderLoginGate();
  } else {
    showApp();
  }
  updateScrolled();

  subscribe(queueRender);
  window.addEventListener('hashchange', () => {
    if (gated) return;
    renderTabbar();
    renderAppbar();
    renderView();
    window.scrollTo({ top: 0 });
    updateScrolled();
  });
  window.addEventListener('scroll', updateScrolled, { passive: true });

  window.addEventListener('viaje:auth', () => {
    if (SYNC_ENABLED && !currentUser()) renderLoginGate();
    else showApp();
  });

  window.addEventListener('online', () => toast('Conexión restablecida', 'success'));
  window.addEventListener('offline', () => toast('Sin conexión — seguís funcionando offline', 'info'));

  registerServiceWorker();
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('view').textContent = 'Error al iniciar: ' + e.message;
});
