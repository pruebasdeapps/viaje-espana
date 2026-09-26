import { h } from '../ui.js';
import { list as storeList } from '../store.js';
import { currentUser } from '../sync.js';
import { SYNC_ENABLED } from '../config.js';
import { section, row, list } from './common.js';
import { open as openAsistente } from './asistente.js';

export const meta = { key: 'mas', label: 'Más', icon: 'mas' };

export function subtitle() {
  const user = currentUser();
  if (!SYNC_ENABLED) return 'Solo en este dispositivo';
  return user ? 'Sincronizado · ' + (user.email || '') : 'Sin iniciar sesión';
}

export function render() {
  const fragment = h('div', {});

  const counts = {
    documentos: storeList('documentos').length,
    checklist: storeList('checklist').length,
    notas: storeList('notas').length,
    enlaces: storeList('enlaces').length,
    hospedajes: storeList('hospedajes').length,
  };

  fragment.append(
    section(
      'Organización',
      list(
        row({ iconName: 'documentos', iconColor: 'indigo', title: 'Reservas', detail: String(counts.documentos), chevron: true, onClick: () => (location.hash = '#/documentos') }),
        row({ iconName: 'casa', iconColor: 'purple', title: 'Hospedaje', detail: String(counts.hospedajes), chevron: true, onClick: () => (location.hash = '#/hospedajes') }),
        row({ iconName: 'maleta', iconColor: 'orange', title: 'Equipaje', detail: String(counts.checklist), chevron: true, onClick: () => (location.hash = '#/checklist') }),
        row({ iconName: 'notas', iconColor: 'purple', title: 'Diario', detail: String(counts.notas), chevron: true, onClick: () => (location.hash = '#/notas') }),
        row({ iconName: 'enlaces', iconColor: 'teal', title: 'Recursos', detail: String(counts.enlaces), chevron: true, onClick: () => (location.hash = '#/enlaces') })
      )
    )
  );

  fragment.append(
    section(
      'Asistente',
      list(
        row({ iconName: 'info', iconColor: 'tint', title: 'Pregúntale a Papacito', sub: 'Recomendaciones y búsqueda web', chevron: true, onClick: openAsistente })
      )
    )
  );

  fragment.append(
    section(
      'Cuenta',
      list(
        row({
          iconName: currentUser() ? 'persona' : 'candado',
          iconColor: currentUser() ? 'green' : 'gray',
          title: currentUser() ? currentUser().email || 'Sesión activa' : 'Iniciar sesión',
          sub: currentUser() ? 'Todo se sincroniza entre dispositivos' : 'Para compartir el viaje con la familia',
          chevron: true,
          onClick: () => (location.hash = '#/ajustes'),
        }),
        row({ iconName: 'ajustes', iconColor: 'gray', title: 'Configuración', chevron: true, onClick: () => (location.hash = '#/ajustes') })
      )
    )
  );

  return fragment;
}
