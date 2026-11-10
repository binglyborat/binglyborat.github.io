import {connectionsTab,committeeTab} from './connections.js';
import {locationMap} from './location-map.js';
import {programDossier} from '../core/programs.js';
import { e, icon, button, tag, recordFor, textBlock, externalLink, options } from './components.js';

export const SCHOOL_TABS = {
  department: {label:'Department notes',title:'About the department',description:'Research strengths, department character, and the mathematical community.'},
  connections: {label:'Connections',title:'Connections to selected professors',description:'People I know and professors selected for matching, with documented relationship evidence.'},
  committee: {label:'Committee',title:'Graduate committee & admissions roles',description:'Independently researched roles, dates, and public sources.'},
  research: { label: 'Research', title: 'Research areas', description: 'Research topics documented in the source report.' },
  faculty: { label: 'Faculty', title: 'Faculty', description: 'Faculty from the report and subsequent research.' },
  funding: { label: 'Funding', title: 'Funding & fees', description: 'Financial support, costs, and remaining checks.' },
  admissions: { label: 'Applying', title: 'Application requirements', description: 'Eligibility, preparation, and required materials.' },
  international: { label: 'International', title: 'International applicants', description: 'Language requirements, eligibility, and international support.' },
  city: { label: 'Location', title: 'Location', description: 'Campus location and setting.' },
  size: { label: 'Size', title: 'School size', description: 'University enrollment and mathematics cohort information.' },
  deadlines: { label: 'Dates', title: 'Deadlines', description: 'Application and funding timelines, with their evidence labels.' },
  dossier: { label: 'Full dossier', title: 'Full dossier', description: 'Original research fields, faculty evidence, and sources.' },
  notes: { label: 'My notes', title: 'Notes & tracker', description: 'Notes and application progress are saved automatically.' },
};

function evidenceBlock(text) {
  if (!text) return '<p class="muted">Not established in the source report.</p>';
  const match = String(text).match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  return match
    ? `<div class="evidence-note">${tag(match[1])}${textBlock(match[2])}</div>`
    : textBlock(text);
}

function summaryBlock(label, text) {
  return `<section class="summary-block"><h3>${e(label)}</h3>${evidenceBlock(text)}</section>`;
}

