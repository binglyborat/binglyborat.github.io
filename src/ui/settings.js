import {e,icon,button,pageHeading,options,recordFor,textBlock,externalLink} from './components.js';
import {BUILTIN_FIELDS,PRESETS,exportValue,readable} from '../core/export.js';
import {DOSSIER_FIELDS} from '../data/fields.js';

export function exportSchools(catalog,state) {
 const scope=state.ui.exportScope||'saved';
 return catalog.filter(s=>scope==='all'||(scope==='flagged'?recordFor(state,s.id).flagged:recordFor(state,s.id).decision===scope));
}
const trackerSteps = [['fields', 'My fields'], ['columns', 'Sheet columns'], ['export', 'Export']];

function fieldSelection(fields, selected) {
 return `<div class="field-grid">${fields.map(({key, label}) => `<label class="field-option"><input type="checkbox" data-export-field="${e(key)}" ${selected.includes(key) ? 'checked' : ''}><span>${e(label)}</span></label>`).join('')}</div>`;
}

function customFieldsScreen(state) {
 return `<section class="panel"><div class="panel-header"><div><h2>Custom tracking fields</h2><p class="muted">Fields appear in the My notes tab on each school card.</p></div></div>
   <form id="custom-field-form"><div class="field-grid"><label class="field-label">Field name<input class="input" name="label" required maxlength="80" placeholder="e.g. Professor contacted"></label><label class="field-label">Type<select class="select" name="type">${options([['text','Text'], ['date','Date'], ['number','Number'], ['checkbox','Checkbox']], 'text')}</select></label></div><button class="button primary" type="submit">${icon('plus')} Add field</button></form>
   <p class="footer-note">Examples: personal deadline, professor contacted, application fee, or submission status.</p>
   <div class="custom-field-list">${state.fields.custom.length ? state.fields.custom.map(field => `<div class="toolbar"><span><strong>${e(field.label)}</strong> <small class="muted">${e(field.type)}</small></span>${button('remove-custom','Delete','ghost small',`data-id="${e(field.id)}"`)}</div>`).join('') : '<p class="notice">No custom fields. Notes and application status are included by default.</p>'}</div>
 </section><div class="tracker-step-footer inline-actions">${button('tracker-step', `Choose sheet columns ${icon('arrow')}`, 'secondary', 'data-step="columns"')}</div>`;
}

