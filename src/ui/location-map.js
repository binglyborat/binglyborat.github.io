import { MAP_CONFIG } from '../config.js';
import { googleMapsURL } from '../core/maps.js';
import { e, button, externalLink } from './components.js';

const DAY = 86400000;
const CACHE_KEY = 'grad-tinder:map-cache:v1';
let leafletPromise;

// Wikipedia redirects handle most university names; these disambiguate catalog labels.
const TITLES = {
  'algant-consortium': null,
  'london-school-of-geometry-and-number-theory': 'University College London',
  'cuny-graduate-center': 'Graduate Center, CUNY',
  'new-york-university-courant-institute': 'Courant Institute of Mathematical Sciences',
  'university-of-bonn-bigs-mathematics-mpim': 'University of Bonn',
  'university-of-edinburgh-and-agq-cdt-with-glasgow-and-heriot-watt': 'University of Edinburgh',
  'university-of-vienna-vienna-school-of-mathematics': 'University of Vienna',
  'universite-paris-saclay-orsay-hadamard': 'Paris-Saclay University',
  'peking-university-school-of-mathematical-sciences-bicmr': 'Peking University',
  'tsinghua-university-mathematics-department-and-qiuzhen-college': 'Tsinghua University',
  'ecole-normale-superieure-psl-paris': 'École normale supérieure (Paris)',
  'ecole-polytechnique-federale-de-lausanne-epfl': 'École Polytechnique Fédérale de Lausanne',
  'technical-university-of-munich-tum': 'Technical University of Munich',
  'university-college-london-ucl': 'University College London',
  'university-of-amsterdam-uva': 'University of Amsterdam',
  'institute-of-science-and-technology-austria-ista': 'Institute of Science and Technology Austria',
  'sissa-international-school-for-advanced-studies-trieste': 'International School for Advanced Studies',
  'scuola-normale-superiore-di-pisa': 'Scuola Normale Superiore di Pisa',
  'sorbonne-universite': 'Sorbonne University',
  'universite-de-strasbourg': 'University of Strasbourg',
  'universite-de-montreal': 'Université de Montréal',
  'university-of-munster': 'University of Münster',
  'university-of-alabama-tuscaloosa': 'University of Alabama',
  'university-of-miami-florida': 'University of Miami',
  'university-of-michigan-ann-arbor': 'University of Michigan',
  'university-of-minnesota-twin-cities': 'University of Minnesota',
  'university-of-missouri-columbia': 'University of Missouri',
  'university-of-oklahoma-norman': 'University of Oklahoma',
  'university-of-washington-seattle': 'University of Washington',
  'university-of-tennessee-knoxville': 'University of Tennessee',
  'pennsylvania-state-university-university-park': 'Pennsylvania State University',
  'purdue-university-west-lafayette': 'Purdue University',
  'rutgers-university-new-brunswick': 'Rutgers University–New Brunswick',
  'binghamton-university-suny': 'Binghamton University',
  'stony-brook-university-suny': 'Stony Brook University',
  'university-at-buffalo-suny': 'University at Buffalo',
  'texas-a-m-university-college-station': 'Texas A&M University',
};

export function campusTitle(school) {
  const id=school.institutionId||school.id;
  return Object.hasOwn(TITLES,id)?TITLES[id]:school.institutionName||school.name;
}