function sectionContent(key, school, state, dossier) {
  if(key==='department')return departmentNotes(school);
  if(key==='connections')return connectionsTab(school,state);
  if(key==='committee')return committeeTab(school);
  if (key === 'research') {
    const interests = state.prefs.areas || [];
    return `<div class="research-tags chip-row">${school.areas.map(area => tag(area, interests.includes(area))).join('')}</div>
      <p class="muted">${e(school.areaNote || 'These areas describe the report’s selected faculty research; they are not an exhaustive department profile.')}</p>
      <div class="research-next"><p>${school.faculty?.length || 0} documented faculty entries.</p>${button('school-tab', `${state.prefs.details.includes('faculty') ? 'View faculty' : 'Read the faculty evidence'} ${icon('arrow')}`, 'secondary small', `data-tab="${state.prefs.details.includes('faculty') ? 'faculty' : 'dossier'}"`)}</div>
      <details class="detail-section"><summary>Ranking evidence</summary><div class="detail-content"><p><strong>${school.rank == null ? 'No verified numeric rank' : `Rank ${e(school.rank)}`}</strong>${school.rankSource ? ` · ${e(school.rankSource)}` : ''}</p>${textBlock(school.rankNote)}</div></details>`;
  }
  if (key === 'faculty') {
    return `<div class="faculty-list">${(school.faculty || []).map(person => `<div class="faculty-item"><div><strong>${e(typeof person === 'string' ? person : person.name)}</strong>${person.role?`<p class="muted">${e(person.role)} · ${e(person.status||'')}</p>`:''}${person.areas?.length ? `<p class="muted">${e(person.areas.join(' · '))}</p>` : ''}</div>${person.url ? externalLink(person.url, 'Profile') : ''}</div>`).join('')}</div>
      <p class="footer-note">A research match does not establish that a professor is accepting students. The full dossier includes affiliation details, recent work, and corrections.</p>
      ${button('school-tab', `Read the faculty evidence ${icon('arrow')}`, 'ghost small', 'data-tab="dossier"')}`;
  }
  if (key === 'funding') return summaryBlock('Funding & support', school.funding) + summaryBlock('Application fee', school.costs);
  if (key === 'admissions') return summaryBlock('Program route', school.program) + (school.duration?summaryBlock('Duration & structure',`${school.duration}\n${school.structure}`):'') + summaryBlock('Eligibility & preparation', school.overview) + summaryBlock('Before you apply', school.admissions) + summaryBlock('Recommendation letters', school.letters) + researchSources(school) + summaryBlock('Written materials', school.writing);
  if (key === 'international') return `${school.programRoute?'':'<p class="notice">The report was prepared for a UChicago undergraduate in F-1 status. Check which of its personal assumptions apply to you.</p>'}${evidenceBlock(school.international)}`;
  if (key === 'city') return locationMap(school,state)+locationResearch(school)+`<div class="location-card"><span class="location-icon">${icon('pin')}</span><h3>${e(school.city || 'City not documented')}</h3><p>${e(school.country)}</p>${school.setting ? tag(school.setting) : ''}${school.ruralCampus?tag('Rural campus'):''}</div>${school.ruralEvidence?`<details class="detail-section"><summary>Rural setting evidence</summary><div class="detail-content">${textBlock(school.ruralEvidence.summary)}${externalLink(school.ruralEvidence.url,school.ruralEvidence.label)}</div></details>`:''}${school.cityNotes ? textBlock(school.cityNotes) : '<p class="muted">Pan and zoom to get a sense of the surrounding streets and campus. Additional observations can be saved in My notes.</p>'}${school.locationBasis ? `<details class="detail-section"><summary>About this location information</summary><div class="detail-content">${textBlock(school.locationBasis)}</div></details>` : ''}`;
  if (key === 'size') return summaryBlock('University & department', school.size || `University size: ${school.schoolSize || 'Unknown'}. The source report does not establish the mathematics cohort size.`)+(school.enrollment?.source?`<p>${externalLink(school.enrollment.source.url,school.enrollment.source.label)}</p><p class="footer-note">The size filter uses total university enrollment. This count is not the mathematics PhD cohort size.</p>`:'');
  if (key === 'deadlines') return evidenceBlock(school.deadlineDetails || school.deadline) + researchSources(school) + `<details class="detail-section"><summary>Test requirements</summary><div class="detail-content">${summaryBlock('GRE General', school.greGeneral)}${summaryBlock('GRE Mathematics', school.greMath)}</div></details><p class="footer-note">The full dossier separates application, funding, reference, test-score, document, and offer-response deadlines.</p>`;
  if (key === 'notes') return trackerFields(school, state);
  if (key === 'dossier') {
    if(school.programRoute)return `<p class="dossier-intro">Program-specific admissions, degree structure and sources, checked ${e(school.checked)}.</p>${dossierContent(programDossier(school),state)}`;
    return `<p class="dossier-intro">All 44 research fields, faculty evidence, and original sources. The report was checked November 5, 2026; its evidence labels and applicant-specific assumptions are preserved.</p>
      <div class="inline-actions">${button('school-tab','My connections','secondary small','data-tab="connections"')}${button('school-tab','Graduate committee research','secondary small','data-tab="committee"')}</div>
      <div class="dossier-meta">${tag(`Original PDF · page ${school.dossierPage || '—'}`)}${school.onlineUpdate ? tag(`Updates checked ${school.onlineUpdate.checked}`) : ''}</div>
      ${school.onlineUpdate ? `<details class="detail-section"><summary>Supplemental research</summary><div class="detail-content">${textBlock(school.onlineUpdate.note)}${school.onlineUpdate.sources.map(source => `<p>${externalLink(source.url, source.label || source.url)}</p>`).join('')}<p class="muted">Card summaries include these updates. The original dossier remains unchanged.</p></div></details>` : ''}
      ${dossier ? dossierContent(dossier, state) : `<div class="dossier-load">${button('load-dossier', `${icon('book')} Open the full dossier`, 'primary', `data-id="${e(school.id)}"`)}<p class="muted">Includes every research field and source page for this school.</p></div>`}
      ${school.sources?.length ? `<details class="detail-section"><summary>Card summary sources</summary><div class="detail-content source-list">${school.sources.map(source => `<p>${externalLink(source.url, source.label || source.url)}${source.checked ? `<small>Checked ${e(source.checked)}</small>` : ''}</p>`).join('')}</div></details>` : ''}`;
  }
  return '';
}

