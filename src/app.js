import {programDossier} from './core/programs.js';
import {CATALOG} from './data/catalog.js';
import {NETWORK,networkForState,useNetworkForState} from './data/network.js';
import {connectionExport,updateSelectedPeople} from './core/network.js';
import {buildConnectionFit} from './core/connection-fit.js';
import {reviewQueue,visitSchool,moveReview,restartReview,markUnreviewed,restoreDecisions} from './core/review.js';
import {mountLocationMap} from './ui/location-map.js';
import {DOSSIER_FIELDS} from './data/fields.js';
import {createStore,defaultPrefs} from './core/storage.js';
import {rankSchools,scoreSchool} from './core/matching.js';
import {BUILTIN_FIELDS,applyExportPreset,moveExportField,buildCSV,serializeBackup,parseBackup,downloadFile} from './core/export.js';
import {e,icon,button,pageHeading,recordFor,options} from './ui/components.js';
import {preferencesView} from './ui/preferences.js';
import {discoverView} from './ui/discover.js';
import {shell} from './ui/navigation.js';
import {resetSchoolFilters,resetPriorities,effectivePreferences,moveCardSection} from './core/profile.js';
import {routeFor,parseRoute} from './core/routes.js';
import {attachSwipe} from './ui/swipe.js';
import {attachCardReorder} from './ui/card-reorder.js';
import {schoolCard} from './ui/school.js';
import {collectionView} from './ui/collection.js';
import {networkLoadState,connectionLoadNotice} from './ui/connections.js';
import {exportView,exportSchools,dataView,reportView} from './ui/settings.js';

const app=document.querySelector('#app');
const clone=value=>JSON.parse(JSON.stringify(value));
const catalog=CATALOG;
let cleanupMap=()=>{};
const dossiers=new Map();
const detailRequests=new Set();
let report=null, reportLoading=false, state, store, timer, toastTimer;
let status={level:'ready',message:'Opening your workspace…'};
let pending=0, dirty=false;
let networkSelectionKey=null, networkRequest=null, exporting=false;
let connectionFitCache=null, deferredRender=false;
const views={discover:'Discover',collection:'My collection',preferences:'Preferences',export:'Tracker & export',data:'Backups & storage'};
const cancelSwipe=attachSwipe(app,{enabled:()=>state?.ui.view==='discover'&&!state.ui.detailId,onDecision:decide,
 onSettled:()=>queueMicrotask(()=>{if(deferredRender)render();})});
const cancelCardReorder=attachCardReorder(app,{
 onReorder:keys=>{
  const current=state.prefs.details;
  if(keys.length!==current.length||new Set(keys).size!==keys.length||keys.some(key=>!current.includes(key)))return;
  state.prefs.details=[...keys];save();render();
 },
 onSettled:()=>{if(deferredRender)render();}
});

function toast(message) {
 const el=document.querySelector('#toast');el.textContent=message;el.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,5000);
}
function updateStatus(next) {
 if(next.level==='saved' && pending>1)next={...next,level:'saving',message:'Saving changes…'};
 status=next;
 document.querySelectorAll('[data-save-status]').forEach(el=>{el.textContent=next.level==='saved'?'Saved on this device':next.level==='ready'?'Local saving ready':next.message;el.dataset.status=next.level;el.title=next.message;});
 const warning=document.querySelector('#storage-warning');
 if(warning) { warning.hidden=!['warning','error','conflict'].includes(next.level);warning.innerHTML=`<span>${e(next.message)}</span> ${button('backup','Download backup','secondary small')}${next.level==='conflict'?button('load-external','Load other tab’s save','secondary small'):''}`; }
}
function save() {
 if(!store) return;
 pending++; dirty=true;
 if(status.level!=='conflict')updateStatus({...status,level:'saving',message:'Saving changes…'});
 store.save(state).then(saved=>{state.updatedAt=saved.updatedAt;state.revision=saved.revision;if(pending===1)dirty=false;}).catch(err=>{toast(err.message);}).finally(()=>pending--);
}
function nav(view) {
 state.ui.view=Object.hasOwn(views,view)?view:'discover';
 if(view==='preferences')state.ui.profileStep='home';
 state.ui.detailId=null;finishNavigation();
 if(view==='report') loadReport();
}
function finishNavigation() {
 clearTimeout(timer);
 const route=routeFor(state.ui);
 if(location.hash!==route)history.pushState(null,'',route);
 save();render();window.scrollTo({top:0,behavior:'instant'});
 document.querySelector('h1')?.focus({preventScroll:true});
}
function withConnections(school,workspace=state){
 const network=networkForState(workspace);
 const load=networkLoadState(network,workspace.prefs.knownPeople);
 const unavailable=load.failed.length?'Connection records could not be loaded. Retry connections before exporting.':'Loading relationship records for selected people…';
 const value=kinds=>load.ready?connectionExport(network,load.ids,school.institutionId||school.id,kinds):unavailable;
 const matching=networkLoadState(network,workspace.prefs.connectionPeople||[]);
 return {...school,selectedConnections:value(),coauthorConnections:value(['coauthor']),mentorshipConnections:value(['phd-supervision','postdoc-supervision']),eventConnections:value(['co-organizer']),knownProfessors:network.people.filter(p=>load.ids.includes(p.id)).map(p=>`${p.name} (${p.institution})`).join('; '),
  matchingConnections:matching.ready?connectionExport(network,matching.ids,school.institutionId||school.id):matching.failed.length?'Connection records for matching professors could not be loaded. Retry connections.':'Connection records for matching professors are pending.',matchingProfessors:network.people.filter(p=>matching.ids.includes(p.id)).map(p=>`${p.name} (${p.institution})`).join('; '),networkCoverage:network.meta.coverageNote||'Selective documented coauthor sample; incomplete coverage.'};
}

