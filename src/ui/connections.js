import {e,icon,button,tag,externalLink,textBlock,options} from './components.js';
import {NETWORK} from '../data/network.js';
import {connectionsForSchool,relationshipLabel,resolvePersonId} from '../core/network.js';

/** Loading is runtime data, never part of the saved workspace. */
export function networkLoadState(network,selectedIds=[]) {
 const ids=[...new Set(selectedIds.map(id=>resolvePersonId(network,id)))];
 const pending=typeof network.loadPeople==='function'?ids.filter(id=>!network.loaded?.has(id)):[];
 const failed=pending.filter(id=>network.errors?.has(id));
 return {ids,pending,failed,ready:pending.length===0};
}

export function connectionLoadNotice(network,selectedIds=[]) {
 const {pending,failed,ready}=networkLoadState(network,selectedIds);
 if(ready)return '';
 if(failed.length) {
  const names=failed.map(id=>network.peopleById?.get(id)?.name||network.people.find(person=>person.id===id)?.name||'a selected person');
  return `<div class="notice" role="alert" data-network-state="error"><p>Could not load relationship records for ${e(names.slice(0,4).join(', '))}${names.length>4?` and ${names.length-4} more`:''}. Check your connection and retry. Your selections and saved schools are unchanged.</p>${button('retry-connections','Retry connections','secondary small')}</div>`;
 }
 return `<p class="notice" role="status" data-network-state="loading">Loading relationship records for ${pending.length} selected ${pending.length===1?'person':'people'}…</p>`;
}

function relationshipCounts(network) {
 if(network.counts instanceof Map)return network.counts;
 const counts=new Map();for(const edge of network.edges)for(const id of [edge.a,edge.b])counts.set(id,(counts.get(id)||0)+1);
 return counts;
}
const relationshipTotal=network=>network.totalEdges??network.totalEdgeCount??network.meta?.totalEdges??network.edges.length;

function personHistory(person){
 const history=person.pastAffiliations||[];
 const indexed=person.reportedAffiliations||[];
 return `${history.length?`<p class="muted">Previously: ${e(history.map(a=>`${a.institution} · ${a.role||''} (${a.startYear||'?'}–${a.endYear||'?'})`).join('; '))}</p>`:''}${person.schoolMatch?.status==='provisional'?'<p class="muted">Provisional catalog association; check the linked index and profile sources.</p>':''}${indexed.length?`<details><summary>Institutions on indexed papers</summary><p class="muted">These are historical publication affiliations, not verified current appointments.</p>${indexed.map(a=>`<p>${e(a.institution)} · ${e((a.publicationYears||[]).join(', '))}</p>`).join('')}</details>`:''}`;
}
function personEvidence(person){return person.sources?.length?`<details><summary>Profile and publication sources (up to 5)</summary>${person.sources.slice(0,5).map(s=>`<p>${externalLink(s.url,s.label||'Source')}</p>`).join('')}</details>`:'';}
function indexAttribution(network){const source=network.meta.zbmath;return source?`<p>${e(source.attribution||'Includes bibliographic data from zbMATH Open.')} ${externalLink(source.licenseURL||'https://creativecommons.org/licenses/by-sa/4.0/',source.license||'CC BY-SA 4.0')}. Indexed records have been selected and linked into the graph.</p>`:'';}

