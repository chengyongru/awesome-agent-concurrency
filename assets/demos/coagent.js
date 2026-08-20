import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setText } from '../site.js';

const [ada, lin, mira] = AGENT_NAMES;
const root = qs('[data-demo="coagent"]');
const steps = [
  { label: `${lin} 读取 parser.py v1 并生成回归测试；Runtime 从工具调用记录 R(${lin})={parser.py}。`, mode: 'lin-read', status: `${lin} 读取 parser.py v1` },
  { label: `${mira} 读取 issue #417 并生成迁移文档；Runtime 记录 R(${mira})={issue#417}。`, mode: 'mira-read', status: `${mira} 读取 issue #417` },
  { label: `${ada} 写入 parser.py v2；Runtime 从工具调用记录 W(${ada})={parser.py}。`, mode: 'ada-write', status: `${ada} 写入 parser.py v2` },
  { label: `Runtime 从实际工具轨迹发现：${lin} 的测试依赖 parser.py v1，而当前文件已是 v2，因此该结果过时。`, mode: 'compare', status: `${lin} 的结果依赖旧版本 v1` },
  { label: `Runtime 要求 ${lin} 重新读取并修改测试；${mira} 的 migration.md 只依赖 issue #417，不接收通知。`, mode: 'notify', status: `要求 ${lin} 重做过时结果` },
  { label: `${lin} 重新读取 parser.py v2 并更新测试；${mira} 的 migration.md 保留。`, mode: 'repair', status: '只重做受影响的测试' },
];

const modeOrder = steps.map((step) => step.mode);
const reached = (current, target) => modeOrder.indexOf(current) >= modeOrder.indexOf(target);

function setState(selector, state = '') {
  qs(selector, root).dataset.state = state;
}

function draw(edge, state = 'drawn') {
  setState(`[data-edge="${edge}"]`, state);
  const label = root.querySelector(`[data-edge-label="${edge}"]`);
  if (label) label.dataset.state = state;
}

function resetVisual() {
  qsa('[data-edge], [data-edge-label], [data-scene-object], [data-agent-node], [data-conflict-engine], [data-artifact]', root)
    .forEach((node) => { node.dataset.state = ''; });
  setText('[data-parser-version]', 'v1', root);
  setText('[data-artifact-version="test"]', '基于 parser.py v1', root);
  setText('[data-artifact-version="docs"]', '读取 issue #417', root);
  setText('[data-runtime-used]', 'Lin 产物 v1', root);
  setText('[data-runtime-current]', '当前文件 v1', root);
  setText('[data-compare-symbol]', 'vs', root);
  setText('[data-engine-result]', '检查产物依赖', root);
}

function render(step) {
  resetVisual();
  if (!step) return;
  setText('[data-status]', step.status, root);

  if (reached(step.mode, 'lin-read')) {
    draw('lin-read', step.mode === 'lin-read' ? 'active' : 'drawn');
    draw('lin-artifact', step.mode === 'lin-read' ? 'active' : 'drawn');
    setState('[data-agent-node="lin"]', step.mode === 'lin-read' ? 'active' : '');
    setState('[data-artifact="test"]', 'created');
  }

  if (reached(step.mode, 'mira-read')) {
    draw('mira-read', step.mode === 'mira-read' ? 'active' : 'drawn');
    draw('mira-artifact', step.mode === 'mira-read' ? 'active' : 'drawn');
    setState('[data-agent-node="mira"]', step.mode === 'mira-read' ? 'active' : '');
    setState('[data-artifact="docs"]', 'created');
  }

  if (reached(step.mode, 'ada-write')) {
    draw('ada-write', step.mode === 'ada-write' ? 'active' : 'drawn');
    setState('[data-agent-node="ada"]', step.mode === 'ada-write' ? 'active' : '');
    setState('[data-scene-object="parser"]', 'changed');
    setText('[data-parser-version]', `v2 · ${ada}`, root);
  }

  if (reached(step.mode, 'compare')) {
    draw('parser-current', step.mode === 'repair' ? 'drawn' : 'compare');
    draw('test-used', step.mode === 'repair' ? 'drawn' : 'compare');
    setState('[data-conflict-engine]', step.mode === 'repair' ? 'repair' : 'compare');
    setState('[data-artifact="test"]', 'invalid');
    setState('[data-artifact="docs"]', 'preserved');
    setText('[data-runtime-used]', 'Lin 产物 v1', root);
    setText('[data-runtime-current]', '当前文件 v2', root);
    setText('[data-compare-symbol]', '≠', root);
    setText('[data-engine-result]', 'Lin 的结果已过时', root);
    setText('[data-artifact-version="test"]', '依赖 v1 · 已过时', root);
    setText('[data-artifact-version="docs"]', '只依赖 issue #417 · 保留', root);
  }

  if (reached(step.mode, 'notify')) {
    draw('notify', 'notify');
    setState('[data-agent-node="lin"]', 'conflict');
  }

  if (step.mode === 'repair') {
    draw('lin-read', 'repair');
    draw('lin-artifact', 'repair');
    draw('notify', 'drawn');
    setState('[data-agent-node="lin"]', 'repair');
    setState('[data-artifact="test"]', 'updated');
    setText('[data-artifact-version="test"]', '重新读取 v2 · 已更新', root);
    setText('[data-runtime-used]', 'Lin 产物 v2', root);
    setText('[data-runtime-current]', '当前文件 v2', root);
    setText('[data-compare-symbol]', '=', root);
    setText('[data-engine-result]', '新结果与当前版本一致', root);
  }
}

makeStepper({ root, steps, render, onReset: resetVisual, delay: 1350 });