function departmentNotes(school) {
  const notes=school.departmentNotes;
  if(!notes?.paragraphs?.length)return '<p class="muted">A department summary has not been written for this entry yet. The Research and Faculty tabs contain the documented research information.</p>';
  const basis=notes.basis==='dossier synthesis'?'Based on selected faculty in the source report, which emphasizes algebraic and arithmetic geometry. This is not a complete survey of the department.':'A research summary based on the linked sources.';
  return `<div class="department-notes">${notes.paragraphs.map(paragraph=>textBlock(paragraph)).join('')}</div><p class="footer-note">${basis}</p>${notes.sources?.length?`<details class="detail-section"><summary>Sources for these notes${notes.checked?` · checked ${e(notes.checked)}`:''}</summary><div class="detail-content source-list">${notes.scope?textBlock(notes.scope):''}${notes.sources.map(source=>`<p>${externalLink(source.url,source.label||'Department source')}${source.checked?`<small>Checked ${e(source.checked)}</small>`:''}</p>`).join('')}</div></details>`:''}`;
}

function locationResearch(school){const r=school.locationResearch;if(!r)return '';return `<section class="summary-block"><h3>Area research</h3>${textBlock(r.summary)}${[['transit','Transport'],['dining','Food'],['nature','Parks & outdoors']].map(([key,label])=>r[key]?summaryBlock(label,r[key]):'').join('')}<div class="source-list">${(r.sources||[]).map(s=>`<p>${externalLink(s.url,s.label)}<small>${e(s.checked||'')}</small></p>`).join('')}</div></section>`;}

function researchSources(school){return school.research?.admissionsResearch?.sources?.length?`<details class="detail-section"><summary>Sources for updated application rules</summary><div class="detail-content source-list">${school.research.admissionsResearch.sources.map(s=>`<p>${externalLink(s.url,s.label)}<small>${e(s.checked||'')}</small></p>`).join('')}</div></details>`:'';}

function fitDetails(match) {
  if (!match.reasons?.length) return `<p class="identity-fit muted">${match.missing?.length?e(match.missing.join(' ')):'No matching preferences set.'}</p>`;
  return `<details class="identity-fit"><summary><span><strong>${match.score == null ? 'Match' : `${match.score}%`}</strong> preference fit</span><span class="fit-info">Details</span></summary><div class="match-explanation">${match.reasons.map(reason => `<p>${reason.matched ? '✓' : '○'} ${e(reason.label)} <small>Weight ${reason.weight}/10</small></p>`).join('')}${(match.missing || []).map(text => `<p class="muted">${e(text)}</p>`).join('')}<p class="footer-note">Scores measure documented preference matches. They are not admission probabilities.</p></div></details>`;
}

