import { h, svg, fmt } from './ui.js';
import { icon } from './icons.js';
import { SITES, CITIES } from './sites.js';
import { HEALTH_RISK } from './health-risks.js';

export function renderHome(root, ctx) {
  const n = ctx.demo ? ctx.demo.visits.length : 0;
  root.append(
    h('section', { class: 'hero' },
      h('div', {},
        h('div', { class: 'eyebrow' }, 'IEEE OneAquaHealth Global Hackathon 2026'),
        h('h1', {}, 'Check the stream.', h('br'), h('span', { style: { color: 'var(--brand)' } }, 'Check yourself.')),
        h('p', { class: 'lead' },
          'StreamWell turns every visit to an urban stream into two health checks: the stream’s, with the OneAquaHealth citizen protocol, and yours, with a 30-second check-in before and after. ',
          'Volunteers get a personal reason to come back. Cities and researchers get the paired data that links ecosystem health to human well-being.'),
        h('div', { class: 'cta' },
          h('a', { class: 'btn primary', href: '#/visit' }, icon('pin'), 'Start a stream visit'),
          h('a', { class: 'btn', href: '#/city' }, 'Open the city dashboard'),
          h('a', { class: 'btn ghost', href: '#/fhir' }, 'FHIR & blue prescriptions')),
      ),
      h('div', { class: 'hero-art' }, heroArt()),
    ),

    h('section', { class: 'section grid grid-3' },
      problem('Volunteers drift away', 'In seven large citizen-science projects only 27% of volunteers came back for a second session, yet returners made 85% of all contributions (Sauermann & Franzoni, PNAS 2015). A personal benefit is a reason to return.'),
      problem('The human half is missing', 'OneAquaHealth asks how stream health relates to well-being, but citizen records describe streams, not how people feel there.'),
      problem('Data that cannot travel', 'Health systems speak HL7 FHIR. Stream observations rarely do, so they never reach the people who could act on them.'),
    ),

    h('section', { class: 'section' },
      h('h2', {}, 'One visit, two health checks'),
      h('div', { class: 'steps section', style: { marginTop: '12px' } },
        step('Check in', 'Before looking closely, rate four feelings: joy, calm, irritation, worry. The same four the OAH app records.'),
        step('Check the stream', 'The OAH citizen protocol in plain words, with pictures and an honest "not sure". About 4 minutes.'),
        step('Second look', 'Explainable checks compare your answers with each other, with recent weather and with an optional photo. You decide.'),
        step('Check out', 'Rate the same feelings again and tag what shaped them. See your restoration and the stream’s condition side by side.'),
      ),
    ),

    h('section', { class: 'section grid grid-3' },
      audience('person', 'For volunteers', 'A journal that shows which streams restore you most, streaks for regular walks, and missions to streams that need a look.', '#/me', 'Open the journal'),
      audience('users', 'For cities & researchers', 'Site conditions, safe-blue-walk advisories from weather and OAH lab data, and which fixes (litter, trees, outfalls) are linked to the biggest well-being gains.', '#/city', 'Open the dashboard'),
      audience('stethoscope', 'For health systems', 'Observations in HL7 FHIR on the OneAquaHealth IG, k-anonymous health measures, and a blue-prescription CarePlan a GP can issue and follow.', '#/fhir', 'See the FHIR'),
    ),

    h('section', { class: 'section card flat' },
      h('h3', {}, 'What is real and what is simulated'),
      h('div', { class: 'grid grid-2', style: { marginTop: '8px' } },
        h('ul', { class: 'small' },
          h('li', {}, h('strong', {}, `${SITES.length} OneAquaHealth research sites`), ` in ${Object.values(CITIES).map((c) => c.name).join(', ')} (OAH public API).`),
          h('li', {}, h('strong', {}, 'OAH Citizen Science App questions and answer codes'), ' (OAH API lookup tables and submission schema).'),
          h('li', {}, h('strong', {}, `OAH lab health-risk scores for ${Object.keys(HEALTH_RISK).length} sites`), ' (pathogen, faecal, antibiotic-resistance; OAH API).'),
          h('li', {}, h('strong', {}, 'HL7 FHIR profiles'), ' from the OneAquaHealth Implementation Guide (hl7-eu/oah).'),
          h('li', {}, h('strong', {}, 'Live weather'), ' from Open-Meteo.'),
        ),
        h('ul', { class: 'small' },
          h('li', {}, h('strong', {}, `${fmt.num(n)} pilot visits are synthetic`), ': simulated by a seeded, documented model (scripts/simulate.py) because no paired eco-health dataset exists yet. Producing one is what StreamWell is for.'),
          h('li', {}, 'Your own visits stay in this browser. Nothing is uploaded unless you export it.'),
          h('li', {}, 'StreamWell gives decision support and well-being feedback. It is not a medical device and does not diagnose.'),
        ),
      ),
    ),

    h('section', { class: 'section' },
      h('div', { class: 'pill-row' },
        ['Citizen Science UX', 'Data-to-Insight', 'AI-Supported Assessment', 'Awareness & Storytelling', 'Community', 'Resilience Informatics', 'Digital Health Standards'].map((t) => h('span', { class: 'chip' }, t)),
      ),
    ),
  );
}

