const paths = {discover:'discover',collection:'schools',preferences:'profile',export:'tracker',report:'library',data:'storage'};
export function routeFor(ui) {
  if (ui.detailId) return `#schools/${encodeURIComponent(ui.detailId)}`;
  if (ui.view==='export')return `#tracker/${ui.trackerStep||'export'}`;
  if (ui.view === 'preferences') {
    const step = ui.profileStep || 'home';
    if(step==='people'&&ui.peoplePurpose==='connections')return '#profile/people/matching';
    return step === 'home' ? '#profile' : `#profile/${step}${step === 'schools' ? `/${ui.filterStep || 'location'}` : step === 'priorities' ? `/${ui.priorityStep || 'research'}` : ''}`;
  }
  return `#${paths[ui.view] || 'profile'}`;
}

export function parseRoute(hash) {
  let parts;
  try {parts = decodeURIComponent(hash.replace(/^#\/?/,'')).split('/');} catch {return null;}
  const [path,step,substep] = parts;
  const view = Object.keys(paths).find(key => paths[key] === path);
  if (!view) return null;
  const ui = {view,detailId:null};
  if(view==='export')ui.trackerStep=['fields','columns','export'].includes(step)?step:'export';
  if (view === 'collection' && step) ui.detailId = step;
  if (view === 'preferences') {
    ui.profileStep = ['schools','priorities','cards','people'].includes(step) ? step : 'home';
    if (step === 'schools') ui.filterStep = ['location','academic','requirements'].includes(substep) ? substep : 'location';
    if (step === 'priorities') ui.priorityStep = ['research','location','people','ranking'].includes(substep) ? substep : 'research';
    if (step === 'people') ui.peoplePurpose = substep==='matching'?'connections':'known';
  }
  return ui;
}
