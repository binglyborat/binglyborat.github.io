/** Pure filtering and preference scoring. Scores describe fit, never admission odds. */
import {schoolCountries,expandCountrySelections,isRuralCampus} from './geography.js';
const list = (value) => Array.isArray(value) ? value : [];
const lower = (value) => String(value ?? '').toLocaleLowerCase();
const known = (value) => !['', 'unknown', 'not documented', 'not available', 'unverified'].includes(lower(value).trim());
const includes = (values, value) => values.some((candidate) => lower(candidate) === lower(value));
const requested = (prefs, key) => list(prefs[key]);
const facultyNames = (school) => list(school.faculty).map((person) => typeof person === 'string' ? person : person.name).join(' ');

export function filterSchools(schools, prefs = {}) {
  return schools.filter((school) => {
    if (requested(prefs, 'excludedIds').includes(school.id)) return false;
    if (includes(requested(prefs, 'excludedCities'), school.city)) return false;
    if (prefs.excludeRural && isRuralCampus(school)) return false;
    for (const [key, schoolKey] of [['countries', 'country'], ['settings', 'setting'], ['sizes', 'schoolSize'], ['degrees', 'degree'],['programTypes','programType']]) {
      const values = key==='countries'?expandCountrySelections(requested(prefs,key)):requested(prefs, key);
      const actual = key==='countries'?schoolCountries(school):key==='settings'?[isRuralCampus(school)?'Rural':school.setting]:Array.isArray(school[schoolKey]) ? school[schoolKey] : [school[schoolKey]];
      if (values.length && !actual.some((value) => includes(values, value))) return false;
    }
    if (prefs.query?.trim()) {
      const haystack = lower([school.name, school.program, school.programFormat, school.city, school.country, school.region, ...list(school.areas), facultyNames(school)].join(' '));
      if (!lower(prefs.query).trim().split(/\s+/).every((term) => haystack.includes(term))) return false;
    }
    for (const [key, value] of [
      ['fundingQuery', school.funding], ['internationalQuery', school.international],
      ['deadlineQuery', school.deadlineDetails],
      ['applicationQuery', [school.admissions, school.greGeneral, school.greMath, school.letters, school.writing].filter(Boolean).join(' ')],
    ]) {
      if (prefs[key]?.trim() && !lower(value).includes(lower(prefs[key]).trim())) return false;
    }
    const areas = Object.hasOwn(prefs, 'requiredAreas') ? requested(prefs, 'requiredAreas') : prefs.requireAreas ? requested(prefs, 'areas') : [];
    if (areas.length) {
      const matches = areas.filter((area) => includes(list(school.areas), area)).length;
      const minimum = String(prefs.areaMode).trim().toLowerCase() === 'all' ? areas.length : Math.max(1, Math.floor(Number(prefs.areaMode) || 1));
      if (matches < minimum) return false;
    }
    const maxRank = Math.max(0, Number(prefs.filterMaxRank) || 0);
    if (maxRank) {
      const rank = Number(school.rank), documented = school.rank != null && Number.isFinite(rank) && rank > 0;
      if (documented ? rank > maxRank : !prefs.filterIncludeUnranked) return false;
    }
    // Retired city/name/rank requirements remain in old backups but no longer
    // silently exclude schools. Their replacement controls are explicit above.
    return true;
  });
}

export function scoreSchool(school, prefs = {}, context = {}) {
  const reasons = [];
  const missing = [];
  let weighted = 0;
  let possible = 0;
  const weight = (key, fallback) => Math.max(0, Math.min(10, Number(prefs.weights?.[key] ?? fallback) || 0));
  const add = (key, amount, label, fallback) => {
    const importance = weight(key, fallback);
    possible += importance;
    weighted += amount * importance;
    if (importance) reasons.push({ category: key, label, matched: amount > 0, fraction: amount, weight: importance });
  };
  const areas = requested(prefs, 'areas');
  if (areas.length) {
    const matching = areas.filter((area) => includes(list(school.areas), area));
    if (!school.areas?.length) missing.push('Research areas are not documented.');
    add('research', matching.length / areas.length, matching.length ? `${matching.length} of ${areas.length} research interests: ${matching.join(', ')}` : 'No documented research-interest match', 5);
  }
  const countries = expandCountrySelections(requested(prefs, 'preferredCountries'));
  const cities = requested(prefs, 'preferredCities');
  if (countries.length || cities.length) {
    const documented = (!countries.length || schoolCountries(school).length>0) && (!cities.length || known(school.city));
    const match = documented && (!countries.length || schoolCountries(school).some(country=>includes(countries,country))) && (!cities.length || includes(cities, school.city));
    if (!documented) missing.push('Location information is incomplete.');
    add('location', Number(match), match ? 'Matches your location preferences' : 'Outside your preferred locations', 3);
  }
  const threshold = Math.max(0, Number(prefs.preferredMaxRank) || 0);
  if (threshold) {
    const rank = Number(school.rank), documented = school.rank != null && Number.isFinite(rank) && rank > 0;
    const match = documented && rank <= threshold;
    if (!documented) missing.push('A numeric mathematics rank is not documented; the ranking preference is neutral.');
    add('ranking', documented ? Number(match) : 0.5, documented ? match ? `Documented rank ${rank} is within your preferred top ${threshold}` : `Documented rank ${rank} is outside your preferred top ${threshold}` : 'Rank not documented; neutral ranking preference', 2);
    if (!documented && reasons.at(-1)?.category === 'ranking') Object.assign(reasons.at(-1), {matched:false,neutral:true});
  }
  if (requested(prefs, 'connectionPeople').length) {
    const fit = context.connectionFit;
    if (!fit?.ready) {
      missing.push(fit?.missing?.length ? 'Some selected professors are unavailable in this dataset; connections are not used in fit.' : 'Selected professors’ connections are still loading; connections are not used in fit.');
    } else if (fit.selectedCount) {
      const entry = fit.byInstitution.get(school.institutionId || school.id);
      const matched = entry?.matchedPeople.size || 0;
      add('connections', matched / fit.selectedCount, matched ? `Documented connections to ${matched} of ${fit.selectedCount} selected professors` : 'No documented connection to the selected professors in this dataset', 3);
    }
  }
  const sizes = requested(prefs, 'preferredSizes');
  if (sizes.length) {
    const match = known(school.schoolSize) && includes(sizes, school.schoolSize);
    if (!known(school.schoolSize)) missing.push('School size is not documented.');
    add('size', Number(match), match ? 'Matches your preferred school size' : 'No documented size match', 1);
  }
  return { score: possible ? Math.round(100 * weighted / possible) : null, reasons, missing };
}

export function rankSchools(schools, prefs = {}, context = {}) {
  return filterSchools(schools, prefs)
    .map((school) => ({ school, ...scoreSchool(school, prefs, context) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.school.name.localeCompare(b.school.name));
}
