import { CONFIG, SYNC_ENABLED } from './config.js';
import { authToken } from './sync.js';

function base() {
  return CONFIG.supabaseUrl.replace(/\/$/, '');
}

function headers(extra = {}) {
  return {
    apikey: CONFIG.supabaseAnonKey,
    Authorization: `Bearer ${authToken() || CONFIG.supabaseAnonKey}`,
    ...extra,
  };
}

export async function uploadFile(bucket, path, file, contentType) {
  if (!SYNC_ENABLED) throw new Error('Sincronización no configurada');
  const res = await fetch(`${base()}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      ...headers(),
      'Content-Type': contentType || file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!res.ok) throw new Error('No se pudo subir el archivo (HTTP ' + res.status + ')');
  return path;
}

export async function signedUrl(bucket, path) {
  const res = await fetch(`${base()}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error('No se pudo firmar el archivo (HTTP ' + res.status + ')');
  const data = await res.json();
  return data.signedURL || data.signedUrl || null;
}

export async function downloadFile(bucket, path) {
  const res = await fetch(`${base()}/storage/v1/object/authenticated/${bucket}/${path}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('No se pudo descargar el archivo (HTTP ' + res.status + ')');
  return res.blob();
}

export async function removeFile(bucket, path) {
  const res = await fetch(`${base()}/storage/v1/object/${bucket}/${path}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) throw new Error('No se pudo borrar el archivo (HTTP ' + res.status + ')');
  return true;
}
