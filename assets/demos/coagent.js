import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="coagent"]');
const steps = [
  { label: 'Runtime 在 launch 时固定 A、B、C 的序列化顺序。', phase: 0, mode: 'order', status: 'order fixed' },
  { label: '每个 tool call 声明自己的 read/write footprint。', phase: 1, mode: 'footprint', status: 'footprints visible' },
  { label: '三个 Agent 按各自 trajectory 并行投机执行。', phase: 2, mode: 'speculate', status: 'speculative execution' },
  { label: '低序 A 更新 parser.py。', phase: 3, mode: 'write', status: 'parser.py changed' },
  { label: 'Runtime 只通知读过 parser.py 的高序 B；C 不受影响。', phase: 3, mode: 'notify', status: 'targeted notify → B' },
  { label: 'B 判断 tests 操作依赖旧 parser，并只修复这部分。', phase: 4, mode: 'repair', status: 'local repair' },
  { label: '所有 trajectory 在预定顺序下达到可串行化静止点。', phase: 4, mode: 'done', status: 'serializable quiescence' },
];

const opState = (name, state) => { const node = qs(`[data-op="${name}"]`, root); if (node) node.dataset.state = state; };

function resetVisual() {
  qsa('[data-order]', root).forEach((node) => { node.dataset.state = ''; });
  qsa('[data-op]', root).forEach((node) => { node.dataset.state = ''; });
  qsa('[data-note]', root).forEach((node) => { node.dataset.state = ''; node.textContent = 'quiet'; });
  qsa('[data-resource]', root).forEach((node) => { node.dataset.state = ''; });
  setText('[data-parser-version]', 'version α', root); setPhases(-1, root);
}

function render(step) {
  resetVisual();
  if (!step) { setText('[data-status]', '等待 launch', root); return; }
  setText('[data-status]', step.status, root); setPhases(step.phase, root);
  if (['order', 'footprint', 'speculate', 'write', 'notify', 'repair', 'done'].includes(step.mode)) qsa('[data-order]', root).forEach((node) => { node.dataset.state = 'ordered'; });
  if (['footprint', 'speculate', 'write', 'notify', 'repair', 'done'].includes(step.mode)) {
    opState('a-read', 'read'); opState('a-write', 'write'); opState('b-read', 'read'); opState('b-plan', 'write'); opState('c-read', 'read'); opState('c-plan', 'write');
  }
  if (['speculate', 'write', 'notify'].includes(step.mode)) qsa('[data-lane]', root).forEach((lane) => { lane.style.transform = 'translateY(-2px)'; });
  else qsa('[data-lane]', root).forEach((lane) => { lane.style.transform = ''; });
  if (['write', 'notify', 'repair', 'done'].includes(step.mode)) { qs('[data-resource="parser"]', root).dataset.state = 'changed'; setText('[data-parser-version]', 'version β · by A', root); }
  if (step.mode === 'notify') { qs('[data-note="1"]', root).dataset.state = 'active'; setText('[data-note="1"]', 'X changed!', root); opState('b-read', 'polluted'); opState('b-plan', 'polluted'); }
  if (step.mode === 'repair') { qs('[data-note="1"]', root).textContent = 'repairing'; opState('b-read', 'repaired'); opState('b-plan', 'polluted'); }
  if (step.mode === 'done') { qsa('[data-op]', root).forEach((node) => { node.dataset.state = 'repaired'; }); qsa('[data-note]', root).forEach((node) => { node.textContent = 'committed'; }); }
}

makeStepper({ root, steps, render, onReset: resetVisual, delay: 1150 });
