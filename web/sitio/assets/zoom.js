/* AulaPro · the zoom viewer. Any element with data-zoom opens its image full screen:
   click or tap to zoom in, wheel or pinch to zoom, drag to move, Esc to close. */
(() => {
  'use strict';
  const dlg = document.getElementById('zoom');
  if (!dlg) return;
  const stage = dlg.querySelector('.zoom-stage');
  const img = dlg.querySelector('.zoom-img');
  const cap = dlg.querySelector('.zoom-cap');
  const btnX = dlg.querySelector('.zoom-x');
  const btnIn = dlg.querySelector('.zoom-in');
  const btnOut = dlg.querySelector('.zoom-out');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  let nw = 1, nh = 1, fit = 1, maxZ = 2, z = 1, x = 0, y = 0;
  let lastFocus = null, openToken = 0;
  const pts = new Map();
  let gesture = null, moved = false;

  function box() { return stage.getBoundingClientRect(); }
  function apply() { img.style.transform = `translate(${x}px,${y}px) scale(${z})`; stage.classList.toggle('zoomed', z > fit * 1.02); }
  function bound() {
    const r = box();
    const w = nw * z, h = nh * z;
    x = w <= r.width ? (r.width - w) / 2 : clamp(x, r.width - w, 0);
    y = h <= r.height ? (r.height - h) / 2 : clamp(y, r.height - h, 0);
  }
  function zoomAt(nz, cx, cy) {
    nz = clamp(nz, fit, maxZ);
    const px = (cx - x) / z, py = (cy - y) / z;
    z = nz;
    x = cx - px * z;
    y = cy - py * z;
    bound();
    apply();
  }
  function reset() {
    const r = box();
    fit = Math.min((r.width - 24) / nw, (r.height - 24) / nh, 1);
    maxZ = Math.max(2, fit * 3);
    z = fit;
    bound();
    apply();
  }

  function open(src, alt) {
    const token = ++openToken;
    lastFocus = document.activeElement;
    cap.textContent = alt || '';
    img.alt = alt || '';
    img.style.opacity = '0';
    dlg.hidden = false;
    document.documentElement.classList.add('zoom-open');
    btnX.focus({ preventScroll: true });
    const ready = () => {
      if (token !== openToken) return;
      nw = img.naturalWidth || 1;
      nh = img.naturalHeight || 1;
      img.style.width = nw + 'px';
      img.style.height = nh + 'px';
      reset();
      img.style.opacity = '1';
    };
    img.onload = ready;
    img.src = src;
    if (img.complete && img.naturalWidth) ready();
  }
  function close() {
    if (dlg.hidden) return;
    openToken++;
    dlg.hidden = true;
    document.documentElement.classList.remove('zoom-open');
    pts.clear();
    gesture = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  /* pointer: tap toggles, one finger drags, two fingers pinch */
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), z };
    } else {
      gesture = { type: 'drag', sx: e.clientX, sy: e.clientY, x, y };
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = box();
    if (gesture && gesture.type === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      moved = true;
      zoomAt(gesture.z * d / gesture.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    } else if (gesture && gesture.type === 'drag') {
      const dx = e.clientX - gesture.sx, dy = e.clientY - gesture.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (moved && z > fit * 1.02) {
        stage.classList.add('dragging');
        x = gesture.x + dx;
        y = gesture.y + dy;
        bound();
        apply();
      }
    }
  });
  function up(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    stage.classList.remove('dragging');
    if (gesture && gesture.type === 'drag' && !moved && e.type === 'pointerup') {
      const r = box();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const inside = cx >= x && cx <= x + nw * z && cy >= y && cy <= y + nh * z;
      if (!inside && z <= fit * 1.02) { close(); return; }
      if (z > fit * 1.02) zoomAt(fit, cx, cy);
      else zoomAt(Math.max(1, fit * 2), cx, cy);
    }
    if (pts.size === 1) {
      const [p] = [...pts.values()];
      gesture = { type: 'drag', sx: p.x, sy: p.y, x, y };
      moved = true;
    } else if (!pts.size) gesture = null;
  }
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = box();
    zoomAt(z * Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  btnX.addEventListener('click', close);
  btnIn.addEventListener('click', () => { const r = box(); zoomAt(z * 1.5, r.width / 2, r.height / 2); });
  btnOut.addEventListener('click', () => { const r = box(); zoomAt(z / 1.5, r.width / 2, r.height / 2); });
  // listen on the document: a click on the picture moves focus to the body, and Esc must still close
  document.addEventListener('keydown', e => {
    if (dlg.hidden) return;
    const r = box();
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === '+' || e.key === '=') zoomAt(z * 1.5, r.width / 2, r.height / 2);
    else if (e.key === '-') zoomAt(z / 1.5, r.width / 2, r.height / 2);
    else if (e.key === '0') zoomAt(fit, r.width / 2, r.height / 2);
    else if (e.key.startsWith('Arrow') && z > fit * 1.02) {
      e.preventDefault();
      const step = 80;
      if (e.key === 'ArrowLeft') x += step;
      if (e.key === 'ArrowRight') x -= step;
      if (e.key === 'ArrowUp') y += step;
      if (e.key === 'ArrowDown') y -= step;
      bound();
      apply();
    } else if (e.key === 'Tab') {
      // keep focus inside the viewer
      const f = [btnOut, btnIn, btnX];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus();
    }
  });
  addEventListener('resize', () => { if (!dlg.hidden) reset(); });

  /* every [data-zoom] gets a visible button, so it works with keyboard and touch too */
  const LABEL = () => dlg.dataset.openLabel || 'Ampliar imagen';
  document.querySelectorAll('[data-zoom]').forEach(el => {
    const im = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (!im) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zoom-btn';
    b.setAttribute('aria-label', LABEL());
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8.2v5.6M8.2 11h5.6"/></svg>';
    const go = ev => {
      ev.preventDefault();
      open(el.dataset.zoom || im.currentSrc || im.src, im.alt);
    };
    b.addEventListener('click', go);
    // a container can offer a visible, labelled button in its own text instead of the corner icon
    const slot = el.querySelector('[data-zoom-slot]');
    if (slot) {
      b.classList.add('inline');
      b.insertAdjacentHTML('beforeend', '<span></span>');
      b.lastChild.textContent = LABEL();
      slot.append(b);
    } else el.append(b);
    if (!el.hasAttribute('data-zoom-button-only')) {
      el.classList.add('zoomable');
      el.addEventListener('click', ev => { if (!ev.target.closest('a,button')) go(ev); });
    }
  });
  // the page's language switch rewrites the label: keep the buttons in step
  new MutationObserver(() => document.querySelectorAll('.zoom-btn').forEach(b => {
    b.setAttribute('aria-label', LABEL());
    const sp = b.querySelector('span');
    if (sp) sp.textContent = LABEL();
  }))
    .observe(dlg, { attributes: true, attributeFilter: ['data-open-label'] });

  window.AulaZoom = { open, close };
})();
