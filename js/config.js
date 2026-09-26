export const CONFIG = {
  appName: 'Viaje a España',
  shortName: 'Viaje',
  supabaseUrl: 'https://rcpdyrhskvtliiuobvar.supabase.co',
  supabaseAnonKey: 'sb_publishable_hP1gdco6hn71ls75a6aG6Q_soW2VyJi',
  baseCurrency: 'EUR',
  rates: { EUR: 1, USD: 1.08, COP: 4300, GBP: 0.85 },
  mapsScheme: 'https://www.google.com/maps/search/?api=1&query=',
};

export const SYNC_ENABLED = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

export const COLLECTIONS = {
  itinerario: { label: 'Itinerario', icon: '🗓️', order: 1 },
  lugares: { label: 'Lugares', icon: '📍', order: 2 },
  gastos: { label: 'Gastos', icon: '💶', order: 3 },
  hospedajes: { label: 'Hospedaje', icon: '🏨', order: 4 },
  documentos: { label: 'Reservas', icon: '📄', order: 5 },
  checklist: { label: 'Equipaje', icon: '🧳', order: 6 },
  notas: { label: 'Diario', icon: '📝', order: 7 },
  enlaces: { label: 'Recursos', icon: '🔗', order: 8 },
};
