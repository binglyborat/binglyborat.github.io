/** Browser-only, redundant persistence. No account or remote storage is involved. */
import {expandCountrySelections} from './geography.js';
export const STORAGE_KEY = 'math-match:state:v1';
export const BACKUP_KEY = 'math-match:backup:v1';
const DATABASE = 'math-match';
const safeKey = (key) => typeof key === 'string' && !['__proto__', 'prototype', 'constructor'].includes(key);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const strings = (value) => Array.isArray(value) ? [...new Set(value.filter((v) => typeof v === 'string'))] : [];
const clone = (value) => JSON.parse(JSON.stringify(value));

export const defaultPrefs = {
  knownPeople: [], areas: [], countries: [], cities: [], settings: [], sizes: [], degrees: [], programTypes: [], facultyQuery: '',
  excludedCities: [], excludeRural: false, connectionPeople: [], preferredMaxRank: 0,
  filterMaxRank: 0, filterIncludeUnranked: false,
  maxRank: 0, includeUnranked: true, weights: { research: 5, location: 3, faculty: 3, size: 1, ranking: 2, connections: 3 },
  areaMode: '1', query: '', excludedIds: [], requireAreas: false, requireFaculty: false,
  requiredAreas: [], requiredFacultyQuery: '',
  preferredCountries: [], preferredCities: [], preferredSizes: [],
  fundingQuery: '', internationalQuery: '', deadlineQuery: '', applicationQuery: '',
  details: ['department', 'research', 'faculty', 'funding', 'admissions', 'international', 'city', 'size','connections','committee'],
};

export function createDefaultState() {
  return {
    version: 1, revision: '', updatedAt: '', prefs: clone(defaultPrefs), records: {},
    fields: { selected: ['name', 'country', 'city', 'deadline', 'deadlineDetails', 'funding', 'decision', 'flagged', 'notes'], custom: [] },
    ui: { queueScope:'unreviewed',reviewFinished:false,peopleConnectedOnly:false,combinePeopleRecords:true,departmentNotesIntroduced:true,view: 'preferences', profileStep: 'home', filterStep: 'location', priorityStep: 'research', activeId: null, collectionFilter: 'saved', exportScope: 'saved' },
  };
}

