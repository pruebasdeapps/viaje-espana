// Búsqueda real de sitios (sin clave). Photon (OpenStreetMap) con respaldo Nominatim.
export async function searchPlaces(query) {
  const q = (query || '').trim();
  if (!q) return [];

  const dedupe = (list) => {
    const seen = new Set();
    const out = [];
    for (const r of list) {
      const key = String(r.name || '').toLowerCase() + '|' + Math.round(Number(r.lat) * 1000) + '|' + Math.round(Number(r.lng) * 1000);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out.slice(0, 6);
  };

  try {
    const res = await fetch('https://photon.komoot.io/api/?limit=8&q=' + encodeURIComponent(q));
    if (res.ok) {
      const j = await res.json();
      const out = (j.features || []).map((f) => {
        const p = f.properties || {};
        const name = p.name || p.street || p.city || q;
        const address = [p.street && p.street !== name ? p.street : '', p.city, p.country].filter(Boolean).join(', ');
        const coords = f.geometry && f.geometry.coordinates ? f.geometry.coordinates : [];
        return { name, address, lat: coords[1], lng: coords[0] };
      });
      const clean = dedupe(out);
      if (clean.length) return clean;
    }
  } catch (_) {
    /* probar respaldo */
  }

  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' + encodeURIComponent(q));
    if (res.ok) {
      const j = await res.json();
      return dedupe(
        (j || []).map((r) => ({
          name: r.name || String(r.display_name || '').split(',')[0],
          address: r.display_name || '',
          lat: Number(r.lat),
          lng: Number(r.lon),
        }))
      );
    }
  } catch (_) {
    /* sin resultados */
  }
  return [];
}
