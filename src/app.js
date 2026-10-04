// StreamWell app shell: loads data, fetches weather, computes advisories and
// routes between the views. Plain ES modules, no build step.

import { h, clear } from './ui.js';
import { SITES, SITE_BY_CODE } from './sites.js';
import { HEALTH_RISK } from './health-risks.js';
import { decodeDataset } from './demo-data.js';
import { siteAggregates } from './insights.js';
import { fetchCityWeather, fallbackWeather, advisory } from './earlywarning.js';
import { store } from './store.js';
import { renderHome } from './view-home.js';
import { renderVisit } from './view-visit.js';
import { renderJournal } from './view-journal.js';
import { renderCity } from './view-city.js';
import { renderFhir } from './view-fhir.js';

const ROUTES = {
  '': renderHome,
  visit: renderVisit,
  me: renderJournal,
  city: renderCity,
  fhir: renderFhir,
};

const ctx = {
  today: new Date(),
  demo: null,
  aggregates: null,
  cityWeather: fallbackWeather(),
  weatherLive: false,
  advisories: {},
  allVisits() {
    const own = store.visits();
    return [...(this.demo ? this.demo.visits : []), ...own];
  },
};

function computeAdvisories() {
  ctx.aggregates = siteAggregates(ctx.allVisits(), ctx.today);
  ctx.advisories = Object.fromEntries(SITES.map((s) => [s.code, advisory(s, ctx.cityWeather[s.city], HEALTH_RISK[s.code], ctx.aggregates[s.code])]));
}

async function load() {
  const main = document.getElementById('app');
  main.replaceChildren(h('div', { class: 'empty' }, 'Loading StreamWell…'));
  try {
    const res = await fetch('data/demo-visits.json');
    ctx.demo = decodeDataset(await res.json(), SITE_BY_CODE);
  } catch (e) {
    console.warn('Demo data unavailable', e);
  }
  const weather = fetchCityWeather().then((w) => { ctx.cityWeather = w; ctx.weatherLive = true; }).catch((e) => console.warn('Weather unavailable', e));
  await Promise.race([weather, new Promise((r) => setTimeout(r, 3500))]);
  computeAdvisories();
  route();
  // If the weather arrived after the first render, refresh advisories quietly.
  weather.then(() => { if (ctx.weatherLive) { computeAdvisories(); const r = current(); if (r.name === 'city' || r.name === 'visit') route(); } });
}

function current() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, query] = raw.split('?');
  return { name: ROUTES[name] ? name : '', params: new URLSearchParams(query || '') };
}

function route() {
  const { name, params } = current();
  const main = document.getElementById('app');
  clear(main);
  document.querySelectorAll('.nav a').forEach((a) => {
    const target = a.getAttribute('href').replace(/^#\/?/, '');
    if (target === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  try {
    ROUTES[name](main, ctx, params);
  } catch (e) {
    console.error(e);
    main.append(h('div', { class: 'card empty' }, h('p', {}, 'Something went wrong on this page.'), h('pre', { class: 'mono small' }, String(e && e.message))));
  }
  document.title = { '': 'StreamWell: check the stream, check yourself', visit: 'Stream visit · StreamWell', me: 'Your journal · StreamWell', city: 'City dashboard · StreamWell', fhir: 'FHIR · StreamWell' }[name];
  if (name !== 'visit') window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
load();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
