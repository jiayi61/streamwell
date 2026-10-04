// Offline support: cache the app shell on install. App files are fetched
// network-first (so updates arrive) with the cache as offline fallback; other
// origins (map tiles, weather, FHIR servers) always go to the network.
const CACHE = 'streamwell-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'assets/styles.css', 'assets/icon.svg',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'data/demo-visits.json',
  'src/app.js', 'src/ui.js', 'src/icons.js', 'src/charts.js', 'src/map.js', 'src/photo.js', 'src/store.js',
  'src/sites.js', 'src/health-risks.js', 'src/protocol.js', 'src/score.js', 'src/checks.js', 'src/wellbeing.js',
  'src/stats.js', 'src/insights.js', 'src/earlywarning.js', 'src/fhir.js', 'src/validate.js', 'src/demo-data.js',
  'src/view-home.js', 'src/view-visit.js', 'src/view-journal.js', 'src/view-city.js', 'src/view-fhir.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
