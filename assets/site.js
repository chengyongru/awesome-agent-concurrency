const ICONS = {
  play: '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"/></svg>',
  pause: '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>',
};

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export function setText(selector, value, root = document) {
  const node = qs(selector, root);
  if (node) node.textContent = String(value);
}

export function makeStepper({ root = document, steps, render, delay = 1100, onReset }) {
  const play = qs('[data-action="play"]', root);
  const step = qs('[data-action="step"]', root);
  const reset = qs('[data-action="reset"]', root);
  const live = qs('[data-live]', root);
  let index = -1;
  let timer = null;
  const resolveSteps = () => (typeof steps === 'function' ? steps() : steps);

  function announce(current) {
    if (live && current?.label) live.textContent = current.label;
  }

  function updateControls() {
    if (play) {
      const isPlaying = timer !== null;
      play.innerHTML = isPlaying ? `${ICONS.pause}<span>暂停</span>` : `${ICONS.play}<span>播放</span>`;
      play.setAttribute('aria-pressed', String(isPlaying));
    }
  }

  function stop() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    updateControls();
  }

  function advance() {
    const currentSteps = resolveSteps();
    if (index >= currentSteps.length - 1) {
      stop();
      return false;
    }
    index += 1;
    render(currentSteps[index], index);
    announce(currentSteps[index]);
    updateControls();
    if (index >= currentSteps.length - 1) stop();
    return true;
  }

  function toggle() {
    const currentSteps = resolveSteps();
    if (timer !== null) {
      stop();
      return;
    }
    if (index >= currentSteps.length - 1) api.reset();
    advance();
    timer = window.setInterval(advance, delay);
    updateControls();
  }

  const api = {
    play: toggle,
    step() { stop(); advance(); },
    reset() {
      stop();
      index = -1;
      onReset?.();
      render(null, -1);
      if (live) live.textContent = '演示已重置';
      updateControls();
    },
    stop,
    get index() { return index; },
  };

  play?.addEventListener('click', toggle);
  step?.addEventListener('click', api.step);
  reset?.addEventListener('click', api.reset);
  api.reset();
  return api;
}

export function setPhases(activeIndex, root = document) {
  qsa('.phase', root).forEach((phase, index) => {
    phase.dataset.state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : '';
  });
}

export function pageShell() {
  const year = qs('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
}

pageShell();
