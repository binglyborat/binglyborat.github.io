import {resolvePersonId} from './network.js';

/** Build once per selected-person/load state. One selected person contributes
 * once per institution, regardless of paper count or duplicate source records. */
export function buildConnectionFit(network, selectedIds = []) {
  const ids = [...new Set(selectedIds.map(id => resolvePersonId(network, id)))];
  const byInstitution = new Map();
  const pending = typeof network.loadPeople === 'function' ? ids.filter(id => !network.loaded?.has(id)) : [];
  const missing = ids.filter(id => !network.peopleById.has(id) || network.missing?.has(id));
  const failed = pending.filter(id => network.errors?.has(id));
  const result = { ready: !pending.length && !missing.length, selectedCount: ids.length, selectedIds: ids,
    pending, failed, missing, byInstitution };
  // Publishing partial evidence would change order according to request timing.
  if (!result.ready || !ids.length) return result;
  const selected = new Set(ids);
  const edges = network.edgesByPerson ? [...new Set(ids.flatMap(id => network.edgesByPerson.get(id) || []))] : network.edges || [];
  for (const edge of edges) for (const [from, to] of [[edge.a, edge.b], [edge.b, edge.a]]) {
    if (!selected.has(from) || from === to) continue;
    const target = network.peopleById.get(to);
    if (!target?.schoolId || ['former', 'deceased'].includes(target.status)) continue;
    if (!byInstitution.has(target.schoolId)) byInstitution.set(target.schoolId, { matchedPeople: new Set(), targetPeople: new Set(), relationshipCount: 0 });
    const entry = byInstitution.get(target.schoolId);
    entry.matchedPeople.add(from); entry.targetPeople.add(to); entry.relationshipCount++;
  }
  return result;
}
