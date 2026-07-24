/* ============================================================
   MAPA DE LOOT - GTA V ZOMBIES
   Basado en las tiles de Flamm64/GTA-V-World-Map (mismo esquema
   de teselas que Google Maps: {carpeta}/{z}_{x}_{y}.jpg, tileSize
   256, zoom 2-7). Usamos el CRS estándar de Leaflet (EPSG3857)
   porque coincide exactamente con ese esquema.
   ============================================================ */

// ---------- Categorías de marcadores ----------
const CATEGORIES = {
  weapons:   { emoji: '🔫', color: '#b91c1c', label: 'Armas / Munición' },
  food:      { emoji: '🍖', color: '#a16207', label: 'Comida / Agua' },
  medkit:    { emoji: '💊', color: '#16a34a', label: 'Botiquín / Medicinas' },
  vehicle:   { emoji: '🚗', color: '#2563eb', label: 'Vehículos' },
  danger:    { emoji: '☠️', color: '#111111', label: 'Zombies / Peligro' },
  safehouse: { emoji: '🏠', color: '#7c3aed', label: 'Base segura / Refugio' },
};

function makeDivIcon(catKey) {
  const cat = CATEGORIES[catKey] || CATEGORIES.danger;
  return L.divIcon({
    className: '',
    html: `<div class="zombie-marker" style="background:${cat.color}">${cat.emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

// ---------- Nombre de usuario (local) ----------
function getUsername() {
  return localStorage.getItem('zm_username') || 'Anónimo';
}
function setUsername(name) {
  localStorage.setItem('zm_username', name);
  document.getElementById('username-label').textContent = name;
}
document.getElementById('username-label').textContent = getUsername();

// ---------- Mapa base ----------
const map = L.map('map', {
  center: [0, 0],
  zoom: 3,
  minZoom: 2,
  maxZoom: 7,
  crs: L.CRS.EPSG3857,
  worldCopyJump: false,
});

// Las teselas se sirven desde tu propia carpeta Satellite/ (la que
// descomprimiste del repo de Flamm64), junto a este index.html.
L.tileLayer('Satellite/{z}_{x}_{y}.jpg', {
  tileSize: 256, minZoom: 2, maxZoom: 7, errorTileUrl: 'empty.png',
}).addTo(map);

// ---------- Conversión de coordenadas in-game -> LatLng ----------
// Réplica de la función gtamp2googlepx() del mapa original, usando
// map.unproject en lugar de la proyección de Google Maps.
const REF_ZOOM = 2;
function gameCoordsToLatLng(x, y) {
  const mx = 0.05030;
  const my = -0.05030;
  const px = (mx * x) - 486.97;
  const py = (my * y) + 408.9;
  return map.unproject([px, py], REF_ZOOM);
}

// ---------- Firebase ----------
let fbReady = false;
let db, auth;
try {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.database();
  fbReady = true;
} catch (e) {
  console.error('Firebase no está configurado todavía:', e);
}

const connStatus = document.getElementById('conn-status');

if (fbReady) {
  auth.signInAnonymously().catch(err => {
    console.error('Error de autenticación anónima:', err);
    alert('No se pudo conectar con Firebase. Revisa firebase-config.js y que la autenticación anónima esté activada.');
  });

  db.ref('.info/connected').on('value', snap => {
    if (snap.val() === true) {
      connStatus.classList.remove('offline');
      connStatus.classList.add('online');
    } else {
      connStatus.classList.remove('online');
      connStatus.classList.add('offline');
    }
  });
}

// ---------- Capas de marcadores y zonas ----------
const markerLayer = L.layerGroup().addTo(map);
const zoneLayer = L.layerGroup().addTo(map);

const markerObjs = {}; // id -> leaflet marker
const zoneObjs = {};   // id -> leaflet layer

function bindMarkerPopup(leafletMarker, id, data) {
  const cat = CATEGORIES[data.category] || CATEGORIES.danger;
  const html = `
    <b>${cat.emoji} ${escapeHtml(data.label || cat.label)}</b><br>
    ${data.note ? escapeHtml(data.note) + '<br>' : ''}
    <div class="popup-meta">Añadido por ${escapeHtml(data.createdBy || 'Anónimo')}</div>
    <button class="popup-delete" data-id="${id}" data-kind="marker">Eliminar</button>
  `;
  leafletMarker.bindPopup(html);
}

function bindZonePopup(leafletLayer, id, data) {
  const html = `
    <b>${escapeHtml(data.label || 'Zona')}</b>
    <div class="popup-meta">Añadido por ${escapeHtml(data.createdBy || 'Anónimo')}</div>
    <button class="popup-delete" data-id="${id}" data-kind="zone">Eliminar</button>
  `;
  leafletLayer.bindPopup(html);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Delegación de click para los botones "Eliminar" dentro de popups
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('popup-delete')) {
    const id = e.target.dataset.id;
    const kind = e.target.dataset.kind;
    if (!confirm('¿Eliminar este ' + (kind === 'zone' ? 'zona' : 'marcador') + '?')) return;
    if (!fbReady) return;
    db.ref((kind === 'zone' ? 'zones/' : 'markers/') + id).remove();
  }
});

// ---------- Sincronización en tiempo real: marcadores ----------
if (fbReady) {
  db.ref('markers').on('child_added', snap => {
    const id = snap.key;
    const data = snap.val();
    const m = L.marker(gameOrLatLng(data), { icon: makeDivIcon(data.category) });
    bindMarkerPopup(m, id, data);
    m.addTo(markerLayer);
    markerObjs[id] = m;
  });
  db.ref('markers').on('child_changed', snap => {
    const id = snap.key;
    const data = snap.val();
    if (markerObjs[id]) {
      markerObjs[id].setIcon(makeDivIcon(data.category));
      bindMarkerPopup(markerObjs[id], id, data);
    }
  });
  db.ref('markers').on('child_removed', snap => {
    const id = snap.key;
    if (markerObjs[id]) {
      markerLayer.removeLayer(markerObjs[id]);
      delete markerObjs[id];
    }
  });

  // ---------- Sincronización en tiempo real: zonas ----------
  db.ref('zones').on('child_added', snap => {
    const id = snap.key;
    const data = snap.val();
    const layer = buildZoneLayer(data);
    if (!layer) return;
    bindZonePopup(layer, id, data);
    layer.addTo(zoneLayer);
    zoneObjs[id] = layer;
  });
  db.ref('zones').on('child_removed', snap => {
    const id = snap.key;
    if (zoneObjs[id]) {
      zoneLayer.removeLayer(zoneObjs[id]);
      delete zoneObjs[id];
    }
  });
}

function gameOrLatLng(data) {
  return L.latLng(data.lat, data.lng);
}

function buildZoneLayer(data) {
  const style = { color: data.color || '#ef4444', weight: 2, fillOpacity: 0.25 };
  if (data.type === 'circle') {
    return L.circle([data.lat, data.lng], { radius: data.radius, ...style });
  } else if (data.type === 'polygon' || data.type === 'rectangle') {
    return L.polygon(data.latlngs, style);
  }
  return null;
}

// ---------- Modo: Ver / Añadir marcador ----------
let currentMode = 'view';
let selectedCategory = null;

const btnView = document.getElementById('mode-view');
const btnMarker = document.getElementById('mode-marker');
const categoryBar = document.getElementById('category-bar');
const categoryButtons = document.getElementById('category-buttons');

Object.entries(CATEGORIES).forEach(([key, cat]) => {
  const b = document.createElement('button');
  b.className = 'cat-btn';
  b.style.background = cat.color;
  b.textContent = `${cat.emoji} ${cat.label}`;
  b.dataset.cat = key;
  b.addEventListener('click', () => {
    document.querySelectorAll('#category-buttons .cat-btn').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    selectedCategory = key;
  });
  categoryButtons.appendChild(b);
});

function setMode(mode) {
  currentMode = mode;
  btnView.classList.toggle('active', mode === 'view');
  btnMarker.classList.toggle('active', mode === 'marker');
  categoryBar.classList.toggle('hidden', mode !== 'marker');
  map.getContainer().style.cursor = mode === 'marker' ? 'crosshair' : '';
}
btnView.addEventListener('click', () => setMode('view'));
btnMarker.addEventListener('click', () => {
  if (!selectedCategory) selectedCategory = Object.keys(CATEGORIES)[0];
  document.querySelector(`#category-buttons .cat-btn[data-cat="${selectedCategory}"]`).classList.add('selected');
  setMode('marker');
});

// ---------- Click en el mapa para añadir marcador ----------
let pendingLatLng = null;
const markerForm = document.getElementById('marker-form');
const markerFormCategory = document.getElementById('marker-form-category');

map.on('click', (e) => {
  if (currentMode !== 'marker' || !selectedCategory) return;
  pendingLatLng = e.latlng;
  openMarkerForm();
});

function openMarkerForm() {
  markerFormCategory.innerHTML = '';
  const cat = CATEGORIES[selectedCategory];
  const chip = document.createElement('span');
  chip.className = 'cat-btn selected';
  chip.style.background = cat.color;
  chip.textContent = `${cat.emoji} ${cat.label}`;
  markerFormCategory.appendChild(chip);
  document.getElementById('marker-label').value = '';
  document.getElementById('marker-note').value = '';
  markerForm.classList.remove('hidden');
}

document.getElementById('marker-cancel').addEventListener('click', () => {
  markerForm.classList.add('hidden');
});

document.getElementById('marker-save').addEventListener('click', () => {
  if (!fbReady) { alert('Firebase no está configurado.'); return; }
  const label = document.getElementById('marker-label').value.trim();
  const note = document.getElementById('marker-note').value.trim();
  db.ref('markers').push({
    lat: pendingLatLng.lat,
    lng: pendingLatLng.lng,
    category: selectedCategory,
    label, note,
    createdBy: getUsername(),
    createdAt: Date.now(),
  });
  markerForm.classList.add('hidden');
});

// ---------- Dibujo de zonas (Leaflet-Geoman) ----------
map.pm.addControls({
  position: 'topleft',
  drawMarker: false,
  drawCircleMarker: false,
  drawPolyline: false,
  drawText: false,
  drawPolygon: true,
  drawRectangle: true,
  drawCircle: true,
  editMode: false,
  dragMode: false,
  cutPolygon: false,
  removalMode: false,
  rotateMode: false,
});
map.pm.setPathOptions({ color: '#ef4444', weight: 2, fillOpacity: 0.25 });

let pendingZoneLayer = null;
const zoneForm = document.getElementById('zone-form');

map.on('pm:create', (e) => {
  pendingZoneLayer = e.layer;
  pendingZoneLayer.shape = e.shape; // 'Polygon' | 'Rectangle' | 'Circle'
  document.getElementById('zone-label').value = '';
  document.getElementById('zone-color').value = '#ef4444';
  zoneForm.classList.remove('hidden');
});

document.getElementById('zone-cancel').addEventListener('click', () => {
  if (pendingZoneLayer) map.removeLayer(pendingZoneLayer);
  zoneForm.classList.add('hidden');
  pendingZoneLayer = null;
});

document.getElementById('zone-save').addEventListener('click', () => {
  if (!fbReady || !pendingZoneLayer) return;
  const label = document.getElementById('zone-label').value.trim();
  const color = document.getElementById('zone-color').value;
  let data;
  if (pendingZoneLayer.shape === 'Circle') {
    const c = pendingZoneLayer.getLatLng();
    data = { type: 'circle', lat: c.lat, lng: c.lng, radius: pendingZoneLayer.getRadius(), color, label, createdBy: getUsername(), createdAt: Date.now() };
  } else {
    const latlngs = pendingZoneLayer.getLatLngs()[0].map(ll => [ll.lat, ll.lng]);
    data = { type: 'polygon', latlngs, color, label, createdBy: getUsername(), createdAt: Date.now() };
  }
  db.ref('zones').push(data);
  map.removeLayer(pendingZoneLayer); // lo quitamos del dibujo temporal; llegará vía Firebase con su popup
  zoneForm.classList.add('hidden');
  pendingZoneLayer = null;
});

// ---------- Cambiar nombre de usuario ----------
const usernameForm = document.getElementById('username-form');
document.getElementById('username-btn').addEventListener('click', () => {
  document.getElementById('username-input').value = getUsername();
  usernameForm.classList.remove('hidden');
});
document.getElementById('username-cancel').addEventListener('click', () => usernameForm.classList.add('hidden'));
document.getElementById('username-save').addEventListener('click', () => {
  const val = document.getElementById('username-input').value.trim();
  if (val) setUsername(val);
  usernameForm.classList.add('hidden');
});

// ---------- Ir a coordenadas in-game ----------
const coordsForm = document.getElementById('coords-form');
document.getElementById('goto-coords-btn').addEventListener('click', () => {
  document.getElementById('coords-x').value = '';
  document.getElementById('coords-y').value = '';
  coordsForm.classList.remove('hidden');
});
document.getElementById('coords-cancel').addEventListener('click', () => coordsForm.classList.add('hidden'));
document.getElementById('coords-go').addEventListener('click', () => {
  const x = parseFloat(document.getElementById('coords-x').value);
  const y = parseFloat(document.getElementById('coords-y').value);
  if (isNaN(x) || isNaN(y)) return;
  const latlng = gameCoordsToLatLng(x, y);
  map.setView(latlng, 5);
  coordsForm.classList.add('hidden');
});