function columnsScreen(state) {
 const selected=state.fields.selected;
 const allFields=[...BUILTIN_FIELDS,...state.fields.custom.map(field=>({key:`custom:${field.id}`,label:field.label})),...DOSSIER_FIELDS.map(label=>({key:`dossier:${label}`,label}))];
 const groups=[
   ['The basics', ['name','institutionName','country','city','region','degree','program','programType','programFormat','award','duration','structure','departmentNotes','areas','faculty','url']],
   ['Applying & support', ['deadline','deadlineDetails','funding','admissions','international','fees','requirements','costs','greGeneral','greMath','letters','writing','checks']],
   ['Professional relationships & admissions committee', ['knownProfessors','selectedConnections','coauthorConnections','mentorshipConnections','eventConnections','matchingProfessors','matchingConnections','networkCoverage','committeeMembers','committeeEvidence']],
   ['Enrollment & evidence', ['enrollmentTotal','enrollmentYear','enrollmentScope','enrollmentSource','independentSources']],
   ['My decisions & notes', ['decision','flagged','applicationStatus','notes']],
   ['More about the school', ['rank','rankSource','rankNote','setting','schoolSize','size','facultyEvidence','sources']],
 ];
 return `<section class="panel"><div class="panel-header"><div><h2>Spreadsheet columns</h2><p class="muted">${selected.length} columns selected. This only changes your export, not your school cards.</p></div><div class="inline-actions">${button('export-all','Select all','ghost small')}${button('export-none','Clear','ghost small')}</div></div>
   <section class="column-group"><h3>Start with a suggested set</h3><p class="muted">Replace standard columns with a preset, then adjust the checkboxes below. Your selected custom and detailed fields stay selected.</p><div class="field-grid">${Object.entries(PRESETS).map(([key,preset])=>`<div>${button('export-preset',e(preset.label),'secondary',`data-preset="${key}"`)}<p class="footer-note">${e(preset.description)}</p></div>`).join('')}</div></section>
   <details class="filter-section"><summary>Column order <span class="tag">${selected.length} selected</span></summary><p class="muted">Columns appear from left to right in this order. Use the arrows to move a column earlier or later.</p>${selected.length?`<ol class="export-column-order">${selected.map((key,index)=>{const label=allFields.find(field=>field.key===key)?.label||key;return `<li><div class="toolbar"><span>${e(label)}</span><div class="inline-actions">${button('move-export-field','↑','ghost small',`data-key="${e(key)}" data-direction="-1" aria-label="Move ${e(label)} earlier" ${index===0?'disabled':''}`)}${button('move-export-field','↓','ghost small',`data-key="${e(key)}" data-direction="1" aria-label="Move ${e(label)} later" ${index===selected.length-1?'disabled':''}`)}</div></div></li>`;}).join('')}</ol>`:'<p class="notice">Select columns below to arrange their order.</p>'}</details>
   <p class="footer-note">Connection columns use People I know; the separate matching columns use your matching professors. School cards show both sets. Choose the combined column or separate columns for coauthored papers and adviser/student relationships. The relationship filter on a school card does not change these export columns. Missing links have not been established in this dataset. Committee evidence distinguishes current roles, historical service and recruiting rosters.</p>
   ${groups.map(([label,keys]) => `<section class="column-group"><h3>${label}</h3>${fieldSelection(keys.map(key => BUILTIN_FIELDS.find(field => field.key === key)).filter(Boolean), selected)}</section>`).join('')}
   ${state.fields.custom.length ? `<section class="column-group"><h3>My custom fields</h3>${fieldSelection(state.fields.custom.map(field => ({key:`custom:${field.id}`,label:field.label})), selected)}</section>` : ''}
   <details class="filter-section"><summary>Detailed application fields <span class="tag">44 fields</span></summary><p class="muted">Export detailed requirements, deadlines and funding terms. Choose Sources to include reference URLs.</p>${fieldSelection(DOSSIER_FIELDS.map(label => ({key:`dossier:${label}`, label})), selected)}</details>
 </section><div class="tracker-step-footer inline-actions">${button('tracker-step', `${icon('back')} My fields`, 'ghost', 'data-step="fields"')}${button('tracker-step', `Preview & export ${icon('arrow')}`, 'primary', 'data-step="export"')}</div>`;
}

function previewValue(school, state, key) {
 if(key.startsWith('dossier:') && !school.researchFields)return school.programRoute?'Separate program entry; choose program-specific columns':'Detailed requirements included in download';
 const value=exportValue(school,state,key);
 if(typeof value==='boolean')return value?'Yes':'No';
 return readable(value).slice(0,130);
}