export function schoolCard(school, state, match = {}, dossier = null) {
  const record = recordFor(state, school.id);
  const selected = (state.prefs.details || []).filter(key => Object.hasOwn(SCHOOL_TABS, key) && !['dossier', 'notes'].includes(key));
  const opened=Object.hasOwn(SCHOOL_TABS,state.ui.schoolTab)&&!selected.includes(state.ui.schoolTab)&&!['dossier','notes'].includes(state.ui.schoolTab)?[state.ui.schoolTab]:[];
  const tabs = [...selected,...opened, 'dossier', 'notes'];
  const active = tabs.includes(state.ui.schoolTab) ? state.ui.schoolTab : tabs[0];
  const heading = SCHOOL_TABS[active];
  const initials = school.name.split(/\s+/).filter(word => !['of', 'the', 'University', 'Institute'].includes(word)).slice(0, 2).map(word => word[0]).join('');
  const decision = record.decision === 'saved' ? 'On your list' : record.decision === 'passed' ? 'Passed for now' : 'Unreviewed';
  return `<article class="school-card review-card review-frame" data-school-id="${e(school.id)}" aria-labelledby="school-name">
    <div class="review-layout">
      <section class="school-identity" data-swipe-surface data-school-id="${e(school.id)}" aria-label="School overview">
        <div class="identity-top"><span class="school-monogram" aria-hidden="true">${e(initials)}</span>${tag(school.country)}</div>
        <div class="identity-name"><p class="eyebrow">GRADUATE MATHEMATICS</p><h1 class="school-title" id="school-name">${e(school.name)}</h1><p class="school-location">${icon('pin')} ${e([school.city, school.country].filter(Boolean).join(', '))}</p><p class="identity-program">${e((Array.isArray(school.degree) ? school.degree.join(' / ') : school.degree) || 'Graduate mathematics')}</p></div>
        ${school.programRoute?`<p>${e(school.programFormat)}<br>${e(school.duration)}</p>`:school.programType==='Department overview'?'<p class="notice">Department overview: admissions and funding can differ between its degree routes.</p>':''}
        ${fitDetails(match)}
        <div class="identity-bottom"><p class="identity-status"><span>${e(decision)}</span>${record.flagged ? `<span class="identity-flag">${icon('flag')} Flagged to revisit</span>` : ''}</p><p class="swipe-hint">Swipe left to pass · right to save<br><span>Or use the buttons below.</span></p></div>
      </section>
      <section class="school-information" aria-label="School information">
        <div class="school-tabs" role="tablist" aria-label="Information on this card">${tabs.map(key => `<button class="school-tab" type="button" role="tab" id="school-tab-${key}" aria-selected="${active === key}" aria-controls="school-tab-content" data-action="school-tab" data-tab="${key}">${e(SCHOOL_TABS[key].label)}</button>`).join('')}</div>
        <div class="school-tab-content" id="school-tab-content" role="tabpanel" aria-labelledby="school-tab-${active}" tabindex="0" data-active-tab="${active}">
          ${!selected.length ? `<div class="notice no-card-details"><p>No card topics selected.</p>${button('profile-step', 'Configure card information', 'secondary small', 'data-step="cards"')}</div>` : ''}
          <div class="tab-heading"><div><h2>${e(heading.title)}</h2><p class="muted">${e(heading.description)}</p></div>${button('profile-step', icon('sliders'), 'ghost icon-button', 'data-step="cards" aria-label="Customize the information on my cards" title="Customize my cards"')}</div>
          <div class="tab-copy">${sectionContent(active, school, state, dossier)}</div>
        </div>
      </section>
    </div>
    <footer class="decision-bar review-decisions"><div class="decision-actions">
      ${button('decide', `${icon('close')} <span>${record.decision === 'passed' ? 'Passed' : 'Pass'}</span>`, 'decision-button pass', `data-id="${e(school.id)}" data-decision="passed" aria-pressed="${record.decision === 'passed'}" aria-label="${record.decision==='passed'?'Mark':'Pass on'} ${e(school.name)}${record.decision==='passed'?' unreviewed':''}" ${record.decision==='passed'?'title="Click again to mark unreviewed"':''}`)}
      ${button('flag', `${icon('flag')} <span>${record.flagged ? 'Flagged' : 'Flag'}</span>`, `decision-button flag ${record.flagged ? 'is-active' : ''}`, `data-id="${e(school.id)}" aria-pressed="${record.flagged}" aria-label="${record.flagged ? 'Unflag' : 'Flag'} ${e(school.name)}"`)}
      ${button('decide', `${icon('heart')} <span>${record.decision === 'saved' ? 'Saved' : 'Save'}</span>`, 'decision-button save', `data-id="${e(school.id)}" data-decision="saved" aria-pressed="${record.decision === 'saved'}" aria-label="${record.decision==='saved'?'Mark':'Save'} ${e(school.name)} ${record.decision==='saved'?'unreviewed':'to my list'}" ${record.decision==='saved'?'title="Click again to mark unreviewed"':''}`)}
    </div><p class="decision-caption">Click Save or Pass again to undo. Flags stay separate.</p></footer>
  </article>`;
}

