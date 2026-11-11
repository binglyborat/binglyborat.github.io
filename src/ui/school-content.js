import {e,button,tag,textBlock,externalLink} from './components.js';
import {connectionsTab,committeeTab} from './connections.js';
import {locationMap} from './location-map.js';
import {FACULTY_META} from '../data/faculty-profiles.js';
import {programDossier} from '../core/programs.js';
import {facultyProfile} from '../core/faculty.js';
import {schoolRankings,departmentSize,urbanIndex} from '../core/school-facts.js';

const clean = text => String(text || '').replace(/\[(?:s|f)\d+(?:[,;\s]+(?:s|f)?\d+)*\]/gi,'').replace(/ {2,}/g,' ').trim();
const copy = text => textBlock(clean(text));
const block = (label,text) => text ? `<section class="summary-block"><h3>${e(label)}</h3>${copy(text)}</section>` : '';
const sourceList = sources => [...new Map(sources.filter(s=>s?.url).map(s=>[s.url,s])).values()].map(s=>`<p>${externalLink(s.url,s.label||'Source')}${s.checked?`<small>Checked ${e(s.checked)}</small>`:''}</p>`).join('');

export function rankingPanel(school) {
  const latest=new Map();
  for(const rank of schoolRankings(school)){
    const key=`${rank.system}:${rank.subject}`,previous=latest.get(key);
    if(!previous||(parseInt(rank.year)||0)>(parseInt(previous.year)||0))latest.set(key,rank);
  }
  const ranks=[...latest.values()];
  return `<section class="identity-rankings" aria-label="Mathematics rankings"><h2>Mathematics rankings</h2>${ranks.length?`<dl>${ranks.map(r=>`<div><dt>${e(r.subject)}<small>${e(r.system)} · ${e(r.year||'Year unspecified')}${r.tied?' · tied':''}</small>${r.note?`<small class="ranking-note">${e(r.note)}</small>`:''}</dt><dd>${r.url?externalLink(r.url,`${typeof r.rank==='number'?'#':''}${r.rank}`):e(r.rank)}</dd></div>`).join('')}</dl>`:'<p class="ranking-empty">No verified ranking recorded.</p>'}<p class="ranking-scope">Subject and graduate rankings · years shown per source</p></section>`;
}

function paperList(papers) {
  return `<ul class="faculty-papers">${papers.map(p=>`<li><span>${e(p.year||'n.d.')}</span> ${externalLink(p.url,p.title)}</li>`).join('')}</ul>`;
}

