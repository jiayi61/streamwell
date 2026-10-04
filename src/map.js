// Thin wrapper around Leaflet (vendored, BSD-2-Clause) with a list fallback
// if the map library cannot load. Tiles: OpenStreetMap (OSMF tile servers, no
// API key), shown in calm greys by CSS (.basemap) so the site colours stand out.

import { h } from './ui.js';

export function createMap(el, { center = [48.5, 6.5], zoom = 4, onReady } = {}) {
  if (!window.L) {
    el.append(h('div', { class: 'empty' }, 'Map unavailable offline. Use the list instead.'));
    return null;
  }
  const L = window.L;
  const map = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(center, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'basemap',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.on('focus', () => map.scrollWheelZoom.enable());
  map.on('blur', () => map.scrollWheelZoom.disable());
  const layer = L.layerGroup().addTo(map);
  const markers = new Map();

  const api = {
    map,
    /** items: [{code, lat, lon, color, radius?, popup?:Node|string, title}] */
    setMarkers(items, onClick) {
      layer.clearLayers();
      markers.clear();
      for (const it of items) {
        const m = L.circleMarker([it.lat, it.lon], {
          radius: it.radius || 7,
          color: it.stroke || '#ffffff',
          weight: it.weight || 2,
          fillColor: it.color,
          fillOpacity: 0.9,
        }).addTo(layer);
        if (it.title) m.bindTooltip(it.title, { direction: 'top', offset: [0, -6] });
        if (it.popup) m.bindPopup(it.popup, { maxWidth: 300 });
        if (onClick) m.on('click', () => onClick(it.code));
        markers.set(it.code, m);
      }
    },
    highlight(code) {
      markers.forEach((m, c) => m.setStyle({ weight: c === code ? 4 : 2, color: c === code ? '#11303d' : '#ffffff', radius: c === code ? 11 : m.options.radius }));
      const m = markers.get(code);
      if (m) m.bringToFront();
    },
    open(code) { const m = markers.get(code); if (m) m.openPopup(); },
    fit(points, maxZoom = 13) {
      if (!points.length) return;
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
      map.fitBounds(b.pad(0.15), { maxZoom });
    },
    flyTo(lat, lon, z = 14) { map.setView([lat, lon], z); },
    invalidate() { setTimeout(() => map.invalidateSize(), 50); },
  };
  if (onReady) onReady(api);
  return api;
}