/** One automatic attempt per stable selection. Failures wait for an explicit retry;
 * asynchronous completion never restores an older workspace or changes its saves. */
function loadSelectedConnections({retry=false}={}) {
 if(typeof NETWORK.loadPeople!=='function')return;
 const selected=[...state.prefs.knownPeople,...(state.prefs.connectionPeople||[])];
 const load=networkLoadState(NETWORK,selected),key=JSON.stringify([state.ui.combinePeopleRecords!==false,[...load.ids].sort()]);
 if(!retry&&networkSelectionKey===key)return;
 networkSelectionKey=key;networkRequest=null;
 if(load.ready)return;
 let request;
 try {request=Promise.resolve(NETWORK.loadPeople(load.ids));}
 catch(error){request=Promise.reject(error);}
 networkRequest=request;
 request.catch(()=>{}).finally(()=>{if(networkRequest===request){networkRequest=null;render();}});
}
function matchingContext(workspace=state) {
 const network=networkForState(workspace),ids=workspace.prefs.connectionPeople||[];
 const load=networkLoadState(network,ids);
 const key=JSON.stringify([load.ids,load.pending,load.failed,(network.rawNetwork||network).edges.length]);
 if(connectionFitCache?.network!==network||connectionFitCache.key!==key)connectionFitCache={network,key,value:{connectionFit:buildConnectionFit(network,ids)}};
 return connectionFitCache.value;
}
function ranked() {return rankSchools(catalog,effectivePreferences(catalog,state.prefs),matchingContext());}
function queue() {return reviewQueue(ranked(),state);}

function reviewView() {
 const matches=ranked(),schools=reviewQueue(matches,state);
 let active=state.ui.activeId?matches.find(m=>m.school.id===state.ui.activeId):null;
 if(!active&&state.ui.activeId){const school=catalog.find(s=>s.id===state.ui.activeId);if(school)active={school,...scoreSchool(school,effectivePreferences(catalog,state.prefs),matchingContext())};}
 if(!active&&!state.ui.reviewFinished){active=schools[0];if(active)visitSchool(state,active.school.id);}
 return discoverView({state,catalog,matches,queue:schools,active,dossier:active?dossiers.get(active.school.id):null});
}