function faculty(school,dossier) {
  return `<div class="faculty-list">${(school.faculty||[]).map(person=>{
    const p=typeof person==='string'?{name:person}:person;
    const profile=facultyProfile(school,p);
    const original=dossier?.faculty?.find(f=>f.name===p.name);
    const brief=profile.summary||clean(original?.description?.split(/\[[^\]]+\]|Research evidence:/)[0]||'');
    const summary=brief===(p.areas||[]).join(' · ')?'':brief;
    const papers=profile.papers||[], availability=profile.availability||{};
    const areas=profile.areas?.length?profile.areas:p.areas||[];
    return `<article class="faculty-item faculty-profile"><div class="faculty-heading"><h3>${e(p.name)}</h3><div class="faculty-links">${p.url?externalLink(p.url,'Profile'):''}${profile.wikipedia?.url?externalLink(profile.wikipedia.url,'Wikipedia'):externalLink(profile.wikipediaSearchURL,'Wikipedia search')}</div></div>${p.role?`<p class="faculty-role">${e(p.role)}${p.status&&p.status!=='current'?` · ${e(p.status)}`:''}</p>`:''}${areas.length?`<p class="faculty-areas">${e(areas.join(' · '))}</p>`:''}${summary?`<p class="faculty-summary">${e(summary)}</p>`:''}<p class="faculty-availability"><strong>New students:</strong> ${e((availability.label||'Not publicly confirmed').replace(/^Supervision:\s*/,''))}${availability.url?` · ${externalLink(availability.url,'Public statement')}`:''}${availability.checked?` <small>Checked ${e(availability.checked)}</small>`:''}</p>${availability.summary?`<p class="faculty-role">${e(availability.summary)}</p>`:''}${papers.length?`<h4>Recent indexed papers${profile.paperIdentity==='provisional'?' · author match unreviewed':''}</h4>${paperList(papers.slice(0,3))}${papers.length>3?`<details><summary>${papers.length-3} more papers</summary>${paperList(papers.slice(3))}</details>`:''}`:`<p class="faculty-role">No recent paper indexed. ${externalLink(`https://arxiv.org/search/?query=${encodeURIComponent(p.name)}&searchtype=author&abstracts=show&order=-announced_date_first`,'Search arXiv')}</p>`}${original?.description?`<details><summary>Research & advising notes</summary>${copy(original.description)}</details>`:''}</article>`;
  }).join('')}</div>`;
}

function location(school,state) {
  const urban=urbanIndex(school),r=school.locationResearch;
  return `<section class="urban-card"><div><p class="eyebrow">URBAN INTENSITY · ESTIMATE</p><h3>${urban.score==null?'Not available':`${e(urban.score)}<small> / 100</small>`}</h3><p>${e(urban.label||'Location not classified')}</p></div>${urban.score==null?'':`<meter min="0" max="100" value="${urban.score}" aria-label="Urban intensity: ${urban.score} out of 100">${urban.score}/100</meter>`}<p class="urban-scale"><span>Remote / rural</span><span>Major city</span></p><details><summary>How this index works</summary>${copy(urban.method)}${urban.sourceUrl?externalLink(urban.sourceUrl,urban.sourceLabel||'Index source'):''}</details>${urban.walkScore?`<p class="walk-score">${externalLink(urban.walkScore.url,'City Walk Score')}: <strong>${e(urban.walkScore.score)}/100</strong> · ${e(urban.walkScore.year)}<br><small>Citywide walkability; campus conditions vary.</small></p>`:''}</section><p class="location-inline">${e([school.city,school.country].filter(Boolean).join(', '))} · ${e(school.ruralCampus?'Rural':school.setting||'Setting unknown')}</p>${locationMap(school,state)}${r?block('The area',r.summary)+[['transit','Transport'],['dining','Food'],['nature','Parks & outdoors']].map(([key,label])=>block(label,r[key])).join(''):block('Campus & surroundings',school.cityNotes)}`;
}

function size(school) {
  const counts=departmentSize(school);
  const metric=(label,item)=>`<div><dt>${e(label)}</dt><dd>${item?.value!=null?`${item.qualifier==='over'?'&gt; ':item.approximate?'≈ ':''}${e(Number(item.value).toLocaleString('en-US'))}${item.maximum?`–${e(Number(item.maximum).toLocaleString('en-US'))}`:''}`:'Not recorded'}</dd>${item?.year?`<small>${e(item.year)}</small>`:''}${item?.scope?`<p>${e(item.scope)}</p>`:''}${item?.note?`<p>${e(item.note)}</p>`:''}${item?.url?externalLink(item.url,'Source'):''}</div>`;
  return `<h3>Mathematics department</h3><dl class="size-metrics">${metric(/researchers/i.test(counts.faculty?.scope||'')?'Faculty & researchers':'Professors',counts.faculty)}${metric('Math undergraduates',counts.undergraduates)}${metric('Math graduate students',counts.graduates)}${counts.postdocs?metric('Postdocs / instructors',counts.postdocs):''}${counts.masters?metric('Math master’s students',counts.masters):''}</dl>${counts.note?`<p class="footer-note">${e(counts.note)}</p>`:''}<p class="footer-note">Department totals are separate from the faculty profiles collected here.</p><h3 class="size-university">University enrollment</h3>${school.enrollment?.total?`<dl class="size-metrics">${metric('All students',{value:school.enrollment.total,approximate:school.enrollment.approximate,year:school.enrollment.year,scope:school.enrollment.scope,url:school.enrollment.source?.url})}</dl>${school.enrollment.notes?copy(school.enrollment.notes):''}`:copy(school.size||'Not recorded')}`;
}

const sectionIds={admissions:['eligibility','deadlines','tests','records','letters','writing','checks'],funding:['funding'],international:['tests'],faculty:[],research:[]};
function extraDetails(key,school,dossier) {
  if(!sectionIds[key]?.length)return '';
  if(!dossier)return `<div class="details-loader">${button('load-school-details','More requirements & details','ghost small',`data-id="${e(school.id)}"`)}</div>`;
  const sections=(dossier.sections||[]).filter(s=>sectionIds[key].includes(s.id)||(school.programRoute&&key==='admissions'&&s.id!=='sources'));
  return sections.length?`<details class="detail-section"><summary>Detailed ${key==='funding'?'funding terms':key==='international'?'language & test rules':'requirements & deadlines'}</summary><div class="detail-content">${sections.map(s=>`<details class="detail-section"><summary>${e(s.title)}</summary><div class="detail-content">${s.fields?.length?s.fields.map(f=>block(f.label,`${f.status?`[${f.status}] `:''}${f.text}`)).join(''):copy(s.text)}</div></details>`).join('')}</div></details>`:'';
}

function sources(school,dossier,key) {
  const sources=[...(school.sources||[]),...(school.departmentNotes?.sources||[]),...(school.locationResearch?.sources||[]),...(school.research?.admissionsResearch?.sources||[]),...(dossier?.sources||[])];
  if(key==='faculty')for(const p of school.faculty||[])sources.push(...(facultyProfile(school,p).sources||[]));
  return sources.length?`<details class="detail-section school-sources"><summary>Sources & notes</summary><div class="detail-content source-list">${key==='research'||key==='department'?'<p>Research areas and faculty profiles are a selection, not a complete department roster.</p>':''}${sourceList(sources)}${key==='faculty'?`<p>${e(FACULTY_META.attribution)} ${e(FACULTY_META.zbmathAttribution)} ${externalLink(FACULTY_META.licenseURL,'CC BY-SA 4.0')}</p>`:''}</div></details>`:'';
}

export function schoolContent(key,school,state,dossier) {
  if(school.programRoute&&!dossier)dossier=programDossier(school);
  let content='';
  if(key==='department')content=school.departmentNotes?.paragraphs?.map(copy).join('')||'<p>Department overview not yet available.</p>';
  if(key==='connections')return connectionsTab(school,state);
  if(key==='committee')return committeeTab(school);
  if(key==='research')content=`<div class="research-tags chip-row">${school.areas.map(area=>tag(area,(state.prefs.areas||[]).includes(area))).join('')}</div><div class="research-next"><p>${school.faculty?.length||0} faculty profiles</p>${button('school-tab','View faculty','secondary small','data-tab="faculty"')}</div>`;
  if(key==='faculty')content=faculty(school,dossier);
  if(key==='funding')content=block('Funding & support',school.funding)+block('Application fee',school.costs);
  if(key==='admissions')content=block('Deadlines',school.deadlineDetails||school.deadline)+`<div class="application-links">${(school.links||[]).map(link=>externalLink(link.url,link.label||'Apply')).join(' · ')}</div>`+block('Program route',school.program)+(school.duration?block('Duration & structure',`${school.duration}\n${school.structure||''}`):'')+block('Eligibility & preparation',school.overview)+block('Before you apply',school.admissions)+block('Recommendation letters',school.letters)+block('Written materials',school.writing)+block('GRE General',school.greGeneral)+block('GRE Mathematics',school.greMath);
  if(key==='international')content=copy(school.international||'Requirements not recorded.');
  if(key==='city')content=location(school,state);
  if(key==='size')content=size(school);
  return content+extraDetails(key,school,dossier)+sources(school,dossier,key);
}
