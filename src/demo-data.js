// Decoder for the SYNTHETIC pilot dataset (data/demo-visits.json, made by
// scripts/simulate.py). Rows are compact; this turns them into the same visit
// objects the app stores for real visits.

import { UNSURE } from './protocol.js';
import { TAGS, TRAVEL } from './wellbeing.js';

const B32 = '0123456789abcdefghijklmnopqrstuv';
const HAB = [['SB', 1], ['SI', 2], ['SD', 4], ['RF', 8], ['AV', 16]];
const BIO = [['FT', 1], ['FB', 2], ['FL', 4]];

const pick = (map) => (ch) => (ch === '?' ? UNSURE : map[ch]);
const flow = pick({ F: 'FAS', N: 'NOR', S: 'STA', D: 'DRY' });
const colour = pick({ C: 'CL', M: 'MU', F: 'FO', O: 'CO' });
const form = pick({ F: 'FLAT', U: 'U', V: 'V' });
const bed = pick({ N: 'NAT', A: 'ART' });
const banks = pick({ N: 'NAT', L: 'LAS', A: 'ART' });
const veg = pick({ H: 'H', B: 'B', T: 'T' });
const yn = (ch) => (ch === '?' ? UNSURE : ch === 'Y');
const rating = { G: 'GOOD', M: 'MODERATE', P: 'POOR' };

export function decodeAnswers(s) {
  const habMask = B32.indexOf(s[5]);
  const bioMask = Number(s[6]);
  return {
    waterFlow: flow(s[0]),
    waterColor: colour(s[1]),
    channelForm: form(s[2]),
    bottomChannelType: bed(s[3]),
    banksChannelType: banks(s[4]),
    habitats: HAB.filter(([, b]) => habMask & b).map(([c]) => c),
    fallenBiomassTypes: BIO.filter(([, b]) => bioMask & b).map(([c]) => c),
    imperviousAreas: { left: yn(s[7]), right: yn(s[8]) },
    isVegetationCovered: { left: yn(s[9]), right: yn(s[10]) },
    vegetationType: { left: veg(s[11]), right: veg(s[12]) },
    hasInvasivePlantSpecies: yn(s[13]),
    recentVegetationCuts: yn(s[14]),
    waterAbstraction: yn(s[15]),
    hasDams: yn(s[16]),
    numberOfDams: s[16] === 'Y' ? 1 : undefined,
    pipes: yn(s[17]),
    waterDischarge: yn(s[18]),
    construction: yn(s[19]),
    overallAssessment: rating[s[20]],
  };
}

const feelings = (s) => ({ joy: +s[0], serenity: +s[1], anger: +s[2], fear: +s[3] });

export function decodeDataset(json, sitesByCode) {
  const start = new Date(`${json.meta.start}T12:00:00Z`);
  const visits = json.rows.map((r, i) => {
    const [person, site, day, answers, before, after, tags, minutes, travel, rain48, tmax3] = r;
    const d = new Date(start.getTime() + day * 86400000);
    const s = sitesByCode[site];
    return {
      id: `demo-${i}`,
      person: `p${person}`,
      site,
      city: s ? s.city : null,
      date: d.toISOString().slice(0, 10),
      lat: s ? s.lat : null,
      lon: s ? s.lon : null,
      answers: decodeAnswers(answers),
      before: feelings(before),
      after: feelings(after),
      tags: TAGS.filter((t, k) => tags & (1 << k)).map((t) => t.id),
      minutes,
      travel: TRAVEL[travel] ? TRAVEL[travel].id : null,
      weather: { rain48, tmax3, source: 'simulated' },
      synthetic: true,
    };
  });
  return { meta: json.meta, visits, demoPerson: `p${json.meta.demoPerson}` };
}
