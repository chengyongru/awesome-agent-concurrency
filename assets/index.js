import { makeStepper, qs, setText } from './site.js';

const root = qs('[data-demo="overview"]');
const range = qs('[data-agent-range]', root);
const output = qs('[data-agent-output]', root);
let agentCount = Number(range.value);

const steps = [
  { label: '所有 Agent 同时读取版本 v₀，并开始生成。', left: 'draft', right: 'draft', status: '并行生成', equationLeft: 'n 个 draft 都基于 room v₀', equationRight: 'n 个 Agent 同时申请 slot' },
  { label: 'Held Draft 一侧只有一个提交成功；Sequencer 一侧原子分配所有 slot。', left: 'first', right: 'slot', status: '第一次提交', equationLeft: '1 commit · n−1 held', equationRight: 'slotᵢ = atomic_fetch_add(next, 1)' },
  { label: '陈旧 draft 被 hold；有 slot 的 Agent 可以继续并行计算。', left: 'held', right: 'slot', status: '冲突显现', equationLeft: '剩余 Agent 重新判断', equationRight: '计算并行 · 顺序已经确定' },
  { label: 'Held Draft 继续形成 n−1、n−2 次判断；Sequencer 开始有序发布。', left: 'retry', right: 'release', status: '形成顺序', equationLeft: 'n + (n−1) + …', equationRight: 'release[1] → release[2] → …' },
  { label: '两种方法都得到全序，但消耗的协调动作不同。', left: 'result', right: 'result', status: '对照完成', equationLeft: '', equationRight: '' },
  { label: '结论：已知严格顺序时，应在执行前分配顺序。', left: 'result', right: 'result', status: '实验结论', equationLeft: '', equationRight: '' },
];

function buildAgents(container, side) {
  container.replaceChildren();
  for (let index = 0; index < agentCount; index += 1) {
    const agent = document.createElement('span');
    agent.className = 'overview-agent';
    agent.dataset.side = side;
    agent.innerHTML = `<span>${String.fromCharCode(65 + (index % 26))}</span><span class="agent-number">${index + 1}</span>`;
    container.append(agent);
  }
}

function setAgentStates(side, state) {
  const nodes = [...root.querySelectorAll(`[data-side="${side}"]`)];
  nodes.forEach((node, index) => {
    let next = '';
    if (state === 'draft') next = 'draft';
    if (state === 'slot') next = 'slot';
    if (state === 'first') next = index === 0 ? 'commit' : 'draft';
    if (state === 'held') next = index === 0 ? 'commit' : 'held';
    if (state === 'retry') next = index < 2 ? 'commit' : 'held';
    if (state === 'release') next = index < Math.ceil(nodes.length / 2) ? 'commit' : 'slot';
    if (state === 'result') next = 'commit';
    node.dataset.state = next;
  });
}

function render(step) {
  if (!step) {
    setAgentStates('left', '');
    setAgentStates('right', '');
    setText('[data-status]', '等待开始', root);
    setText('[data-left-equation]', '所有 Agent 基于 v₀ 推理', root);
    setText('[data-right-equation]', '等待原子分配 slot', root);
    qs('[data-left-equation]', root).dataset.state = '';
    qs('[data-right-equation]', root).dataset.state = '';
    return;
  }
  setAgentStates('left', step.left);
  setAgentStates('right', step.right);
  setText('[data-status]', step.status, root);
  const leftTotal = (agentCount * (agentCount + 1)) / 2;
  const rightTotal = agentCount;
  const final = step.left === 'result';
  setText('[data-left-equation]', final ? `${agentCount} 个 Agent → ${leftTotal} 次判断` : step.equationLeft, root);
  setText('[data-right-equation]', final ? `${agentCount} 个 Agent → ${rightTotal} 次协调` : step.equationRight, root);
  qs('[data-left-equation]', root).dataset.state = final ? 'result' : '';
  qs('[data-right-equation]', root).dataset.state = final ? 'result' : '';
}

function rebuild() {
  buildAgents(qs('[data-left-agents]', root), 'left');
  buildAgents(qs('[data-right-agents]', root), 'right');
}

const demo = makeStepper({ root, steps, render, delay: 1250, onReset: rebuild });
range.addEventListener('input', () => {
  agentCount = Number(range.value);
  output.value = agentCount;
  output.textContent = agentCount;
  demo.reset();
});