export function dossierContent(dossier, state) {
  return `<div class="dossier-content">${(dossier.sections || []).map((section, index) => `<details class="detail-section" data-section="dossier-${index}" ${(state.ui.openSections || []).includes(`dossier-${index}`) ? 'open' : ''}><summary>${e(section.title)}</summary><div class="detail-content">${textBlock(section.text || section.fields?.map(field => `${field.label} [${field.status}]\n${field.text}`).join('\n\n'))}</div></details>`).join('')}
    ${dossier.sources?.length ? `<details class="detail-section"><summary>All linked sources (${dossier.sources.length})</summary><div class="detail-content source-list">${dossier.sources.map(source => `<p><strong>${e(source.id || '')}</strong> ${externalLink(source.url, source.label || source.url)}<small>${e([source.checked, source.cycle, source.evidence].filter(Boolean).join(' · '))}</small></p>`).join('')}</div></details>` : ''}
    ${dossier.pages?.length?`<details class="detail-section"><summary>Original page text (${dossier.pages?.length || 0} pages)</summary><div class="detail-content">${(dossier.pages || []).map(page => `<details class="detail-section"><summary>PDF page ${page.number}</summary><div class="detail-content">${textBlock(page.text)}<div class="source-list">${(page.links || []).map(link => externalLink(link.url, link.label || link.url)).join('<br>')}</div></div></details>`).join('')}</div></details>`:''}</div>`;
}

export function trackerFields(school, state) {
  const record = recordFor(state, school.id);
  return `<label class="field-label">Application status<select class="select" data-record="applicationStatus" data-id="${e(school.id)}">${options(['Not started', 'Researching', 'Preparing', 'Submitted', 'Interview', 'Offer', 'Waitlisted', 'Rejected', 'Withdrawn'], record.applicationStatus || 'Not started')}</select></label>
    <label class="field-label">My notes<textarea class="textarea" rows="5" data-record="notes" data-id="${e(school.id)}" placeholder="Notes, adviser contacts, questions…">${e(record.notes)}</textarea></label>
    <div class="field-grid">${state.fields.custom.map(field => `<label class="field-label">${e(field.label)}<input class="${field.type === 'checkbox' ? '' : 'input'}" type="${e(field.type)}" data-custom="${e(field.id)}" data-id="${e(school.id)}" ${field.type === 'checkbox' ? (record.custom[field.id] ? 'checked' : '') : `value="${e(record.custom[field.id] ?? '')}"`}></label>`).join('')}</div>
    ${record.decision!=='unreviewed'?button('decide','Mark this school unreviewed','secondary small',`data-id="${e(school.id)}" data-decision="unreviewed"`):''}
    ${button('tracker-step', `${icon('plus')} Add a tracking field`, 'ghost small', 'data-step="fields"')}`;
}
