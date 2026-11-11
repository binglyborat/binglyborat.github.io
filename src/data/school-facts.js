/** Dated mathematics rankings and department headcounts from public sources.
 * Ranking populations are kept separate: US graduate departments vs worldwide subjects.
 * A missing value is not a zero or an unranked institution.
 */
const checked = '2026-11-10';
const rank = (system, subject, value, year, url, extra={}) => ({system,subject,rank:value,year,url,checked,...extra});
const count = (value, scope, url, extra={}) => ({value,scope,url,year:'Undated; checked Nov 2026',checked,...extra});
const qs = 'https://www.topuniversities.com/university-subject-rankings/mathematics';
const mit = 'https://news.mit.edu/2026/mit-graduate-engineering-business-programs-ranked-highly-us-news-0407';
const chicago = 'https://physicalsciences.uchicago.edu/news/article/psd-among-2023-u.s-news-world-report-top-science-graduate-schools/';
const texas = 'https://cns.utexas.edu/news/announcements/computing-sciences-math-ut-among-best-us-graduate-study';
const hopkins = 'https://hub.jhu.edu/2026/04/07/best-graduate-program-rankings/';
const utah = 'https://attheu.utah.edu/arts-humanities/usnwr-2026-graduate-rankings/';
const overall = (value,year,url,extra={}) => rank('U.S. News','Mathematics (US graduate)',value,year,url,{overall:true,...extra});
const specialty = (name,value,year,url,extra={}) => rank('U.S. News',name,value,year,url,extra);
const global = (system,value,year,url,extra={}) => rank(system,'Mathematics (world)',value,year,url,{overall:true,...extra});
export const SCHOOL_FACTS = {
 'university-of-chicago': {rankings:[overall(6,2023,chicago),specialty('Algebra / number theory / algebraic geometry',8,2023,chicago),specialty('Analysis',3,2023,chicago),specialty('Geometry',6,2023,chicago),specialty('Topology',2,2023,chicago,{tied:true}),global('Shanghai GRAS',11,2026,'https://www.shanghairanking.com/universities/university-of-chicago')],department:{faculty:count(30,'Tenured and tenure-track faculty','https://mathematics.uchicago.edu/about/',{qualifier:'over'}),note:'About 10% of College graduating seniors receive mathematics degrees; a current undergraduate headcount is not published on the department overview.'}},
 'massachusetts-institute-of-technology': {rankings:[overall(2,2026,mit,{tied:true}),global('U.S. News Global',3,2025,'https://ir.mit.edu/projects/us-news-world-report/')],department:{faculty:count(50,'Mathematics faculty','https://math.mit.edu/about/index.html',{approximate:true}),undergraduates:count(360,'Mathematics and mathematics with computer science majors','https://math.mit.edu/about/index.html',{approximate:true}),graduates:count(100,'Mathematics graduate students','https://math.mit.edu/about/index.html',{qualifier:'over'}),postdocs:count(30,'Instructors, including CLE Moore Instructors','https://math.mit.edu/about/index.html',{approximate:true})}},
 'harvard-university': {rankings:[overall(2,2026,mit,{tied:true})]},
 'stanford-university': {rankings:[overall(2,2026,mit,{tied:true})]},
 'university-of-california-berkeley': {rankings:[overall(2,2026,mit,{tied:true})],department:{faculty:count(55,'Regular mathematics faculty','https://math.berkeley.edu/about',{approximate:true}),graduates:count(180,'Mathematics graduate students','https://math.berkeley.edu/about',{approximate:true}),undergraduates:count(800,'Mathematics undergraduate majors','https://math.berkeley.edu/about',{qualifier:'over'}),postdocs:count(25,'Postdoctoral scholars','https://math.berkeley.edu/about',{maximum:30})}},
 'princeton-university': {rankings:[global('Shanghai GRAS',1,2026,'https://www.shanghairanking.com/universities/princeton-university')],department:{faculty:count(87,'Faculty and researchers (includes research appointments)','https://www.math.princeton.edu/about',{year:'2026–27'}),graduates:count(78,'Mathematics graduate students','https://www.math.princeton.edu/about',{year:'2026–27'}),undergraduates:count(108,'Mathematics undergraduate majors','https://www.math.princeton.edu/about',{year:'2026–27'})}},
 'johns-hopkins-university': {rankings:[overall(16,2026,hopkins,{tied:true}),specialty('Analysis',18,'2026 listing',hopkins,{tied:true,note:'Carried forward; not newly ranked in 2026.'}),specialty('Algebra / number theory / algebraic geometry',23,'2026 listing',hopkins,{tied:true,note:'Carried forward; not newly ranked in 2026.'}),specialty('Applied mathematics',25,'2026 listing',hopkins,{note:'Carried forward; not newly ranked in 2026.'})]},
 'university-of-texas-at-austin': {rankings:[overall(12,2026,texas),specialty('Algebra / number theory / algebraic geometry',19,'2026 listing',texas,{note:'Specialty ranking carried forward from an earlier edition.'}),specialty('Analysis',8,'2026 listing',texas,{note:'Specialty ranking carried forward from an earlier edition.'}),specialty('Applied mathematics',7,'2026 listing',texas,{note:'Specialty ranking carried forward from an earlier edition.'}),specialty('Topology',8,'2026 listing',texas,{note:'Specialty ranking carried forward from an earlier edition.'})]},
 'university-of-utah': {rankings:[overall(36,2026,utah),specialty('Algebra / number theory / algebraic geometry',19,'2026 listing',utah)]},
 'university-of-wisconsin-madison': {rankings:[overall(16,2026,'https://news.wisc.edu/most-recent-u-s-news-rankings-by-department/',{tied:true})]},
 'boston-college': {rankings:[overall(61,2026,'https://www.bc.edu/bc-web/sites/bc-news/articles/2026/spring/us-news-graduate-rankings.html')]},
 'binghamton-university-suny': {rankings:[overall(93,2026,'https://www.binghamton.edu/news/story/6177/2026-us-news-and-world-report-graduate-rankings/')]},
 'new-york-university-courant-institute': {rankings:[global('Shanghai GRAS',10,2026,'https://www.shanghairanking.com/universities/new-york-university')]},
 'university-of-cambridge': {rankings:[global('Shanghai GRAS',5,2026,'https://www.shanghairanking.com/universities/university-of-cambridge')]},
 'universite-paris-saclay-orsay-hadamard': {rankings:[global('Shanghai GRAS',2,2026,'https://www.universite-paris-saclay.fr/en/news/2026-shanghai-ranking-global-ranking-academic-subjects-gras')]},
 'university-of-bonn-bigs-mathematics-mpim': {rankings:[global('Shanghai GRAS',27,2026,'https://www.uni-bonn.de/en/news/universitaet-bonn-stark-im-shanghai-faecherranking-2026')]},
 'cornell-university': {department:{faculty:count(43,'Tenured and tenure-track mathematics faculty','https://math.cornell.edu/')}},
 'university-of-california-irvine': {department:{graduates:count(110,'Mathematics graduate students','https://www.math.uci.edu/about',{approximate:true}),undergraduates:count(615,'Mathematics undergraduate majors','https://www.math.uci.edu/about',{qualifier:'over'})}},
};
// Exact placements visible in the publisher's 2026 mathematics table.
for (const [id,value,tied=false] of [
 ['massachusetts-institute-of-technology',1],['university-of-oxford',2],['university-of-cambridge',3],['harvard-university',4],['princeton-university',5],['stanford-university',6,true],['university-of-california-berkeley',6,true],['imperial-college-london',8,true],['sorbonne-universite',11],['nanyang-technological-university',12,true],['tsinghua-university-mathematics-department-and-qiuzhen-college',12,true],['university-of-california-los-angeles',12,true],['universite-paris-saclay-orsay-hadamard',19],['california-institute-of-technology',20],['carnegie-mellon-university',21],['university-of-chicago',22,true],['university-of-warwick',28],['university-of-edinburgh-and-agq-cdt-with-glasgow-and-heriot-watt',29,true],['university-of-waterloo',29,true],
]) {
 const facts=SCHOOL_FACTS[id] ||= {};
 (facts.rankings ||= []).push(global('QS',value,2026,qs,{tied}));
}

