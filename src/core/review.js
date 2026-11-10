/** Review navigation is independent of decisions, so a saved/passed school stays reachable. */
export function reviewQueue(matches,state) {
  const scope=state.ui.queueScope||'unreviewed';
  return matches.filter(({school})=>{
    const record=state.records[school.id]||{decision:'unreviewed',flagged:false};
    return scope==='all'||(scope==='flagged'?record.flagged:record.decision===scope);
  });
}
export function visitSchool(state,id) {
  const trail=state.ui.reviewTrail||[];
  const cursor=Number.isInteger(state.ui.reviewCursor)?state.ui.reviewCursor:trail.length-1;
  if(trail[cursor]!==id){state.ui.reviewTrail=[...trail.slice(0,cursor+1),id].slice(-1000);state.ui.reviewCursor=state.ui.reviewTrail.length-1;}
  state.ui.activeId=id;state.ui.reviewFinished=false;
}
export function canGoBack(state) {
  return (state.ui.reviewTrail?.length||0)>0 && (!state.ui.activeId || state.ui.reviewCursor>0);
}
export function nextCandidate(matches,state) {
  const available=reviewQueue(matches,state).filter(item=>item.school.id!==state.ui.activeId);
  const index=matches.findIndex(item=>item.school.id===state.ui.activeId);
  const next=available.find(item=>matches.indexOf(item)>index);
  return next?.school.id||((state.ui.queueScope||'unreviewed')==='unreviewed'?available[0]?.school.id:null)||null;
}
export function canGoNext(matches,state) {
  return state.ui.reviewCursor<(state.ui.reviewTrail?.length||0)-1||Boolean(nextCandidate(matches,state));
}
export function moveReview(state,matches,direction) {
  const trail=state.ui.reviewTrail||[];
  let cursor=Number.isInteger(state.ui.reviewCursor)?state.ui.reviewCursor:trail.length-1;
  if(direction==='previous') {
    if(state.ui.activeId)cursor--;
    if(cursor<0||!trail[cursor])return false;
    state.ui.reviewCursor=cursor;state.ui.activeId=trail[cursor];state.ui.reviewFinished=false;return true;
  }
  if(cursor<trail.length-1){state.ui.reviewCursor=cursor+1;state.ui.activeId=trail[cursor+1];state.ui.reviewFinished=false;return true;}
  const id=nextCandidate(matches,state);
  if(id){visitSchool(state,id);return true;}
  state.ui.activeId=null;state.ui.reviewFinished=true;return false;
}
export function restartReview(state,matches,scope='all') {
  state.ui.queueScope=scope;state.ui.activeId=null;state.ui.reviewFinished=false;state.ui.reviewCursor=(state.ui.reviewTrail?.length||0)-1;
  const first=reviewQueue(matches,state)[0];if(first)visitSchool(state,first.school.id);
}
export function markUnreviewed(state,ids) {
  state.ui.decisionUndo=Object.fromEntries(ids.map(id=>[id,state.records[id]?.decision||'unreviewed']));
  for(const id of ids)if(state.records[id])state.records[id]={...state.records[id],decision:'unreviewed'};
  state.ui.reviewFinished=false;
}
export function restoreDecisions(state) {
  for(const [id,decision] of Object.entries(state.ui.decisionUndo||{})) {
    state.records[id]={decision:'unreviewed',flagged:false,notes:'',custom:{},...state.records[id],decision};
  }
  delete state.ui.decisionUndo;
}
