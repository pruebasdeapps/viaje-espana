# Viaje a España — PWA offline

Aplicación web progresiva (PWA) para organizar el viaje familiar. Funciona **sin conexión**,
guarda todo en el dispositivo (IndexedDB) y permite **sincronizar entre teléfonos** con Supabase.

## Módulos

| Módulo | Para qué sirve |
|---|---|
| 🗓️ Itinerario | Actividades por día con hora, lugar, costo y botón a Google Maps |
| 📍 Lugares | Restaurantes y sitios agrupados por ciudad, con valoración y deep link a Maps |
| 💶 Gastos | Registro de gastos con conversión de moneda (EUR/USD/COP/GBP) |
| 📄 Reservas | Vuelos, hoteles, seguros y documentos con referencia y enlace |
| 🧳 Equipaje | Checklist con progreso, categorías y responsable |
| 📝 Diario | Notas del viaje con estado de ánimo |
| 🔗 Recursos | Enlaces útiles (Renfe, AEMET, museos…) |
| ⚙️ Ajustes | Cuenta, sincronización, exportar/importar y borrar datos |

## Estructura

```
Viaje/
├─ index.html              # Shell de la app
├─ manifest.webmanifest    # Metadatos PWA (nombre, íconos, colores)
├─ sw.js                   # Service Worker: cachea la app para uso offline
├─ css/styles.css          # Estilos (modo claro/oscuro, móvil primero)
├─ js/
│  ├─ app.js               # Arranque, router por hash, navegación
│  ├─ config.js            # ← CONFIGURA AQUÍ Supabase y monedas
│  ├─ db.js                # IndexedDB
│  ├─ store.js             # Estado local + exportar/importar
│  ├─ sync.js              # Cliente REST de Supabase + auth
│  ├─ ui.js                # Componentes y modales
│  ├─ seed.js              # Datos de ejemplo
│  └─ modules/             # Un módulo por funcionalidad
├─ icons/                  # Íconos PNG (192/512/maskable/apple)
└─ supabase/schema.sql     # Tabla y políticas (RLS)
```

## 1. Probar en local

Los módulos ES y el Service Worker necesitan un servidor (no abrir el archivo directo).

```powershell
cd C:\Users\sebastian.canal\Desktop\Viaje
python -m http.server 8123
```

Abre `http://localhost:8123`.

## 2. Activar sincronización (Supabase)

1. Crea un proyecto gratis en https://supabase.com.
2. En **SQL Editor**, pega y ejecuta el contenido de `supabase/schema.sql`.
3. En **Project Settings → API** copia:
   - `Project URL`
   - `anon public` key
4. Pega ambos valores en `js/config.js`:

```js
export const CONFIG = {
  ...
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...',
};
```

5. (Opcional) En **Authentication → Providers → Email**, desactiva
   "Confirm email" si quieres que la familia entre sin verificar correo.
6. Abre la app → **Ajustes → Crear cuenta**. Cada miembro entra con su
   correo y contraseña y todos ven el mismo viaje.

> Sin configurar Supabase la app funciona igual en modo **solo local**.

## 3. Publicar en GitHub Pages

```powershell
cd C:\Users\sebastian.canal\Desktop\Viaje
git init
git add .
git commit -m "App de viaje PWA"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
La URL será `https://TU_USUARIO.github.io/TU_REPO/`.

> Importante: la app **debe** servirse por HTTPS para que el Service Worker y la
> instalación funcionen. GitHub Pages ya lo hace.

## 4. Instalar en iPhone

1. Abre la URL **en Safari** (obligatorio).
2. Botón **Compartir** → **Añadir a pantalla de inicio**.
3. Se abre a pantalla completa con su ícono.

En Android/Chrome aparece un aviso de instalación automático.

## 5. Mapas sin conexión

La app **no descarga tiles de Google** (no está permitido). En su lugar guarda
coordenadas y abre el **Google Maps nativo** con el botón 🗺️. Google Maps sí
permite mapas offline:

1. Google Maps → tu perfil → **Mapas sin conexión** → **Seleccionar mapa propio**.
2. Encuadra la zona (p. ej. Madrid, Barcelona, Sevilla) y descarga.
3. Al tocar 🗺️ en la app, la navegación funciona aunque no tengas datos.

## Advertencias en iOS

- iOS puede borrar el almacenamiento de una PWA poco usada. Por eso existe
  **Ajustes → Exportar** (respaldo JSON). Hazlo antes de volar.
- Las notificaciones push solo funcionan desde iOS 16.4+ y no son necesarias aquí.
- Usa Safari para instalar; Chrome en iOS no permite añadir a pantalla de inicio.

## Cómo modificar monedas o tipo de cambio

Edita `js/config.js`:

```js
baseCurrency: 'EUR',
rates: { EUR: 1, USD: 1.08, COP: 4300, GBP: 0.85 },
```

`rates` es cuántas unidades de esa moneda equivalen a 1 unidad de `baseCurrency`.
