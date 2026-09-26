// Supabase Edge Function: proxy de IA (DeepSeek)
// La clave vive como secreto del servidor: DEEPSEEK_API_KEY (nunca en el frontend).
//
// Despliegue (con la CLI de Supabase):
//   supabase functions deploy ai
//   supabase secrets set DEEPSEEK_API_KEY=sk-...
//
// La función exige un JWT válido (por defecto), así que solo la usan usuarios logueados.

const DEEPSEEK_KEY = Deno.env.get('DEEPSEEK_API_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!DEEPSEEK_KEY) return json({ error: 'Falta el secreto DEEPSEEK_API_KEY' }, 500);

    const body = await req.json();
    const messages = body?.messages;
    if (!Array.isArray(messages)) return json({ error: 'Se requiere "messages"' }, 400);

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + DEEPSEEK_KEY },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.4, stream: false }),
    });

    const data = await res.json();
    if (!res.ok) return json({ error: 'DeepSeek HTTP ' + res.status, detail: data }, 502);
    const text = data?.choices?.[0]?.message?.content ?? '';
    return json({ text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
