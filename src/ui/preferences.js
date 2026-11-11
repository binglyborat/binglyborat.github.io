import { e, icon, button, checkGroup, fieldLabel } from './components.js';
import {peopleProfile,networkLoadState,connectionLoadNotice} from './connections.js';
import {networkForState} from '../data/network.js';
import {availablePriorities} from '../core/profile.js';
import { filterSchools } from '../core/matching.js';
import {countryOptions,countryRegions} from '../core/geography.js';

export const DETAILS = [
  ['department', 'Department notes'], ['research', 'Research areas'], ['faculty', 'Professors'], ['funding', 'Funding & fees'],
  ['admissions', 'Applying & deadlines'], ['international', 'International students'], ['city', 'City & campus'],
  ['size', 'School & department size'], ['connections', 'My connections'], ['committee', 'Graduate committee'],
];

const detailDescriptions = {
  department: 'A readable department summary: mathematical strengths, research groups, and program character.',
  connections: 'Coauthors, PhD advisers, and former students of the professors you selected.',
  committee: 'Published graduate admissions roles, committee lists, and their dates.',
  research: 'Mathematical areas, research fit, and documented rankings.',
  faculty: 'Potential advisers, their interests, and research evidence.',
  funding: 'Stipends, tuition support, application fees, and conditions.',
  admissions: 'Deadlines, eligibility, application materials, and preparation.',
  international: 'English requirements, exemptions, and international eligibility.',
  city: 'Location, campus setting, and what still needs researching.',
  size: 'University enrollment and available department-size information.',
};
const profileSections = [
  ['people', 'People I know', 'Select people to find their professional connections at each school.', 'people'],
  ['schools', 'School filters', 'Choose which schools appear in review.', 'pin'],
  ['priorities', 'Matching preferences', 'Set the criteria used to sort schools.', 'heart'],
  ['cards', 'Card information', 'Select and order the information on each card.', 'book'],
];
const schoolSteps = [['location', 'Locations'], ['academic', 'Programs'], ['requirements', 'Applications']];
const prioritySteps = [['research', 'Math interests'], ['location', 'Location & size'], ['ranking', 'Ranking'], ['people', 'Professor connections']];
const unique = values => [...new Set(values.filter(Boolean))].sort();
const selectedLabel = (values, fallback) => values.length ? values.length > 2 ? `${values.slice(0, 2).join(', ')} +${values.length - 2}` : values.join(', ') : fallback;
const stepButton = (step, label, kind = 'secondary') => button('profile-step', label, kind, `data-step="${step}"`);

function subnav(steps, selected, action, label) {
  return `<nav class="profile-subnav" aria-label="${label}">${steps.map(([id, title]) => button(action, e(title), `profile-step-button${id === selected ? ' is-active' : ''}`, `data-step="${id}" ${id === selected ? 'aria-current="step"' : ''}`)).join('')}</nav>`;
}
function choiceGroup(title, key, values, selected, description = '', available = null) {
  return `<section class="profile-form-section"><div class="panel-header"><h2>${e(title)}</h2>${selected.length ? button('clear-pref', 'Clear', 'ghost small', `data-key="${key}"`) : '<span class="muted">Any</span>'}</div>${description ? `<p class="muted">${e(description)}</p>` : ''}${available ? `<div class="check-grid">${values.map(value=>`<label class="check-option ${available.has(value)?'':'is-unavailable'}"><input type="checkbox" data-pref-array="${key}" value="${e(value)}" ${selected.includes(value)?'checked':''} ${available.has(value)?'':'disabled'}><span>${e(value)}${available.has(value)?'':`<small>Excluded by your school filters${selected.includes(value)?' · saved but inactive':''}</small>`}</span></label>`).join('')}</div>` : checkGroup(key, values, selected)}</section>`;
}
function chips(key, values, available = null) {
  return `<div class="chip-row">${values.map(value => button('remove-pref', `${e(value)}${available&&!available.has(value)?' · inactive':''} ×`, `ghost small${available&&!available.has(value)?' inactive-chip':''}`, `data-key="${key}" data-value="${e(value)}" aria-label="Remove ${e(value)}"`)).join('')}</div>`;
}
function addChoice(label, key, values, selected, placeholder, available = null) {
  return `${fieldLabel(label, `<select class="select" data-add-pref="${key}"><option value="">${e(placeholder)}</option>${values.filter(value=>!selected.includes(value)).map(value=>`<option value="${e(value)}" ${available&&!available.has(value)?'disabled':''}>${e(value)}${available&&!available.has(value)?' — excluded by filters':''}</option>`).join('')}</select>`)}${chips(key, selected, available)}${available&&selected.some(value=>!available.has(value))?'<p class="muted">Some saved preferences are excluded by school filters and inactive. They become available again when those filters change.</p>':''}`;
}
function weight(key, label, value) {
  return `<label class="range-row"><span>${e(label)}</span><output id="weight-${key}">${value}</output><input type="range" min="0" max="10" step="1" data-weight="${key}" value="${value}" aria-label="${e(label)} importance"><small class="muted">0 · Ignore</small><small class="muted">10 · Very important</small></label>`;
}
function frame(step, title, description, content, footer) {
  return `<div class="profile-page"><div class="profile-step-header">${stepButton('home', `${icon('back')} My profile`, 'ghost small')}<span class="profile-note">Changes save automatically</span></div><header class="profile-heading"><p class="eyebrow">${e(profileSections.find(section => section[0] === step)?.[1] || 'My profile')}</p><h1 class="page-title">${e(title)}</h1><p class="page-description">${e(description)}</p></header>${content}<footer class="profile-footer">${stepButton('home', 'Back to my profile', 'ghost')}${footer}</footer></div>`;
}

