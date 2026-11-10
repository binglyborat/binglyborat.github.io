import {icon,button} from './components.js';

export function shell({state,body,review=false}) {
  const view=state.ui.view;
  const saved=Object.values(state.records).filter(record=>record.decision==='saved').length;
  const links=[['discover','Review','discover'],['collection','Schools','heart'],['preferences','Profile','sliders'],['export','Tracker','download']];
  return `<div class="app-shell app-v2 ${review?'is-review':''}">
    <header class="app-header">
      <a class="brand" href="#profile" data-action="navigate" data-view="preferences" aria-label="Math Grad Tinder home"><img class="brand-mark" src="./favicon.svg" alt="" width="36" height="41" title="A flame with a graduate degree"><span class="brand-name">Math Grad Tinder</span></a>
      <nav class="primary-nav" aria-label="Main navigation">${links.map(([key,label,glyph])=>`<button class="nav-button" data-action="navigate" data-view="${key}" ${key===view?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span>${key==='collection'&&saved?`<span class="nav-count">${saved}</span>`:''}</button>`).join('')}</nav>
      <div class="header-tools"><span class="save-indicator" data-save-status></span><details class="utility-menu"><summary aria-label="More options">${icon('more')}</summary><div class="utility-links">${button('backup',`${icon('download')} Download backup`,'ghost')}${button('navigate',`${icon('shield')} Backups & storage`,'ghost','data-view="data"')}${button('navigate',`${icon('book')} Source library`,'ghost','data-view="report"')}</div></details></div>
    </header>
    <div class="workspace"><main class="main ${review?'review-main':''}" id="main"><div id="storage-warning" class="save-banner" role="alert" hidden></div>${body}</main></div>
    <span class="sr-only" role="status" aria-live="polite" id="review-announcement"></span>
  </div>`;
}