function render() {
 if(!state)return;
 if(cancelSwipe.isActive?.()||cancelCardReorder.isActive()){deferredRender=true;return;}
 deferredRender=false;
 // Resolve duplicate identities for display without rewriting saved source selections.
 useNetworkForState(state);
 loadSelectedConnections();
 cancelSwipe();cleanupMap();
 const active=document.activeElement;
 const oldPanel=app.querySelector('.school-tab-content');
 const panelPosition=oldPanel?{id:app.querySelector('.review-card')?.dataset.schoolId,tab:oldPanel.dataset.activeTab,scroll:oldPanel.scrollTop}:null;
 const focusKey=active&&app.contains(active)?{id:active.id,index:[...app.querySelectorAll('input,select,textarea')].indexOf(active),start:active.selectionStart,end:active.selectionEnd}:null;
 const view=Object.hasOwn(views,state.ui.view)?state.ui.view:'discover';
 let body;
 const review=view==='discover'||Boolean(state.ui.detailId);
 if(state.ui.detailId) {
  const school=catalog.find(s=>s.id===state.ui.detailId);
  body=school?`<div class="review-toolbar">${button('back-collection',`${icon('back')} My schools`,'ghost small')}<span class="muted">Review your choice</span>${button('profile-step','Edit my cards','ghost small','data-step="cards"')}</div>${schoolCard(school,state,scoreSchool(school,effectivePreferences(catalog,state.prefs),matchingContext()),dossiers.get(school.id))}`:collectionView(state,catalog);
 } else body=view==='discover'?reviewView():view==='collection'?collectionView(state,catalog):view==='preferences'?preferencesView(state,catalog):view==='export'?connectionLoadNotice(NETWORK,[...state.prefs.knownPeople,...(state.prefs.connectionPeople||[])])+exportView(state,catalog.map(school=>withConnections(school))):view==='report'?reportView(state,report):dataView(state,status);
 app.innerHTML=shell({state,body,review});
 const card=app.querySelector('[data-school-id]');
 if(card&&['faculty','admissions','funding','international'].includes(app.querySelector('[data-active-tab]')?.dataset.activeTab)){
  const id=card.dataset.schoolId;
  if(!dossiers.has(id)&&!detailRequests.has(id)){
   detailRequests.add(id);
   loadDossier(id).then(()=>{if(app.querySelector('[data-school-id]')?.dataset.schoolId===id)render();}).catch(()=>{});
  }
 }
 if(exporting)for(const target of app.querySelectorAll('[data-action="download-csv"]')){target.disabled=true;target.textContent='Preparing your sheet…';}
 if(view==='report'&&!report&&!reportLoading)loadReport();
 document.body.classList.toggle('review-mode',review);
 document.querySelector('h1')?.setAttribute('tabindex','-1');
 for(const details of app.querySelectorAll('details')) {
  if(details.classList.contains('utility-menu'))continue;
  const key=panelKey(details);
  if(Object.hasOwn(state.ui.expandedPanels||{},key))details.open=state.ui.expandedPanels[key];
 }
 updateStatus(status);
 const mapHost=app.querySelector('[data-location-map]');
 if(mapHost){const school=catalog.find(s=>s.id===mapHost.dataset.locationMap);if(school)cleanupMap=mountLocationMap(mapHost,school,state,save);}
 const nextPanel=app.querySelector('.school-tab-content');
 if(panelPosition && nextPanel?.dataset.activeTab===panelPosition.tab && app.querySelector('.review-card')?.dataset.schoolId===panelPosition.id)nextPanel.scrollTop=panelPosition.scroll;
 if(focusKey) {
  const target=(focusKey.id?document.getElementById(focusKey.id):null)||app.querySelectorAll('input,select,textarea')[focusKey.index];
  if(target){target.focus({preventScroll:true});try{target.setSelectionRange(focusKey.start,focusKey.end);}catch{}}
 }
}
function panelKey(el) {return `${state.ui.view}:${el.dataset.section||el.querySelector(':scope > summary')?.textContent.trim()}`;}

async function loadDossier(id) {
 if(dossiers.has(id))return dossiers.get(id);
 const school=catalog.find(s=>s.id===id);
 if(school.programRoute){const dossier=programDossier(school);dossiers.set(id,dossier);return dossier;}
 const response=await fetch(school.dossierUrl);
 if(!response.ok)throw new Error('The school details could not be loaded. Check your connection and try again.');
 const dossier=await response.json();dossiers.set(id,dossier);return dossier;
}
async function loadReport() {
 if(report || reportLoading)return;
 reportLoading=true;
 try {const r=await fetch('./src/data/report.json');if(!r.ok)throw new Error('Could not load the report.');report=await r.json();if(state.ui.view==='report')render();}
 catch(err){toast(err.message);}finally{reportLoading=false;}
}

