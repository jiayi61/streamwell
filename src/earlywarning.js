// Safe-blue-walk advisories: early warning that combines
//   * weather (Open-Meteo forecast and last two days, free, no key),
//   * OneAquaHealth lab health-risk scores per site (faecal / pathogen), and
//   * what StreamWell volunteers reported recently (discharges, still water).
// Every advisory lists its reasons and their sources. Rules are simple on
// purpose so a city officer can check them.

import { CITIES } from './sites.js';

export const LEVELS = [
  { id: 0, key: 'go', label: 'Good for a blue walk', short: 'Go' },
  { id: 1, key: 'care', label: 'Walk, but keep out of the water', short: 'Care' },
  { id: 2, key: 'avoid', label: 'Avoid water contact, pick another stream', short: 'Avoid' },
];

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

/** One request for all five OAH cities. */
export async function fetchCityWeather(fetchImpl = fetch) {
  const ids = Object.keys(CITIES);
  const lat = ids.map((c) => CITIES[c].lat).join(',');
  const lon = ids.map((c) => CITIES[c].lon).join(',');
  const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,temperature_2m_max&past_days=2&forecast_days=3&timezone=auto`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json];
  const out = {};
  ids.forEach((id, i) => { out[id] = summariseDaily(list[i].daily, 'Open-Meteo (live)'); });
  return out;
}

/** Weather for one point (used during a visit for the second look). */
export async function fetchPointWeather(lat, lon, fetchImpl = fetch) {
  const url = `${OPEN_METEO}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&daily=precipitation_sum,temperature_2m_max&past_days=3&forecast_days=1&timezone=auto`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const j = await res.json();
  const rain = j.daily.precipitation_sum.map((x) => x || 0);
  const tmax = j.daily.temperature_2m_max;
  // past_days=3 + today: indices 0..3, today = 3
  return {
    rain48: rain[2] + rain[3],
    rain72: rain[1] + rain[2] + rain[3],
    tmax3: Math.max(tmax[1], tmax[2], tmax[3]),
    source: 'Open-Meteo',
    fetchedAt: new Date().toISOString(),
  };
}

/** daily arrays with past_days=2, forecast_days=3: indices 0,1 past; 2 today; 3,4 next. */
export function summariseDaily(daily, source) {
  const rain = daily.precipitation_sum.map((x) => x || 0);
  const tmax = daily.temperature_2m_max.map((x) => (x == null ? NaN : x));
  return {
    days: daily.time,
    rain,
    tmax,
    rainPast48: rain[0] + rain[1],
    rainToday: rain[2],
    rainNext48: rain[3] + rain[4],
    tmaxNext: Math.max(tmax[2], tmax[3], tmax[4]),
    source,
  };
}

/** What-if scenarios for planning and for demos when the weather is calm. */
export const SCENARIOS = {
  live: { label: 'Live forecast' },
  storm: { label: 'Storm: 28 mm tonight', apply: (w) => ({ ...w, rainToday: w.rainToday + 28, rainNext48: w.rainNext48 + 6, source: `${w.source} + storm scenario` }) },
  heat: { label: 'Heatwave: 36 °C', apply: (w) => ({ ...w, tmaxNext: Math.max(w.tmaxNext, 36), source: `${w.source} + heatwave scenario` }) },
};

export function applyScenario(cityWeather, scenarioId) {
  const s = SCENARIOS[scenarioId];
  if (!s || !s.apply) return cityWeather;
  return Object.fromEntries(Object.entries(cityWeather).map(([k, w]) => [k, s.apply(w)]));
}

/**
 * Advisory for one site.
 * @param {object} site    {code, city}
 * @param {object} w       city weather summary
 * @param {object|null} lab OAH health risk {fecal, pathogen, score, date}
 * @param {object|null} agg StreamWell site aggregate (recentDischarge, recentStill, ...)
 */
export function advisory(site, w, lab, agg) {
  const reasons = [];
  let level = 0;
  const raise = (l, text, source) => { level = Math.max(level, l); reasons.push({ level: l, text, source }); };
  const fecal = lab ? lab.fecal : null;
  const highFecal = fecal != null && fecal >= 0.5;
  const pipesHistory = agg && (agg.recentDischarge || agg.dischargeShare >= 0.15);

  if (w) {
    const rainNow = Math.max(w.rainPast48 + w.rainToday, w.rainToday + w.rainNext48);
    if (rainNow >= 20) {
      raise(highFecal || pipesHistory ? 2 : 1,
        `Heavy rain (${fmt(rainNow)} mm over 48 h): storm overflows and run-off wash sewage and dirt into urban streams. Stay out of the water until 48 h after the rain stops.`,
        w.source);
    } else if (rainNow >= 10) {
      if (highFecal || pipesHistory) raise(1, `Rain (${fmt(rainNow)} mm over 48 h) at a site with a faecal-contamination signal: first-flush pollution is likely.`, w.source);
      else reasons.push({ level: 0, text: `Some rain (${fmt(rainNow)} mm over 48 h). Water may be muddy.`, source: w.source });
    }
    if (w.tmaxNext >= 30) {
      if (agg && agg.recentStill) raise(1, `Hot days ahead (${fmt(w.tmaxNext)} °C) and volunteers recently saw still water here: algal bloom and mosquito risk.`, `${w.source}; StreamWell volunteers`);
      if (w.tmaxNext >= 35) raise(1, `Heatwave (${fmt(w.tmaxNext)} °C): walk early or late and prefer shaded banks.`, w.source);
    }
  }
  if (lab && lab.fecal >= 0.75) {
    raise(1, `OAH lab sampling found a high faecal-contamination score here (${lab.fecal.toFixed(2)} on a 0-1 scale, sampled ${lab.date}).`, 'OneAquaHealth lab health-risk data');
  }
  if (agg && agg.recentDischarge) {
    raise(1, 'A volunteer reported dirty water flowing in during one of the last five visits.', 'StreamWell volunteers');
  }
  return { site: site.code, city: site.city, level, ...LEVELS[level], reasons };
}

/** For a site that is not "go", the nearest sites in the same city that are. */
export function saferAlternatives(site, advisories, allSites, n = 3) {
  const goCodes = new Set(advisories.filter((a) => a.level === 0 && a.city === site.city).map((a) => a.site));
  return allSites
    .filter((s) => goCodes.has(s.code) && s.code !== site.code)
    .map((s) => ({ ...s, d: Math.hypot((s.lat - site.lat) * 111, (s.lon - site.lon) * 111 * Math.cos((site.lat * Math.PI) / 180)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

function fmt(x) { return Math.round(x * 10) / 10; }

/** Calm fallback weather used when Open-Meteo cannot be reached (clearly labelled). */
export function fallbackWeather() {
  const calm = (tmax) => ({ days: [], rain: [0, 0, 0, 0, 0], tmax: [tmax, tmax, tmax, tmax, tmax], rainPast48: 0, rainToday: 0, rainNext48: 0, tmaxNext: tmax, source: 'Offline: no live weather' });
  return { CO: calm(22), TO: calm(21), GH: calm(16), BE: calm(23), OS: calm(11) };
}
