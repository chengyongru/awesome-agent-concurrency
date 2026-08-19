import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="latte"]');
const steps = [
  { label: '依赖为空的 A、B、D 进入 ready frontier。', phase: 0, mode: 'ready', frontier: '{ A, B, D }', status: '3 tasks ready' },
  { label: '三个空闲 Worker 原子 claim 三个不同节点。', phase: 1, mode: 'claim', frontier: '∅ · all claimed', status: 'atomic claims won' },
  { label: 'A 与 B 完成；D 仍在运行。', phase: 2, mode: 'abdone', frontier: '∅ · recomputing', status: 'A + B complete' },
  { label: 'C 的所有依赖完成，因此进入 ready frontier。', phase: 3, mode: 'cready', frontier: '{ C }', status: 'C unlocked' },
  { label: 'Worker 1 claim 并完成 C；E 解锁，F 仍等待 D。', phase: 3, mode: 'cdone', frontier: '{ E }', status: 'E unlocked · F waits' },
  { label: 'D 完成后，F 的全部依赖也满足。', phase: 3, mode: 'dDone', frontier: '{ E, F }', status: 'frontier expanded' },
  { label: 'Worker 提议新的图变更；Lead 审核后才进入全局结构。', phase: 4, mode: 'review', frontier: '{ E, F } + proposal G', status: 'graph mutation review' },
];

const setTask = (id, state) => { qs(`[data-task="${id}"]`, root).dataset.state = state; };

function clear() {
  qsa('[data-task]', root).forEach((node) => { node.dataset.state = ''; });
  qs('[data-task="G"]', root).style.opacity = '0';
  qsa('[data-worker]', root).forEach((node, index) => { node.dataset.state = ''; node.textContent = `W${index + 1} · idle`; });
  setPhases(-1, root);
}

function render(step) {
  clear();
  if (!step) { setText('[data-status]', 'frontier = { A, B, D }', root); setText('[data-frontier]', '{ A, B, D }', root); return; }
  setText('[data-status]', step.status, root); setText('[data-frontier]', step.frontier, root); setPhases(step.phase, root);
  const states = { A: '', B: '', C: '', D: '', E: '', F: '', G: '' };
  if (step.mode === 'ready') Object.assign(states, { A: 'ready', B: 'ready', D: 'ready' });
  if (step.mode === 'claim') Object.assign(states, { A: 'claimed', B: 'claimed', D: 'claimed' });
  if (step.mode === 'abdone') Object.assign(states, { A: 'done', B: 'done', D: 'claimed' });
  if (step.mode === 'cready') Object.assign(states, { A: 'done', B: 'done', C: 'ready', D: 'claimed' });
  if (step.mode === 'cdone') Object.assign(states, { A: 'done', B: 'done', C: 'done', D: 'claimed', E: 'ready' });
  if (step.mode === 'dDone') Object.assign(states, { A: 'done', B: 'done', C: 'done', D: 'done', E: 'ready', F: 'ready' });
  if (step.mode === 'review') Object.assign(states, { A: 'done', B: 'done', C: 'done', D: 'done', E: 'ready', F: 'ready', G: 'review' });
  Object.entries(states).forEach(([id, state]) => setTask(id, state));
  qs('[data-task="G"]', root).style.opacity = step.mode === 'review' ? '1' : '0';
  if (step.mode === 'claim') qsa('[data-worker]', root).forEach((node, index) => { node.dataset.state = 'busy'; node.textContent = `W${index + 1} · ${['A', 'B', 'D'][index]}`; });
  if (['abdone', 'cready'].includes(step.mode)) { qs('[data-worker="2"]', root).dataset.state = 'busy'; setText('[data-worker="2"]', 'W3 · D', root); }
  if (step.mode === 'cdone') { qs('[data-worker="0"]', root).dataset.state = 'busy'; setText('[data-worker="0"]', 'W1 · E', root); qs('[data-worker="2"]', root).dataset.state = 'busy'; setText('[data-worker="2"]', 'W3 · D', root); }
}

makeStepper({ root, steps, render, onReset: clear, delay: 1150 });
