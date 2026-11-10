/** Reorder selected card topics without changing which topics are selected.
 * The entire row can be dragged; checkboxes and the arrow buttons stay native. */
const ROW = '[data-card-key]';
const INTERACTIVE = 'input,button,a,select,textarea,summary,[contenteditable]';
const rows = list => [...list.querySelectorAll(ROW)];
const keys = list => rows(list).map(row => row.dataset.cardKey);
const sameOrder = (left, right) => left.length === right.length && left.every((key, index) => key === right[index]);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function attachCardReorder(container, {
  onReorder, onSettled = () => {},
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = id => globalThis.cancelAnimationFrame(id),
} = {}) {
  let gesture = null, frame = null, suppressClick = false, clickTimer, settleTimer;
  const view = container.ownerDocument?.defaultView;
  const announce = message => {
    const status = container.querySelector('[data-card-order-status]');
    if (status) status.textContent = message;
  };
  const order = (current, next) => {
    const existing = new Map(rows(current.list).map(row => [row.dataset.cardKey, row]));
    if (next.length !== existing.size || next.some(key => !existing.has(key))) return false;
    if (!sameOrder(keys(current.list), next)) for (const key of next) current.list.append(existing.get(key));
    return true;
  };
  function begin(row, mode, event) {
    const list = row.closest('[data-card-order]');
    if (!list || rows(list).length < 2) return;
    gesture = { row, list, mode, key:row.dataset.cardKey, title:row.dataset.cardTitle || row.dataset.cardKey,
      original:keys(list), pointerId:event?.pointerId, startX:event?.clientX, startY:event?.clientY,
      y:event?.clientY, offset:event ? event.clientY - row.getBoundingClientRect().top : 0,
      active:mode === 'keyboard' };
    if (gesture.active) {
      row.classList.add('is-reordering');
      announce(`${gesture.title} picked up. Use arrow keys to move; Enter to finish or Escape to cancel.`);
    }
  }
  function finish(cancelled = false, notify = true) {
    const current = gesture;
    gesture = null;
    clearTimeout(settleTimer);
    if (frame !== null) { cancelFrame(frame); frame = null; }
    if (!current) return;
    const next = keys(current.list);
    const complete = next.length === current.original.length && new Set(next).size === next.length
      && next.every(key => current.original.includes(key)) && current.list.isConnected !== false;
    cancelled = cancelled || !complete;
    const changed = current.active && !cancelled && !sameOrder(next, current.original);
    if (cancelled || !complete) order(current, current.original);
    current.row.style.transform = '';
    current.row.classList.remove('is-reordering', 'is-dragging');
    current.list.classList.remove('is-reordering');
    if (current.active && current.mode === 'pointer') {
      suppressClick = true;
      clearTimeout(clickTimer); clickTimer = setTimeout(() => { suppressClick = false; }, 250);
    }
    try { current.row.releasePointerCapture(current.pointerId); } catch { /* capture may already be released */ }
    try {
      if (changed) onReorder?.(next);
    } finally {
      try { if (notify) onSettled({changed, cancelled}); }
      finally {
        // Both callbacks may rerender the page. Restore focus and announce only
        // after the final render, using the new row rather than a detached node.
        if (current.active) {
          const position = (cancelled ? current.original : next).indexOf(current.key) + 1;
          announce(cancelled ? `Reordering cancelled. ${current.title} returned to position ${position}.` : `${current.title} is in position ${position} of ${next.length}.`);
          [...container.querySelectorAll(ROW)].find(row => row.dataset.cardKey === current.key)?.focus({preventScroll:true});
        }
      }
    }
  }
  function paint(current) {
    if (current.list.isConnected === false) { finish(true); return; }
    current.row.style.transform = '';
    const others = rows(current.list).filter(row => row !== current.row);
    const center = current.y - current.offset + current.row.getBoundingClientRect().height / 2;
    const before = others.find(row => { const rect=row.getBoundingClientRect(); return center < rect.top + rect.height / 2; });
    const next = others.map(row => row.dataset.cardKey);
    next.splice(before ? next.indexOf(before.dataset.cardKey) : next.length, 0, current.key);
    order(current, next);
    current.row.style.transform = `translate3d(0, ${current.y - current.offset - current.row.getBoundingClientRect().top}px, 0)`;
  }
  function schedule() {
    if (frame !== null || !gesture?.active || gesture.mode !== 'pointer') return;
    const current = gesture;
    frame = requestFrame(() => {
      frame = null;
      if (gesture !== current) return;
      const height = view?.innerHeight || 0;
      const speed = height ? current.y < 56 ? -Math.ceil((56-current.y)/4) : current.y > height-56 ? Math.ceil((current.y-height+56)/4) : 0 : 0;
      const before = view?.scrollY;
      if (speed) view?.scrollBy?.({top:clamp(speed,-18,18),behavior:'instant'});
      paint(current);
      if (speed && view?.scrollY !== before) schedule();
    });
  }
  function down(event) {
    if (gesture?.ending) finish(false);
    if (gesture || !event.isPrimary || event.button !== 0 || event.target.closest(INTERACTIVE)) return;
    const row = event.target.closest(ROW);
    if (row) begin(row, 'pointer', event);
  }
  function move(event) {
    const current = gesture;
    if (!current || current.ending || current.mode !== 'pointer' || event.pointerId !== current.pointerId) return;
    current.y = event.clientY;
    if (!current.active) {
      if (Math.hypot(event.clientX-current.startX,event.clientY-current.startY) < 8) return;
      current.active = true;
      current.row.classList.add('is-reordering','is-dragging'); current.list.classList.add('is-reordering');
      try { current.row.setPointerCapture(current.pointerId); } catch { /* pointer can still be handled inside the list */ }
      announce(`Moving ${current.title}. Release to set its position.`);
    }
    if (event.cancelable) event.preventDefault();
    schedule();
  }
  function up(event) {
    if (!gesture || gesture.mode !== 'pointer' || event.pointerId !== gesture.pointerId) return;
    if (!gesture.active) {
      // A label click happens after pointerup. Keep the candidate alive through
      // that native click/change so a queued render cannot replace its checkbox.
      const current=gesture;
      current.ending=true;
      clearTimeout(settleTimer);
      settleTimer=setTimeout(()=>{if(gesture===current)finish(false);},0);
      return;
    }
    if (gesture.active) { gesture.y=event.clientY; paint(gesture); }
    finish(false);
  }
  function cancel(event) {
    if (gesture && (event.pointerId === undefined || event.pointerId === gesture.pointerId)) finish(true);
  }
  function click(event) {
    if (!suppressClick && !gesture?.active) return;
    suppressClick = false; clearTimeout(clickTimer);
    event.preventDefault(); event.stopPropagation();
  }
  function keydown(event) {
    if (gesture && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(true); return; }
    if (gesture?.mode === 'keyboard' && event.key === 'Tab') { finish(false); return; }
    if (event.target.closest(INTERACTIVE)) return;
    const row=event.target.closest(ROW);
    if (!row) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation();
      if (gesture?.mode === 'keyboard') finish(false);
      else if (!gesture) begin(row,'keyboard');
      return;
    }
    if (gesture?.mode !== 'keyboard' || gesture.row !== row || !['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const next=keys(gesture.list), index=next.indexOf(gesture.key);
    const target=event.key==='Home'?0:event.key==='End'?next.length-1:clamp(index+(event.key==='ArrowUp'?-1:1),0,next.length-1);
    next.splice(index,1);next.splice(target,0,gesture.key);order(gesture,next);
    row.focus({preventScroll:true});announce(`${gesture.title}, position ${target+1} of ${next.length}.`);
  }
  const handlers={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:cancel,keydown};
  for (const [name,handler] of Object.entries(handlers)) container.addEventListener(name,handler);
  container.addEventListener('click',click,true);
  view?.addEventListener('blur',cancel);
  view?.addEventListener('pointerup',up);
  view?.addEventListener('scroll',schedule);
  function reset() { finish(true); }
  reset.isActive=()=>gesture!==null;
  reset.destroy=()=>{
    finish(true,false);clearTimeout(clickTimer);clearTimeout(settleTimer);suppressClick=false;
    for (const [name,handler] of Object.entries(handlers)) container.removeEventListener(name,handler);
    container.removeEventListener('click',click,true);view?.removeEventListener('blur',cancel);
    view?.removeEventListener('pointerup',up);view?.removeEventListener('scroll',schedule);
  };
  return reset;
}