const tokens = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) || [];
const validPoint = point => Number.isFinite(point?.lat) && Number.isFinite(point?.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

/** Reject search results for unrelated institutions instead of falling back to a city. */
export function coordinatesFromPages(data, title) {
  const connector = new Set(['the', 'of', 'at', 'in', 'and']);
  const kinds = new Set(['university', 'universite', 'universitat', 'college', 'institute', 'school', 'ecole', 'scuola']);
  const wantedWords = tokens(title).filter(word => !connector.has(word));
  const wanted = wantedWords.filter(word => !kinds.has(word));
  const pages = Object.values(data?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const page of pages) {
    const words = tokens(page.title).filter(word => !connector.has(word));
    const distinct = words.filter(word => !kinds.has(word));
    // "Oxford" alone is a city; "Boston University" is not Boston College.
    if (wantedWords.some(word => kinds.has(word) && !words.includes(word))) continue;
    if (!wanted.length || wanted.filter(word => words.includes(word)).length / wanted.length < 0.8
      || distinct.filter(word => wanted.includes(word)).length / distinct.length < 0.8) continue;
    const coordinate = page.coordinates?.find(point => !point.globe || point.globe === 'earth');
    const point = { lat: coordinate?.lat, lng: coordinate?.lon, title: page.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replaceAll(' ', '_'))}` };
    if (validPoint(point)) return point;
  }
  return null;
}

function readCache(key, maxAge) {
  try {
    const entry = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')[key];
    return entry && Date.now() - entry.saved < maxAge ? entry.value : null;
  } catch { return null; }
}

function writeCache(key, value) {
  try {
    const old = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entries = Object.entries(old && typeof old === 'object' ? old : {}).filter(([id]) => id !== key)
      .sort(([, a], [, b]) => (b?.saved || 0) - (a?.saved || 0)).slice(0, 39);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...Object.fromEntries(entries), [key]: { saved: Date.now(), value } }));
  } catch { /* Optional map cache must never interfere with application saves. */ }
}

async function fetchJSON(url, { signal, ...options } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timeout = setTimeout(cancel, 30000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`Map service returned ${response.status}.`);
    const data = await response.json();
    if (data.error) throw new Error('The location service could not complete the search.');
    return data;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

export async function resolveCampusCoordinates(school, signal) {
  const title = campusTitle(school);
  if (!title) throw new Error('This consortium has several campuses. Choose a partner campus using the Google Maps links.');
  const key = `campus:${school.id}`;
  const cached = readCache(key, 180 * DAY);
  if (validPoint(cached)) return cached;
  const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', redirects: '1',
    prop: 'coordinates', coprimary: 'primary', colimit: 'max', titles: title });
  let point = coordinatesFromPages(await fetchJSON(`${MAP_CONFIG.wikipediaAPI}?${params}`, { signal }), title);
  if (!point) {
    params.delete('titles');
    params.set('generator', 'search'); params.set('gsrsearch', title); params.set('gsrnamespace', '0'); params.set('gsrlimit', '5');
    point = coordinatesFromPages(await fetchJSON(`${MAP_CONFIG.wikipediaAPI}?${params}`, { signal }), title);
  }
  if (!point) throw new Error('A reliable university map point was not found. The Google Maps searches below are still available.');
  writeCache(key, point);
  return point;
}

function loadLeaflet() {
  if (globalThis.L?.map) return Promise.resolve(globalThis.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; css.crossOrigin = 'anonymous';
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; script.crossOrigin = 'anonymous';
    let loaded = 0, settled = false;
    const finish = error => {
      if (settled) return;
      if (!error && ++loaded < 2) return;
      settled = true; clearTimeout(timeout);
      css.onload = script.onload = css.onerror = script.onerror = null;
      if (error) { css.remove(); script.remove(); leafletPromise = null; reject(error); }
      else resolve(globalThis.L);
    };
    const timeout = setTimeout(() => finish(new Error('The map library did not load. Check your connection and retry.')), 20000);
    css.onload = script.onload = () => finish();
    css.onerror = script.onerror = () => finish(new Error('The map library could not load. Google Maps links remain available below.'));
    document.head.append(css, script);
  });
  return leafletPromise;
}

/** Public Google Maps URL; an API key is not required for Street View links.
 * https://developers.google.com/maps/documentation/urls/get-started */
export function streetViewURL(point) {
  if (!validPoint(point)) throw new Error('Street View needs valid campus coordinates.');
  const params = new URLSearchParams({ api: '1', map_action: 'pano', viewpoint: `${point.lat},${point.lng}` });
  return `https://www.google.com/maps/@?${params}`;
}

export function locationMap(school, state) {
  const opened = Array.isArray(state.ui.mapOpened) && state.ui.mapOpened.includes(school.id);
  return `<section class="map-section" data-location-map="${e(school.id)}" aria-label="Campus street map">
    <h3>Campus and surrounding streets</h3>
    <p class="map-help">Pan and zoom to explore the campus and its surroundings.</p>
    ${opened ? `<div class="map-status" data-map-status role="status" aria-live="polite">Loading map…</div>
      <div class="map-canvas" data-map-canvas aria-label="Interactive street map. Use arrow keys to pan and plus or minus to zoom."></div>
      <p class="map-tile-warning" data-map-tile-warning role="status" hidden>Map tiles could not load. You can open the campus in Google Maps below.</p>
      <div class="map-actions"><button type="button" class="button secondary small" data-map-recenter disabled>Back to campus</button><button type="button" class="button secondary small" data-map-retry hidden>Retry map</button></div>
      <p class="map-source" data-map-source></p>
      ${MAP_CONFIG.googleMapsEmbedKey ? '<details class="map-google"><summary>Google Maps view</summary><div data-map-google></div></details>' : ''}`
      : `<div class="map-load">${button('load-map', 'Load street map', 'secondary', `data-id="${e(school.id)}"`)}<p class="map-help">The map loads when you open it. Your saved school choices are never sent.</p></div>`}
    <div class="map-search-links" aria-label="Campus map links">${externalLink(googleMapsURL(school), 'Campus on Google Maps')}<span data-map-streetview></span></div>
  </section>`;
}

/** The callback persists state without rerendering the map; cleanup cancels requests and map events. */
export function mountLocationMap(host, school, state, onChange = () => {}) {
  if (!host) return () => {};
  let disposed = false, map, point, controller, observer;
  const canvas = host.querySelector('[data-map-canvas]');
  const status = host.querySelector('[data-map-status]');
  const retry = host.querySelector('[data-map-retry]');
  const recenter = host.querySelector('[data-map-recenter]');
  const saveView = () => {
    if (!map || disposed) return;
    const center = map.getCenter();
    state.ui.mapViews = { ...state.ui.mapViews, [school.id]: { lat: center.lat, lng: center.lng, zoom: map.getZoom() } };
    onChange();
  };
  const removeMap = () => {
    observer?.disconnect(); observer = null;
    if (map) { map.off('moveend', saveView); map.remove(); map = null; }
  };
  async function start() {
    controller?.abort(); removeMap();
    controller = new AbortController();
    const signal = controller.signal;
    status.textContent = 'Loading map…'; retry.hidden = true; recenter.disabled = true;
    canvas.hidden = false;
    host.querySelector('[data-map-tile-warning]').hidden = true;
    try {
      const [L, coordinates] = await Promise.all([loadLeaflet(), resolveCampusCoordinates(school, signal)]);
      if (disposed || signal.aborted) return;
      point = coordinates;
      const saved = state.ui.mapViews?.[school.id];
      const view = validPoint(saved) ? saved : { ...point, zoom: 14 };
      map = L.map(canvas, { preferCanvas: true, scrollWheelZoom: false, minZoom: 2, maxZoom: 19 }).setView([view.lat, view.lng], Math.max(2, Math.min(19, Number(view.zoom) || 14)));
      const tiles = L.tileLayer(MAP_CONFIG.tileURL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>' }).addTo(map);
      tiles.on('tileerror', () => { if (!disposed) host.querySelector('[data-map-tile-warning]').hidden = false; });
      L.circleMarker([point.lat, point.lng], { radius: 10, color: '#243b32', weight: 3, fillColor: '#fffefa', fillOpacity: 1 })
        .addTo(map).bindPopup(`<strong>${e(point.title)}</strong><p>University reference point; check the department building before planning a commute.</p>`);
      map.on('moveend', saveView);
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => map?.invalidateSize({ pan: false })); observer.observe(canvas); }
      recenter.disabled = false;
      host.querySelector('[data-map-source]').innerHTML = `Reference point: ${externalLink(point.url, point.title)}. ${school.id === 'london-school-of-geometry-and-number-theory' ? 'UCL is one of the consortium campuses. ' : ''}This may be the university centre rather than the mathematics building. Zoom controls and pinch gestures are available; scrolling continues down the page.`;
      host.querySelector('[data-map-streetview]').innerHTML = externalLink(streetViewURL(point), 'Street View near campus');
      status.textContent = 'Map ready. Pan and zoom to explore.';
    } catch (error) {
      if (disposed || signal.aborted) return;
      removeMap(); canvas.hidden = true;
      status.textContent = error.name === 'AbortError' ? 'The map request timed out. Retry or open the campus in Google Maps below.' : error.message;
      retry.hidden = false; retry.textContent = 'Retry map';
    }
  }
  const click = event => {
    if (event.target.closest('[data-map-retry]')) start();
    if (event.target.closest('[data-map-recenter]') && map && point) map.setView([point.lat, point.lng], 14);
  };
  const keydown = event => {
    // Map keyboard use must not trigger review shortcuts (save, pass, flag, undo).
    if (event.target.closest('[data-map-canvas]')) event.stopPropagation();
  };
  const google = host.querySelector('.map-google');
  const toggleGoogle = () => {
    if (!google.open || google.querySelector('iframe')) return;
    const frame = document.createElement('iframe');
    const params = new URLSearchParams({ key: MAP_CONFIG.googleMapsEmbedKey, q: `${school.institutionName||school.name}, ${school.city}, ${school.country}` });
    frame.src = `https://www.google.com/maps/embed/v1/place?${params}`;
    frame.title = `Google map of ${school.name}`; frame.loading = 'lazy'; frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.className = 'map-google-frame';
    host.querySelector('[data-map-google]').append(frame);
  };
  host.addEventListener('click', click); host.addEventListener('keydown', keydown);
  google?.addEventListener('toggle', toggleGoogle);
  if (canvas) start();
  return () => {
    disposed = true; controller?.abort(); removeMap();
    host.removeEventListener('click', click); host.removeEventListener('keydown', keydown);
    google?.removeEventListener('toggle', toggleGoogle);
  };
}
