import {SCHOOLS} from './schools.js';
import {RESEARCH,CONNECTIONS_CONTEXT as CONNECTIONS} from './institutions.js';
import {PROGRAMS} from './programs.js';
import {programEntries} from '../core/programs.js';
import {personId} from '../core/network.js';
import {schoolCountries} from '../core/geography.js';
import {CAMPUS_CONTEXT} from './campus-context.js';
import {DEPARTMENT_NOTES} from './department-notes.js';

export const CONNECTIONS_META=CONNECTIONS.meta||{};
const sizeClass=total=>total<10000?'Small':total<25000?'Medium':'Large';
const sourceText=sources=>(sources||[]).map(s=>`${s.label||'Source'}: ${s.url}`).join('\n');
const institutions=SCHOOLS.map(base=>{
 const research=RESEARCH[base.id]||{},enrollment=research.enrollment;
 const connections=CONNECTIONS.schools?.[base.id]||{status:'not-researched',connections:[]};
 const committee=research.committee||{status:'not-researched',members:[],summary:'Committee membership has not yet been independently researched for this program.',sources:[]};
 const campus=CAMPUS_CONTEXT[base.id]||{};
 const independentSources=[enrollment?.source,...(enrollment?.sources||[]),...(committee.sources||[]),...(research.locationResearch?.sources||[]),...(research.admissionsResearch?.sources||[]),...(research.sources||[]),campus.ruralEvidence].filter(Boolean);
 const total=enrollment?.total;
 const size=total?`${enrollment.approximate?'Approximately ':''}${total.toLocaleString('en-US')} students · ${enrollment.year}\nScope: ${enrollment.scope}\n${enrollment.notes||''}\nSource: ${enrollment.source.label} (${enrollment.source.kind||'research source'})\n${enrollment.source.url}`:research.enrollmentNote||base.size;
 const additions=(CONNECTIONS.people||[]).filter(p=>p.schoolId===base.id&&p.identityStatus==='verified'&&['current','emeritus'].includes(p.affiliationStatus));
 const movedIds=new Set((CONNECTIONS.people||[]).flatMap(p=>p.previousPersonIds||[]));
 const faculty=base.faculty.filter(p=>!movedIds.has(personId(base.id,p.name)));
 for(const p of additions){
  const index=faculty.findIndex(f=>f.name===p.name),profile={name:p.name,role:p.role,status:p.affiliationStatus,url:p.sources?.[0]?.url};
  if(index<0)faculty.push({...profile,areas:p.areas||[]});
  else faculty[index]={...faculty[index],...profile};
 }
 return {...base,...campus,countries:schoolCountries(base),faculty,institutionId:base.id,institutionName:base.name,programType:base.degree.length>1?'Department overview':base.degree.includes('PhD')?'Research doctorate':'Master’s program',research,enrollment,schoolSize:total&&enrollment.comparable!==false?sizeClass(total):base.schoolSize,size,
  letters:research.admissionsResearch?.letters||base.letters,
  deadlineDetails:research.admissionsResearch?.deadlineDetails||base.deadlineDetails,
  committee,connections,locationResearch:research.locationResearch,
  enrollmentTotal:total??null,enrollmentYear:enrollment?.year||'',enrollmentScope:enrollment?.scope||'',enrollmentSource:enrollment?.source?.url||'',
  committeeMembers:committee.members?.map(p=>`${p.name} — ${p.role}`).join('; ')||'No published roster established',
  committeeEvidence:[committee.cycle,committee.summary,sourceText(committee.sources)].filter(Boolean).join('\n'),
  uchicagoConnections:connections.connections?.map(c=>`${c.chicagoName} (${c.chicagoAffiliationStatus}; ${c.chicagoRole}) ↔ ${c.targetName||c.schoolName} (${c.schoolRole})\n${c.paper.title} (${c.paper.year})\n${c.paper.url}\n${c.notes||''}\n${sourceText(c.sources)}`).join('\n\n')||`Coverage: ${connections.status}; no documented connection in this dataset.`,
  connectionCoverage:`${connections.status}; checked ${connections.checked||'not yet'}; MathSciNet: ${CONNECTIONS_META.mathSciNetAccess||'Access not established'}`,
  independentSources,sources:[...base.sources,...independentSources],
 };
});
export const CATALOG=[...institutions,...programEntries(PROGRAMS,institutions)].map(school=>({...school,departmentNotes:DEPARTMENT_NOTES[school.id]}));
