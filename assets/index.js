import { qs, setText } from './site.js';

const embeddedDemos = [
  ['held-draft', 'algorithms/01-held-draft.html', './demos/held-draft.js'],
  ['sequencer', 'algorithms/02-ticket-sequencer.html', './demos/ticket-sequencer.js'],
  ['coagent', 'algorithms/03-coagent.html', './demos/coagent.js'],
  ['latte', 'algorithms/04-latte.html', './demos/latte.js'],
  ['syncplan', 'algorithms/05-syncplan.html', './demos/syncplan.js'],
  ['atomix', 'algorithms/06-atomix.html', './demos/atomix.js'],
  ['cordon', 'algorithms/07-cordon.html', './demos/cordon.js'],
  ['tracefix', 'algorithms/08-tracefix.html', './demos/tracefix.js'],
];

async function mountEmbeddedDemo([id, pagePath, modulePath]) {
  const slot = qs(`[data-demo-slot="${id}"]`);
  try {
    const response = await fetch(pagePath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = await response.text();
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    const stage = parsed.querySelector('[data-demo]');
    if (!stage) throw new Error('stage not found');

    const pageStyles = [...parsed.querySelectorAll('style')].map((style) => style.textContent).join('\n');
    if (pageStyles) {
      const style = document.createElement('style');
      style.dataset.embeddedDemoStyle = id;
      style.textContent = pageStyles;
      document.querySelector('link[href="assets/canvas.css"]').before(style);
    }

    slot.replaceChildren(stage);
    await import(modulePath);
    syncNodeAccessibility();
  } catch (error) {
    slot.innerHTML = `<span>实验 ${id} 加载失败</span>`;
    console.error(`Unable to mount ${id}:`, error);
  }
}

Promise.all(embeddedDemos.map(mountEmbeddedDemo));

const canvasApp = qs('[data-canvas-app]');
const viewport = qs('[data-canvas-viewport]', canvasApp);
const world = qs('[data-canvas-world]', canvasApp);
const navigator = qs('[data-canvas-navigator]', canvasApp);
const navigatorToggle = qs('[data-navigator-toggle]', navigator);
const zoomOutput = qs('[data-zoom-output]', canvasApp);
const canvasLive = qs('[data-canvas-live]', canvasApp);
const nodes = [...canvasApp.querySelectorAll('[data-canvas-node]')];
const nodeIds = nodes.map((node) => node.dataset.canvasNode);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const camera = {
  x: 0,
  y: 0,
  zoom: 1,
  current: nodeIds.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'held-draft',
};

let animationTimer;
let resizeTimer;
let pointerStart;
let suppressNodeClick = false;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function renderCamera({ animate = false } = {}) {
  window.clearTimeout(animationTimer);
  world.classList.toggle('is-animating', animate && !reduceMotion.matches);
  viewport.classList.toggle('is-animating', animate && !reduceMotion.matches);
  world.style.setProperty('--camera-x', `${camera.x / camera.zoom}px`);
  world.style.setProperty('--camera-y', `${camera.y / camera.zoom}px`);
  world.style.setProperty('--camera-screen-x', `${camera.x}px`);
  world.style.setProperty('--camera-screen-y', `${camera.y}px`);
  world.style.setProperty('--camera-scale', camera.zoom);
  viewport.style.setProperty('--grid-x', `${camera.x}px`);
  viewport.style.setProperty('--grid-y', `${camera.y}px`);
  viewport.style.setProperty('--grid-size', `${40 * camera.zoom}px`);
  zoomOutput.value = `${Math.round(camera.zoom * 100)}%`;
  zoomOutput.textContent = `${Math.round(camera.zoom * 100)}%`;

  if (animate && !reduceMotion.matches) {
    animationTimer = window.setTimeout(() => {
      world.classList.remove('is-animating');
      viewport.classList.remove('is-animating');
    }, 660);
  }
}

function nodeBounds(node) {
  const styles = getComputedStyle(node);
  return {
    x: Number.parseFloat(styles.getPropertyValue('--x')),
    y: Number.parseFloat(styles.getPropertyValue('--y')),
    width: Number.parseFloat(styles.getPropertyValue('--node-width')),
    height: Number.parseFloat(styles.getPropertyValue('--node-height')),
  };
}

function syncNodeAccessibility() {
  nodes.forEach((node) => {
    const active = node.dataset.canvasNode === camera.current;
    if (active) node.removeAttribute('aria-hidden');
    else node.setAttribute('aria-hidden', 'true');
    node.querySelectorAll('a, button, input, select, textarea').forEach((control) => {
      if (active) control.removeAttribute('tabindex');
      else control.setAttribute('tabindex', '-1');
    });
  });
}

function updateLocation(node, announce = true) {
  camera.current = node.dataset.canvasNode;
  nodes.forEach((candidate) => { candidate.dataset.active = candidate === node ? 'true' : 'false'; });
  canvasApp.querySelectorAll('[data-jump]').forEach((button) => {
    if (button.dataset.jump === camera.current) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  setText('[data-location-index]', node.dataset.index, document);
  setText('[data-location-title]', node.dataset.title, document);
  syncNodeAccessibility();
  if (announce) canvasLive.textContent = `已定位到 ${node.dataset.index} ${node.dataset.title}`;
}

function focusNode(id, { animate = true, updateHash = true, announce = true } = {}) {
  const node = nodes.find((candidate) => candidate.dataset.canvasNode === id);
  if (!node) return;

  const bounds = nodeBounds(node);
  const mobile = window.matchMedia('(max-width: 48rem)').matches;
  const navigatorInset = navigator.dataset.collapsed === 'true' ? 72 : 240;
  const insets = mobile
    ? { left: 18, right: 18, top: 18, bottom: 94 }
    : { left: navigatorInset, right: 28, top: 20, bottom: 20 };
  const availableWidth = viewport.clientWidth - insets.left - insets.right;
  const availableHeight = viewport.clientHeight - insets.top - insets.bottom;
  const maximumZoom = 1.05;

  camera.zoom = clamp(Math.min(availableWidth / bounds.width, availableHeight / bounds.height), 0.26, maximumZoom);
  camera.x = insets.left + (availableWidth / 2) - (bounds.x + bounds.width / 2) * camera.zoom;
  camera.y = insets.top + (availableHeight / 2) - (bounds.y + bounds.height / 2) * camera.zoom;
  updateLocation(node, announce);
  renderCamera({ animate });

  if (updateHash && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
}

function zoomAt(nextZoom, point = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }) {
  const zoom = clamp(nextZoom, 0.22, 1.6);
  const worldX = (point.x - camera.x) / camera.zoom;
  const worldY = (point.y - camera.y) / camera.zoom;
  camera.x = point.x - worldX * zoom;
  camera.y = point.y - worldY * zoom;
  camera.zoom = zoom;
  renderCamera();
}

canvasApp.querySelectorAll('[data-jump]').forEach((button) => {
  button.addEventListener('click', () => focusNode(button.dataset.jump));
});

navigatorToggle.addEventListener('click', () => {
  const collapsed = navigator.dataset.collapsed !== 'true';
  navigator.dataset.collapsed = String(collapsed);
  navigatorToggle.setAttribute('aria-expanded', String(!collapsed));
  navigatorToggle.setAttribute('aria-label', collapsed ? '展开算法导航' : '收起算法导航');
  canvasLive.textContent = collapsed ? '算法导航已收起' : '算法导航已展开';
  focusNode(camera.current, { animate: true, updateHash: false, announce: false });
});

nodes.forEach((node) => {
  node.addEventListener('click', (event) => {
    if (suppressNodeClick) return;
    if (event.target.closest('a, button, input, label')) return;
    focusNode(node.dataset.canvasNode);
  });
});

qs('[data-zoom-in]', canvasApp).addEventListener('click', () => zoomAt(camera.zoom * 1.15));
qs('[data-zoom-out]', canvasApp).addEventListener('click', () => zoomAt(camera.zoom / 1.15));
qs('[data-fit]', canvasApp).addEventListener('click', () => focusNode(camera.current));

viewport.addEventListener('wheel', (event) => {
  event.preventDefault();
  if (event.ctrlKey || event.metaKey) {
    const bounds = viewport.getBoundingClientRect();
    zoomAt(camera.zoom * Math.exp(-event.deltaY * 0.002), {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    return;
  }
  camera.x -= event.deltaX;
  camera.y -= event.deltaY;
  renderCamera();
}, { passive: false });

viewport.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('a, button, input, label')) return;
  world.classList.remove('is-animating');
  viewport.classList.remove('is-animating');
  pointerStart = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: camera.x, y: camera.y, moved: false };
  viewport.setPointerCapture(event.pointerId);
});

viewport.addEventListener('pointermove', (event) => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - pointerStart.clientX, event.clientY - pointerStart.clientY) > 5) pointerStart.moved = true;
  camera.x = pointerStart.x + event.clientX - pointerStart.clientX;
  camera.y = pointerStart.y + event.clientY - pointerStart.clientY;
  renderCamera();
});

