const NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  hoy: '<circle cx="12" cy="12" r="4.3"/><path d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M19.1 4.9l-1.9 1.9M6.8 17.2l-1.9 1.9"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="3.5"/><path d="M8 3v4M16 3v4M3 10.5h18"/>',
  lugares: '<path d="M12 21.5s7-6.4 7-11.3A7 7 0 1 0 5 10.2c0 4.9 7 11.3 7 11.3Z"/><circle cx="12" cy="10" r="2.6"/>',
  gastos: '<circle cx="12" cy="12" r="9"/><path d="M15.4 8.6a4 4 0 1 0 0 6.8"/><path d="M8.8 11h5.6M8.8 13.2h5.6"/>',
  mas: '<circle cx="12" cy="12" r="9"/><circle cx="8.2" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.8" cy="12" r="1.15" fill="currentColor" stroke="none"/>',
  documentos: '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13.5h6M9 17h4"/>',
  checklist: '<path d="M4 6.5l2 2 3-3"/><path d="M4 16.5l2 2 3-3"/><path d="M12.5 7h7.5M12.5 17h7.5"/>',
  notas: '<path d="M5 4.5h11.5a2 2 0 0 1 2 2V21H6.5A1.5 1.5 0 0 1 5 19.5V4.5Z"/><path d="M9.5 4.5V21"/>',
  enlaces: '<path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  ajustes: '<path d="M4 7.5h9M18.5 7.5H20M4 16.5h4M13.5 16.5H20"/><circle cx="15.5" cy="7.5" r="2.4"/><circle cx="10.5" cy="16.5" r="2.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lapiz: '<path d="M4 20.5h4L19 9.5a2.8 2.8 0 0 0-4-4L4 16.5v4Z"/><path d="M13.5 7l3.5 3.5"/>',
  papelera: '<path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6A1.2 1.2 0 0 1 14.5 5.2V7M6.3 7l.9 12.4A2 2 0 0 0 9.2 21.3h5.6a2 2 0 0 0 2-1.9L17.7 7"/>',
  mapa: '<path d="M9 4 3.5 6.2v13.6L9 17.6l6 2.2 5.5-2.2V4L15 6.2 9 4Z"/><path d="M9 4v13.6M15 6.2V19.8"/>',
  navegar: '<path d="M12 2.8 3.8 20.2l8.2-3.8 8.2 3.8L12 2.8Z" fill="currentColor"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5 16 16"/>',
  refrescar: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.7 4.5v4.2h-4.2"/>',
  check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
  cerrar: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  persona: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  estrella: '<path d="M12 3.6l2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.4 7 19.1l1-5.6-4.1-4 5.6-.8L12 3.6Z"/>',
  estrellaLlena: '<path d="M12 3.6l2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.4 7 19.1l1-5.6-4.1-4 5.6-.8L12 3.6Z" fill="currentColor"/>',
  compartir: '<path d="M12 3.2v11.6"/><path d="M8.2 6.6 12 2.8l3.8 3.8"/><path d="M5.5 11.5v7.3a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-7.3"/>',
  importar: '<path d="M12 3.2v11.6"/><path d="M8.2 11 12 14.8 15.8 11"/><path d="M5.5 11.5v7.3a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-7.3"/>',
  maleta: '<rect x="3" y="7.5" width="18" height="13" rx="3"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 13h18"/>',
  sobre: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M4 7.5l8 5.5 8-5.5"/>',
  candado: '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.8h.01"/>',
  chevron: '<path d="M9 5.5l7 6.5-7 6.5"/>',
  ubicacion: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3.3M12 18.2v3.3M2.5 12h3.3M18.2 12h3.3"/>',
  euro: '<path d="M16.5 7.2a5.5 5.5 0 1 0 0 9.6"/><path d="M7 10.8h8M7 13.2h8"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.1 5.1l1.7 1.7M17.2 17.2l1.7 1.7M18.9 5.1l-1.7 1.7M6.8 17.2l-1.7 1.7"/>',
  tache: '<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
  basura: '<path d="M5 7.5h14M10 7.5V6a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 14 6v1.5M6.5 7.5l.8 11.6A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.9l.8-11.6"/>',
  camara: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.6"/><path d="M9 7l1.4-2.6A1 1 0 0 1 11.3 4h1.4a1 1 0 0 1 .9.4L15 7"/>',
  telefono: '<path d="M5.5 4h3.2l1.8 4.2-2.1 1.4a12.5 12.5 0 0 0 6 6l1.4-2.1 4.2 1.8v3.2a1.8 1.8 0 0 1-2 1.8A16.8 16.8 0 0 1 3.7 6a1.8 1.8 0 0 1 1.8-2Z"/>',
  wifi: '<path d="M2.8 8.5a14.5 14.5 0 0 1 18.4 0M5.8 12a10 10 0 0 1 12.4 0M9 15.4a4.6 4.6 0 0 1 6 0"/><circle cx="12" cy="18.6" r="1.1" fill="currentColor" stroke="none"/>',
  nube: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.95 6 6 0 0 1 11.6 1.6A3.75 3.75 0 0 1 17.5 18.5H7Z"/>',
  tema: '<path d="M12 3a9 9 0 1 0 0 18Z" fill="currentColor"/><path d="M12 3a9 9 0 0 1 0 18"/>',
  idioma: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  casa: '<path d="M3.5 11.5 12 4.5l8.5 7"/><path d="M5.5 10.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8.5"/><path d="M10 20v-5h4v5"/>',
  grafica: '<path d="M4 4v15.5h16"/><path d="M8 16v-4.5M12 16V7.5M16 16v-6.5"/>',
  personas: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16 14.5a4.5 4.5 0 0 1 4.5 5"/>',
  clip: '<path d="M20.5 11.5l-8.4 8.4a5.2 5.2 0 0 1-7.4-7.4L13 4.3a3.6 3.6 0 0 1 5.1 5.1l-8.4 8.4a2 2 0 0 1-2.9-2.9l8-8"/>',
  carita: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.15" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.15" fill="currentColor" stroke="none"/><path d="M8.3 14.4a4.6 4.6 0 0 0 7.4 0"/>',
  lluvia: '<path d="M7 15a4.2 4.2 0 0 1-.6-8.3 5.2 5.2 0 0 1 9.9 1.2A3.5 3.5 0 0 1 16 15H7Z"/><path d="M8.5 18l-1 2.5M12 18l-1 2.5M15.5 18l-1 2.5"/>',
  nieve: '<path d="M7 14a4.2 4.2 0 0 1-.6-8.3 5.2 5.2 0 0 1 9.9 1.2A3.5 3.5 0 0 1 16 14H7Z"/><path d="M8.5 18h.01M12 19.5h.01M15.5 18h.01"/>',
  tormenta: '<path d="M7 14a4.2 4.2 0 0 1-.6-8.3 5.2 5.2 0 0 1 9.9 1.2A3.5 3.5 0 0 1 16 14H7Z"/><path d="M13 14l-3 4h3l-1 4 4-5h-3l2-3"/>',
  niebla: '<path d="M4 7h16M6 11h12M4 15h16M7 19h10"/>',
  parcial: '<circle cx="15" cy="7.5" r="2.6"/><path d="M15 2.8v1.4M19.7 7.5h-1.4M18.3 4.2l-1 1M18.3 10.8l-1-1"/><path d="M7 19a4.2 4.2 0 0 1-.6-8.3 5.2 5.2 0 0 1 9.9 1.2A3.5 3.5 0 0 1 16 19H7Z"/>',
  sobre_cerrado: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M4 7.5l8 5.5 8-5.5"/>',
  informacion: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.8h.01"/>',
};

export function icon(name, { size = 24, cls = '', strokeWidth = 1.8, fill = false } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', fill ? 'currentColor' : 'none');
  svg.setAttribute('stroke', fill ? 'none' : 'currentColor');
  svg.setAttribute('stroke-width', strokeWidth);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  svg.innerHTML = PATHS[name] || PATHS.info;
  return svg;
}

export function iconHTML(name, size = 20, strokeWidth = 1.8) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.info}</svg>`;
}

export const ICONS = Object.keys(PATHS);