function exportScreen(state, catalog) {
 const schools=exportSchools(catalog,state);
 const selected=state.fields.selected;
 const fields=[...BUILTIN_FIELDS,...DOSSIER_FIELDS.map(label => ({key:`dossier:${label}`,label})),...state.fields.custom.map(field => ({key:`custom:${field.id}`,label:field.label}))];
 return `<section class="panel"><div class="panel-header"><div><h2>Export spreadsheet</h2><p class="muted">${schools.length} schools · ${selected.length} columns</p></div>${button('tracker-step', 'Edit columns', 'secondary small', 'data-step="columns"')}</div>
  <label class="field-label">Schools to export<select class="select" data-ui="exportScope">${options([['saved','Schools on my list'],['flagged','All flagged schools'],['passed','Schools I passed'],['unreviewed','Unreviewed schools'],['all','Entire catalog']],state.ui.exportScope||'saved')}</select></label><p class="footer-note">Your discovery filters do not limit the export. CSV works with Excel, Google Sheets, Numbers, and LibreOffice.</p></section>
  <section class="panel"><div class="panel-header"><h2>Spreadsheet preview</h2><span class="muted">First 5 schools</span></div>${selected.length ? `<div class="table-wrap"><table class="preview-table"><thead><tr>${selected.map(key => `<th>${e(fields.find(field => field.key===key)?.label||key)}</th>`).join('')}</tr></thead><tbody>${schools.slice(0,5).map(school => `<tr>${selected.map(key => `<td>${e(previewValue(school,state,key))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="notice">Choose at least one column for your sheet.</p>${button('tracker-step','Choose columns','secondary','data-step="columns"')}`}${!schools.length ? `<p class="notice">No schools in this group. Select another group or save schools from Discover.</p>${button('navigate', 'Explore schools', 'secondary', 'data-view="discover"')}` : ''}<p class="footer-note">Long text is shortened in this preview. Your downloaded sheet keeps it in full.</p></section>
  <details class="panel backup-details"><summary>Full workspace backup</summary><p class="muted">A JSON backup keeps every preference, decision, note, and tracker field. Use it to restore your workspace or move to another browser.</p>${button('backup', `${icon('download')} Download full backup`, 'secondary')}</details>`;
}

export function exportView(state,catalog) {
 const step=trackerSteps.some(([key]) => key===state.ui.trackerStep) ? state.ui.trackerStep : 'export';
 const schools=exportSchools(catalog,state);
 const descriptions={fields:'Add fields for application details and personal records.',columns:'Select columns for the exported spreadsheet.',export:'Choose schools and download the spreadsheet.'};
 return `<div class="tracker-page">${pageHeading('APPLICATIONS','Application tracker',descriptions[step],step==='export' ? button('download-csv',`${icon('download')} Download CSV`,'primary',!schools.length||!state.fields.selected.length?'disabled':'') : '')}
  <nav class="tracker-subnav profile-subnav" aria-label="Application tracker">${trackerSteps.map(([key,label]) => button('tracker-step',label,'ghost',`data-step="${key}" ${step===key?'aria-current="page"':''}`)).join('')}</nav>
  <div class="tracker-screen" data-tracker-screen="${step}">${step==='fields' ? customFieldsScreen(state) : step==='columns' ? columnsScreen(state) : exportScreen(state,catalog)}</div></div>`;
}

export function dataView(state,status) {
 return `${pageHeading('STORAGE','Saved data','Preferences, decisions, and notes stay in this browser. No accounts or uploads are required.')}
 <div class="settings-grid"><section class="panel"><p class="eyebrow">LOCAL SAVING</p><h2>${icon('shield')} Automatic saving</h2><p class="notice">${e(status.message)}</p><p>Every change is saved immediately to local storage, with a previous-save copy and a second copy in IndexedDB when available. A cookie records the save time; it does not contain your private notes.</p><p>Browser data can still be lost if you clear it, use private browsing, change the site address, or switch devices. Download a backup regularly.</p><p class="muted">Last save: ${state.updatedAt?e(new Date(state.updatedAt).toLocaleString()):'No saved changes yet'}</p><div class="inline-actions">${button('backup',`${icon('download')} Download full backup`,'primary')}${button('persist','Protect browser storage','secondary')}</div><p class="footer-note">Persistent storage asks the browser to avoid automatic eviction. Your browser decides whether to grant it. Keep downloaded backups too.</p></section>
 <section class="panel"><p class="eyebrow">RESTORE OR MOVE BROWSERS</p><h2>Restore a backup</h2><p class="muted">Restore a Math Grad Tinder JSON backup. Preview its contents before choosing to merge or replace. A merge keeps current preferences and fills missing schools; imported school records win when both copies have the same school.</p><label class="field-label">Backup file<input class="input" type="file" id="import-backup" accept=".json,application/json"></label><p class="footer-note">Files are read only on your device. Nothing is uploaded.</p></section>
 </div>`;
}

export function reportView(state,report) {
 const page=report?.pages?.[Math.min(Math.max((Number(state.ui.reportPage)||1)-1,0),(report?.pages?.length||1)-1)];
 return `${pageHeading('REFERENCE','Source report','Read and search all 1,705 pages of the supplied report.')}
 <section class="panel"><div class="report-controls"><label class="field-label">PDF page<input class="input" type="number" min="1" max="1705" data-ui="reportPage" value="${Number(state.ui.reportPage)||1}"></label><div class="inline-actions">${button('report-prev',icon('back'),'secondary',`aria-label="Previous page" ${Number(state.ui.reportPage||1)<=1?'disabled':''}`)}${button('report-next',icon('arrow'),'secondary',`aria-label="Next page" ${Number(state.ui.reportPage||1)>=1705?'disabled':''}`)}</div><label class="field-label">Search the full report<input class="input" type="search" id="report-search" value="${e(state.ui.reportQuery||'')}" placeholder="Topic, professor, requirement…"></label>${button('report-search','Search','primary')}</div>${report?`<div id="report-results"></div><article class="report-page"><span class="tag">Page ${page.number} of ${report.pageCount||report.pages.length}</span>${textBlock(page.text)}<div class="source-list">${(page.links||[]).map(l=>externalLink(l.url,l.label||l.url)).join('<br>')}</div></article>`:'<p role="status">Loading the full report…</p>'}</section>`;
}
