import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="latte"]');
const steps = [
  { label: '没有前置依赖的三个迁移任务进入可领取集合。', phase: 0, mode: 'ready', frontier: '检查旧 API · 统计调用方 · 收集测试样本', status: '3 个任务可领取' },
  { label: 'Ada、Lin、Mira 原子 claim 三个不同任务。', phase: 1, mode: 'claim', frontier: '暂无 · 均已 claim', status: '任务 claim 唯一' },
  { label: 'Ada 与 Lin 完成；Mira 仍在收集测试样本。', phase: 2, mode: 'abdone', frontier: '实现适配器', status: '依赖满足' },
  { label: 'Ada claim 并完成适配器；集成测试解锁。', phase: 3, mode: 'cdone', frontier: '集成测试', status: '适配器完成' },
  { label: 'Mira 完成测试样本；发布说明也进入可领取集合。', phase: 3, mode: 'dDone', frontier: '集成测试 · 发布迁移说明', status: '可领取集合扩展' },
  { label: 'Mira 发现旧客户端，提议加入兼容性检查。', phase: 4, mode: 'review', frontier: '现有任务不变 · 新任务待审核', status: '检查图变更' },
  { label: 'Lead 确认新节点不引入依赖环，兼容性检查进入可领取集合。', phase: 4, mode: 'accepted', frontier: '集成测试 · 发布迁移说明 · 兼容性检查', status: '图变更已接受' },
];

const setTask = (id, state) => { qs(`[data-task="${id}"]`, root).dataset.state = state; };

function clear() {
  qsa('[data-task]', root).forEach((node) => { node.dataset.state = ''; });
  qs('[data-task="G"]', root).style.opacity = '0';
  const ownerDefaults = { A: '等待 claim', B: '等待 claim', C: '依赖前两项', D: '等待 claim', E: '等待适配器', F: '等待适配器与样本', G: '等待 Lead 审核' };
  qsa('[data-task]', root).forEach((node) => { setText('[data-task-owner]', ownerDefaults[node.dataset.task], node); });
  qsa('[data-worker]', root).forEach((node, index) => { node.dataset.state = ''; node.textContent = `${AGENT_NAMES[index]} · 空闲`; });
  setPhases(-1, root);
}

function render(step) {
  clear();
  if (!step) { setText('[data-status]', '等待 claim', root); setText('[data-frontier]', '检查旧 API · 统计调用方 · 收集测试样本', root); return; }
  setText('[data-status]', step.status, root); setText('[data-frontier]', step.frontier, root); setPhases(step.phase, root);
  const states = { A: '', B: '', C: '', D: '', E: '', F: '', G: '' };
  if (step.mode === 'ready') Object.assign(states, { A: 'ready', B: 'ready', D: 'ready' });
  if (step.mode === 'claim') Object.assign(states, { A: 'claimed', B: 'claimed', D: 'claimed' });
  if (step.mode === 'abdone') Object.assign(states, { A: 'done', B: 'done', C: 'ready', D: 'claimed' });
  if (step.mode === 'cready') Object.assign(states, { A: 'done', B: 'done', C: 'ready', D: 'claimed' });
  if (step.mode === 'cdone') Object.assign(states, { A: 'done', B: 'done', C: 'done', D: 'claimed', E: 'ready' });
  if (step.mode === 'dDone') Object.assign(states, { A: 'done', B: 'done', C: 'done', D: 'done', E: 'ready', F: 'ready' });
  if (step.mode === 'review') Object.assign(states, { A: 'done', B: 'done', C: 'done', D: 'done', E: 'ready', F: 'ready', G: 'review' });
  if (step.mode === 'accepted') Object.assign(states, { A: 'done', B: 'done', C: 'done', D: 'done', E: 'ready', F: 'ready', G: 'ready' });
  Object.entries(states).forEach(([id, state]) => setTask(id, state));
  qs('[data-task="G"]', root).style.opacity = ['review', 'accepted'].includes(step.mode) ? '1' : '0';
  if (step.mode === 'claim') {
    ['A', 'B', 'D'].forEach((id, index) => setText('[data-task-owner]', AGENT_NAMES[index], qs(`[data-task="${id}"]`, root)));
    qsa('[data-worker]', root).forEach((node, index) => { node.dataset.state = 'busy'; node.textContent = `${AGENT_NAMES[index]} · ${['检查 API', '统计调用方', '收集样本'][index]}`; });
  }
  if (['abdone', 'cdone'].includes(step.mode)) { setText('[data-task-owner]', `${AGENT_NAMES[0]} · 完成`, qs('[data-task="A"]', root)); setText('[data-task-owner]', `${AGENT_NAMES[1]} · 完成`, qs('[data-task="B"]', root)); setText('[data-task-owner]', `${AGENT_NAMES[2]} · 执行中`, qs('[data-task="D"]', root)); qs('[data-worker="2"]', root).dataset.state = 'busy'; setText('[data-worker="2"]', `${AGENT_NAMES[2]} · 收集样本`, root); }
  if (step.mode === 'cdone') { setText('[data-task-owner]', `${AGENT_NAMES[0]} · 完成`, qs('[data-task="C"]', root)); setText('[data-worker="0"]', `${AGENT_NAMES[0]} · 空闲`, root); }
  if (['dDone', 'review', 'accepted'].includes(step.mode)) { setText('[data-task-owner]', `${AGENT_NAMES[2]} · 完成`, qs('[data-task="D"]', root)); }
  if (step.mode === 'review') setText('[data-task-owner]', `${AGENT_NAMES[2]} 提议 · 待审核`, qs('[data-task="G"]', root));
  if (step.mode === 'accepted') setText('[data-task-owner]', '审核通过 · 等待 claim', qs('[data-task="G"]', root));
}

makeStepper({ root, steps, render, onReset: clear, delay: 1150 });
