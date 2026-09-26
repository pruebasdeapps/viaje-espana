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

async function chat(messages) {
  const k = await loadKey();
  if (!k) throw new Error('Configura la clave de DeepSeek en js/ai.local.js');

  const url = 'https://api.deepseek.com/chat/completions';
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.4, stream: false }),
    });
    if (res.ok || (res.status !== 429 && res.status !== 503 && res.status < 500)) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!res.ok) throw new Error('Error de DeepSeek: HTTP ' + res.status);
  const data = await res.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

export async function askChat(query) {
  return chat([
    { role: 'system', content: 'Eres "Papacito", un asistente de viajes amable, breve y útil. Respondes en español.' },
    { role: 'user', content: query },
  ]);
}

export async function suggestChecklist(context) {
  const prompt =
    'Eres un asistente de viajes. El usuario viaja por: ' +
    (context.cities || 'España, Italia, Francia') +
    '. Es invierno (febrero). Ya tiene en su equipaje: ' +
    (context.have || 'nada') +
    '. Sugiere 8 ítems concretos de equipaje que falten (ropa por capas, calzado cómodo, documentos, tecnología, salud, abrigo impermeable). Responde SOLO una lista JSON de strings, por ejemplo: ["item1","item2"].';

  const text = await chat([
    { role: 'system', content: 'Respondes únicamente con JSON válido.' },
    { role: 'user', content: prompt },
  ]);
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr)) return arr;
    } catch (_) {
      /* seguir al fallback */
    }
  }
  return text
    .split('\n')
    .map((s) => s.replace(/^\d+[.)]\s*/, '').replace(/^-\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter(Boolean);
}