SCHOOL_FACTS['university-of-oxford'].department={
 faculty:count(100,'Mathematical Institute faculty','https://www.maths.ox.ac.uk/about-us',{qualifier:'over'}),
 undergraduates:count(950,'Undergraduates including joint courses','https://www.maths.ox.ac.uk/about-us',{approximate:true}),
 graduates:count(250,'Graduate research students; excludes separately listed master’s students','https://www.maths.ox.ac.uk/about-us',{maximum:300,approximate:true}),
 masters:count(250,'Master’s students across five programmes','https://www.maths.ox.ac.uk/about-us',{approximate:true}),
};
SCHOOL_FACTS['university-of-washington-seattle']={department:{
 faculty:count(49,'Permanent mathematics faculty','https://math.washington.edu/about',{approximate:true}),
 graduates:count(100,'Full-time mathematics graduate students','https://math.washington.edu/about',{qualifier:'over'}),
 undergraduates:count(800,'Mathematics and joint ACMS undergraduate majors','https://math.washington.edu/about',{qualifier:'over'}),
}};

/** Published 2021 citywide Walk Scores; not a campus score or city-size metric. */
export const CITY_WALK_SCORES = {
 'United States': {'New York City':88,Chicago:77.2,Boston:82.8,'Washington, DC':76.7,Washington:76.7,Philadelphia:74.8,Seattle:74.4,'Los Angeles':68.6,Houston:47.5,Austin:41.7,Columbus:41.2,Baltimore:64.3,Nashville:28.8,Denver:61.2,Milwaukee:61.5,Portland:67.3,Albuquerque:42.6,Tucson:43.2,Atlanta:47.7,Raleigh:31.3,Cleveland:57.1,Minneapolis:71.4,'New Orleans':58,'St. Louis':65.7,Pittsburgh:62.4,Riverside:42.7,Buffalo:66.6,Lincoln:44.1,Madison:49.7,'Baton Rouge':39.1,Durham:30.3,Irvine:43.2},
 Canada:{Vancouver:79.8,Montréal:65.4,Montreal:65.4,Toronto:61,Hamilton:49.6,Winnipeg:48.5,Ottawa:45.1,Calgary:39.1,Edmonton:40.2,London:38.6},
};
export const WALK_SCORE_SOURCE = 'https://www.walkscore.com/cities-and-neighborhoods/';

