/** A program inherits institutional context, never another degree's admissions rules. */
export function programEntries(programs, institutions) {
 const byId=new Map(institutions.map(s=>[s.id,s]));
 return programs.map(route=>{
  const parent=byId.get(route.institutionId);
  const sources=route.sources.map(s=>({...s,checked:'2026-11-09'}));
  const deadlineDetails=route.deadlines.map(d=>`${d.label}: ${d.date||'No confirmed date'} · ${d.cycle} · ${d.status}\n${d.note||''}`).join('\n\n');
  const degree=/DPhil|PhD/i.test(route.degreeType)?'PhD':'Master’s';
  return {
   id:route.id,institutionId:route.institutionId||route.id,institutionName:route.institutionName,
   name:`${route.institutionName} — ${route.name}`,program:route.name,
   programType:degree==='PhD'?'Research doctorate':route.format.includes('consortium')?'International consortium master’s':route.format.includes('Second-year')?'Second-year master’s (M2)':'Master’s program',
   programFormat:route.format,degree:[degree],award:route.degreeType,duration:route.duration,programRoute:route,
   country:route.country||route.countries[0],countries:route.countries,city:route.city,region:parent?.region||route.country,
   setting:parent?.setting||'Unknown',schoolSize:parent?.schoolSize||'Unknown',size:parent?.size||'University enrollment has not been researched for this entry.',
   ruralCampus:parent?.ruralCampus,ruralEvidence:parent?.ruralEvidence,
   enrollment:parent?.enrollment,enrollmentTotal:parent?.enrollmentTotal,enrollmentYear:parent?.enrollmentYear,enrollmentScope:parent?.enrollmentScope,enrollmentSource:parent?.enrollmentSource,
   faculty:parent?.faculty||[],areas:parent?.areas||[],areaNote:'Institution-level research topics; consult this program’s course choices and eligibility.',
   rank:parent?.rank??null,rankSource:parent?.rankSource,rankNote:parent?.rankNote||'No verified numeric rank for this program.',
   deadline:route.deadlines.find(d=>d.date&&d.status.startsWith('confirmed'))?.date||null,deadlineDetails,
   overview:route.eligibility,admissions:route.applicationRoute,structure:route.structure,letters:route.references,
   funding:route.funding,international:route.internationalNotes,costs:route.costs||'See the program-specific fee and funding sources.',
   writing:route.writing||'Follow the linked program application checklist.',greGeneral:route.greGeneral||'No program-specific requirement established here.',greMath:route.greMath||'No program-specific requirement established here.',
   sources,independentSources:sources,links:sources,url:sources[0]?.url,checked:'2026-11-09',
   research:{admissionsResearch:{sources}},committee:{status:'not-researched',members:[],summary:'An admissions committee roster has not been researched for this specific program.',sources:[]},
   committeeMembers:'No published roster established',committeeEvidence:'No committee roster established for this program.',
   locationResearch:parent?.locationResearch,locationBasis:parent?.locationBasis,
  };
 });
}

export function programDossier(school) {
 const route=school.programRoute;
 return {name:school.name,sections:[{id:'program',title:'Program details',fields:[
  ['Award',route.degreeType],['Format',route.format],['Duration',route.duration],['Eligibility',route.eligibility],
  ['Course structure',route.structure],['Application route',route.applicationRoute],['Recommendation letters',route.references],
  ['Deadlines',school.deadlineDetails],['Funding',route.funding],['International applicants',route.internationalNotes],
 ].map(([label,text])=>({label,text,status:'Program-specific research'}))}],faculty:school.faculty||[],sources:school.sources,pages:[]};
}
