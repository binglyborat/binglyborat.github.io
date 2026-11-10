/** Horizontal gestures are limited to the school identity; reading panes scroll normally. */
export function swipeDecision(dx, dy) {
  return Math.abs(dx) >= 85 && Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx > 0 ? 'saved' : 'passed') : null;
}

const INTENT_DISTANCE = 14;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function attachSwipe(container, {
  enabled, onDecision, onSettled = () => {},
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = frame => globalThis.cancelAnimationFrame(frame),
}) {
  let gesture = null, frame = null;

  function clearGesture() {
    const previous = gesture;
    gesture = null;
    if (frame !== null) { cancelFrame(frame); frame = null; }
    if (!previous) return null;
    previous.surface.style.transform = '';
    previous.surface.classList.remove('swiping', 'swipe-right', 'swipe-left');
    previous.feedback?.remove();
    // Clearing the state first also makes the resulting lostpointercapture inert.
    try { previous.surface.releasePointerCapture(previous.pointerId); } catch { /* capture may already be gone */ }
    return previous;
  }

  function reset() {
    const previous = clearGesture();
    if (previous) onSettled({id: previous.id, decision: null});
  }

  function paint(current) {
    const {surface, dx, feedback} = current;
    const travel = clamp(dx / 3, -100, 100);
    surface.style.transform = `translate3d(${travel}px, 0, 0) rotate(${travel / 35}deg)`;
    const direction = Math.abs(dx) < INTENT_DISTANCE ? 0 : Math.sign(dx);
    surface.classList.toggle('swipe-right', direction > 0);
    surface.classList.toggle('swipe-left', direction < 0);
    feedback.hidden = direction === 0;
    if (direction !== current.direction) {
      feedback.textContent = direction > 0 ? 'Save school' : direction < 0 ? 'Pass for now' : '';
      current.direction = direction;
    }
  }

  function schedulePaint() {
    if (frame !== null) return;
    const current = gesture;
    frame = requestFrame(() => {
      if (gesture !== current) return;
      frame = null; paint(current);
    });
  }

  function down(event) {
    const surface = event.target.closest('[data-swipe-surface]');
    if (gesture || !enabled() || !surface || !event.isPrimary || event.button !== 0
      || event.target.closest('button,a,input,summary,select,textarea,[contenteditable]')) return;
    gesture = {surface, pointerId:event.pointerId, x:event.clientX, y:event.clientY,
      dx:0, dy:0, horizontal:false, direction:0, feedback:null, id:surface.dataset.schoolId};
    try { surface.setPointerCapture(event.pointerId); } catch { /* mouse events can still be handled inside the card */ }
  }

  function move(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.dx = event.clientX - gesture.x;
    gesture.dy = event.clientY - gesture.y;
    if (!gesture.horizontal) {
      const horizontal = Math.abs(gesture.dx), vertical = Math.abs(gesture.dy);
      if (Math.max(horizontal, vertical) < INTENT_DISTANCE) return;
      if (vertical > horizontal * 1.2) { reset(); return; }
      if (horizontal < INTENT_DISTANCE || horizontal < vertical * 1.5) return;
      gesture.horizontal = true;
      gesture.surface.classList.add('swiping');
      const feedback = container.ownerDocument.createElement('span');
      feedback.className = 'swipe-feedback'; feedback.setAttribute('aria-hidden', 'true'); feedback.hidden = true;
      gesture.surface.append(feedback); gesture.feedback = feedback;
    }
    // Once horizontal intent is established, every position matters, including
    // crossing zero or moving back inside the initial intent threshold.
    if (event.cancelable) event.preventDefault();
    schedulePaint();
  }

  function up(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const decision = gesture.horizontal ? swipeDecision(event.clientX - gesture.x, event.clientY - gesture.y) : null;
    const previous = clearGesture();
    try { if (decision && enabled()) onDecision(previous.id, decision); }
    finally { onSettled({id:previous.id, decision}); }
  }

  function cancel(event) {
    if (gesture && (event.pointerId === undefined || event.pointerId === gesture.pointerId)) reset();
  }
  const handlers = {pointerdown:down, pointermove:move, pointerup:up, pointercancel:cancel, lostpointercapture:cancel};
  for (const [name, handler] of Object.entries(handlers)) container.addEventListener(name, handler);
  const view = container.ownerDocument?.defaultView;
  view?.addEventListener('blur', cancel);

  // render() may clear an inactive card normally. While a pointer is held, the
  // caller can defer asynchronous rerenders and replay them from onSettled.
  reset.isActive = () => gesture !== null;
  reset.destroy = () => {
    clearGesture();
    for (const [name, handler] of Object.entries(handlers)) container.removeEventListener(name, handler);
    view?.removeEventListener('blur', cancel);
  };
  return reset;
}