function hub(state, catalog) {
  const p = state.prefs;
  const matches = filterSchools(catalog, p).length;
  const summaries = {
    people: `${networkLoadState(networkForState(state),p.knownPeople).ids.length} people selected`,
    schools: `${selectedLabel(p.countries, 'All countries')} · ${selectedLabel(p.degrees, 'Any degree')}`,
    priorities: p.areas.length ? selectedLabel(p.areas, '') : 'No research preferences selected',
    cards: p.details.length ? `${p.details.length} topics selected` : 'No optional topics selected',
  };
  return `<div class="profile-page"><header class="profile-heading"><p class="eyebrow">SETTINGS</p><h1 class="page-title">My profile</h1><p class="page-description">Configure school filters, sorting preferences, and card information separately.</p></header><div class="profile-hub">${profileSections.map(([id, title, description, glyph], index) => `<button class="profile-choice" data-action="profile-step" data-step="${id}"><span class="profile-choice-icon">${icon(glyph)}</span><span class="eyebrow">0${index + 1}</span><span class="profile-choice-title">${title}</span><span class="profile-choice-description">${description}</span><span class="profile-summary">${e(summaries[id])}</span><span class="profile-choice-link">Edit ${icon('arrow')}</span></button>`).join('')}</div><div class="profile-ready"><div><h2>${matches ? `${matches} matching schools` : 'No matching schools'}</h2><p class="muted">${matches ? 'Your settings save automatically and can be changed later.' : 'Change or clear some filters to include more schools.'}</p></div>${button('start-discover', `Review schools ${icon('arrow')}`, 'primary')}</div><div class="profile-resources">${button('reset-profile','Reset profile settings','ghost small')}${state.ui.preferenceUndo?button('undo-preferences','Undo last settings reset','secondary small'):''}${button('navigate', `${icon('shield')} Backups & storage`, 'ghost small', 'data-view="data"')}</div></div>`;
}

