// Everything personal stays in this browser (localStorage), wrapped so the app
// still works when storage is blocked (private mode, previews).

const KEY = 'streamwell.v1';

const memory = { visits: [], settings: { includeDemo: true, consentResearch: false, consentOah: true }, who5: [], draft: null };

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...memory, ...JSON.parse(raw) } : { ...memory };
  } catch {
    return memory;
  }
}

function write(state) {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { Object.assign(memory, state); }
}

export const store = {
  get() { return read(); },
  visits() { return read().visits || []; },
  addVisit(v) {
    const s = read();
    s.visits = [...(s.visits || []).filter((x) => x.id !== v.id), v];
    s.draft = null;
    write(s);
  },
  deleteVisit(id) {
    const s = read();
    s.visits = (s.visits || []).filter((x) => x.id !== id);
    write(s);
  },
  settings() { return read().settings || memory.settings; },
  setSetting(k, v) {
    const s = read();
    s.settings = { ...(s.settings || {}), [k]: v };
    write(s);
  },
  draft() { return read().draft; },
  saveDraft(d) { const s = read(); s.draft = d; write(s); },
  clearDraft() { const s = read(); s.draft = null; write(s); },
  who5() { return read().who5 || []; },
  addWho5(entry) { const s = read(); s.who5 = [...(s.who5 || []), entry]; write(s); },
  reset() { try { window.localStorage.removeItem(KEY); } catch { /* ignore */ } },
};
