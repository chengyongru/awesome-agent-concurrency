import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="tracefix"]');
const [ada, lin] = AGENT_NAMES;
const steps = [
  { label: `${ada} 与 ${lin} 生成了顺序相反的文件加锁协议。`, phase: 0, mode: 'synth', status: '待检查协议已生成' },
  { label: '协议被转换为包含文件锁所有者与等待关系的状态模型。', phase: 1, mode: 'translate', status: '状态模型已生成' },
  { label: 'Model checker 枚举两个 Agent 的可能交错执行。', phase: 2, mode: 'explore', status: '正在检查交错执行' },
  { label: `${ada} 锁住 schema，${lin} 锁住 migration，双方继续等待对方文件。`, phase: 2, mode: 'fail', status: '发现死锁反例' },
  { label: '修复协议要求两个 Agent 都先锁 schema，再锁 migration。', phase: 3, mode: 'repair', status: '统一加锁顺序' },
  { label: '重新检查给定有界状态空间，没有再发现死锁反例。', phase: 3, mode: 'pass', status: '有界检查通过' },
  { label: 'Runtime 采用通过检查的协议版本。', phase: 4, mode: 'enforce', status: '协议版本可部署' },
];

const original = [`${ada}:`, '  lock schema.prisma', '  lock migration.sql', '', `${lin}:`, '  lock migration.sql', '  lock schema.prisma', '', '性质: 最终释放全部文件锁'];
const repaired = [`${ada}:`, '  lock schema.prisma', '  lock migration.sql', '', `${lin}:`, '  lock schema.prisma', '  lock migration.sql', '', '性质: 最终释放全部文件锁'];

function clear() {
  qsa('[data-code]', root).forEach((node, index) => { node.dataset.state = ''; node.textContent = original[index]; });
  qsa('[data-state-node]', root).forEach((node) => { node.dataset.state = ''; });
  qsa('[data-trace]', root).forEach((node) => { node.dataset.state = ''; });
  qs('[data-verdict]', root).dataset.state = ''; setText('strong', '尚未运行', qs('[data-verdict]', root)); setPhases(-1, root);
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
    qsa('[data-trace]', root).forEach((node, index) => { node.dataset.state = index === 3 ? 'bad' : ''; }); qs('[data-verdict]', root).dataset.state = 'fail'; setText('strong', '发现反例 · 双方持锁等待', qs('[data-verdict]', root));
  }
  if (['repair', 'pass', 'enforce'].includes(step.mode)) {
    qsa('[data-code]', root).forEach((node, index) => { node.textContent = repaired[index]; node.dataset.state = index === 5 || index === 6 ? 'active' : ''; });
  }
  if (step.mode === 'repair') { qs('[data-verdict]', root).dataset.state = 'fail'; setText('strong', '修复中 · 统一加锁顺序', qs('[data-verdict]', root)); }
  if (['pass', 'enforce'].includes(step.mode)) {
    qsa('[data-state-node]', root).forEach((node, index) => { node.dataset.state = index === 3 ? '' : 'safe'; }); qsa('[data-trace]', root).forEach((node) => { node.dataset.state = 'safe'; }); qs('[data-verdict]', root).dataset.state = 'pass'; setText('strong', step.mode === 'enforce' ? '通过检查的协议可部署' : '有界状态空间内未发现死锁', qs('[data-verdict]', root));
  }
}

makeStepper({ root, steps, render, onReset: clear, delay: 1150 });
