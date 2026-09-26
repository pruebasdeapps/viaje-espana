let key = null;

async function loadKey() {
  if (key !== null) return key;
  try {
    const m = await import('./ai.local.js');
    key = (m.AI && m.AI.apiKey) || '';
  } catch (_) {
    key = '';
  }
  return key;
}

export async function suggestChecklist(context) {
  const k = await loadKey();
  if (!k) throw new Error('Configura la clave de Gemini en js/ai.local.js');

  const prompt =
    'Eres un asistente de viajes. El usuario viaja por: ' +
    (context.cities || 'España, Italia, Francia') +
    '. Es invierno (febrero). Ya tiene en su equipaje: ' +
    (context.have || 'nada') +
    '. Sugiere 8 ítems concretos de equipaje que falten (ropa por capas, calzado cómodo, documentos, tecnología, salud, abrigo impermeable). Responde SOLO una lista JSON de strings, por ejemplo: ["item1","item2"].';

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(k),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error('Error de Gemini: HTTP ' + res.status);

  const data = await res.json();
  const text = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      /* seguir al fallback */
    }
  }
  return text
    .split('\n')
    .map((s) => s.replace(/^\d+[.)]\s*/, '').replace(/^-\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter(Boolean);
}
