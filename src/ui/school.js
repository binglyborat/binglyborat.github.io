import {schoolContent,rankingPanel} from './school-content.js';
import { e, icon, button, tag, recordFor, textBlock, externalLink, options } from './components.js';

export const SCHOOL_TABS = {
  department: {label:'Department notes',title:'About the department',description:'Research strengths, department character, and the mathematical community.'},
  connections: {label:'Connections',title:'Connections to selected professors',description:'People I know and professors selected for matching, with documented relationship evidence.'},
  committee: {label:'Committee',title:'Graduate committee & admissions roles',description:''},
  research: { label: 'Research', title: 'Research areas', description: '' },
  faculty: { label: 'Faculty', title: 'Faculty', description: '' },
  funding: { label: 'Funding', title: 'Funding & fees', description: 'Financial support, costs, and remaining checks.' },
  admissions: { label: 'Applying', title: 'Applying & deadlines', description: 'Eligibility, preparation, and required materials.' },
  international: { label: 'International', title: 'International applicants', description: 'Language requirements, eligibility, and international support.' },
  city: { label: 'Location', title: 'Location', description: 'Campus location and setting.' },
  size: { label: 'Size', title: 'School size', description: 'University enrollment and mathematics cohort information.' },
  notes: { label: 'My notes', title: 'Notes & tracker', description: 'Notes and application progress are saved automatically.' },
};

function fitDetails(match) {
  if (!match.reasons?.length) return match.missing?.length?`<p class="identity-fit muted">${e(match.missing.join(' '))}</p>`:'';
  return `<details class="identity-fit"><summary><span><strong>${match.score == null ? 'Match' : `${match.score}%`}</strong> preference fit</span><span class="fit-info">Details</span></summary><div class="match-explanation">${match.reasons.map(reason => `<p>${reason.matched ? '✓' : '○'} ${e(reason.label)} <small>Weight ${reason.weight}/10</small></p>`).join('')}${(match.missing || []).map(text => `<p class="muted">${e(text)}</p>`).join('')}<p class="footer-note">Scores measure documented preference matches. They are not admission probabilities.</p></div></details>`;
}

export function schoolCard(school, state, match = {}, dossier = null) {
  const record = recordFor(state, school.id);
  const selected = (state.prefs.details || []).filter(key => Object.hasOwn(SCHOOL_TABS, key) && !['dossier', 'notes'].includes(key));
  const opened=Object.hasOwn(SCHOOL_TABS,state.ui.schoolTab)&&!selected.includes(state.ui.schoolTab)&&!['dossier','notes'].includes(state.ui.schoolTab)?[state.ui.schoolTab]:[];
  const tabs = [...selected,...opened, 'notes'];
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
        ${rankingPanel(school)}
        <div class="identity-bottom"><p class="identity-status"><span>${e(decision)}</span>${record.flagged ? `<span class="identity-flag">${icon('flag')} Flagged to revisit</span>` : ''}</p><p class="swipe-hint">Swipe left to pass · right to save</p></div>
      </section>
      <section class="school-information" aria-label="School information">
        <div class="school-tabs" role="tablist" aria-label="Information on this card">${tabs.map(key => `<button class="school-tab" type="button" role="tab" id="school-tab-${key}" aria-selected="${active === key}" aria-controls="school-tab-content" data-action="school-tab" data-tab="${key}">${e(SCHOOL_TABS[key].label)}</button>`).join('')}</div>
        <div class="school-tab-content" id="school-tab-content" role="tabpanel" aria-labelledby="school-tab-${active}" tabindex="0" data-active-tab="${active}">
          ${!selected.length ? `<div class="notice no-card-details"><p>No card topics selected.</p>${button('profile-step', 'Configure card information', 'secondary small', 'data-step="cards"')}</div>` : ''}
          <div class="tab-heading"><div><h2>${e(heading.title)}</h2></div>${button('profile-step', icon('sliders'), 'ghost icon-button', 'data-step="cards" aria-label="Customize the information on my cards" title="Customize my cards"')}</div>
          <div class="tab-copy">${active==='notes'?trackerFields(school,state):schoolContent(active,school,state,dossier)}</div>
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
