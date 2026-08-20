import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const [ada, lin, mira] = AGENT_NAMES;

const root = qs('[data-demo="syncplan"]');
const deadlockButton = qs('[data-action="deadlock"]', root);
let deadlock = false;
const originalActions = {
  A1: '构建镜像',
  A3: '等待发布',
  B1: '等待镜像',
  C4: '更新 manifest',
};
const steps = [
  { label: 'Coordinator 为构建、测试与配置生成三条发布计划。', phase: 0, mode: 'compile', status: '发布计划已生成' },
  { label: `${ada}、${lin}、${mira} 并行执行不需要同步的前置动作。`, phase: 1, mode: 'run1', status: '并行执行前置动作' },
  { label: `${lin} 等待镜像；${ada} 继续构建，${mira} 生成部署配置。`, phase: 2, mode: 'gatewait', status: `${lin} 等待 ${ada}` },
  { label: `${ada} 发布镜像摘要，${lin} 的集成测试随即解锁。`, phase: 2, mode: 'gateopen', status: '镜像等待已解除' },
  { label: `${lin} 的测试与 ${mira} 的策略检查均完成，发布汇合点打开。`, phase: 3, mode: 'barrier', status: '发布条件满足' },
  { label: '目标集群从 prod-cn 改为 prod-sg；Mira 的剩余 manifest 失效。', phase: 4, mode: 'stale', status: '配置后缀失效' },
  { label: `Runtime 只重新生成 ${mira} 的剩余 manifest，已完成工作保持不变。`, phase: 4, mode: 'done', status: '局部重排完成' },
];

function clear() {
  qsa('[data-action-block]', root).forEach((node) => { node.dataset.state = ''; });
  Object.entries(originalActions).forEach(([id, label]) => { setText(`[data-action-block="${id}"]`, label, root); });
  qsa('[data-primitive]', root).forEach((node) => { node.dataset.state = ''; });
  setText('[data-gate-state]', 'Lin 等待 Ada', root);
  setText('[data-barrier-state]', 'Lin + Mira 未到达', root);
  setText('[data-stale-state]', '剩余动作有效', root);
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
  if (step.mode === 'gatewait') { mark('A', 2, 2); mark('B', 1, -1, [1]); mark('C', 2, 2); qs('[data-primitive="gate"]', root).dataset.state = 'active'; setText('[data-gate-state]', `${lin} 阻塞 · ${ada} 构建中`, root); }
  if (step.mode === 'gateopen') { mark('A', 3, 3, [3]); mark('B', 2, 2); mark('C', 3, 3); qs('[data-primitive="gate"]', root).dataset.state = 'active'; setText('[data-gate-state]', '镜像 sha256:a81f 已就绪', root); }
  if (step.mode === 'barrier') { mark('A', 3, -1, [3]); mark('B', 3, -1, [3]); mark('C', 3, -1, [3]); qs('[data-primitive="barrier"]', root).dataset.state = 'active'; setText('[data-gate-state]', '镜像已就绪', root); setText('[data-barrier-state]', `${lin} + ${mira} 均已到达`, root); }
  if (step.mode === 'stale') { mark('A', 4, 4); mark('B', 4, 4); mark('C', 4, -1); qs('[data-action-block="C4"]', root).dataset.state = 'stale'; qs('[data-primitive="stale"]', root).dataset.state = 'active'; setText('[data-barrier-state]', '发布条件已满足', root); setText('[data-stale-state]', 'prod-cn → prod-sg', root); }
  if (step.mode === 'done') { qsa('[data-action-block]', root).forEach((node) => { node.dataset.state = 'done'; }); qs('[data-action-block="C4"]', root).textContent = '生成 prod-sg manifest'; qs('[data-primitive="stale"]', root).dataset.state = 'active'; setText('[data-gate-state]', '镜像已就绪', root); setText('[data-barrier-state]', '发布条件已满足', root); setText('[data-stale-state]', 'Mira 后缀已更新', root); }
}

const demo = makeStepper({ root, steps, render, onReset: clear, delay: 1150 });
deadlockButton.addEventListener('click', () => {
  deadlock = !deadlock;
  demo.stop(); clear();
  deadlockButton.setAttribute('aria-pressed', String(deadlock));
  if (deadlock) {
    qs('[data-action-block="A1"]', root).dataset.state = 'deadlock'; qs('[data-action-block="B1"]', root).dataset.state = 'deadlock';
    qs('[data-action-block="A1"]', root).textContent = `等待 ${lin} 测试许可`; qs('[data-action-block="B1"]', root).textContent = `等待 ${ada} 镜像`;
    setText('[data-status]', `计划被拒绝：${ada} ↔ ${lin}`, root); qs('[data-primitive="stale"]', root).dataset.state = 'active'; setText('[data-stale-state]', `检测到等待环 ${ada} ↔ ${lin}`, root); deadlockButton.textContent = '恢复正常计划';
  } else { deadlockButton.textContent = '模拟循环等待'; demo.reset(); }
});