function setRecord(id,key,value) {
 state.records[id]={...recordFor(state,id),[key]:value};save();
}
function decide(id,decision,{toggle=false}={}) {
 if(toggle&&decision===recordFor(state,id).decision&&['saved','passed'].includes(decision))decision='unreviewed';
 state.ui.history=[...(state.ui.history||[]),{id,record:clone(recordFor(state,id)),activeId:state.ui.activeId}].slice(-30);
 state.records[id]={...recordFor(state,id),decision};
 if(decision!=='unreviewed'&&!state.ui.detailId && state.ui.view==='discover')moveReview(state,ranked(),'next');
 save();render();toast(`${catalog.find(s=>s.id===id).name}: ${decision==='saved'?'saved':decision==='passed'?'passed for now':'marked unreviewed'}.`);
 const announcement=document.querySelector('#review-announcement');
 if(announcement)announcement.textContent=`${decision==='saved'?'Saved school.':'Decision updated.'} ${document.querySelector('.school-title')?.textContent||'Review complete.'}`;
}
function backup() {downloadFile(serializeBackup(state),`grad-tinder-backup-${new Date().toISOString().slice(0,10)}.json`,'application/json');toast('Full workspace backup downloaded.');}
function modal(title,body,actions) {
 const root=document.querySelector('#dialog-root');
 const previous=document.activeElement;
 root.innerHTML=`<dialog class="modal"><h2>${e(title)}</h2>${body}<div class="modal-actions">${actions}${button('close-modal','Cancel','secondary')}</div></dialog>`;
 const dialog=root.querySelector('dialog');dialog.showModal();
 dialog.addEventListener('close',()=>{root.innerHTML='';previous?.focus();},{once:true});
}
let importCandidate=null;
async function importFile(file) {
 if(!file)return;
 try {
  if(file.size>10_000_000)throw new Error('Backup is too large (maximum 10 MB).');
  importCandidate=parseBackup(await file.text());
  const records=Object.values(importCandidate.records);
  modal('Restore this workspace?',`<p>This backup contains ${records.filter(r=>r.decision==='saved').length} saved schools, ${records.filter(r=>r.flagged).length} flags, ${importCandidate.fields.custom.length} custom fields, and your preferences.</p><p>Download a backup of this workspace before replacing it. Merge keeps current preferences and imports school records and missing custom fields. For the same school, the imported record wins.</p>`,`${button('backup','Back up current workspace','secondary')}${button('import-merge','Merge school records','secondary')}${button('import-replace','Replace workspace','primary')}`);
 }catch(err){toast(err.message);}
}

app.addEventListener('click',async event=>{
 const target=event.target.closest('[data-action]');if(!target)return;
 event.preventDefault();await action(target);
});
document.querySelector('#dialog-root').addEventListener('click',async event=>{const target=event.target.closest('[data-action]');if(target)await action(target);});

