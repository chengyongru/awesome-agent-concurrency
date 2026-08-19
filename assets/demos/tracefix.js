import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="tracefix"]');
const steps = [
  { label: 'LLM 生成一个看似合理的双 Agent 协调协议。', phase: 0, mode: 'synth', status: 'protocol synthesized' },
  { label: '协议被转换为 PlusCal / TLA+ 状态机。', phase: 1, mode: 'translate', status: 'translated to model' },
  { label: 'Model checker 穷举可能的并发 interleaving。', phase: 2, mode: 'explore', status: 'exploring state space' },
  { label: '发现 A 等待 B 且 B 等待 A 的 deadlock 反例。', phase: 2, mode: 'fail', status: 'counterexample found' },
  { label: 'LLM 根据反例修复协议：A 完成后才允许 B 获取资源。', phase: 3, mode: 'repair', status: 'protocol repaired' },
  { label: '重新检查修复后的有界状态空间，性质通过。', phase: 3, mode: 'pass', status: 'bounded check passed' },
  { label: 'Runtime 只允许符合已验证 topology 的操作。', phase: 4, mode: 'enforce', status: 'verified topology enforced' },
];

const original = ['agent A:', '  acquire file_x', '  wait until B.done', '', 'agent B:', '  acquire file_y', '  wait until A.done', '', 'invariant: eventually done'];

function clear() {
  qsa('[data-code]', root).forEach((node, index) => { node.dataset.state = ''; node.textContent = original[index]; });
  qsa('[data-state-node]', root).forEach((node) => { node.dataset.state = ''; });
  qsa('[data-trace]', root).forEach((node) => { node.dataset.state = ''; });
  qs('[data-verdict]', root).dataset.state = ''; setText('strong', 'not run', qs('[data-verdict]', root)); setPhases(-1, root);
}

function render(step) {
  clear();
  if (!step) { setText('[data-status]', 'waiting for protocol', root); return; }
  setText('[data-status]', step.status, root); setPhases(step.phase, root);
  if (step.mode === 'synth') { qs('[data-code="2"]', root).dataset.state = 'active'; qs('[data-code="6"]', root).dataset.state = 'active'; }
  if (['translate', 'explore', 'fail'].includes(step.mode)) qsa('[data-code]', root).forEach((node) => { node.dataset.state = 'active'; });
  if (step.mode === 'translate') qs('[data-state-node="0"]', root).dataset.state = 'visited';
  if (step.mode === 'explore') qsa('[data-state-node]', root).slice(0, 3).forEach((node) => { node.dataset.state = 'visited'; });
  if (step.mode === 'fail') {
    qsa('[data-state-node]', root).slice(0, 3).forEach((node) => { node.dataset.state = 'visited'; }); qs('[data-state-node="3"]', root).dataset.state = 'counterexample';
    qsa('[data-trace]', root).forEach((node, index) => { node.dataset.state = index === 3 ? 'bad' : ''; }); qs('[data-verdict]', root).dataset.state = 'fail'; setText('strong', 'FAIL · deadlock at s₃', qs('[data-verdict]', root));
  }
  if (['repair', 'pass', 'enforce'].includes(step.mode)) {
    const repaired = ['agent A:', '  acquire file_x', '  do work; done := TRUE', '', 'agent B:', '  await A.done', '  acquire file_y; do work', '', 'invariant: eventually done'];
    qsa('[data-code]', root).forEach((node, index) => { node.textContent = repaired[index]; node.dataset.state = index === 2 || index === 5 ? 'active' : ''; });
  }
  if (step.mode === 'repair') { qs('[data-verdict]', root).dataset.state = 'fail'; setText('strong', 'repairing from trace', qs('[data-verdict]', root)); }
  if (['pass', 'enforce'].includes(step.mode)) {
    qsa('[data-state-node]', root).forEach((node, index) => { node.dataset.state = index === 3 ? '' : 'safe'; }); qsa('[data-trace]', root).forEach((node) => { node.dataset.state = 'safe'; }); qs('[data-verdict]', root).dataset.state = 'pass'; setText('strong', step.mode === 'enforce' ? 'PASS · topology locked' : 'PASS · no bounded counterexample', qs('[data-verdict]', root));
  }
}

makeStepper({ root, steps, render, onReset: clear, delay: 1150 });