export function normalizeState(raw) {
  if (!object(raw)) throw new Error('State must be an object.');
  if (raw.version != null && raw.version !== 1) throw new Error('This save uses an unsupported version. Keep a backup before updating the app.');
  const state = createDefaultState();
  state.revision = typeof raw.revision === 'string' ? raw.revision : '';
  state.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : '';
  // The pre-release `preferences` name is migrated without discarding choices.
  const prefs = object(raw.prefs) ? raw.prefs : object(raw.preferences) ? raw.preferences : {};
  for (const [key, fallback] of Object.entries(defaultPrefs)) {
    const value = prefs[key];
    if (Array.isArray(fallback)) state.prefs[key] = value === undefined ? [...fallback] : strings(value);
    else if (typeof fallback === 'boolean') state.prefs[key] = typeof value === 'boolean' ? value : fallback;
    else if (typeof fallback === 'string') state.prefs[key] = typeof value === 'string' ? value : fallback;
  }
  state.prefs.maxRank = Math.max(0, Math.min(10000, Number(prefs.maxRank) || 0));
  state.prefs.filterMaxRank = Math.max(0, Math.min(10000, Math.floor(Number(prefs.filterMaxRank) || 0)));
  state.prefs.preferredMaxRank = Math.max(0, Math.min(10000, Number(Object.hasOwn(prefs,'preferredMaxRank')?prefs.preferredMaxRank:prefs.maxRank) || 0));
  // Retired city inclusions become soft preferences once. Preserve the old keys
  // for backups, but never turn them into new exclusions or reapply them later.
  if (!Object.hasOwn(prefs,'excludedCities')) state.prefs.preferredCities = strings([...state.prefs.preferredCities,...state.prefs.cities]);
  state.prefs.countries = expandCountrySelections(state.prefs.countries);
  state.prefs.preferredCountries = expandCountrySelections(state.prefs.preferredCountries);
  // Convert the former separate rural veto into visible setting selections.
  if (state.prefs.excludeRural) {
    state.prefs.settings = (state.prefs.settings.length ? state.prefs.settings : ['City','College town','Suburban','Unknown']).filter(setting=>setting!=='Rural');
    state.prefs.excludeRural = false;
  }
  const areaMode = String(prefs.areaMode ?? '1').trim().toLowerCase();
  state.prefs.areaMode = areaMode === 'all' ? 'all' : String(Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(areaMode) || 1))));
  state.prefs.details = [...new Set(state.prefs.details.map(key=>key==='deadlines'?'admissions':key))];
  state.prefs.details = state.prefs.details.filter((key) => defaultPrefs.details.includes(key));
  if (!raw.ui?.departmentNotesIntroduced && Array.isArray(prefs.details) && state.prefs.details.length && !state.prefs.details.includes('department')) state.prefs.details.unshift('department');
  // Preserve existing required matches while separating them from soft priorities.
  if (!Object.hasOwn(prefs, 'requiredAreas') && prefs.requireAreas) state.prefs.requiredAreas = strings(prefs.areas);
  if (!Object.hasOwn(prefs, 'requiredFacultyQuery') && prefs.requireFaculty) state.prefs.requiredFacultyQuery = typeof prefs.facultyQuery === 'string' ? prefs.facultyQuery : '';
  for (const [key, fallback] of Object.entries(defaultPrefs.weights)) {
    const value = prefs.weights?.[key];
    state.prefs.weights[key] = Number.isFinite(Number(value)) && value != null ? Math.max(0, Math.min(10, Number(value))) : fallback;
  }
  if (object(raw.records)) {
    for (const [id, record] of Object.entries(raw.records)) {
      if (!safeKey(id) || !object(record)) continue;
      const custom = {};
      for (const [key, value] of Object.entries(object(record.custom) ? record.custom : {})) {
        if (safeKey(key) && ['string', 'number', 'boolean'].includes(typeof value)) custom[key] = value;
      }
      state.records[id] = {
        decision: ['saved', 'passed', 'unreviewed'].includes(record.decision) ? record.decision : 'unreviewed',
        flagged: record.flagged === true,
        notes: typeof record.notes === 'string' ? record.notes : '',
        applicationStatus: typeof record.applicationStatus === 'string' ? record.applicationStatus : '',
        custom,
      };
    }
  }
  if (object(raw.fields)) {
    if (Array.isArray(raw.fields.selected)) state.fields.selected = strings(raw.fields.selected);
    const seen = new Set();
    state.fields.custom = (Array.isArray(raw.fields.custom) ? raw.fields.custom : [])
      .filter((field) => object(field) && safeKey(field.id) && field.id && typeof field.label === 'string' && field.label.trim())
      .filter((field) => { if (seen.has(field.id)) return false; seen.add(field.id); return true; })
      .map((field) => ({ id: field.id, label: field.label.trim(), type: ['text', 'date', 'number', 'checkbox'].includes(field.type) ? field.type : 'text' }));
  }
  // UI keys may evolve independently; retain JSON-safe, own keys.
  if (object(raw.ui)) for (const [key, value] of Object.entries(raw.ui)) if (safeKey(key) && value !== undefined) state.ui[key] = clone(value);
  const ui = state.ui;
  if(ui.view==='report')ui.view='data';
  if(ui.schoolTab==='dossier')ui.schoolTab=state.prefs.details[0]||'notes';
  if (ui.schoolTab === 'deadlines') ui.schoolTab = 'admissions';
  if(!['discover','collection','preferences','export','report','data'].includes(ui.view))ui.view='preferences';
  if(Object.hasOwn(ui,'trackerStep')&&!['fields','columns','export'].includes(ui.trackerStep))ui.trackerStep='export';
  for (const [key, allowed] of Object.entries({profileStep:['home','schools','priorities','cards','people'],filterStep:['location','academic','requirements'],priorityStep:['research','location','people','ranking']})) {
    if (!allowed.includes(ui[key])) ui[key] = allowed[0];
  }
  for (const key of ['schoolTab','schoolPickerQuery','peopleQuery','connectionPeopleQuery']) if (Object.hasOwn(ui,key) && typeof ui[key] !== 'string') ui[key] = '';
  for (const [key, fallback] of Object.entries({ view: 'discover', collectionFilter: 'saved', exportScope: 'saved', queueScope: 'unreviewed', flagFilter: 'all', collectionQuery: '', reportQuery: '' })) {
    if (Object.hasOwn(ui, key) && typeof ui[key] !== 'string') ui[key] = fallback;
  }
  for (const key of ['activeId', 'detailId']) if (Object.hasOwn(ui, key) && typeof ui[key] !== 'string') ui[key] = null;
  if (Object.hasOwn(ui, 'reportPage')) ui.reportPage = Math.max(1, Math.floor(Number(ui.reportPage) || 1));
  if (Object.hasOwn(ui, 'openSections')) ui.openSections = strings(ui.openSections);
  if(Object.hasOwn(ui,'reviewTrail'))ui.reviewTrail=(Array.isArray(ui.reviewTrail)?ui.reviewTrail.filter(id=>typeof id==='string'):[]).slice(-1000);
  if(Object.hasOwn(ui,'reviewCursor'))ui.reviewCursor=Math.max(-1,Math.min((ui.reviewTrail?.length||0)-1,Math.floor(Number(ui.reviewCursor)||0)));
  if(Object.hasOwn(ui,'preferenceUndo'))ui.preferenceUndo=object(ui.preferenceUndo)?normalizeState({prefs:ui.preferenceUndo,ui:{departmentNotesIntroduced:true}}).prefs:null;
  if(Object.hasOwn(ui,'decisionUndo'))ui.decisionUndo=Object.fromEntries(Object.entries(object(ui.decisionUndo)?ui.decisionUndo:{}).filter(([id,decision])=>safeKey(id)&&['saved','passed','unreviewed'].includes(decision)));
  for (const key of ['expandedPanels', 'openPanels']) {
    if (!Object.hasOwn(ui, key)) continue;
    ui[key] = Object.fromEntries(Object.entries(object(ui[key]) ? ui[key] : {}).filter(([id, value]) => safeKey(id) && typeof value === 'boolean'));
  }
  if (Object.hasOwn(ui, 'history')) {
    ui.history = (Array.isArray(ui.history) ? ui.history : [])
      .filter((entry) => object(entry) && safeKey(entry.id) && object(entry.record))
      .slice(-30).map((entry) => ({ id: entry.id, activeId: typeof entry.activeId === 'string' ? entry.activeId : null,
        record: normalizeState({ records: { [entry.id]: entry.record } }).records[entry.id] }));
  }
  if(!ui.reviewTrail?.length && ui.history?.length){ui.reviewTrail=ui.history.map(entry=>entry.id);if(ui.activeId&&ui.reviewTrail.at(-1)!==ui.activeId)ui.reviewTrail.push(ui.activeId);ui.reviewCursor=ui.reviewTrail.length-1;}
  if(!['unreviewed','all','saved','passed','flagged'].includes(ui.queueScope))ui.queueScope='unreviewed';
  ui.reviewFinished=ui.reviewFinished===true;
  ui.peopleConnectedOnly=ui.peopleConnectedOnly===true;
  ui.combinePeopleRecords=ui.combinePeopleRecords!==false;
  ui.departmentNotesIntroduced=true;
  if(Object.hasOwn(ui,'mapOpened'))ui.mapOpened=strings(ui.mapOpened);
  return state;
}

