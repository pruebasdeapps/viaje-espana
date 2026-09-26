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

async function callGemini(body) {
  const k = await loadKey();
  if (!k) throw new Error('Configura la clave de Gemini en js/ai.local.js');

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + encodeURIComponent(k);
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok || (res.status !== 429 && res.status !== 503 && res.status < 500)) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!res.ok) throw new Error('Error de Gemini: HTTP ' + res.status);
  return res.json();
}

function extractText(data) {
  const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map((p) => p.text).filter(Boolean).join('\n').trim();
}

export async function suggestChecklist(context) {
  const prompt =
    'Eres un asistente de viajes. El usuario viaja por: ' +
    (context.cities || 'España, Italia, Francia') +
    '. Es invierno (febrero). Ya tiene en su equipaje: ' +
    (context.have || 'nada') +
    '. Sugiere 8 ítems concretos de equipaje que falten (ropa por capas, calzado cómodo, documentos, tecnología, salud, abrigo impermeable). Responde SOLO una lista JSON de strings, por ejemplo: ["item1","item2"].';

  const data = await callGemini({ contents: [{ parts: [{ text: prompt }] }] });
  const text = extractText(data);
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

export async function askWeb(query) {
  const data = await callGemini({
    contents: [{ parts: [{ text: query }] }],
    tools: [{ googleSearch: {} }],
  });
  const text = extractText(data);
  const gm = (data && data.candidates && data.candidates[0] && data.candidates[0].groundingMetadata) || {};
  const sources = (gm.groundingChunks || [])
    .filter((c) => c && c.web && c.web.uri)
    .map((c) => ({ title: c.web.title || c.web.uri, uri: c.web.uri }))
    .slice(0, 4);
  return { text, sources };
}
