export const CITY_COUNTRY = {
  Madrid: 'España',
  Toledo: 'España',
  Barcelona: 'España',
  Granada: 'España',
  Sevilla: 'España',
  Valencia: 'España',
  Roma: 'Italia',
  Pisa: 'Italia',
  Florencia: 'Italia',
  Venecia: 'Italia',
  Milán: 'Italia',
  París: 'Francia',
  Niza: 'Francia',
  Lyon: 'Francia',
};

export const CITY_ORDER = ['Madrid', 'Toledo', 'Barcelona', 'Granada', 'Sevilla', 'Roma', 'Pisa', 'Florencia', 'Venecia', 'París', 'Niza', 'Lyon'];

export function countryOfCity(ciudad) {
  if (!ciudad) return null;
  return CITY_COUNTRY[ciudad] || null;
}
