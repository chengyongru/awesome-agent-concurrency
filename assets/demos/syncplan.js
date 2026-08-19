import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="syncplan"]');
const deadlockButton = qs('[data-action="deadlock"]', root);
let deadlock = false;
const steps = [
  { label: 'Coordinator 一次生成三条长周期 action chain。', phase: 0, mode: 'compile', status: 'plan compiled' },
  { label: 'A、B、C 各自执行无需同步的前置动作。', phase: 1, mode: 'run1', status: 'parallel actions' },
  { label: 'B 到达 wait A；A 继续执行到 milestone₁。', phase: 2, mode: 'gatewait', status: 'B waits · A runs' },
  { label: 'A 完成 milestone₁，runtime 打开 B 的 gate。', phase: 2, mode: 'gateopen', status: 'gate opened' },
  { label: 'B 与 C 到达 barrier，最后一个抵达者打开它。', phase: 3, mode: 'barrier', status: 'barrier B + C' },
  { label: 'Staleness detector 发现 C 的剩余计划假设失效。', phase: 4, mode: 'stale', status: 'plan staleness detected' },
  { label: '只重规划 C 的剩余链；全队继续到完成。', phase: 4, mode: 'done', status: 'targeted correction' },
];

function clear() {
  qsa('[data-action-block]', root).forEach((node) => { node.dataset.state = ''; });
  qsa('[data-primitive]', root).forEach((node) => { node.dataset.state = ''; });
  setPhases(-1, root);
}

function mark(prefix, through, active, waiting = []) {
  for (let index = 0; index <= 5; index += 1) {
    const node = qs(`[data-action-block="${prefix}${index}"]`, root);
    if (index < through) node.dataset.state = 'done';
    else if (index === active) node.dataset.state = 'active';
    if (waiting.includes(index)) node.dataset.state = 'wait';
  }
}

function render(step) {
  clear();
  deadlock = false; deadlockButton.setAttribute('aria-pressed', 'false');
  if (!step) { setText('[data-status]', '等待编译计划', root); return; }
  setText('[data-status]', step.status, root); setPhases(step.phase, root);
  if (step.mode === 'compile') return;
  if (step.mode === 'run1') { mark('A', 0, 0); mark('B', 0, 0); mark('C', 0, 0); }
  if (step.mode === 'gatewait') { mark('A', 2, 2); mark('B', 1, -1, [1]); mark('C', 2, 2); qs('[data-primitive="gate"]', root).dataset.state = 'active'; }
  if (step.mode === 'gateopen') { mark('A', 3, 3, [3]); mark('B', 2, 2); mark('C', 3, 3); qs('[data-primitive="gate"]', root).dataset.state = 'active'; }
  if (step.mode === 'barrier') { mark('A', 3, -1, [3]); mark('B', 3, -1, [3]); mark('C', 3, -1, [3]); qs('[data-primitive="barrier"]', root).dataset.state = 'active'; }
  if (step.mode === 'stale') { mark('A', 4, 4); mark('B', 4, 4); mark('C', 4, -1); qs('[data-action-block="C4"]', root).dataset.state = 'stale'; qs('[data-primitive="stale"]', root).dataset.state = 'active'; }
  if (step.mode === 'done') { qsa('[data-action-block]', root).forEach((node) => { node.dataset.state = 'done'; }); qs('[data-action-block="C4"]', root).textContent = 'replanned'; qs('[data-primitive="stale"]', root).dataset.state = 'active'; }
}

const demo = makeStepper({ root, steps, render, onReset: clear, delay: 1150 });
deadlockButton.addEventListener('click', () => {
  deadlock = !deadlock;
  demo.stop(); clear();
  deadlockButton.setAttribute('aria-pressed', String(deadlock));
  if (deadlock) {
    qs('[data-action-block="A3"]', root).dataset.state = 'deadlock'; qs('[data-action-block="B1"]', root).dataset.state = 'deadlock';
    qs('[data-action-block="A3"]', root).textContent = 'wait B'; qs('[data-action-block="B1"]', root).textContent = 'wait A';
    setText('[data-status]', 'deadlock detected: A ↔ B', root); qs('[data-primitive="stale"]', root).dataset.state = 'active';
  } else { demo.reset(); }
});
