/** Load complete incident-edge shards only for the people a visitor selects. */
const edgeId = (a, b, kind, url) => [kind, ...(kind === 'coauthor' ? [a, b].sort() : [a, b]), url].join('|');

export function unpackNetworkShard(shard) {
  if (shard?.schemaVersion !== 1 || typeof shard.personId !== 'string' || !Array.isArray(shard.edges)
    || !shard.tables || !['people', 'evidence', 'sources', 'notes'].every(key => Array.isArray(shard.tables[key]))) throw new Error('Invalid connection shard.');
  const item = (table, index) => {
    if (index === -1) return undefined;
    if (!Number.isInteger(index) || index < 0 || index >= shard.tables[table].length) throw new Error(`Invalid ${table} reference in connection shard.`);
    return shard.tables[table][index];
  };
  return shard.edges.map(row => {
    if (!Array.isArray(row) || row.length < 9) throw new Error('Invalid connection record.');
    const [explicitId, aRef, bRef, kind, evidenceRef, paperRef, explicitURL, sourcesRef, notesRef, rest = {}] = row;
    const a = item('people', aRef), b = item('people', bRef), evidence = item('evidence', evidenceRef), paper = item('evidence', paperRef);
    const canonicalEvidenceURL = explicitURL ?? evidence?.url ?? paper?.url;
    if (typeof a !== 'string' || typeof b !== 'string' || a === b || typeof kind !== 'string' || !kind
      || !evidence?.title || !evidence?.url || typeof canonicalEvidenceURL !== 'string') throw new Error('Incomplete connection record.');
    return { ...rest, id: explicitId ?? edgeId(a, b, kind, canonicalEvidenceURL), a, b, kind, evidence, paper,
      canonicalEvidenceURL, sources: item('sources', sourcesRef), notes: item('notes', notesRef) };
  });
}

export function createLazyNetwork(index, {
  baseURL = new URL('../data/network-shards/', import.meta.url), fetchImpl = (...args) => fetch(...args),
} = {}) {
  if (index?.schemaVersion !== 1 || !Array.isArray(index.people) || !Array.isArray(index.idAliases)
    || !Array.isArray(index.counts) || !index.shards || typeof index.shards !== 'object') throw new Error('Invalid connection index.');
  const people = index.people, peopleById = new Map(people.map(person => [person.id, person]));
  if (peopleById.size !== people.length || people.some(p => typeof p.id !== 'string' || !p.id)) throw new Error('Invalid person IDs in connection index.');
  const rawAliases = new Map(index.idAliases), idAliases = new Map();
  function resolveId(id) {
    const seen = new Set();
    while (rawAliases.has(id) && rawAliases.get(id) !== id) {
      if (seen.has(id)) throw new Error('Cyclic person identity aliases in connection index.');
      seen.add(id); id = rawAliases.get(id);
    }
    return id;
  }
  for (const [id] of rawAliases) idAliases.set(id, resolveId(id));
  const counts = new Map(index.counts);
  const edges = [], edgesByPerson = new Map(), edgeLookup = new Map();
  const loading = new Set(), loaded = new Set(), errors = new Map(), missing = new Set(), pending = new Map();
  const totalEdgeCount = index.meta?.totalEdges ?? 0;
  function addEdges(incoming) {
    for (const edge of incoming) {
      if (edgeLookup.has(edge.id)) continue;
      edgeLookup.set(edge.id, edge); edges.push(edge);
      for (const id of [edge.a, edge.b]) {
        if (!edgesByPerson.has(id)) edgesByPerson.set(id, []);
        edgesByPerson.get(id).push(edge);
      }
    }
  }
  function loadPerson(id) {
    if (loaded.has(id)) return Promise.resolve();
    if (pending.has(id)) return pending.get(id);
    errors.delete(id); loading.add(id);
    const request = (async () => {
      try {
        // Keep old saved IDs in the workspace, but do not permanently block exports or
        // spin on a person removed from this index. Missing is distinct from known zero edges.
        if (!peopleById.has(id)) { missing.add(id); loaded.add(id); return; }
        const expected = counts.get(id) || 0, filename = index.shards[id];
        if (!expected) { loaded.add(id); return; }
        if (typeof filename !== 'string' || !/^[a-zA-Z0-9._-]+\.json$/.test(filename) || filename.includes('..')) throw new Error('Missing or invalid connection shard location.');
        const response = await fetchImpl(new URL(filename, baseURL).href);
        if (!response.ok) throw new Error(`Connection records could not be loaded (HTTP ${response.status}).`);
        const shard = await response.json();
        if (shard.personId !== id) throw new Error('Connection shard belongs to a different person.');
        const incoming = unpackNetworkShard(shard);
        if (incoming.length !== expected || new Set(incoming.map(e => e.id)).size !== expected) throw new Error('Connection shard is incomplete or contains duplicate records.');
        for (const edge of incoming) {
          if (!peopleById.has(edge.a) || !peopleById.has(edge.b) || (edge.a !== id && edge.b !== id)) throw new Error('Connection shard contains an unrelated or unknown person.');
          const old = edgeLookup.get(edge.id);
          if (old && (old.a !== edge.a || old.b !== edge.b || old.kind !== edge.kind || old.canonicalEvidenceURL !== edge.canonicalEvidenceURL)) throw new Error('Conflicting connection record.');
        }
        // Validate the whole shard before publishing any of its edges.
        addEdges(incoming); loaded.add(id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.set(id, message); throw new Error(message);
      } finally { loading.delete(id); pending.delete(id); }
    })();
    pending.set(id, request);
    // A zero-record lookup can settle synchronously before pending is assigned.
    request.then(() => pending.delete(id), () => pending.delete(id));
    return request;
  }
  async function loadPeople(ids) {
    const requested = [...new Set(ids.map(resolveId))];
    const results = await Promise.allSettled(requested.map(loadPerson));
    const failed = results.flatMap((result, i) => result.status === 'rejected' ? [{ id: requested[i], error: result.reason }] : []);
    if (failed.length) {
      const error = new AggregateError(failed.map(item => item.error), `Could not load connections for ${failed.length} selected ${failed.length === 1 ? 'person' : 'people'}.`);
      error.personIds = failed.map(item => item.id); throw error;
    }
    return { loaded: requested };
  }
  return { people, peopleById, idAliases, counts, edges, edgesByPerson, meta: index.meta || {},
    totalEdgeCount, totalEdges: totalEdgeCount, loading, loaded, errors, missing, loadPeople, resolveId };
}