function groupedRecords(person) {
 const records=person.sourceRecords||[];
 if(records.length<2)return '';
 const provisional=person.grouping?.confidence==='probable';
 const reasons=person.grouping?.reasons||[];
 return `<details class="identity-records" data-section="person-records-${e(person.id)}"><summary>${records.length} source records combined${provisional?' · probable match':''}</summary>
 <p>${provisional?'This grouping includes a probable identity match. Inspect the original profiles below.':'These profiles are linked by matching identity or publication evidence.'} All original records and connections are retained.</p>
 ${reasons.length?`<div class="identity-match-evidence"><p class="muted">Match evidence:</p>${reasons.map(reason=>typeof reason==='string'?`<p>${e(reason)}</p>`:`<p>${e(reason.label)}${reason.url?`: ${externalLink(reason.url,reason.title||reason.institution||'Matching source')}`:reason.value?`: ${e(reason.value)}`:''}</p>`).join('')}</div>`:''}
 ${records.map(record=>`<div class="identity-source"><strong>${e(record.name)}</strong><p>${e(record.institution)} · ${e(record.role)} · ${e(record.status)}</p><p><code>${e(record.id)}</code></p>${record.orcid?`<p>${externalLink(`https://orcid.org/${record.orcid}`,'ORCID profile')}</p>`:''}${(record.sources||[]).map(source=>`<p>${externalLink(source.url,source.label||'Original source')}</p>`).join('')}</div>`).join('')}</details>`;
}

export function peopleProfile(state,network=NETWORK) {
 const matching=state.ui.peoplePurpose==='connections',purpose=matching?'connections':'known';
 const selection=matching?(state.prefs.connectionPeople||[]):state.prefs.knownPeople;
 const heading=matching?'Professors for matching':'People I know';
 const description=matching?'Choose professors whose professional connections should help order your schools. Schools with documented connections to more of your selections rank higher; paper counts do not give one professor extra weight.':'Select people who know your work. School cards will show their documented coauthors, former PhD students, advisers and postdoctoral mentors at that institution.';
 const query=(state.ui.peopleQuery||'').trim().normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 const selected=new Set(networkLoadState(network,selection).ids);
 const counts=relationshipCounts(network);
 const results=network.people.filter(p=>[p.name,p.institution,p.role,p.status,...(p.indexedNames||[]),...(p.rawBylines||[]),...(p.pastAffiliations||[]).map(a=>a.institution),...(p.sourceRecords||[]).flatMap(record=>[record.name,record.institution,record.id])].join(' ').normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes(query)&&(!state.ui.peopleConnectedOnly||(counts.get(p.id)||0)>0));
 results.sort((a,b)=>Number((counts.get(b.id)||0)>0)-Number((counts.get(a.id)||0)>0)||Number(b.verified)-Number(a.verified)||a.name.localeCompare(b.name));
 const picked=network.people.filter(p=>selected.has(p.id));
 const unavailable=[...selected].filter(id=>!network.peopleById.has(id));
 return `<div class="profile-page"><div class="profile-step-header">${button('profile-step',`${icon('back')} My profile`,'ghost small','data-step="home"')}</div><header class="profile-heading"><h1 class="page-title">${heading}</h1><p class="page-description">${description}</p></header>
 <section class="panel"><h2>Selected people (${picked.length+unavailable.length})</h2><div class="chip-row">${picked.map(p=>button('remove-person',`${e(p.name)} · ${e(p.institution)} ×`,'secondary small',`data-id="${e(p.id)}" data-purpose="${purpose}"`)).join('')||(!unavailable.length?'<p class="muted">No people selected.</p>':'')}${unavailable.map(id=>button('remove-person',`Unavailable saved record: ${e(id)} ×`,'secondary small',`data-id="${e(id)}" data-purpose="${purpose}"`)).join('')}</div><p class="footer-note">The database combines faculty listings with publications, CVs and institutional biographies. Emeritus faculty and former postdocs are included. Indexed identities are searchable before manual review; publication-time affiliations do not establish a current appointment.</p></section>
 ${connectionLoadNotice(network,[...selected])}<section class="panel"><label class="field-label">Find a person<input class="input" type="search" data-ui="peopleQuery" value="${e(state.ui.peopleQuery||'')}" placeholder="Name or university" autocomplete="off"></label><label class="check-option"><input type="checkbox" data-ui="combinePeopleRecords" ${state.ui.combinePeopleRecords!==false?'checked':''}><span>Combine duplicate profiles</span></label><p class="footer-note">Matching profiles share one entry and their combined connections. Expand source records to inspect a match, or turn this off to view each original profile. Names alone are not enough to combine people.${network.grouping?.stats?` ${network.grouping.stats.sourceRecords.toLocaleString()} original profiles are shown as ${network.people.length.toLocaleString()} entries.`:''}</p><label class="check-option"><input type="checkbox" data-ui="peopleConnectedOnly" ${state.ui.peopleConnectedOnly?'checked':''}><span>Only show people with documented relationships in this dataset</span></label><p class="muted">${results.length} matching people · ${relationshipTotal(network)} documented relationship records. ${results.length>40?'First 40 shown; narrow your search.':''}</p><div class="people-results">${results.slice(0,40).map(p=>`<article class="person-result" data-person-id="${e(p.id)}"><div><h3>${e(p.name)}</h3><p>${e(p.institution)} · ${e(p.role)}</p><p class="muted">${counts.get(p.id)||0} documented relationship records${(counts.get(p.id)||0)>0?'':' · not yet researched'}</p><small class="muted">${p.verified&&['current','emeritus'].includes(p.status)?'Current appointment checked against linked sources':p.identityStatus==='indexed'?'Indexed identity; current appointment not checked':p.status==='report listing'?'Faculty listing; current affiliation unconfirmed':'Identity documented in linked sources; current appointment not checked'}${p.status!=='current'?` · ${e(p.status)}`:''}</small>${personHistory(p)}${groupedRecords(p)}${personEvidence(p)}${p.openAlexId?`<p class="muted">${externalLink(`https://openalex.org/authors/${p.openAlexId}`,`OpenAlex ${p.openAlexId}`)}${p.orcid?` · ${externalLink(`https://orcid.org/${p.orcid}`,'ORCID')}`:''}</p>`:''}</div>${button(selected.has(p.id)?'remove-person':'add-person',selected.has(p.id)?'Remove':'Select','secondary small',`data-id="${e(p.id)}" data-purpose="${purpose}" aria-label="${selected.has(p.id)?'Remove':'Select'} ${e(p.name)}, ${e(p.institution)}"`)}</article>`).join('')}</div></section>
 <p class="notice">Coverage is incomplete. A documented professional relationship does not establish admissions influence or a current personal connection. ${matching?'These choices affect school order and stay separate from People I know.':'Choose letter writers who know your mathematical work well.'}</p><footer class="profile-footer">${button(matching?'reset-connection-people':'reset-known-people','Clear selected people','ghost')}${matching?button('profile-step','Back to matching preferences','primary','data-step="priorities"'):button('start-discover','Review schools','primary')}</footer></div>`;
}

const CONNECTION_KINDS=[['all','All relationships'],['coauthor','Coauthored papers'],['phd-supervision','PhD advisers and students'],['postdoc-supervision','Postdoctoral mentors and researchers'],['co-organizer','Joint academic event organizers'],['research-collaboration','Research collaborations']];

function relationshipSentence(row) {
 const mentor=row.knownIsMentor?row.known:row.target,student=row.knownIsMentor?row.target:row.known;
 if(row.kind==='phd-supervision')return `${mentor.name} supervised ${student.name}’s PhD.`;
 if(row.kind==='postdoc-supervision')return `${mentor.name} was ${student.name}’s postdoctoral mentor.`;
 return '';
}

function connectionCard(row) {
 const publication=row.kind==='coauthor',evidence=row.paper||{},sentence=relationshipSentence(row);
 return `<article class="connection-card" data-connection-kind="${e(row.kind)}"><div class="chip-row">${tag(relationshipLabel(row))}</div>
 <h3>${e(row.known.name)} ${icon('arrow')} ${e(row.target.name)}</h3>
 <p class="muted">Selected person: ${e(row.known.institution)} · ${e(row.known.role)} · ${e(row.known.status)}</p>
 ${[row.known,row.target].some(person=>person.grouping?.confidence==='probable')?'<p class="notice">This connection includes a probable identity match. Inspect the combined source records in People I know, or turn off “Combine duplicate profiles” to view the original records separately.</p>':''}
 ${row.target.schoolMatch?.status==='provisional'?'<p class="notice">Provisional catalog association; the indexed identity and current appointment have not been independently checked.</p>':''}<p class="muted">At this school: ${e(row.target.institution)} · ${e(row.target.role)} · ${e(row.target.status)}</p>
 ${row.rawEdgeIds?.length>1?`<p class="muted">Combined from ${row.rawEdgeIds.length} source records. All evidence is listed below.</p>`:''}${sentence?textBlock(sentence):''}<p><strong>${externalLink(evidence.url,evidence.title)}</strong></p>
 <p>${e(evidence.year??'Year not specified')}${evidence.yearType?` · ${e(evidence.yearType)}`:''}</p>
 ${publication&&evidence.authors?.length?`<p class="muted">Authors: ${e(evidence.authors.join(', '))}</p>`:''}
 ${evidence.summary?textBlock(evidence.summary):''}
 <details class="detail-section"><summary>${publication?'Publication':'Relationship'} and affiliation evidence</summary><div class="detail-content source-list">${row.notes?textBlock(row.notes):''}${row.sourceRecordIds?.length?`<p class="muted">Original person records: ${e(row.sourceRecordIds.join('; '))}</p>`:''}${(row.evidenceVariants||[]).filter(item=>item.url!==evidence.url).map(item=>`<p>${externalLink(item.url,item.title||'Additional publication record')}</p>`).join('')}${(row.sources||[]).map(source=>`<p>${externalLink(source.url,source.label||'Evidence source')}<small>${source.kind?`${e(source.kind)} · `:''}${source.checked?`Checked ${e(source.checked)}`:'Check date not recorded'}</small></p>`).join('')}</div></details></article>`;
}

export function connectionsTab(school,state,network=NETWORK) {
 const ids=[...new Set([...(state.prefs.knownPeople||[]),...(state.prefs.connectionPeople||[])])],load=networkLoadState(network,ids);
 const allRows=load.ready?connectionsForSchool(network,load.ids,school.institutionId||school.id):[];
 const kind=CONNECTION_KINDS.some(([key])=>key===state.ui.connectionKind)?state.ui.connectionKind:'all';
 const kindOrder={'coauthor':0,'phd-supervision':1,'postdoc-supervision':2};
 const rows=allRows.filter(row=>kind==='all'||row.kind===kind).sort((a,b)=>(kindOrder[a.kind]??3)-(kindOrder[b.kind]??3));
 return `<div class="panel-header"><p>${load.ids.length} selected people · ${load.ready?`${allRows.length} documented relationship records`:'Connection records pending'}</p><div class="inline-actions">${button('profile-step','Edit people I know','secondary small','data-step="people"')}${state.prefs.connectionPeople?.length?button('choose-connection-people','Edit matching professors','secondary small'):''}</div></div>
 <label class="field-label">Relationship type<select class="select" data-ui="connectionKind">${options(CONNECTION_KINDS,kind)}</select></label>
 ${!load.ready?connectionLoadNotice(network,ids):!ids.length?'<p class="notice">Select people you know in Profile to see their professional relationships at this school. You can select anyone in the database.</p>':!rows.length?`<p class="notice">${allRows.length?'No records of this relationship type match your selections. Choose another type to see the other connections.':'No professional relationship to your selections has been documented in this dataset. Coverage is incomplete; this is not evidence that no connection exists.'}</p>`:''}
 ${rows.length?`<div class="connection-list">${rows.slice(0,5).map(connectionCard).join('')}</div>${rows.length>5?`<details class="detail-section" data-section="more-connections-${e(school.id)}-${kind}"><summary>More connections (${rows.length-5})</summary><div class="detail-content connection-list">${rows.slice(5).map(connectionCard).join('')}</div></details>`:''}`:''}
 <details class="detail-section"><summary>Sources & coverage</summary><div class="detail-content">${textBlock(network.meta.mathSciNetAccess||'MathSciNet records have not been inspected.')}<p>${network.people.length} searchable people${network.rawNetwork?` from ${network.rawNetwork.people.length} original person records`: ''} · ${relationshipTotal(network)} documented relationships. Each record links its publication, CV, biography or institutional evidence.</p><p>Relationships are included only when supported by the linked source. Professional relationships do not establish current closeness or admissions influence. Former affiliations and historical supervision are labeled.</p>${indexAttribution(network)}${externalLink('https://mathscinet.ams.org/mathscinet/publications-search','Open MathSciNet')}</div></details>`;
}

export function committeeTab(school) {
 const committee=school.committee;
 if(!committee)return '<p>No committee roster recorded.</p>';
 return `<div class="chip-row">${tag(committee.status)}${committee.cycle?tag(committee.cycle):''}</div>${textBlock(committee.summary)}<div class="faculty-list">${(committee.members||[]).map(p=>`<div class="faculty-item"><strong>${e(p.name)}</strong><span>${e(p.role)}</span></div>`).join('')}</div><details class="detail-section"><summary>Sources & role notes</summary><p>A graduate director is not necessarily on the admissions committee. Roles may change by cycle.</p><div class="source-list">${(committee.sources||[]).map(s=>`<p>${externalLink(s.url,s.label)}<small>${e(s.checked||'')}</small></p>`).join('')}</div></details>`;
}