export class StorageConflictError extends Error {
  constructor(externalState) {
    super('Another tab saved newer changes. Your current edits remain on this screen. Download a backup, then load the other tab’s changes.');
    this.name = 'StorageConflictError';
    this.externalState = externalState;
  }
}

function envelope(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed.schema !== 1 || !object(parsed.state) || parsed.state.version !== 1 || !parsed.state.prefs || !parsed.state.records || !Number.isFinite(parsed.savedAt) || typeof parsed.revision !== 'string') return null;
    return { ...parsed, state: normalizeState(parsed.state) };
  } catch { return null; }
}

function unsupported(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return value && (Number(value.schema) > 1 || Number(value.state?.version) > 1);
  } catch { return false; }
}

function openDatabase(factory) {
  return new Promise((resolve, reject) => {
    if (!factory) return reject(new Error('IndexedDB is unavailable.'));
    const request = factory.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database upgrade is blocked by another tab.'));
  });
}

function readDatabase(database) {
  return new Promise((resolve, reject) => {
    const request = database.transaction('snapshots').objectStore('snapshots').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeDatabase(database, next, expectedRevision, baseTime) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readwrite');
    const snapshots = transaction.objectStore('snapshots');
    const request = snapshots.get('current');
    let failure;
    request.onsuccess = () => {
      if (unsupported(request.result)) {
        failure = new Error('Saving is paused because stored data comes from a newer app version.');
        failure.name = 'StorageVersionError';
        transaction.abort();
        return;
      }
      const previous = envelope(request.result);
      if (previous && previous.revision !== expectedRevision && previous.savedAt >= baseTime) {
        failure = new StorageConflictError(previous.state);
        transaction.abort();
        return;
      }
      if (previous) snapshots.put(previous, 'previous');
      snapshots.put(next, 'current');
    };
    transaction.oncomplete = () => resolve(true);
    transaction.onabort = transaction.onerror = () => reject(failure ?? transaction.error ?? new Error('Could not save to IndexedDB.'));
  });
}