async function action(target) {
 const {action:a,id}=target.dataset;
 try {
  if(a==='navigate')nav(target.dataset.view);
  else if(a==='start-discover'){state.ui.schoolTab=state.prefs.details[0]||'notes';nav('discover');}
  else if(a==='tracker-step'){state.ui.view='export';state.ui.detailId=null;state.ui.trackerStep=target.dataset.step;finishNavigation();}
  else if(a==='profile-step'){state.ui.view='preferences';state.ui.detailId=null;state.ui.profileStep=target.dataset.step;if(target.dataset.step==='people')state.ui.peoplePurpose='known';finishNavigation();}
  else if(a==='choose-connection-people'){state.ui.view='preferences';state.ui.detailId=null;state.ui.profileStep='people';state.ui.peoplePurpose='connections';state.ui.priorityStep='people';finishNavigation();}
  else if(a==='copy-known-people'){state.prefs.connectionPeople=[...state.prefs.knownPeople];save();render();}
  else if(a==='filter-step'){state.ui.view='preferences';state.ui.profileStep='schools';state.ui.filterStep=target.dataset.step;finishNavigation();}
  else if(a==='priority-step'){state.ui.view='preferences';state.ui.profileStep='priorities';state.ui.priorityStep=target.dataset.step;finishNavigation();}
  else if(a==='move-detail'){state.prefs=moveCardSection(state.prefs,target.dataset.key,target.dataset.direction);save();render();document.querySelector(`[data-action="move-detail"][data-key="${CSS.escape(target.dataset.key)}"][data-direction="${target.dataset.direction}"]`)?.focus();}
  else if(a==='load-map'){state.ui.mapOpened=[...new Set([...(state.ui.mapOpened||[]),id])];save();render();}
  else if(a==='add-person'||a==='remove-person'){
   const key=target.dataset.purpose==='connections'?'connectionPeople':'knownPeople';
   state.prefs[key]=updateSelectedPeople(NETWORK,state.prefs[key]||[],id,a==='add-person');
   if(a==='add-person'&&!state.prefs.details.includes('connections'))state.prefs.details.push('connections');save();render();
  }
  else if(a==='reset-known-people'){state.ui.preferenceUndo=clone(state.prefs);state.prefs.knownPeople=[];save();render();toast('Selections cleared. Undo is available on My profile.');}
  else if(a==='reset-connection-people'){state.ui.preferenceUndo=clone(state.prefs);state.prefs.connectionPeople=[];save();render();toast('Matching professors cleared. Undo is available on My profile.');}
  else if(a==='retry-connections'){loadSelectedConnections({retry:true});render();}
  else if(a==='clear-pref'){state.prefs[target.dataset.key]=[];state.ui.activeId=null;state.ui.reviewFinished=false;save();render();}
  else if(a==='school-tab'){state.ui.schoolTab=target.dataset.tab;save();render();document.querySelector(`.school-tab[data-tab="${CSS.escape(target.dataset.tab)}"]`)?.focus({preventScroll:true});}
  else if(a==='backup')backup();
  else if(a==='decide')decide(id,target.dataset.decision,{toggle:true});
  else if(a==='flag'){setRecord(id,'flagged',!recordFor(state,id).flagged);render();}
  else if(a==='undo') {const last=state.ui.history?.pop();if(last){state.records[last.id]={...recordFor(state,last.id),decision:last.record.decision};visitSchool(state,last.id);save();render();toast('Last decision undone. Your notes and flag are preserved.');}}
  else if(a==='next'||a==='previous'){moveReview(state,ranked(),a);save();render();}
  else if(a==='reset-filters'||a==='reset-priorities'||a==='reset-profile'||a==='reset-cards'){
   state.ui.preferenceUndo=clone(state.prefs);
   state.prefs=a==='reset-filters'?resetSchoolFilters(state.prefs):a==='reset-priorities'?resetPriorities(state.prefs):a==='reset-cards'?{...state.prefs,details:[...defaultPrefs.details]}:clone(defaultPrefs);
   if(a==='reset-cards'||a==='reset-profile')state.ui.schoolTab=state.prefs.details[0]||'notes';
   state.ui.activeId=null;state.ui.reviewFinished=false;save();render();toast('Settings reset. School decisions and notes are preserved. Undo is available on My profile.');
  }
  else if(a==='undo-preferences'){if(state.ui.preferenceUndo){state.prefs=state.ui.preferenceUndo;delete state.ui.preferenceUndo;state.ui.activeId=null;state.ui.reviewFinished=false;save();render();}}
  else if(a==='restart-review'||a==='show-all'){restartReview(state,ranked(),'all');document.querySelector('dialog')?.close();save();render();toast('Review restarted. Saved schools, flags, and notes are unchanged.');}
  else if(a==='review-history'){
   const trail=[...new Set([...(state.ui.reviewTrail||[])].reverse())];
   modal('Recently viewed schools',`<p>Return to any visited school without changing its decision.</p><div class="review-history-list">${trail.map(id=>{const school=catalog.find(s=>s.id===id);return school?button('revisit-school',`${e(school.name)} <small>${e(recordFor(state,id).decision)}</small>`,'ghost',`data-id="${e(id)}"`):'';}).join('')||'<p>No schools viewed yet.</p>'}</div>`,button('restart-review','Review all matches from the start','secondary'));
  }
  else if(a==='revisit-school'){visitSchool(state,id);state.ui.detailId=null;state.ui.view='discover';document.querySelector('dialog')?.close();finishNavigation();}
  else if(a==='reset-decisions'){
   const count=Object.values(state.records).filter(r=>r.decision!=='unreviewed').length;
   modal('Mark schools unreviewed?',`<p>This removes ${count} saved or passed decisions across all schools. Flags, notes, application progress, and custom fields are kept. You can undo this reset.</p>`,button('confirm-reset-decisions','Mark all schools unreviewed','danger'));
  }
  else if(a==='confirm-reset-decisions'){markUnreviewed(state,Object.keys(state.records));restartReview(state,ranked(),'unreviewed');document.querySelector('dialog')?.close();save();render();toast('Decisions reset. Use Undo reset to restore them.');}
  else if(a==='undo-decision-reset'){restoreDecisions(state);save();render();toast('Previous decisions restored.');}
  else if(a==='remove-pref'){state.prefs[target.dataset.key]=state.prefs[target.dataset.key].filter(v=>v!==target.dataset.value);state.ui.activeId=null;state.ui.reviewFinished=false;save();render();}
  else if(a==='include-all'){state.prefs.excludedIds=[];save();render();}
  else if(a==='open-school'){state.ui.detailId=id;finishNavigation();}
  else if(a==='back-collection'){state.ui.detailId=null;nav('collection');}
  else if(a==='load-school-details'){target.disabled=true;target.textContent='Loading details…';await loadDossier(id);render();}
  else if(a==='export-preset'){state.fields.selected=applyExportPreset(state.fields.selected,target.dataset.preset);save();render();}
  else if(a==='move-export-field'){state.fields.selected=moveExportField(state.fields.selected,target.dataset.key,Number(target.dataset.direction));save();render();}
  else if(a==='export-none'||a==='export-all'){state.fields.selected=a==='export-none'?[]:[...BUILTIN_FIELDS.map(f=>f.key),...DOSSIER_FIELDS.map(f=>`dossier:${f}`),...state.fields.custom.map(f=>`custom:${f.id}`)];save();render();}
  else if(a==='download-csv') {
   if(exporting)return;
   const snapshot=clone(state);
   const exportNetwork=networkForState(snapshot);
   exporting=true;render();
   try {
    const needsKnownConnections=snapshot.fields.selected.some(key=>['selectedConnections','coauthorConnections','mentorshipConnections','eventConnections'].includes(key));
    const needsMatchingConnections=snapshot.fields.selected.includes('matchingConnections');
    if(typeof exportNetwork.loadPeople==='function'&&(needsKnownConnections||needsMatchingConnections)) {
     const ids=[...(needsKnownConnections?snapshot.prefs.knownPeople:[]),...(needsMatchingConnections?snapshot.prefs.connectionPeople||[]:[])];
     try {await exportNetwork.loadPeople(ids);}
     catch {throw new Error('Connection records could not be loaded. Check your connection, then retry the CSV export.');}
     if(!networkLoadState(exportNetwork,ids).ready)throw new Error('Connection records are still incomplete. Retry the CSV export.');
    }
    const selection=exportSchools(catalog,snapshot);
    const needsDossier=snapshot.fields.selected.some(k=>k.startsWith('dossier:')||k==='sources'||k==='facultyEvidence');
    const rows=await Promise.all(selection.map(async original=>{
     const school=withConnections(original,snapshot);
     if(!needsDossier)return school;
     const dossier=await loadDossier(school.id);const researchFields={};
     for(const section of dossier.sections||[])for(const f of section.fields||[])researchFields[f.label]={status:f.status,text:f.text};
     return {...school,researchFields,facultyEvidence:dossier.sections.find(s=>s.id==='faculty')?.text||'',sources:[...dossier.sources,...(school.onlineUpdate?.sources||[]),...(school.independentSources||[])]};
    }));
    downloadFile(buildCSV(rows,snapshot),`grad-tinder-schools-${new Date().toISOString().slice(0,10)}.csv`,'text/csv;charset=utf-8');toast(`Exported ${rows.length} schools.`);
   } finally {exporting=false;render();}
  }
  else if(a==='remove-custom'){modal('Delete this tracking field?',`<p>Its values will also be removed from every school. Download a backup first if you want to keep them.</p>`,button('confirm-remove-custom','Delete field & values','danger',`data-id="${e(id)}"`));}
  else if(a==='confirm-remove-custom'){state.fields.custom=state.fields.custom.filter(f=>f.id!==id);state.fields.selected=state.fields.selected.filter(k=>k!==`custom:${id}`);for(const r of Object.values(state.records))delete r.custom[id];document.querySelector('dialog').close();save();render();}
  else if(a==='close-modal')document.querySelector('dialog')?.close();
  else if(a==='import-merge'||a==='import-replace') {
   if(!importCandidate)return;
   if(a==='import-replace')state=clone(importCandidate);
   else {state.records={...state.records,...importCandidate.records};for(const f of importCandidate.fields.custom)if(!state.fields.custom.some(c=>c.id===f.id))state.fields.custom.push(f);state.fields.selected=[...new Set([...state.fields.selected,...importCandidate.fields.selected])];}
   importCandidate=null;document.querySelector('dialog').close();finishNavigation();toast('Backup restored.');
  }
  else if(a==='persist'){const result=await store.requestPersistence();toast(result?'Browser storage protection granted. Keep downloaded backups too.':'This browser did not grant persistent storage. Download a backup regularly.');}
  else if(a==='load-external'){modal('Load the other tab’s save?','<p>Your unsaved changes on this screen will be replaced. Download a backup first to keep them.</p>',`${button('backup','Back up this screen','secondary')}${button('confirm-load-external','Load saved version','primary')}`);}
  else if(a==='confirm-load-external'){state=await store.reload();dirty=false;document.querySelector('dialog').close();history.replaceState(null,'',routeFor(state.ui));render();}
  else if(a==='report-prev'||a==='report-next'){state.ui.reportPage=Math.max(1,Math.min(1705,(Number(state.ui.reportPage)||1)+(a==='report-next'?1:-1)));save();render();}
  else if(a==='report-search')searchReport();
  else if(a==='report-result'){state.ui.reportPage=Number(target.dataset.page);save();render();}
 }catch(err){toast(err.message);if(target.isConnected){target.disabled=false;if(a==='load-school-details')target.textContent='Retry loading details';if(a==='download-csv')target.textContent='Retry CSV export';}}
}