function problem(title, text) {
  return h('div', { class: 'card' }, h('h3', {}, title), h('p', { class: 'muted small' }, text));
}
function step(title, text) {
  return h('div', { class: 'card' }, h('h3', {}, title), h('p', { class: 'muted small' }, text));
}
function audience(ic, title, text, href, cta) {
  return h('div', { class: 'card stack' },
    h('div', { style: { color: 'var(--brand)', width: '40px' } }, icon(ic)),
    h('h3', {}, title), h('p', { class: 'muted small' }, text),
    h('a', { class: 'btn small', href }, cta));
}

function heroArt() {
  return svg(`<svg viewBox="0 0 420 300" role="img" aria-label="A stream check and a well-being check side by side">
  <rect x="0" y="0" width="420" height="300" rx="16" fill="none"/>
  <g transform="translate(16 18)">
    <rect width="182" height="262" rx="16" fill="var(--surface)" stroke="var(--line)"/>
    <text x="16" y="30" style="font: 700 13px var(--font); fill: var(--muted)">STREAM</text>
    <text x="16" y="62" style="font: 800 30px var(--font); fill: var(--moderate)">Moderate</text>
    <text x="16" y="84" style="font: 13px var(--font); fill: var(--muted)">Vale das Flores · C3</text>
    ${bars([['Channel & banks', 0.55], ['Places for life', 0.72], ['Banks & margins', 0.6], ['Water & pressures', 0.78]], 16, 104)}
  </g>
  <g transform="translate(222 18)">
    <rect width="182" height="262" rx="16" fill="var(--surface)" stroke="var(--line)"/>
    <text x="16" y="30" style="font: 700 13px var(--font); fill: var(--muted)">YOU</text>
    <text x="16" y="62" style="font: 800 30px var(--font); fill: var(--good)">+0.75</text>
    <text x="16" y="84" style="font: 13px var(--font); fill: var(--muted)">Restored after 25 min</text>
    ${feel([['Joy', 2, 3], ['Calm', 2, 4], ['Irritation', 3, 2], ['Worry', 3, 2]], 16, 112)}
  </g>
</svg>`);
}

function bars(rows, x, y) {
  return rows.map(([l, v], i) => `<text x="${x}" y="${y + i * 38}" style="font: 12px var(--font); fill: var(--muted)">${l}</text><rect x="${x}" y="${y + 8 + i * 38}" width="150" height="9" rx="4.5" fill="var(--surface-2)"/><rect x="${x}" y="${y + 8 + i * 38}" width="${150 * v}" height="9" rx="4.5" fill="var(--brand)"/>`).join('');
}
function feel(rows, x, y) {
  const X = (v) => x + 70 + (v - 1) * 20;
  return rows.map(([l, b, a], i) => {
    const yy = y + i * 36;
    const better = l === 'Joy' || l === 'Calm' ? a > b : a < b;
    return `<text x="${x}" y="${yy + 4}" style="font: 12px var(--font); fill: var(--muted)">${l}</text><line x1="${X(b)}" x2="${X(a)}" y1="${yy}" y2="${yy}" stroke="${better ? 'var(--good)' : 'var(--poor)'}" stroke-width="4" stroke-linecap="round"/><circle cx="${X(b)}" cy="${yy}" r="5" fill="var(--surface)" stroke="var(--muted)" stroke-width="2"/><circle cx="${X(a)}" cy="${yy}" r="6" fill="${better ? 'var(--good)' : 'var(--poor)'}"/>`;
  }).join('');
}
