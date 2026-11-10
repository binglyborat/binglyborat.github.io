/** Non-destructive identity resolution. Source records remain the source of truth;
 * groups are a reproducible display index, never replacements for those records. */
const normalize = value => String(value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unique = values => [...new Set(values)];
const pairKey = (a, b) => JSON.stringify([a, b].sort());
const provider = person => person.id.startsWith('openalex:') ? 'openalex' : person.id.startsWith('zbmath:') ? 'zbmath' : 'local';
const orcid = person => {
  const value = String(person.orcid || '').trim().replace(/^https?:\/\/orcid\.org\//i, '').replace(/\/$/, '').toUpperCase();
  return /^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$/.test(value) ? value : '';
};
const sourceId = (person, field) => String(person[field] || '').replace(/^https?:\/\/(?:www\.)?openalex\.org\//i, '').trim();

function nameKey(value) {
  const pieces = String(value || '').split(',');
  const text = pieces.length === 2 ? `${pieces[1]} ${pieces[0]}` : value;
  const words = normalize(text).split(' ');
  // Abbreviations and database notices are not full-name identity evidence.
  return words.filter(word => word.length > 1).length >= 2 && words.length <= 8
    && !/unavailable|license|interface|contents|\bunknown\b|\banonymous\b|\bunidentified\b/.test(words.join(' ')) ? words.join(' ') : '';
}
function names(person) {
  return unique([person.name, ...(person.indexedNames || []), ...(person.rawBylines || [])].map(nameKey).filter(Boolean));
}
function compatibleNames(a, b, keys) {
  const right = new Set(keys.get(b.id));
  return keys.get(a.id).some(key => right.has(key));
}
function preferred(a, b) {
  const rank = p => (p.verified ? 16 : 0) + (provider(p) === 'local' ? 8 : 0)
    + (p.schoolId ? 4 : 0) + (!['former', 'deceased', 'unverified'].includes(p.status) ? 2 : 0)
    + (p.identityStatus === 'verified' ? 1 : 0);
  return rank(b) - rank(a) || a.id.localeCompare(b.id);
}

/** Normalize equivalent identifier URLs, including arXiv's DOI representation. */
export function publicationURL(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  try { url = decodeURIComponent(url); } catch { /* retain malformed source text */ }
  const arxiv = url.match(/(?:arxiv\.org\/(?:abs|pdf)\/|10\.48550\/arxiv\.)([^?#]+?)(?:\.pdf)?(?:[?#].*)?$/i);
  if (arxiv) return `arxiv:${arxiv[1].replace(/v\d+$/i, '').toLowerCase()}`;
  const doi = url.match(/(?:doi\.org\/|^doi:\s*|^)(10\.\d{4,9}\/[^\s?#]+)$/i);
  if (doi) return `doi:${doi[1].replace(/\/$/, '').toLowerCase()}`;
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) if (/^utm_|^(?:fbclid|gclid)$/i.test(key)) parsed.searchParams.delete(key);
    parsed.searchParams.sort();
    return `${parsed.hostname.replace(/^www\./, '').toLowerCase()}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
  } catch { return url; }
}

function paperTokens(edge) {
  const evidence = edge.paper || edge.evidence || {};
  const tokens = unique([edge.canonicalEvidenceURL, evidence.url, evidence.doi].map(publicationURL).filter(Boolean));
  const title = normalize(evidence.title), authors = (evidence.authors || []).map(nameKey);
  // A title alone is not a publication identifier. Require a substantial exact
  // title, year, and the complete full-name author list for this fallback.
  if (title.length >= 24 && title.split(' ').length >= 4 && Number.isInteger(Number(evidence.year))
    && Number(evidence.year) > 1800 && authors.length > 1 && authors.every(Boolean)) {
    tokens.push(`title:${title}|${evidence.year}|${unique(authors).sort().join(';')}`);
  }
  return tokens;
}

function publicationIndex(edges) {
  edges = [...edges].sort((a, b) => a.id.localeCompare(b.id));
  const parent = new Map();
  const root = token => {
    if (!parent.has(token)) parent.set(token, token);
    let current = token;
    while (parent.get(current) !== current) current = parent.get(current);
    while (parent.get(token) !== token) { const next = parent.get(token); parent.set(token, current); token = next; }
    return current;
  };
  const tokensByEdge = new Map();
  for (const edge of edges) {
    if ((edge.kind || 'coauthor') !== 'coauthor') continue;
    const tokens = paperTokens(edge); tokensByEdge.set(edge.id, tokens);
    for (const token of tokens) {
      const a = root(tokens[0]), b = root(token);
      if (a !== b) { const [first, second] = [a, b].sort(); parent.set(second, first); }
    }
  }
  const edgeKeys = new Map(), papers = new Map();
  for (const edge of edges) {
    const tokens = tokensByEdge.get(edge.id);
    if (!tokens?.length) continue;
    const key = root(tokens[0]); edgeKeys.set(edge.id, key);
    if (!papers.has(key)) papers.set(key, { key, people: new Set(), evidence: edge.paper || edge.evidence });
    const paper = papers.get(key); paper.people.add(edge.a); paper.people.add(edge.b);
  }
  return { edgeKeys, papers, aliases: [...parent.keys()].map(token => [token, root(token)]).filter(([token, canonical]) => token !== canonical).sort(([a], [b]) => a.localeCompare(b)) };
}

function aggregateEdges(rawEdges, memberToGroup, evidenceKeys) {
  const records = new Map();
  // Stable, source-aware evidence choice: network timing must not change which
  // publication a combined row opens. Locally researched endpoints take priority
  // over wholly indexed pairs; every alternate evidence object is still retained.
  const localEndpoints = edge => [edge.a, edge.b].filter(id => !/^(?:openalex|zbmath):/.test(id)).length;
  const orderedEdges = [...rawEdges].sort((a, b) => localEndpoints(b) - localEndpoints(a) || a.id.localeCompare(b.id));
  for (const original of orderedEdges) {
    const a = memberToGroup.get(original.a) || original.a, b = memberToGroup.get(original.b) || original.b;
    // Defensive only: the resolver forbids joining documented coauthors.
    if (a === b) continue;
    const kind = original.kind || 'coauthor';
    const evidenceKey = kind === 'coauthor' ? evidenceKeys.get(original.id) || publicationURL(original.canonicalEvidenceURL || original.evidence?.url)
      : original.canonicalEvidenceURL || original.evidence?.url;
    const key = JSON.stringify([kind, ...(kind === 'coauthor' ? [a, b].sort() : [a, b]), evidenceKey]);
    const old = records.get(key);
    if (!old) {
      records.set(key, { ...original, id: key, a, b, sources: [...(original.sources || [])],
        rawEdgeIds: [original.id], sourceRecordIds: unique([original.a, original.b]),
        evidenceVariants: [original.paper || original.evidence], notes: original.notes || '' });
      continue;
    }
    old.rawEdgeIds.push(original.id);
    old.sourceRecordIds = unique([...old.sourceRecordIds, original.a, original.b]);
    old.sources = [...new Map([...old.sources, ...(original.sources || [])].map(source => [source.url, source])).values()];
    if (!old.evidenceVariants.some(evidence => JSON.stringify(evidence) === JSON.stringify(original.paper || original.evidence))) old.evidenceVariants.push(original.paper || original.evidence);
    if (original.notes && !old.notes.split('\n\n').includes(original.notes)) old.notes += `${old.notes ? '\n\n' : ''}${original.notes}`;
  }
  return [...records.values()];
}

/** Build once from the complete graph. The returned JSON can be shipped with the
 * lightweight person index, so clients need not download publications to group. */
export function buildPersonGroups(network) {
  const people = [...network.people].sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(people.map(person => [person.id, person]));
  const nameKeys = new Map(people.map(person => [person.id, names(person)]));
  const parent = new Map(people.map(person => [person.id, person.id]));
  const members = new Map(people.map(person => [person.id, new Set([person.id])]));
  const reasons = new Map(people.map(person => [person.id, []]));
  const candidates = new Map(), blocked = new Set();
  const root = id => { let current = id; while (parent.get(current) !== current) current = parent.get(current); return current; };
  for (const edge of network.edges || []) blocked.add(pairKey(edge.a, edge.b));
  const candidate = (a, b, method, confidence, evidence = {}) => {
    if (a === b || !byId.has(a) || !byId.has(b)) return;
    const key = pairKey(a, b), rank = { identifier: 3, publication: 2, catalog: 1 }[method];
    if (!candidates.has(key) || candidates.get(key).rank < rank) candidates.set(key, { a, b, method, confidence, rank, ...evidence });
  };
  for (const field of ['orcid', 'openAlexId', 'zbmathAuthorCode']) {
    const index = new Map();
    for (const person of people) {
      const value = field === 'orcid' ? orcid(person) : sourceId(person, field);
      if (!value) continue;
      if (!index.has(value)) index.set(value, []);
      index.get(value).push(person.id);
    }
    for (const [value, ids] of index) for (let i = 1; i < ids.length; i++) candidate(ids[0], ids[i], 'identifier', 'supported', { label: `Shared ${field === 'orcid' ? 'ORCID' : field === 'openAlexId' ? 'OpenAlex author ID' : 'zbMATH author code'}`, value });
  }
  const publications = publicationIndex(network.edges || []);
  for (const paper of publications.papers.values()) {
    const namesInPaper = new Map();
    for (const id of paper.people) for (const name of nameKeys.get(id) || []) {
      if (!namesInPaper.has(name)) namesInPaper.set(name, new Set());
      namesInPaper.get(name).add(id);
    }
    for (const ids of namesInPaper.values()) {
      const list = [...ids];
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        candidate(list[i], list[j], 'publication', 'supported', { label: 'Matching full name on the same publication', title: paper.evidence.title, url: paper.evidence.url });
      }
    }
  }
  // Existing importer associations are useful, but they remain explicitly
  // provisional. Reject ambiguous buckets rather than assigning a roster person
  // arbitrarily to one of two same-name indexed identities.
  const catalogBuckets = new Map();
  for (const person of people) if (person.schoolId) for (const name of nameKeys.get(person.id)) {
    const key = `${person.schoolId}|${name}`;
    if (!catalogBuckets.has(key)) catalogBuckets.set(key, new Set());
    catalogBuckets.get(key).add(person.id);
  }
  for (const ids of catalogBuckets.values()) {
    const entries = [...ids].map(id => byId.get(id));
    if (entries.length < 2 || !entries.some(person => provider(person) === 'local')) continue;
    const identifiers = new Set(entries.map(orcid).filter(Boolean));
    const counts = new Map();
    for (const person of entries) counts.set(provider(person), (counts.get(provider(person)) || 0) + 1);
    if (identifiers.size > 1 || [...counts.values()].some(count => count > 1)) continue;
    const local = entries.find(person => provider(person) === 'local');
    for (const person of entries) if (person !== local && compatibleNames(local, person, nameKeys)) {
      if (person.catalogPersonId && person.catalogPersonId !== local.id) continue;
      candidate(local.id, person.id, 'catalog', 'probable', { label: 'Matching full name and catalog institution', institution: local.institution, url: person.schoolMatch?.rosterSource?.url || local.sources?.[0]?.url || '' });
    }
  }
  let conflicts = 0;
  for (const match of [...candidates.values()].sort((a, b) => b.rank - a.rank || pairKey(a.a, a.b).localeCompare(pairKey(b.a, b.b)))) {
    let a = root(match.a), b = root(match.b); if (a === b) continue;
    const combined = [...members.get(a), ...members.get(b)];
    const identifiers = new Set(combined.map(id => orcid(byId.get(id))).filter(Boolean));
    const incompatible = identifiers.size > 1 || [...members.get(a)].some(left => [...members.get(b)].some(right => blocked.has(pairKey(left, right))));
    if (incompatible) { conflicts++; continue; }
    // Strong identifier or publication evidence can connect duplicate provider
    // IDs. A catalog-name hint alone cannot bridge two indexed namesakes.
    if (match.method === 'catalog') {
      const providerIds = new Map();
      for (const id of combined) { const p = provider(byId.get(id)); if (!providerIds.has(p)) providerIds.set(p, new Set()); providerIds.get(p).add(id); }
      if ([...providerIds.values()].some(ids => ids.size > 1)) { conflicts++; continue; }
    }
    [a, b] = [a, b].sort(); parent.set(b, a);
    members.set(a, new Set(combined)); members.delete(b);
    reasons.set(a, [...reasons.get(a), ...reasons.get(b), match]); reasons.delete(b);
  }
  const groups = [...members].map(([rootId, ids]) => {
    const records = [...ids].map(id => byId.get(id)).sort(preferred), links = reasons.get(rootId);
    return { id: records[0].id, memberIds: records.map(record => record.id).sort(),
      confidence: links.some(link => link.confidence === 'probable') ? 'probable' : links.length ? 'supported' : 'separate',
      reasons: links.map(({ rank, ...reason }) => reason) };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const memberToGroup = new Map(groups.flatMap(group => group.memberIds.map(id => [id, group.id])));
  const edges = aggregateEdges(network.edges || [], memberToGroup, publications.edgeKeys);
  const counts = new Map();
  for (const edge of edges) for (const id of [edge.a, edge.b]) counts.set(id, (counts.get(id) || 0) + 1);
  return { schemaVersion: 1, groups, counts: [...counts].sort(([a], [b]) => a.localeCompare(b)), totalEdges: edges.length,
    publicationAliases: publications.aliases,
    stats: { sourceRecords: people.length, people: groups.length, combinedGroups: groups.filter(group => group.memberIds.length > 1).length,
      combinedRecords: people.length - groups.length, sourceRelationships: network.edges?.length || 0, relationships: edges.length, conflicts } };
}

function groupProfile(group, byId) {
  const sourceRecords = group.memberIds.map(id => byId.get(id)).filter(Boolean);
  const representative = byId.get(group.id) || [...sourceRecords].sort(preferred)[0];
  const union = key => unique(sourceRecords.flatMap(record => record[key] || []));
  let displayName = representative.name;
  if (/unavailable|conflicting licenses|web interface contents/i.test(displayName || '')) {
    const usable = sourceRecords.flatMap(record => [record.name, ...(record.indexedNames || []), ...(record.rawBylines || [])]).find(value => nameKey(value));
    const parts = usable?.split(',');
    displayName = usable ? (parts.length === 2 ? `${parts[1].trim()} ${parts[0].trim()}` : usable)
      : `${representative.zbmathAuthorCode || representative.id.startsWith('zbmath:') ? 'zbMATH author' : 'Indexed author'} ${representative.zbmathAuthorCode || representative.id.replace(/^zbmath:/, '')}`;
  }
  return { ...representative, id: group.id, name: displayName, memberIds: [...group.memberIds], sourceRecords,
    grouping: { confidence: group.confidence, reasons: group.reasons },
    indexedNames: unique([...union('indexedNames'), ...sourceRecords.map(record => record.name)]), rawBylines: union('rawBylines'),
    sources: [...new Map(sourceRecords.flatMap(record => record.sources || []).map(source => [source.url, source])).values()],
    pastAffiliations: [...new Map(sourceRecords.flatMap(record => record.pastAffiliations || []).map(affiliation => [JSON.stringify(affiliation), affiliation])).values()] };
}

/** A reversible graph view. Raw profile/edge arrays are never mutated or removed.
 * Lazy views fetch every member of a selected group and report success only once
 * all those records are available, keeping partial exports from looking complete. */
export function groupNetwork(rawNetwork, grouping = buildPersonGroups(rawNetwork)) {
  if (grouping?.schemaVersion !== 1 || !Array.isArray(grouping.groups)) throw new Error('Invalid person grouping index.');
  const rawById = rawNetwork.peopleById || new Map(rawNetwork.people.map(person => [person.id, person]));
  const memberToGroup = new Map(), groupsById = new Map();
  for (const group of grouping.groups) {
    if (!Array.isArray(group.memberIds) || !group.memberIds.includes(group.id) || groupsById.has(group.id)) throw new Error('Invalid person group.');
    groupsById.set(group.id, group);
    for (const id of group.memberIds) {
      if (!rawById.has(id) || memberToGroup.has(id)) throw new Error('Missing or duplicate source person in grouping index.');
      memberToGroup.set(id, group.id);
    }
  }
  if (memberToGroup.size !== rawById.size) throw new Error('Person grouping index omits source records.');
  const people = grouping.groups.map(group => groupProfile(group, rawById)).sort((a, b) => a.name.localeCompare(b.name) || a.institution.localeCompare(b.institution));
  const peopleById = new Map(people.map(person => [person.id, person]));
  const resolveId = id => {
    const seen = new Set();
    while (rawNetwork.idAliases?.has(id) && rawNetwork.idAliases.get(id) !== id) {
      if (seen.has(id)) throw new Error('Cyclic source person aliases.');
      seen.add(id); id = rawNetwork.idAliases.get(id);
    }
    return memberToGroup.get(id) || id;
  };
  const idAliases = new Map();
  for (const id of [...rawById.keys(), ...(rawNetwork.idAliases?.keys() || [])]) {
    const resolved = resolveId(id); idAliases.set(id, resolved);
    if (peopleById.has(resolved)) peopleById.set(id, peopleById.get(resolved));
  }
  const loaded = new Set(), loading = new Set(), errors = new Map(), missing = new Set();
  const counts = new Map(grouping.counts || []), rawCounts = new Map();
  const publicationAliases = new Map(grouping.publicationAliases || []);
  for (const group of grouping.groups) rawCounts.set(group.id, group.memberIds.reduce((sum, id) => sum + (rawNetwork.counts?.get(id) || rawNetwork.edgesByPerson?.get(id)?.length || 0), 0));
  let seenEdges = -1, cachedEdges = [], cachedIncident = new Map();
  function refreshEdges() {
    if (seenEdges === rawNetwork.edges.length) return;
    seenEdges = rawNetwork.edges.length;
    const evidenceKeys = publicationIndex(rawNetwork.edges).edgeKeys;
    for (const [id, key] of evidenceKeys) evidenceKeys.set(id, publicationAliases.get(key) || key);
    cachedEdges = aggregateEdges(rawNetwork.edges, memberToGroup, evidenceKeys);
    cachedIncident = new Map();
    for (const edge of cachedEdges) for (const id of [edge.a, edge.b]) {
      if (!cachedIncident.has(id)) cachedIncident.set(id, []);
      cachedIncident.get(id).push(edge);
    }
  }
  function refreshStatus(ids) {
    for (const input of ids) {
      const id = resolveId(input), members = groupsById.get(id)?.memberIds || [id];
      if (members.every(member => rawNetwork.loaded?.has(member))) loaded.add(id); else loaded.delete(id);
      if (members.some(member => rawNetwork.loading?.has(member))) loading.add(id); else loading.delete(id);
      const failed = members.filter(member => rawNetwork.errors?.has(member));
      if (failed.length) errors.set(id, failed.map(member => `${rawById.get(member)?.name || member}: ${rawNetwork.errors.get(member)}`).join('; ')); else errors.delete(id);
      if (members.some(member => rawNetwork.missing?.has(member))) missing.add(id); else missing.delete(id);
    }
  }
  const facade = { rawNetwork, grouping, people, peopleById, idAliases, resolveId, memberToGroup, groupsById, counts, rawCounts,
    meta: { ...rawNetwork.meta, totalPeople: people.length, totalEdges: grouping.totalEdges, sourcePeople: rawNetwork.people.length, sourceEdges: rawNetwork.totalEdges ?? rawNetwork.edges.length },
    totalEdges: grouping.totalEdges, totalEdgeCount: grouping.totalEdges,
    get edges() { refreshEdges(); return cachedEdges; }, get edgesByPerson() { refreshEdges(); return cachedIncident; } };
  if (typeof rawNetwork.loadPeople === 'function') Object.assign(facade, { loaded, loading, errors, missing,
    async loadPeople(ids) {
      const requested = unique(ids.map(resolveId));
      const members = unique(requested.flatMap(id => groupsById.get(id)?.memberIds || [id]));
      const request = rawNetwork.loadPeople(members); refreshStatus(requested);
      try { await request; return { loaded: requested }; }
      finally { refreshStatus(requested); refreshEdges(); }
    } });
  return facade;
}
