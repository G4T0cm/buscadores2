# Mapa de Loot — GTA V Zombies

Mapa interactivo de GTA V para vuestro server de zombies: marcadores por
categoría (armas, comida, medicinas, vehículos, peligro, refugio) y zonas
dibujadas (polígonos/círculos), todo sincronizado en tiempo real entre
todos los que abran la página, usando Firebase Realtime Database.

Está construido sobre las teselas del mapa de
[Flamm64/GTA-V-World-Map](https://github.com/Flamm64/GTA-V-World-Map)
(licencia libre: se puede editar, compartir y reusar), pero reemplaza
Google Maps API por **Leaflet** (gratis, sin API key) y añade encima toda
la capa de marcadores/zonas/tiempo real.

## 1. Las teselas del mapa (no hay que descargar nada)

Las imágenes del mapa se cargan directamente desde el repo original de
Flamm64 vía [jsDelivr](https://www.jsdelivr.com/) (un CDN gratuito para
repos públicos de GitHub) — así este proyecto se queda ligero (solo
código) y no hace falta descargar, extraer ni subir cientos de MB de
imágenes. Si alguna vez el propio repo de Flamm64 cambia de nombre o
desaparece, solo habría que actualizar la constante `TILE_CDN` en
`app.js`.

La estructura del proyecto es simplemente:

```
zombie-map/
├── index.html
├── style.css
├── app.js
├── firebase-config.js
├── empty.png
└── README.md
```

## 2. Crea el proyecto de Firebase

Ya tienes cuenta de Firebase, así que solo falta el proyecto:

1. Entra en https://console.firebase.google.com
2. **Añadir proyecto** → ponle un nombre (ej. `mapa-zombies`) → puedes
   desactivar Google Analytics, no hace falta.
3. Dentro del proyecto, ve a **Compilación → Realtime Database** →
   **Crear base de datos** → elige una región (ej. Europa) → empieza en
   **modo bloqueado** (ya pondremos las reglas nosotros).
4. Ve a **Compilación → Authentication** → **Comenzar** → pestaña
   **Sign-in method** → activa **Anónimo**. Esto hace que cada
   visitante tenga una sesión anónima, sin pedir registro ni contraseña,
   pero nos permite proteger la base de datos (ver punto 4).
5. Ve a **Configuración del proyecto** (el engranaje) → baja hasta
   **Tus apps** → icono `</>` (Web) → dale un nombre → **Registrar app**.
   Te mostrará un bloque `firebaseConfig = {...}`.
6. Copia esos valores dentro de `firebase-config.js` (sustituye los
   `PEGA_AQUI_...`).

## 3. Reglas de seguridad de la base de datos

Por defecto, cualquiera con el enlace de vuestra página podrá leer y
escribir marcadores (así es como todos ven lo mismo). Para que **solo**
quien entre por vuestra web (no cualquiera con la URL de Firebase) pueda
escribir, usa estas reglas — pégalas en **Realtime Database → Reglas**:

```json
{
  "rules": {
    "markers": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "zones": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

Esto exige que el visitante tenga una sesión (aunque sea anónima), que la
web ya crea sola al cargar. No es una seguridad a prueba de balas —el
`firebaseConfig` es público por diseño en cualquier app web— pero es
suficiente para un mapa privado que compartís solo entre vosotros; nadie
que no entre por vuestra página podrá escribir sin más.

## 4. Sube esto a GitHub y activa GitHub Pages

1. Crea un repo nuevo en GitHub (puede ser privado o público) y sube
   todos los archivos de esta carpeta (incluidas `Atlas/`, `Roadmap/`,
   `Satellite/`).
2. En el repo: **Settings → Pages** → en "Build and deployment" elige
   **Deploy from a branch** → rama `main`, carpeta `/ (root)` → **Save**.
3. En un par de minutos tendréis la web en
   `https://tu-usuario.github.io/tu-repo/`.

> Nota: si el repo es privado, GitHub Pages en un repo privado requiere
> plan Pro/Team/Enterprise. Si queréis mantenerlo gratis y privado del
> todo, podéis dejar el repo público (las teselas del mapa no son
> secretas) — lo único "privado" de verdad son las reglas de Firebase.

## Cómo se usa

- **🖐️ Ver**: modo por defecto, solo mueves y haces zoom.
- **📍 Marcador**: elige categoría en la barra que aparece arriba y toca
  el mapa donde quieras poner el marcador; rellena título/notas y
  guarda. Aparece al instante para todos.
- Herramientas de la esquina (icono de lápiz de Leaflet.draw): dibuja
  polígonos, círculos o rectángulos para delimitar zonas (zona
  infestada, zona segura, etc.), elige color y título.
- Toca cualquier marcador o zona para ver detalles y poder eliminarlo.
- **🎯 Ir a coords**: pega las coordenadas X/Y que os da el juego y el
  mapa centra ahí (réplica de la función que traía el mapa original).
- **👤 nombre**: cambia cómo aparecéis como autor de marcadores/zonas
  (se guarda solo en tu navegador).

## Personalizar categorías

Las categorías de marcador están definidas al principio de `app.js`, en
el objeto `CATEGORIES`. Puedes añadir, quitar o cambiar emoji/color ahí.