function locationFilters(state, catalog) {
  const p = state.prefs;
  const regions=countryRegions(catalog);
  return `<section class="profile-form-section"><div class="panel-header"><h2>Countries</h2>${p.countries.length?button('clear-pref','Clear','ghost small','data-key="countries"'):'<span class="muted">All countries</span>'}</div><p class="muted">Choose individual countries. A program offered in several countries matches any of its listed countries. Leave all unchecked to include every country.</p><div class="country-regions">${regions.map(region=>`<section class="country-region"><h3>${e(region.label)}</h3>${checkGroup('countries',region.countries,p.countries)}</section>`).join('')}</div></section>
  ${choiceGroup('Campus setting','settings',unique([...catalog.map(school=>school.setting),'Rural']),p.settings,'Leave all unchecked to include every setting. Select settings to include only those settings.').replace('class="check-grid"','class="check-grid campus-settings-grid"')}
  <details class="profile-form-section"><summary>Exclude particular cities${p.excludedCities?.length?` (${p.excludedCities.length})`:''}</summary><p class="muted">Only add cities you want to rule out. Cities you like belong in Matching preferences.</p>${addChoice('Excluded cities','excludedCities',unique(catalog.map(school=>school.city).filter(city=>city!=='Unknown')),p.excludedCities||[],'Exclude a city…')}</details>`;
}
function academicFilters(state, catalog) {
  const p = state.prefs;
  const requiredAreas = p.requiredAreas || (p.requireAreas ? p.areas : []);
  return `${choiceGroup('Degree', 'degrees', unique(catalog.flatMap(school => school.degree || [])), p.degrees)}${choiceGroup('Program type', 'programTypes', unique(catalog.map(school => school.programType).filter(Boolean)), p.programTypes || [], 'Choose specific degrees or department overviews. Separate programs at one university have separate saved decisions.')}${choiceGroup('University size', 'sizes', ['Small', 'Medium', 'Large', 'Unknown'], p.sizes, 'This is total university enrollment. Small: under 10,000; medium: 10,000–24,999; large: 25,000+. Counts include their source year and campus scope on school cards. Consortia without a comparable total remain unknown.')}<details class="profile-form-section"><summary>Required research areas</summary><p class="muted">These requirements exclude schools without a documented area match. Research interests in Matching preferences only affect their order.</p>${checkGroup('requiredAreas', unique(catalog.flatMap(school => school.areas)), requiredAreas)}${requiredAreas.length ? fieldLabel('Schools must cover', `<input class="input" data-pref="areaMode" value="${e(p.areaMode==='any'?'1':p.areaMode)}" list="area-coverage-options" pattern="[1-9][0-9]*|[Aa][Ll][Ll]" placeholder="A number or all" aria-describedby="area-coverage-help"><datalist id="area-coverage-options"><option value="all"></option></datalist><small id="area-coverage-help" class="muted">At least this many selected areas, or all (${requiredAreas.length}).</small>`) : ''}</details>${rankingFilter(state)}`;
}
function applicationFilters(state) {
  const p = state.prefs;
  return `<section class="profile-form-section"><h2>Policy text filters</h2><p class="muted">Search for exact text in program summaries. Leave a field blank to ignore it.</p><div class="profile-note">A phrase can appear in an exception or restriction. Read the full policy before relying on a match.</div>${[['fundingQuery', 'Funding contains', 'e.g. tuition'], ['internationalQuery', 'International policy contains', 'e.g. English'], ['deadlineQuery', 'Deadline rules contain', 'e.g. December'], ['applicationQuery', 'Application or GRE policy contains', 'e.g. not required']].map(([key, label, placeholder]) => fieldLabel(label, `<input class="input" data-pref="${key}" value="${e(p[key] || '')}" placeholder="${placeholder}">`)).join('')}</section>`;
}
/** A single filter screen, retained as an export for integrations. */
export function filters(state, catalog) {
  const step = schoolSteps.some(([id]) => id === state.ui.filterStep) ? state.ui.filterStep : 'location';
  return ({location: locationFilters, academic: academicFilters, requirements: applicationFilters})[step](state, catalog);
}
function schoolsView(state, catalog) {
  const step = schoolSteps.some(([id]) => id === state.ui.filterStep) ? state.ui.filterStep : 'location';
  const next = schoolSteps[schoolSteps.findIndex(([id]) => id === step) + 1];
  const matches = filterSchools(catalog, state.prefs).length;
  return frame('schools', 'School filters', 'Choose which schools appear in review. These settings do not change the information shown on cards.', `${subnav(schoolSteps, step, 'filter-step', 'School filter categories')}<section class="panel profile-form">${filters(state, catalog)}</section><div class="profile-filter-summary"><p class="muted">${matches} schools match these filters.</p>${button('reset-filters', 'Clear school filters', 'ghost small')}</div>`, next ? button('filter-step', `Next: ${next[1]} ${icon('arrow')}`, 'primary', `data-step="${next[0]}"`) : stepButton('home', `Done ${icon('check')}`, 'primary'));
}