const tech='https://math.gatech.edu/news/us-news-ranks-college-sciences-graduate-programs-among-nations-best';
for(const id of ['georgia-institute-of-technology','rice-university','rutgers-university-new-brunswick','university-of-washington-seattle']){
 const facts=SCHOOL_FACTS[id] ||= {};
 (facts.rankings ||= []).push(overall(26,2026,tech,{tied:true}));
}
SCHOOL_FACTS['georgia-institute-of-technology'].rankings.push(
 specialty('Analysis',20,2023,tech,{tied:true}),specialty('Applied mathematics',16,2023,tech,{tied:true}),specialty('Discrete mathematics / combinatorics',5,2023,tech,{tied:true})
);
SCHOOL_FACTS['georgia-institute-of-technology'].department={faculty:count(60,'Permanent mathematics faculty','https://upsun-main.sciences.gatech.edu/graduate-studies-mathematics',{approximate:true})};
SCHOOL_FACTS['university-of-illinois-urbana-champaign']={rankings:[overall(21,2026,'https://illinois.edu/about/rankings/',{tied:true})]};

// Counted unique role-labelled entries in the live official directory, 2026-11-10.
// Directory listings are not a registrar-certified enrollment census.
SCHOOL_FACTS['university-of-chicago'].department.graduates=count(79,'Graduate student listings in the mathematics directory','https://mathematics.uchicago.edu/people/',{year:'10 Nov 2026',note:'Count of entries labelled Graduate Student; the directory may lag enrollment changes.'});
SCHOOL_FACTS['university-of-chicago'].department.postdocs=count(30,'Dickson Instructor listings','https://mathematics.uchicago.edu/people/',{year:'10 Nov 2026'});

