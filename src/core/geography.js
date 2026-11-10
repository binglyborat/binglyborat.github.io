/** Countries are selectable places; consortium/region labels are display text. */
const REGION_COUNTRIES = {
  Europe: ['Austria', 'Belgium', 'Denmark', 'France', 'Germany', 'Italy', 'Netherlands', 'Switzerland', 'United Kingdom'],
  'North America': ['Canada', 'United States'],
  Asia: ['China', 'Hong Kong SAR, China', 'Japan', 'Singapore'],
  Africa: ['Ghana'],
  Oceania: ['Australia'],
};
const ALIASES = new Map([
  ['us', 'United States'], ['usa', 'United States'], ['united states of america', 'United States'],
  ['uk', 'United Kingdom'], ['great britain', 'United Kingdom'], ['ca', 'Canada'],
]);
const CONSORTIUM_COUNTRIES = {
  // The report's ALGANT overview predates the explicit program-country array.
  'algant-consortium': ['France', 'Canada', 'Germany', 'Netherlands', 'Italy'],
};
const unique = values => [...new Set(values)];
export function canonicalCountry(value) {
  const text = String(value || '').trim();
  return ALIASES.get(text.toLowerCase()) || text;
}
const compound = value => /^(?:Europe\s*(?:\/|and|&)\s*Canada|Multiple countries|Unknown)$/i.test(value);

export function schoolCountries(school) {
  const values = school.countries?.length ? school.countries : CONSORTIUM_COUNTRIES[school.id] || [school.country];
  return unique(values.map(canonicalCountry).filter(value => value && !compound(value) && !Object.hasOwn(REGION_COUNTRIES, value)));
}

export function countryOptions(catalog) {
  return unique(catalog.flatMap(schoolCountries)).sort((a, b) => a.localeCompare(b));
}

export function countryRegions(catalog) {
  const available = new Set(countryOptions(catalog));
  const regions=Object.entries(REGION_COUNTRIES).map(([label, countries]) => ({ label, countries: countries.filter(country => available.has(country)) })).filter(region => region.countries.length);
  const grouped=new Set(regions.flatMap(region=>region.countries));
  const other=[...available].filter(country=>!grouped.has(country));
  if(other.length)regions.push({label:'Other countries',countries:other});
  return regions;
}

/** Preserve an old broad selection as actual countries, never as a fake country. */
export function expandCountrySelections(values = []) {
  return unique(values.flatMap(value => {
    const country = canonicalCountry(value);
    if (/^Europe\s*(?:\/|and|&)\s*Canada$/i.test(country)) return [...REGION_COUNTRIES.Europe, 'Canada'];
    if (Object.hasOwn(REGION_COUNTRIES, country)) return REGION_COUNTRIES[country];
    return country && !compound(country) ? [country] : [];
  }));
}

/** Rural flags require explicit setting information; college towns are not
 * automatically rural (Oxford and Ann Arbor are examples). */
export function isRuralCampus(school) {
  return school.ruralCampus === true || /\brural\b/i.test(String(school.setting || ''));
}