function searchReport() {
 if(!report){loadReport();return;}
 const query=document.querySelector('#report-search').value.trim();state.ui.reportQuery=query;save();
 const result=document.querySelector('#report-results');
 if(!query){result.textContent='Enter a word or phrase to search.';return;}
 const found=report.pages.filter(p=>p.text.toLowerCase().includes(query.toLowerCase()));
 result.innerHTML=`<p class="notice">${found.length} pages found${found.length>80?' · showing the first 80; narrow your search for more specific results':''}.</p><div class="report-hits">${found.slice(0,80).map(p=>{const index=p.text.toLowerCase().indexOf(query.toLowerCase());return button('report-result',`Page ${p.number} — ${e(p.text.slice(Math.max(0,index-45),index+130))}`,'ghost small',`data-page="${p.number}"`);}).join('')}</div>`;
}

app.addEventListener('input',event=>{
 const t=event.target;
 if(t.type==='checkbox'||t.tagName==='SELECT'||t.type==='file')return;
 handleInput(t,false);
});
app.addEventListener('change',event=>{
 const t=event.target;
 if(t.id==='import-backup'){importFile(t.files[0]);t.value='';return;}
 if(t.type==='checkbox'||t.tagName==='SELECT')handleInput(t,true);
});
function handleInput(t,immediate) {
 let redraw=true;
 if(t.dataset.pref){state.prefs[t.dataset.pref]=t.type==='checkbox'?(t.hasAttribute('data-invert')?!t.checked:t.checked):t.type==='number'?Number(t.value):t.value;state.ui.activeId=null;}
 else if(t.dataset.prefArray){const key=t.dataset.prefArray;state.prefs[key]=t.checked?[...new Set([...state.prefs[key],t.value])]:state.prefs[key].filter(v=>v!==t.value);if(key!=='details')state.ui.activeId=null;else if(!t.checked&&state.ui.schoolTab===t.value)state.ui.schoolTab=state.prefs.details[0]||'notes';}
 else if(t.dataset.addPref){if(!t.value)return;const key=t.dataset.addPref;state.prefs[key]=[...new Set([...state.prefs[key],t.value])];state.ui.activeId=null;}
 else if(t.dataset.weight){state.prefs.weights[t.dataset.weight]=Number(t.value);const output=document.querySelector(`#weight-${t.dataset.weight}`);if(output)output.textContent=t.value;redraw=false;}
 else if(t.dataset.schoolInclude){const id=t.dataset.schoolInclude;state.prefs.excludedIds=t.checked?state.prefs.excludedIds.filter(v=>v!==id):[...new Set([...state.prefs.excludedIds,id])];}
 else if(t.dataset.record){setRecord(t.dataset.id,t.dataset.record,t.value);return;}
 else if(t.dataset.custom){const r=recordFor(state,t.dataset.id);setRecord(t.dataset.id,'custom',{...r.custom,[t.dataset.custom]:t.type==='checkbox'?t.checked:t.value});return;}
 else if(t.dataset.ui){state.ui[t.dataset.ui]=t.type==='checkbox'?t.checked:t.type==='number'?Math.max(1,Math.min(1705,Number(t.value)||1)):t.value;if(t.dataset.ui==='queueScope')restartReview(state,ranked(),t.value);}
 else if(t.dataset.exportField){const key=t.dataset.exportField;state.fields.selected=t.checked?[...new Set([...state.fields.selected,key])]:state.fields.selected.filter(k=>k!==key);}
 else if(t.id==='report-search'){state.ui.reportQuery=t.value;redraw=false;}
 else return;
 if(t.dataset.pref||t.dataset.prefArray&&t.dataset.prefArray!=='details'||t.dataset.addPref||t.dataset.schoolInclude){state.ui.activeId=null;state.ui.reviewFinished=false;}
 save();if(redraw){clearTimeout(timer);if(immediate)render();else timer=setTimeout(render,320);}
}
app.addEventListener('submit',event=>{
 if(event.target.id!=='custom-field-form')return;event.preventDefault();
 const data=new FormData(event.target),label=data.get('label').trim();if(!label)return;
 const id=crypto.randomUUID?.()||`field-${Date.now()}`;
 state.fields.custom.push({id,label,type:data.get('type')});state.fields.selected.push(`custom:${id}`);save();render();toast(`“${label}” added to every school’s tracker.`);
});
app.addEventListener('toggle',event=>{
 const details=event.target;if(details.tagName!=='DETAILS'||!state)return;
 if(details.classList.contains('utility-menu'))return;
 const key=panelKey(details);state.ui.expandedPanels ||= {};
 if(state.ui.expandedPanels[key]===details.open)return;
 state.ui.expandedPanels[key]=details.open;save();
},true);
document.addEventListener('keydown',event=>{
 if(event.key==='Enter'&&event.target.id==='report-search'){event.preventDefault();searchReport();}
 const tab=event.target.closest('.school-tab');
 if(tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
  event.preventDefault();const tabs=[...document.querySelectorAll('.school-tab')],i=tabs.indexOf(tab);
  const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[index].click();return;
 }
 if(event.target.matches('input,textarea,select,[contenteditable]')||document.querySelector('dialog[open]'))return;
 if((event.ctrlKey||event.metaKey)&&event.key==='z'&&state.ui.view==='discover'){event.preventDefault();action({dataset:{action:'undo'}});}
 if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||event.target.closest('button,a,summary'))return;
 if(state.ui.view!=='discover'||state.ui.detailId)return;
 const id=state.ui.activeId;
 if(!id||!catalog.some(school=>school.id===id))return;
 if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();decide(id,event.key==='ArrowRight'?'saved':'passed');}
 if(event.key.toLowerCase()==='f'){event.preventDefault();action({dataset:{action:'flag',id}});}
 if(event.key.toLowerCase()==='u'){event.preventDefault();action({dataset:{action:'undo'}});}
});
window.addEventListener('beforeunload',event=>{if(dirty||pending){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',()=>{
 if(!state)return;
 const route=parseRoute(location.hash);if(!route)return;
 if(route.detailId&&!catalog.some(s=>s.id===route.detailId))route.detailId=null;
 Object.assign(state.ui,route);clearTimeout(timer);save();render();
 if(state.ui.view==='report')loadReport();
 window.scrollTo({top:0,behavior:'instant'});
 document.querySelector('h1')?.focus({preventScroll:true});
});

try {
 store=await createStore({onStatus:updateStatus});
 status=store.getStatus();
 state=clone(store.state);
 const route=parseRoute(location.hash);if(route)Object.assign(state.ui,route);
 if(state.ui.detailId&&!catalog.some(s=>s.id===state.ui.detailId))state.ui.detailId=null;
 history.replaceState(null,'',routeFor(state.ui));render();
 if(state.ui.view==='report')loadReport();
}catch(err){app.innerHTML=`<main class="main"><h1>Your saved workspace needs attention</h1><p>${e(err.message)}</p><p>No existing data has been overwritten. Keep this browser’s site data and use the app version that created it.</p></main>`;}
