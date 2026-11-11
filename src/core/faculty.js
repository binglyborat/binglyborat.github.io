import { FACULTY_PROFILES, FACULTY_ADDITIONS } from '../data/faculty-profiles.js';
import { personId } from './network.js';

/** Department rosters and publication indexes have different scopes. Only
 * explicitly sourced appointments enter the visible faculty roster. */
export function enrichFaculty(schoolId, faculty = []) {
  const people = new Map(faculty.map(person => [personId(schoolId, person.name), person]));
  for (const person of FACULTY_ADDITIONS[schoolId] || []) {
    const id = personId(schoolId, person.name);
    const old = people.get(id) || {};
    people.set(id, { ...old, ...person, areas: [...new Set([...(old.areas || []), ...(person.areas || [])])] });
  }
  return [...people.values()];
}

export function facultyProfile(school, person) {
  const name = typeof person === 'string' ? person : person.name;
  const profile = FACULTY_PROFILES[personId(school.institutionId || school.id, name)] || {};
  return {
    ...profile,
    summary: profile.summary || person.summary || (person.areas || []).join(' · '),
    papers: profile.papers || [],
    sources: profile.sources || [],
    availability: profile.availability || { status: 'unknown', label: 'Supervision: not publicly confirmed' },
    arxivURL: `https://arxiv.org/search/?searchtype=author&query=${encodeURIComponent(name)}&order=-announced_date_first`,
    wikipediaSearchURL: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(`${name} mathematician`)}`,
  };
}