// Secondary transcription fills gaps where the publisher blocks automated access.
// Its top placements agree with the independently checked university releases above.
const republished='https://www.forwardpathway.us/us-colleges-ranking/science-grad-mathematics';
for(const [id,value,tied=true] of [
 ['princeton-university',1,false],['columbia-university',9,false],['university-of-california-los-angeles',6],['california-institute-of-technology',8,false],['new-york-university-courant-institute',10],['university-of-michigan-ann-arbor',10],['cornell-university',12],['yale-university',12],['brown-university',15,false],['duke-university',16],['university-of-minnesota-twin-cities',16],['university-of-pennsylvania',16],['carnegie-mellon-university',21],['northwestern-university',21],['university-of-california-san-diego',21],['university-of-maryland-college-park',21],['ohio-state-university',30,false],['stony-brook-university-suny',31],['texas-a-m-university-college-station',31],['pennsylvania-state-university-university-park',31],['university-of-california-davis',31],['university-of-north-carolina-at-chapel-hill',31],['university-of-california-irvine',36],['university-of-notre-dame',36],
 ['indiana-university-bloomington',39],['purdue-university-west-lafayette',39],['university-of-arizona',39],['university-of-colorado-boulder',39],['university-of-southern-california',39],['vanderbilt-university',39],['washington-university-in-st-louis',39],
 ['michigan-state-university',46],['north-carolina-state-university',46],['university-of-california-santa-barbara',46],['university-of-illinois-chicago',46],['university-of-virginia',46],
 ['boston-university',51],['northeastern-university',51],
 ['arizona-state-university',53],['cuny-graduate-center',53],['dartmouth-college',53],['university-of-florida',53],['university-of-georgia',53],['university-of-massachusetts-amherst',53],['university-of-pittsburgh',53],['virginia-tech',53],
 ['brandeis-university',61],['emory-university',61],['university-of-california-riverside',61],['university-of-connecticut',61],['university-of-oregon',61],
 ['louisiana-state-university',67],['tufts-university',67],['tulane-university',67],['university-of-california-santa-cruz',67],['university-of-iowa',67],['university-of-missouri-columbia',67],
 ['auburn-university',73],['colorado-state-university',73],['iowa-state-university',73],['university-of-tennessee-knoxville',73],['university-of-kansas',73],['university-of-nebraska-lincoln',73],
 ['clemson-university',79],['florida-state-university',79],['rensselaer-polytechnic-institute',79],['temple-university',79],['university-of-south-carolina',79],
 ['case-western-reserve-university',84],['oregon-state-university',84],['university-of-delaware',84],
 ['drexel-university',87],['oklahoma-state-university',87],['university-of-houston',87],['university-of-kentucky',87],['university-of-oklahoma-norman',87],['university-of-rochester',87],
 ['brigham-young-university',93],['george-mason-university',93],['george-washington-university',93],['kansas-state-university',93],['lehigh-university',93],['syracuse-university',93],
]){
 const facts=SCHOOL_FACTS[id] ||= {};
 (facts.rankings ||= []).unshift(overall(value,2026,republished,{tied,sourceKind:'secondary',note:'2026 U.S. News graduate ranking, republished by Forward Pathway.'}));
}
