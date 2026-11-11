import {SCHOOL_FACTS,CITY_WALK_SCORES,WALK_SCORE_SOURCE} from '../data/school-facts.js';
import {isRuralCampus} from './geography.js';

const institution = school => school.institutionId || school.id;
export function schoolRankings(school) {
 if (school.rankings) return school.rankings;
 const entries=[...(SCHOOL_FACTS[institution(school)]?.rankings||[])];
 // Preserve existing dated QS evidence as its own global ranking row.
 if(Number.isFinite(school.rank)&&/^QS Mathematics/.test(school.rankSource||'')&&!entries.some(r=>r.system==='QS'))entries.push({system:'QS',subject:'Mathematics (world)',rank:school.rank,year:2026,overall:true,url:'https://www.topuniversities.com/university-subject-rankings/mathematics',checked:school.checked});
 return entries;
}
export function departmentSize(school) {
 return {faculty:null,undergraduates:null,graduates:null,postdocs:null,...SCHOOL_FACTS[institution(school)]?.department};
}
/** A national doctoral ranking is the default scalar for the existing rank
 * preference/filter. Global rankings remain separate, not substituted for it. */
export function graduateMathRank(school) {
 return schoolRankings(school).filter(r=>r.system==='U.S. News'&&r.overall&&typeof r.rank==='number').sort((a,b)=>Number(b.year)-Number(a.year))[0] || null;
}
// Explicit coarse bands, not measured travel times or an external city rating.
const largeCity = /^(Chicago|New York City|London|Paris|Tokyo|Beijing|Shanghai|Hong Kong|Singapore|Toronto|Los Angeles|Boston|Philadelphia|Houston|Berlin|Sydney|Melbourne|Montréal|Montreal|Madrid|Rome|Vienna|Seoul|São Paulo)$/i;
export function urbanIndex(school) {
 const rural=isRuralCampus(school),setting=school.setting;
 let score = rural?15:({'College town':40,Suburban:55,City:70}[setting]??null);
 if(!rural&&setting==='City'&&largeCity.test(school.city||''))score=90;
 if(!rural&&setting==='City'&&school.city==='New York City')score=100;
 const label=score===null?'Setting not classified':score>=90?'Major city':score>=70?'Urban':score>=55?'Suburban':score>=40?'College town':'Rural';
 const publishedWalkScore=CITY_WALK_SCORES[school.country]?.[school.city];
 const walkScore=publishedWalkScore===undefined?null:{score:publishedWalkScore,year:2021,url:WALK_SCORE_SOURCE,scope:'Citywide'};
 return {score,label,walkScore,estimated:true,method:'App estimate: rural 15, college town 40, suburban 55, city 70, major city 90, New York City 100. Uses campus setting and city; it does not measure transport or walkability.',sourceUrl:school.ruralEvidence?.url||school.locationResearch?.sources?.[0]?.url||school.links?.find(s=>/campus|location|about/i.test(s.label||''))?.url||'',sourceLabel:school.ruralEvidence?'Campus description':'Catalog campus setting and city',basis:`${school.city||'City unknown'} · ${rural?'Rural':setting||'Unknown'}`};
}
