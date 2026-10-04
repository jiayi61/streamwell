// Line pictograms drawn for StreamWell (48x48, stroke = currentColor).
const s = (body, vb = '0 0 48 48') => `<svg class="ic" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  logo: `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="swg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d6e86"/><stop offset="1" stop-color="#1f9d7a"/></linearGradient></defs><circle cx="24" cy="24" r="22" fill="url(#swg)"/><path d="M8 27c4-3 8-3 12 0s8 3 12 0 6-2 8-1" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M10 34c4-3 8-3 12 0s8 3 12 0" stroke="#bff0e6" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M24 20c-3-4-9-2-7 3 1 3 7 6 7 6s6-3 7-6c2-5-4-7-7-3z" fill="#fff"/></svg>`,
  flowFast: s('<path d="M6 16c5-4 9 4 14 0s9 4 14 0 6-2 8-1"/><path d="M6 26c5-4 9 4 14 0s9 4 14 0 6-2 8-1"/><path d="M6 36c5-4 9 4 14 0s9 4 14 0 6-2 8-1"/><path d="M38 11l4 4-4 4"/>'),
  flowSlow: s('<path d="M6 20c6-3 12 3 18 0s12 3 18 0"/><path d="M6 30c6-3 12 3 18 0s12 3 18 0"/>'),
  flowStill: s('<path d="M6 22h36"/><path d="M10 30h28"/><circle cx="34" cy="14" r="3"/>'),
  flowDry: s('<path d="M4 30h40"/><path d="M14 30l4 6-3 6"/><path d="M28 30l-3 5 5 4"/><path d="M38 30l2 5"/><circle cx="34" cy="14" r="5"/>'),
  formFlat: s('<path d="M4 16l6 0 4 10h20l4-10h6"/><path d="M15 23h18" stroke-dasharray="3 3"/>'),
  formU: s('<path d="M8 12v10c0 10 7 16 16 16s16-6 16-16V12"/><path d="M12 28h24" stroke-dasharray="3 3"/>'),
  formV: s('<path d="M6 10l18 28 18-28"/><path d="M15 24h18" stroke-dasharray="3 3"/>'),
  bedNatural: s('<path d="M4 34h40"/><ellipse cx="13" cy="29" rx="5" ry="3.5"/><ellipse cx="26" cy="30" rx="6" ry="3"/><ellipse cx="37" cy="29" rx="4" ry="3"/><path d="M6 18c6-3 10 3 16 0s10 3 16 0"/>'),
  bedConcrete: s('<rect x="4" y="26" width="40" height="12" rx="1"/><path d="M4 32h40M14 26v6M28 26v6M21 32v6M36 32v6"/><path d="M6 16c6-3 10 3 16 0s10 3 16 0"/>'),
  bankNatural: s('<path d="M4 38c8-2 12-14 22-16s14 6 18 6"/><path d="M12 31l-1-6M16 28l1-6M20 25l-2-6M30 23l1-6"/>'),
  bankStones: s('<path d="M6 40h36"/><rect x="8" y="32" width="10" height="8" rx="3"/><rect x="18" y="32" width="10" height="8" rx="3"/><rect x="28" y="32" width="10" height="8" rx="3"/><rect x="12" y="24" width="10" height="8" rx="3"/><rect x="22" y="24" width="10" height="8" rx="3"/><rect x="17" y="16" width="10" height="8" rx="3"/>'),
  bankConcrete: s('<path d="M8 40V12h14v28"/><path d="M8 20h14M8 28h14M15 12v8M15 28v12"/><path d="M26 34c4-2 7 2 11 0s5 0 7 1"/>'),
  habSandBank: s('<path d="M4 30c6-3 12 3 18 0s12 3 18 0"/><path d="M4 22c10 0 14-6 22-6"/><path d="M8 20l2 1M14 18l2 1M20 17l2 1" stroke-width="2"/>'),
  habIsland: s('<path d="M4 30c6-3 12 3 18 0s12 3 18 0"/><path d="M14 26c3-6 17-6 20 0"/><path d="M20 22l1 1M26 21l1 1" stroke-width="2"/>'),
  habStones: s('<path d="M4 36c6-3 12 3 18 0s12 3 18 0"/><ellipse cx="14" cy="27" rx="7" ry="5"/><ellipse cx="30" cy="25" rx="8" ry="6"/><ellipse cx="22" cy="18" rx="5" ry="4"/>'),
  habRiffle: s('<ellipse cx="14" cy="32" rx="6" ry="4"/><ellipse cx="32" cy="33" rx="7" ry="4"/><path d="M4 22c4-4 8 4 12 0s8 4 12 0 8 4 12 0"/><path d="M8 14c4-4 8 4 12 0s8 4 12 0"/>'),
  habPlants: s('<path d="M4 32c6-3 12 3 18 0s12 3 18 0"/><path d="M16 32c0-8-4-12-6-16"/><path d="M16 32c0-6 4-10 8-12"/><path d="M30 32c0-10 2-14 6-18"/><path d="M30 32c-1-5-4-8-7-9"/>'),
  bioTree: s('<path d="M4 36h40"/><rect x="8" y="26" width="30" height="8" rx="4"/><circle cx="38" cy="30" r="4"/><path d="M16 26l-3-6M24 26l2-7"/>'),
  bioBranch: s('<path d="M6 34l34-10"/><path d="M18 31l-4-8M28 28l2-8M34 26l6-4"/>'),
  bioLeaves: s('<path d="M12 32c0-8 8-12 14-10-1 7-7 12-14 10z"/><path d="M12 32l9-7"/><path d="M26 36c2-7 9-9 14-6-3 6-9 8-14 6z"/><path d="M26 36l8-5"/>'),
  vegHerbs: s('<path d="M6 38h36"/><path d="M12 38c0-6-2-9-4-12M12 38c0-5 2-8 5-10M24 38c0-7-2-10-5-13M24 38c0-6 3-9 6-11M36 38c0-6-2-9-4-11M36 38c0-5 2-8 5-10"/>'),
  vegShrubs: s('<path d="M6 38h36"/><path d="M10 38c-3-9 5-15 10-11 3-6 13-4 13 3 6-1 9 5 6 8"/><path d="M24 38v-6"/>'),
  vegTrees: s('<path d="M6 40h36"/><path d="M16 40V28"/><circle cx="16" cy="20" r="9"/><path d="M33 40V24"/><path d="M33 8l-8 14h16z"/><path d="M33 14l-9 15h18z"/>'),
  pin: s('<path d="M24 42s14-12 14-23a14 14 0 1 0-28 0c0 11 14 23 14 23z"/><circle cx="24" cy="19" r="5"/>'),
  check: s('<path d="M10 25l9 9 19-20"/>'),
  alert: s('<path d="M24 6l20 36H4z"/><path d="M24 19v10M24 35v1"/>'),
  info: s('<circle cx="24" cy="24" r="19"/><path d="M24 22v12M24 15v1"/>'),
  heart: s('<path d="M24 40S7 30 7 18a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 12-17 22-17 22z"/>'),
  leaf: s('<path d="M10 38C8 20 22 8 40 8c0 18-12 32-30 30z"/><path d="M10 38l16-16"/>'),
  paw: s('<ellipse cx="24" cy="31" rx="8" ry="7"/><circle cx="13" cy="21" r="4"/><circle cx="20" cy="13" r="4"/><circle cx="29" cy="13" r="4"/><circle cx="36" cy="21" r="4"/>'),
  person: s('<circle cx="24" cy="14" r="7"/><path d="M10 42c0-9 6-15 14-15s14 6 14 15"/>'),
  download: s('<path d="M24 8v22M15 21l9 9 9-9M8 38h32"/>'),
  camera: s('<rect x="5" y="14" width="38" height="26" rx="4"/><path d="M17 14l3-5h8l3 5"/><circle cx="24" cy="27" r="7"/>'),
  locate: s('<circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="3"/><path d="M24 4v8M24 36v8M4 24h8M36 24h8"/>'),
  left: s('<path d="M28 10L14 24l14 14"/>'),
  right: s('<path d="M20 10l14 14-14 14"/>'),
  flask: s('<path d="M18 6h12M20 6v12L9 38a3 3 0 0 0 3 4h24a3 3 0 0 0 3-4L28 18V6"/><path d="M14 30h20"/>'),
  users: s('<circle cx="17" cy="16" r="6"/><circle cx="33" cy="18" r="5"/><path d="M5 40c0-8 5-13 12-13s12 5 12 13"/><path d="M29 28c7 0 13 4 13 12"/>'),
  share: s('<circle cx="35" cy="12" r="5"/><circle cx="13" cy="24" r="5"/><circle cx="35" cy="36" r="5"/><path d="M17 22l13-7M17 26l13 7"/>'),
  rain: s('<path d="M14 30a9 9 0 1 1 3-17 11 11 0 0 1 21 5 7 7 0 0 1-2 14H14z"/><path d="M16 36l-2 5M24 36l-2 5M32 36l-2 5"/>'),
  sun: s('<circle cx="24" cy="24" r="8"/><path d="M24 4v5M24 39v5M4 24h5M39 24h5M10 10l3 3M35 35l3 3M38 10l-3 3M13 35l-3 3"/>'),
  stethoscope: s('<path d="M12 6v12a8 8 0 0 0 16 0V6"/><path d="M20 26v4a10 10 0 0 0 20 0v-4"/><circle cx="40" cy="22" r="4"/>'),
  shield: s('<path d="M24 5l16 6v11c0 10-7 18-16 21C15 40 8 32 8 22V11z"/><path d="M17 24l5 5 9-10"/>'),
};

export function icon(name, cls = '') {
  const markup = ICONS[name] || '';
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const el = t.content.firstElementChild;
  if (el && cls) el.setAttribute('class', `${el.getAttribute('class') || ''} ${cls}`.trim());
  return el || document.createTextNode('');
}