function researchPriorities(state, catalog) {
  return `${choiceGroup('Research interests', 'areas', unique(catalog.flatMap(school => school.areas)), state.prefs.areas, 'Schools with documented matches to these areas appear earlier in review.', availablePriorities(catalog,state.prefs).areas)}<section class="profile-form-section"><h2>Research importance</h2>${weight('research', 'Research fit', state.prefs.weights.research)}<p class="muted">Choose as many interests as you like.</p></section>`;
}
function locationPriorities(state, catalog) {
  const p = state.prefs, available=availablePriorities(catalog,p);
  return `<section class="profile-form-section"><h2>Preferred locations</h2><p class="muted">These preferences change school order without excluding other locations.</p>${addChoice('Preferred countries', 'preferredCountries', countryOptions(catalog), p.preferredCountries, 'Add a country…',available.preferredCountries)}${addChoice('Preferred cities', 'preferredCities', unique(catalog.map(school => school.city).filter(city => city !== 'Unknown')), p.preferredCities || [], 'Add a city…',available.preferredCities)}${weight('location', 'Location preference', p.weights.location)}</section>${choiceGroup('Preferred university size', 'preferredSizes', ['Small', 'Medium', 'Large'], p.preferredSizes, 'Options excluded by school filters are inactive.',available.preferredSizes)}${weight('size', 'University size', p.weights.size)}`;
}
function rankingFilter(state) {
  const p=state.prefs;
  return `<section class="profile-form-section"><h2>Ranking filter</h2>${fieldLabel('Only show documented ranks up to',`<input class="input" type="number" min="1" max="10000" step="1" data-pref="filterMaxRank" value="${p.filterMaxRank||''}" placeholder="No rank limit">`,'Leave blank for no limit. Uses U.S. News graduate mathematics ranks (United States); years appear on each card. Global rankings remain separate.')}<label class="check-option"><input type="checkbox" data-pref="filterIncludeUnranked" ${p.filterIncludeUnranked?'checked':''}><span>Also include schools without a numeric rank</span></label></section>`;
}
function rankingPriorities(state) {
  const p=state.prefs;
  return `<section class="profile-form-section"><h2>Ranking preference</h2><p class="muted">Favor a rank range when sorting. Use the filter below to exclude schools.</p>${fieldLabel('Prefer documented ranks up to',`<input class="input" type="number" min="0" max="10000" data-pref="preferredMaxRank" value="${p.preferredMaxRank||''}" placeholder="No ranking preference">`,'For example, 50 favors documented ranks 1–50. Leave blank to ignore ranking.')}${weight('ranking','Ranking preference',p.weights.ranking??2)}<p class="muted">Unknown ranks receive a neutral sorting score.</p></section>${rankingFilter(state)}`;
}
function peoplePriorities(state) {
  const network=networkForState(state),ids=networkLoadState(network,state.prefs.connectionPeople||[]).ids;
  const selected=ids.map(id=>network.peopleById.get(id)).filter(Boolean);
  return `<section class="profile-form-section"><h2>Professor connections</h2><p class="muted">Choose professors whose connections matter to you. Schools with documented coauthors, former students, advisers, or other professional links to those professors appear earlier.</p><div class="chip-row">${selected.map(person=>`<span class="tag">${e(person.name)}</span>`).join('')||'<p class="muted">No professors selected for matching.</p>'}</div><div class="inline-actions">${button('choose-connection-people',selected.length?'Edit selected professors':'Choose professors','secondary')}${state.prefs.knownPeople.length?button('copy-known-people','Use People I know','secondary small'):''}${ids.length?button('clear-pref','Clear selections','ghost small','data-key="connectionPeople"'):''}</div>${connectionLoadNotice(network,ids)}${weight('connections','Professor connections',state.prefs.weights.connections??3)}<p class="muted">Matching counts the professors with a documented connection, rather than rewarding a large number of papers by one person. Missing records mean the database has no documented link; they do not establish that no connection exists.</p><p class="muted">These choices stay separate from People I know. School cards show connections for both sets; the spreadsheet has separate columns for each.</p></section>`;
}
function prioritiesView(state, catalog) {
  const step = prioritySteps.some(([id]) => id === state.ui.priorityStep) ? state.ui.priorityStep : 'research';
  const next = prioritySteps[prioritySteps.findIndex(([id]) => id === step) + 1];
  const content = ({research: researchPriorities, location: locationPriorities, ranking: rankingPriorities, people: peoplePriorities})[step](state, catalog);
  return frame('priorities', 'Matching preferences', 'Set the interests and weights used to sort schools. School filters are configured separately.', `${subnav(prioritySteps, step, 'priority-step', 'Matching priorities')}<section class="panel profile-form">${content}</section><p class="profile-note">Fit describes your preferences, not your chance of admission.</p>${button('reset-priorities','Reset matching preferences','ghost small')}`, next ? button('priority-step', `Next: ${next[1]} ${icon('arrow')}`, 'primary', `data-step="${next[0]}"`) : stepButton('home', `Done ${icon('check')}`, 'primary'));
}