function endPointer(event) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  suppressNodeClick = pointerStart.moved;
  pointerStart = undefined;
  if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  window.setTimeout(() => { suppressNodeClick = false; }, 0);
}

viewport.addEventListener('pointerup', endPointer);
viewport.addEventListener('pointercancel', endPointer);

viewport.addEventListener('keydown', (event) => {
  if (event.target !== viewport) return;
  const distance = event.shiftKey ? 180 : 80;
  let handled = true;
  if (event.key === 'ArrowLeft') camera.x += distance;
  else if (event.key === 'ArrowRight') camera.x -= distance;
  else if (event.key === 'ArrowUp') camera.y += distance;
  else if (event.key === 'ArrowDown') camera.y -= distance;
  else if (event.key === '+' || event.key === '=') zoomAt(camera.zoom * 1.15);
  else if (event.key === '-' || event.key === '_') zoomAt(camera.zoom / 1.15);
  else if (event.key === '0' || event.key === 'Home') focusNode(camera.current);
  else handled = false;

  if (handled) {
    event.preventDefault();
    if (event.key.startsWith('Arrow')) {
      canvasApp.dataset.focusMode = 'false';
      renderCamera();
    }
  }
});

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (nodeIds.includes(id)) focusNode(id, { updateHash: false });
});

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => focusNode(camera.current, { animate: false, updateHash: false, announce: false }), 120);
});

requestAnimationFrame(() => focusNode(camera.current, { animate: false, updateHash: false, announce: false }));
