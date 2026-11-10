import {defaultPrefs} from './storage.js';
import {filterSchools} from './matching.js';
import {schoolCountries,expandCountrySelections} from './geography.js';

/** Eligibility, ranking preferences, and card content are independent settings. */
export const SCHOOL_FILTER_KEYS = [
  'countries','cities','excludedCities','excludeRural','settings','sizes','degrees','programTypes','query',
  'excludedIds','requiredAreas','requiredFacultyQuery','requireAreas','requireFaculty','areaMode',
  'fundingQuery','internationalQuery','deadlineQuery','applicationQuery',
];

export function resetSchoolFilters(prefs) {
  const next = {...prefs};
  for (const key of SCHOOL_FILTER_KEYS) next[key] = structuredClone(defaultPrefs[key]);
  return next;
}

export function moveCardSection(prefs, key, direction) {
  const details = [...prefs.details];
  const from = details.indexOf(key);
  const to = from + (direction === 'up' ? -1 : 1);
  if (from >= 0 && to >= 0 && to < details.length) [details[from], details[to]] = [details[to], details[from]];
  return {...prefs, details};
}

export const PRIORITY_KEYS=['areas','facultyQuery','preferredCountries','preferredCities','preferredSizes','preferredMaxRank','maxRank','includeUnranked','connectionPeople','weights'];
export function resetPriorities(prefs) {
  const next={...prefs};for(const key of PRIORITY_KEYS)next[key]=structuredClone(defaultPrefs[key]);return next;
}
/** Candidate-based availability includes all active constraints, not only the corresponding checkbox. */
export function availablePriorities(catalog,prefs) {
  const schools=filterSchools(catalog,prefs);
  return {
    areas:new Set(schools.flatMap(s=>s.areas)),
    preferredCountries:new Set(schools.flatMap(schoolCountries)),
    preferredCities:new Set(schools.map(s=>s.city)),
    preferredSizes:new Set(schools.map(s=>s.schoolSize)),
  };
}
export function effectivePreferences(catalog,prefs) {
  const allowed=availablePriorities(catalog,prefs),effective={...prefs};
  for(const key of Object.keys(allowed))effective[key]=(key==='preferredCountries'?expandCountrySelections(prefs[key]||[]):prefs[key]||[]).filter(value=>allowed[key].has(value));
  return effective;
}
