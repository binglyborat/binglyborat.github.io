export const escapeHTML = (value = '') => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const e = escapeHTML;
export const safeURL = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? e(u.href) : '#'; } catch { return '#'; } };
const paths = {
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  discover:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  flag:'<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  sliders:'<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  book:'<path d="M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>',
  shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  undo:'<path d="M3 10h12a6 6 0 0 1 0 12M3 10l5-5m-5 5 5 5"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
};
export const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
export const button = (action,label,kind='secondary',extra='') => `<button class="button ${kind}" data-action="${action}" ${extra}>${label}</button>`;
export const externalLink = (url,label) => `<a href="${safeURL(url)}" target="_blank" rel="noopener noreferrer">${e(label)} ${icon('external')}</a>`;
export const recordFor = (state,id) => state.records[id] || {decision:'unreviewed',flagged:false,notes:'',applicationStatus:'Not started',custom:{}};
export const pageHeading = (eyebrow,title,description,action='') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1 class="page-title">${title}</h1><p class="page-description">${description}</p></div>${action}</div>`;
export const tag = (text, accent=false) => `<span class="tag${accent?' accent':''}">${e(text)}</span>`;
export const fieldLabel = (label,control,description='') => `<label class="field-label">${e(label)}${control}${description?`<small class="muted">${e(description)}</small>`:''}</label>`;
export const options = (values,selected) => values.map(v => {const [value,label]=Array.isArray(v)?v:[v,v];return `<option value="${e(value)}" ${String(value)===String(selected)?'selected':''}>${e(label)}</option>`;}).join('');
export function checkGroup(key,values,selected=[]) {
  return `<div class="check-grid">${values.map(v=>`<label class="check-option"><input type="checkbox" data-pref-array="${e(key)}" value="${e(v)}" ${selected.includes(v)?'checked':''}><span>${e(v)}</span></label>`).join('')}</div>`;
}
export const textBlock = text => `<p class="prose">${e(text || 'Not established in the source. Check the program’s current official information.').replaceAll('\n','<br>')}</p>`;
