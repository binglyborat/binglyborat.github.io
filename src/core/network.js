const normalized=name=>String(name).normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const personId=(schoolId,name)=>`${schoolId}:${normalized(name)}`;

export function resolvePersonId(network,id) {
 const seen=new Set();
 while(network.idAliases?.has(id)&&!seen.has(id)) {
  seen.add(id);const next=network.idAliases.get(id);
  if(!next||next===id)break;
  id=next;
 }
 return id;
}

/** Keep source IDs in saves; grouped display never silently rewrites old selections. */
export function updateSelectedPeople(network,selectedIds,id,include) {
 const canonical=resolvePersonId(network,id);
 const members=network.peopleById.get(canonical)?.memberIds||[canonical];
 return include?[...new Set([...selectedIds,...members])]:selectedIds.filter(person=>resolvePersonId(network,person)!==canonical);
}

/** Reviewed source IDs are authoritative. Legacy roster entries use institution + name;
 * an indexed identity is never joined to that roster merely because its name matches. */
export function buildNetwork(catalog,research={}) {
 const aliases=new Map(Object.entries(research.meta?.nameAliases||{}).flatMap(([name,variants])=>variants.map(alias=>[normalized(alias),name])));
 const canonical=name=>aliases.get(normalized(name))||name;
 const excluded=new Set((research.meta?.excludedHistoricalPeople||[]).map(p=>normalized(canonical(p.name))));
 const people=new Map(),idAliases=new Map(),edges=[],edgeKeys=new Map(),schools=new Map(catalog.map(s=>[s.id,s]));
 const moved=new Map((research.people||[]).flatMap(p=>(p.previousPersonIds||[]).map(id=>[id,p])));
 function person(input) {
  const previous=!input.id&&moved.get(personId(input.schoolId||input.institution||'unknown',input.name));
  if(previous)input={...input,...previous,sources:[...(input.sources||[]),...(previous.sources||[])]};
  let {id:sourceId,localPersonId,name,schoolId,institution,role,status,affiliationStatus,verified=false,sources=[],openAlexId,orcid,...metadata}=input;
  const originalName=name;name=canonical(name);
  if(excluded.has(normalized(name)))return null;
  if(sourceId!=null&&(typeof sourceId!=='string'||!sourceId.trim()))throw new TypeError('A source person ID must be a nonempty string.');
  if(localPersonId){const linked=people.get(localPersonId);if(!sourceId||!linked||linked.schoolId!==schoolId||normalized(canonical(linked.name))!==normalized(name))throw new TypeError('An explicit identity link must match an existing reviewed person and institution.');if(linked.openAlexId&&openAlexId&&linked.openAlexId!==openAlexId)throw new TypeError('Conflicting indexed identities cannot share a local person.');}
  const id=localPersonId||sourceId?.trim()||personId(schoolId||institution||'unknown',name);
  if(!sourceId||localPersonId){for(const variant of [originalName,name,...(research.meta?.nameAliases?.[name]||[])])idAliases.set(personId(schoolId||institution||'unknown',variant),id);}
  if(localPersonId&&sourceId)idAliases.set(sourceId,id);
  for(const previousId of metadata.previousPersonIds||[])idAliases.set(previousId,id);
  const old=people.get(id);
  // Minimal edge endpoints must not erase the fuller profile or upgrade an indexed
  // affiliation to a checked, current appointment.
  const confirmed=verified||metadata.identityStatus==='verified';
  people.set(id,{...old,...metadata,id,name,schoolId:schoolId??old?.schoolId??null,institution:institution||old?.institution||schools.get(schoolId)?.name||'Current institution not checked',role:role||old?.role||(metadata.identityStatus==='indexed'?'Indexed author':'Faculty listing'),status:affiliationStatus||status||old?.status||'current',verified:confirmed||old?.verified||false,sources:[...new Map([...(old?.sources||[]),...sources].map(s=>[s.url,s])).values()],
   ...(openAlexId?{openAlexId}:{}),...(orcid?{orcid}:{})});
  return id;
 }
 for(const school of catalog)for(const faculty of school.faculty||[]) {
  person({name:faculty.name,schoolId:school.id,institution:school.name,status:'report listing',sources:faculty.url?[{label:'Faculty source from report',url:faculty.url}]:[]});
 }
 // Some reviewed bridges reference people introduced by the manual evidence below.
 for(const entry of research.people||[])if(!entry.localPersonId)person(entry);
 function add(a,b,evidence,sources,notes,kind='coauthor') {
  if(!a||!b||a===b||!evidence?.title||!evidence?.url)return;
  const canonicalEvidenceURL=kind==='coauthor'?(research.meta?.paperAliases?.[evidence.url]||evidence.url):evidence.url;
  const key=[kind,...(kind==='coauthor'?[a,b].sort():[a,b]),canonicalEvidenceURL].join('|');
  if(edgeKeys.has(key)){
   const old=edgeKeys.get(key);old.sources=[...new Map([...old.sources,...(sources||[])].map(s=>[s.url,s])).values()];return;
  }
  const edge={id:key,a,b,kind,evidence,paper:kind==='coauthor'?evidence:null,canonicalEvidenceURL,sources:sources||[],notes:notes||''};
  edgeKeys.set(key,edge);edges.push(edge);
 }

 for(const [schoolId,record] of Object.entries(research.schools||{}))for(const connection of record.connections||[]) {
  const a=person({name:connection.chicagoName,schoolId:connection.chicagoCurrentSchoolId||'university-of-chicago',institution:connection.chicagoCurrentInstitution||'University of Chicago',role:connection.chicagoRole,status:connection.chicagoAffiliationStatus,verified:true,sources:connection.sources});
  const b=person({name:connection.targetName||connection.schoolName,schoolId,institution:schools.get(schoolId)?.name,role:connection.schoolRole,status:connection.targetAffiliationStatus||'current',verified:true,sources:connection.sources});
  add(a,b,connection.paper,connection.sources,connection.notes);
 }
 for(const entry of research.extraEdges||[]) {
  const make=end=>person({...end,verified:end.identityStatus==='verified'||(!end.id&&!end.identityStatus),sources:entry.sources});
  add(make(entry.personA),make(entry.personB),entry.paper,entry.sources,entry.notes);
 }
 for(const entry of research.relationships||[]){const make=end=>person({...end,verified:end.identityStatus==='verified'||(!end.id&&!end.identityStatus),sources:entry.sources});add(make(entry.personA),make(entry.personB),entry.evidence,entry.sources,entry.notes,entry.kind);}
 for(const entry of research.people||[])person(entry);
 const edgesByPerson=new Map();for(const edge of edges)for(const id of [edge.a,edge.b]){if(!edgesByPerson.has(id))edgesByPerson.set(id,[]);edgesByPerson.get(id).push(edge);}
 return {people:[...people.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.institution.localeCompare(b.institution)),peopleById:people,idAliases,edgesByPerson,edges,meta:research.meta||{}};
}
export function connectionsForSchool(network,selectedIds,schoolId) {
 const selected=new Set(selectedIds.map(id=>resolvePersonId(network,id)));if(!selected.size)return [];
 const byId=network.peopleById||new Map(network.people.map(p=>[p.id,p]));
 const edges=network.edgesByPerson?[...new Set([...selected].flatMap(id=>network.edgesByPerson.get(id)||[]))]:network.edges;
 return edges.flatMap(edge=>{
  const rows=[];
  for(const [from,to] of [[edge.a,edge.b],[edge.b,edge.a]]) {
   const known=byId.get(from),target=byId.get(to);
   if(selected.has(from)&&target?.schoolId===schoolId&&!['former','deceased'].includes(target.status))rows.push({known,target,kind:edge.kind||'coauthor',knownIsMentor:edge.a===from,paper:edge.paper||edge.evidence,sources:edge.sources,notes:edge.notes,
    ...(edge.rawEdgeIds?{rawEdgeIds:edge.rawEdgeIds,sourceRecordIds:edge.sourceRecordIds,evidenceVariants:edge.evidenceVariants}:{})});
  }
  return rows;
 });
}
export function connectionRecordEvidence(row) {
 if(!row.rawEdgeIds?.length)return '';
 const variants=[...new Map((row.evidenceVariants||[]).filter(item=>item?.url).map(item=>[item.url,item])).values()];
 const probable=[row.known,row.target].filter(person=>person.grouping?.confidence==='probable').map(person=>person.name);
 return `${probable.length?`\nProbable identity match in combined profiles: ${probable.join('; ')}`:''}\nOriginal person records: ${(row.sourceRecordIds||[]).join('; ')}${row.rawEdgeIds.length>1?`\nCombined from ${row.rawEdgeIds.length} relationship records`:''}${variants.length>1?`\nPublication records: ${variants.map(item=>`${item.title}: ${item.url}`).join('; ')}`:''}`;
}
export function connectionExport(network,selectedIds,schoolId,kinds=null) {
 const text=connectionsForSchool(network,selectedIds,schoolId).filter(c=>!kinds||kinds.includes(c.kind)).map(c=>`${relationshipLabel(c)}: ${c.known.name} (${c.known.institution}; ${c.known.status}) ↔ ${c.target.name} (${c.target.role}; ${c.target.status}${c.target.schoolMatch?.status==='provisional'?'; provisional school match':''})\n${c.paper.title} · ${c.paper.year} ${c.paper.yearType||''}${c.paper.authors?.length?`\nAuthors: ${c.paper.authors.join('; ')}`:''}${c.paper.summary?`\n${c.paper.summary}`:''}\n${c.paper.url}\n${c.notes}\n${c.sources.map(s=>`${s.label}: ${s.url}`).join('\n')}${connectionRecordEvidence(c)}`).join('\n\n')||'No documented professional connection in the researched dataset for the selected people. This is not evidence of no connection.';
 const license=network.meta?.zbmath;
 return text+(license?`\n\nBibliographic data includes zbMATH Open; ${license.license||'CC BY-SA 4.0'} (${license.licenseURL||'https://creativecommons.org/licenses/by-sa/4.0/'}). Indexed records selected and linked into this graph. ${license.attribution||''}`:'');
}

export function relationshipLabel(row){return row.kind==='phd-supervision'?(row.knownIsMentor?'Selected professor supervised their PhD':'Their PhD adviser'):row.kind==='postdoc-supervision'?(row.knownIsMentor?'Selected professor was their postdoctoral mentor':'Their postdoctoral mentor'):row.kind==='co-organizer'?'Joint academic event organizers':row.kind==='research-collaboration'?'Documented research collaboration':'Coauthored paper';}