/**
 * `save` resolves after persistence; failures never silently replace the current form.
 * `reload` explicitly accepts the newest stored state. No automatic merge is attempted.
 * Dependencies are injectable so storage failures can be tested without a browser.
 */
export async function createStore(options = {}) {
  let local;
  try { local = 'storage' in options ? options.storage : globalThis.localStorage; } catch { local = null; }
  const factory = 'indexedDB' in options ? options.indexedDB : globalThis.indexedDB;
  const events = options.eventTarget ?? globalThis.window;
  const locks = options.locks ?? globalThis.navigator?.locks;
  const instance = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  let database;
  try { database = await openDatabase(factory); } catch { database = null; }
  let current = createDefaultState();
  let baseTime = 0;
  let status = { level: 'ready', message: 'Ready to save on this device.', local: false, indexedDB: Boolean(database), lastSaved: null };
  const subscribers = new Set();
  let queue = Promise.resolve();
  let closed = false;
  let readOnly = false;
  const notify = (next) => { status = { ...status, ...next }; options.onStatus?.({ ...status }); };
  const readLocal = (key) => { try { return envelope(local?.getItem(key)); } catch { return null; } };

  async function load() {
    const primary = readLocal(STORAGE_KEY);
    const backup = readLocal(BACKUP_KEY);
    let copies = [];
    try { if (database) copies = await readDatabase(database); } catch { /* local copies remain usable */ }
    let foreignLocal = false;
    try { foreignLocal = unsupported(local?.getItem(STORAGE_KEY)); } catch { /* may be blocked */ }
    readOnly = foreignLocal || copies.some(unsupported);
    const candidates = [primary, backup, ...copies.map(envelope)].filter(Boolean).sort((a, b) => b.savedAt - a.savedAt);
    const newest = candidates[0];
    current = newest ? newest.state : createDefaultState();
    baseTime = newest?.savedAt ?? 0;
    if (readOnly) notify({ level: 'error', message: 'A newer app version saved this data. Saving is paused to protect it; reopen with the updated app.' });
    else if (newest) notify({ level: primary?.revision === newest.revision ? 'saved' : 'warning', message: primary?.revision === newest.revision ? 'Saved on this device.' : 'Recovered your progress from a backup copy.', local: Boolean(primary), lastSaved: current.updatedAt });
    else if (!local && !database) notify({ level: 'error', message: 'Browser storage is unavailable. Download a backup before closing this page.' });
    return clone(current);
  }
  await load();

  const checkExternal = (other) => {
    if (other && other.revision !== current.revision && other.savedAt >= baseTime) {
      const error = new StorageConflictError(other.state);
      notify({ level: 'conflict', message: error.message });
      options.onExternalChange?.(clone(other.state));
      return error;
    }
    return null;
  };

  async function commit(snapshot) {
    if (closed) throw new Error('This storage connection is closed.');
    try { if (unsupported(local?.getItem(STORAGE_KEY))) readOnly = true; } catch { /* other backend can still save */ }
    if (readOnly) throw new Error('Saving is paused because stored data comes from a newer app version.');
    const conflict = checkExternal(readLocal(STORAGE_KEY));
    if (conflict) throw conflict;
    const savedAt = Math.max(Date.now(), baseTime + 1);
    snapshot.updatedAt = new Date(savedAt).toISOString();
    snapshot.revision = `${instance}:${savedAt}`;
    const next = { schema: 1, revision: snapshot.revision, savedAt, state: snapshot };
    let idbSaved = false;
    let localSaved = false;
    let backupSaved = false;
    if (database) {
      try { idbSaved = await writeDatabase(database, next, current.revision, baseTime); }
      catch (error) {
        if (error.name === 'StorageVersionError') {
          readOnly = true;
          notify({ level: 'error', message: error.message });
          throw error;
        }
        if (error instanceof StorageConflictError) {
          notify({ level: 'conflict', message: error.message });
          options.onExternalChange?.(clone(error.externalState));
          throw error;
        }
      }
    }
    try {
      if (local) {
        const previous = readLocal(STORAGE_KEY);
        // Preserve the current revision before replacing it, but a full backup must
        // not prevent the primary save if the browser is near its quota.
        try { local.setItem(BACKUP_KEY, JSON.stringify(previous ?? next)); backupSaved = true; } catch { /* try primary */ }
        local.setItem(STORAGE_KEY, JSON.stringify(next));
        localSaved = true;
      }
    } catch { /* IndexedDB may still have committed the complete state. */ }
    if (!localSaved && !idbSaved) {
      const error = new Error('Your changes are still on screen, but browser storage failed. Download a backup now before closing or reloading.');
      notify({ level: 'error', message: error.message, local: false, indexedDB: false });
      throw error;
    }
    current = snapshot;
    baseTime = savedAt;
    // A tiny cookie records save activity only. The complete data lives in the stores above.
    try { if (globalThis.document) document.cookie = `math_match_saved=${savedAt}; Max-Age=31536000; Path=/; SameSite=Lax`; } catch { /* cookies are optional */ }
    const redundant = idbSaved && localSaved;
    notify({ level: redundant ? 'saved' : 'warning', message: redundant ? 'Saved on this device · backup copy ready' : `Saved ${idbSaved ? 'in the browser database' : 'on this device'}${backupSaved ? ' with a previous copy' : ''}. Download a backup for extra protection.`, local: localSaved, indexedDB: idbSaved, lastSaved: snapshot.updatedAt });
    subscribers.forEach((fn) => fn(clone(current)));
    return clone(current);
  }

  const listener = (event) => { if (event.key === STORAGE_KEY && event.newValue) checkExternal(envelope(event.newValue)); };
  events?.addEventListener?.('storage', listener);
  return {
    get state() { return clone(current); },
    getStatus: () => ({ ...status }),
    save(next) {
      const snapshot = normalizeState(next);
      const work = () => locks?.request ? locks.request('math-match-save', () => commit(snapshot)) : commit(snapshot);
      const result = queue.then(work);
      queue = result.catch(() => {});
      return result;
    },
    async reload() { await queue; return load(); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    async requestPersistence() {
      try { return Boolean(await globalThis.navigator?.storage?.persist?.()); } catch { return false; }
    },
    close() { closed = true; events?.removeEventListener?.('storage', listener); database?.close(); subscribers.clear(); },
  };
}