function cardsView(state) {
  const selected = state.prefs.details;
  const active = selected.map(key => DETAILS.find(([id]) => id === key)).filter(Boolean);
  const inactive = DETAILS.filter(([id]) => !selected.includes(id));
  const first = active[0];
  const row = ([key,title],index = -1) => `<div class="profile-card-option ${index>=0?'is-selected':''}" ${index>=0?`data-card-key="${key}" data-card-title="${e(title)}" role="listitem" tabindex="0" aria-describedby="card-order-help"`:''}><label class="check-option"><input type="checkbox" data-pref-array="details" value="${key}" ${index>=0?'checked':''}><span><strong>${e(title)}</strong><small class="muted">${e(detailDescriptions[key])}</small></span></label>${index>=0?`<div class="profile-card-actions">${button('move-detail','↑','ghost small',`data-key="${key}" data-direction="up" aria-label="Move ${e(title)} earlier" ${index===0?'disabled':''}`)}${button('move-detail','↓','ghost small',`data-key="${key}" data-direction="down" aria-label="Move ${e(title)} later" ${index===active.length-1?'disabled':''}`)}</div>`:''}</div>`;
  const topics=`<section class="panel profile-card-list"><p id="card-order-help" class="profile-note">Drag a selected topic to change its position, or use the arrows. To reorder with the keyboard, focus a topic, press Space, then use ↑ and ↓. Press Enter to finish or Escape to cancel.</p><h2>Shown on your cards</h2><div class="profile-card-order" data-card-order role="list" aria-label="Selected card topics">${active.map(row).join('')}</div>${!active.length?'<p class="muted">No optional topics selected. Add one below.</p>':''}<p class="sr-only" data-card-order-status role="status" aria-live="polite" aria-atomic="true"></p>${inactive.length?`<h2 class="card-other-heading">Other topics</h2><div class="profile-card-unselected">${inactive.map(item=>row(item)).join('')}</div>`:''}</section>`;
  const preview=`<aside class="profile-preview" aria-label="Preview of your school card"><p class="eyebrow">CARD PREVIEW</p><div class="profile-preview-school"><span class="profile-preview-mark" aria-hidden="true">U</span><h2>University name</h2><p>City, country</p></div><div class="profile-preview-tabs">${selected.map((key,index)=>`<span class="profile-preview-tab ${index===0?'is-active':''}">${e(DETAILS.find(([id])=>id===key)?.[1]||key)}</span>`).join('')}</div><div class="profile-preview-content"><h3>${e(first?.[1]||'No topics selected')}</h3><p class="muted">${e(first?detailDescriptions[first[0]]:'The school name, location, and your notes remain available.')}</p></div><p class="profile-note">Your notes remain available regardless of selected topics.</p></aside>`;
  return frame('cards','Card information','Select the topics shown on each school card and arrange their order.',`<div class="profile-filter-summary"><p class="muted">Your card layout is saved independently of your filters.</p>${button('reset-cards','Restore default card topics','ghost small')}</div><div class="profile-split">${topics}${preview}</div>`,button('start-discover',`Review schools ${icon('arrow')}`,'primary'));
}

export function preferencesView(state, catalog) {
  switch (state.ui.profileStep) {
    case 'people': return peopleProfile(state);
    case 'schools': return schoolsView(state, catalog);
    case 'priorities': return prioritiesView(state, catalog);
    case 'cards': return cardsView(state);
    default: return hub(state, catalog);
  }
}
