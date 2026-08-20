import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setText } from '../site.js';

const [ada, lin] = AGENT_NAMES;
const root = qs('[data-demo="tracefix"]');
const steps = [
  { mode: 'candidate', label: `${ada} 与 ${lin} 的候选协议规定了相反的文件加锁顺序。`, status: '候选协议已生成 · 两个进程的锁顺序相反' },
  { mode: 'translate', label: 'TraceFix 将协调拓扑和进程体编译为 PlusCal，再由工具链转换为可供 TLC 检查的 TLA+ 模型。', status: '候选协议已转换为可检查模型' },
  { mode: 'counterexample', label: `TLC 找到具体交错：${ada} 先持有 schema，${lin} 先持有 migration，随后双方等待对方的锁。`, status: '正在重放模型检查器返回的反例交错' },
  { mode: 'repair', label: `修复 Agent 根据反例，把 ${lin} 的进程体改为先取得 schema，再取得 migration。`, status: '反例驱动修复 · 统一全局加锁顺序' },
  { mode: 'pass', label: 'TLC 重新枚举给定边界内的交错，没有再找到死锁反例。', status: '重新检查完成 · 有界状态空间内未发现死锁' },
  { mode: 'enforce', label: '已验证的进程体被编译进每个 Agent 的提示；Runtime Monitor 只允许协调拓扑中的锁和通道。', status: '已验证协议已下发 · 协调拓扑监控已启用' },
];

const modelPaths = ['schema-checker', 'migration-checker', 'checker-input'];
let run;
let renderToken = 0;

function randomUnit() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x100000000;
}

function buildRun() {
  const adaFirst = randomUnit() < 0.5;
  run = {
    ada: (adaFirst ? 640 : 820) + Math.round(randomUnit() * 65),
    lin: (adaFirst ? 820 : 640) + Math.round(randomUnit() * 65),
  };
}

function setNode(id, state = '', detail) {
  const node = qs(`[data-trace-node="${id}"]`, root);
  node.dataset.state = state;
  if (detail !== undefined) setText('span', detail, node);
}

function setPath(id, state = '') {
  qs(`[data-trace-path="${id}"]`, root).dataset.state = state;
}

function setPaths(ids, state) {
  ids.forEach((id) => setPath(id, state));
}

function setStatus(message, state = 'checking') {
  const status = qs('[data-trace-state]', root);
  status.dataset.state = state;
  status.textContent = message;
  setText('[data-status]', message, root);
}

function setProperty(state = '', result = '尚未检查') {
  const property = qs('[data-trace-property]', root);
  property.dataset.state = state;
  setText('span', result, property);
}

function setStepLocked(locked) {
  qs('[data-action="step"]', root).disabled = locked;
}

function startProgress(id, duration, token, onComplete) {
  const node = qs(`[data-trace-node="${id}"]`, root);
  const bar = qs('[data-trace-progress]', node);
  node.style.setProperty('--task-duration', `${duration}ms`);
  bar.style.animation = 'none';
  void bar.offsetWidth;
  bar.style.removeProperty('animation');
  bar.addEventListener('animationend', () => {
    if (token !== renderToken) return;
    node.dataset.running = 'false';
    onComplete();
  }, { once: true });
  node.dataset.running = 'true';
}

function clear() {
  setStepLocked(false);
  qsa('[data-trace-node]', root).forEach((node) => {
    node.dataset.state = '';
    node.dataset.running = 'false';
    node.style.removeProperty('--task-duration');
    const bar = qs('[data-trace-progress]', node);
    if (bar) bar.style.animation = 'none';
  });
  qsa('[data-trace-path]', root).forEach((path) => { path.dataset.state = ''; });
  setText('[data-ada-order]', 'schema.prisma → migration.sql', root);
  setText('[data-lin-order]', 'migration.sql → schema.prisma', root);
  setText('[data-schema-owner]', '未加锁', root);
  setText('[data-migration-owner]', '未加锁', root);
  setText('[data-checker-title]', 'TLC 模型检查器', root);
  setText('[data-checker-state]', '尚未运行', root);
  setProperty();
  setStatus('等待候选协调协议', '');
}

function showCandidate() {
  setNode('ada', 'active', 'schema.prisma → migration.sql');
  setNode('lin', 'active', 'migration.sql → schema.prisma');
  setPath('ada-schema', 'pending');
  setPath('lin-migration', 'pending');
  setPath('ada-wait-migration', 'pending');
  setPath('lin-wait-schema', 'pending');
  setPaths(modelPaths, 'pending');
  setProperty('', '等待模型检查');
}

function showTranslated() {
  showCandidate();
  setNode('checker', 'active', 'PlusCal → TLA+ · 枚举交错');
  setPaths(modelPaths, 'active');
  setProperty('', '正在枚举可达状态');
}

function showCounterexample() {
  showTranslated();
  setNode('ada', 'wait', `持有 schema · 等待 migration`);
  setNode('lin', 'wait', `持有 migration · 等待 schema`);
  setNode('schema', 'owned', `${ada} 持有`);
  setNode('migration', 'owned', `${lin} 持有`);
  setPath('ada-schema', 'done');
  setPath('lin-migration', 'done');
  setPath('ada-wait-migration', 'wait');
  setPath('lin-wait-schema', 'wait');
  setNode('checker', 'fail', '反例：循环等待');
  setProperty('fail', 'FAIL · 存在不释放锁的可达交错');
}

function showRepair() {
  showCandidate();
  setText('[data-lin-order]', 'schema.prisma → migration.sql', root);
  setNode('ada', 'repair', 'schema.prisma → migration.sql');
  setNode('lin', 'repair', 'schema.prisma → migration.sql');
  setNode('schema', 'repair', '全局顺序 1');
  setNode('migration', 'repair', '全局顺序 2');
  setPath('ada-schema', 'active');
  setPath('lin-migration', '');
  setPath('ada-wait-migration', '');
  setPath('lin-wait-schema', '');
  setPath('lock-order', 'active');
  setNode('checker', 'repair', '使用反例修订进程体');
  setProperty('', '修复后重新检查');
}

function showPass() {
  showRepair();
  setNode('ada', 'safe', 'schema.prisma → migration.sql');
  setNode('lin', 'safe', 'schema.prisma → migration.sql');
  setNode('schema', 'safe', '先取得 · 再释放');
  setNode('migration', 'safe', '后取得 · 再释放');
  setPaths(modelPaths, 'done');
  setNode('checker', 'pass', '有界检查未发现反例');
  setProperty('pass', 'PASS · 有界状态空间内未发现死锁');
}

function replayCounterexample(token) {
  showTranslated();
  setStepLocked(true);
  const remaining = new Set(['ada', 'lin']);
  const complete = (id) => {
    remaining.delete(id);
    if (id === 'ada') {
      setNode('ada', 'owned', `${ada} 已取得 schema.prisma`);
      setNode('schema', 'owned', `${ada} 持有`);
      setPath('ada-schema', 'active');
    } else {
      setNode('lin', 'owned', `${lin} 已取得 migration.sql`);
      setNode('migration', 'owned', `${lin} 持有`);
      setPath('lin-migration', 'active');
    }
    if (remaining.size) {
      const waiting = remaining.has('ada') ? ada : lin;
      setStatus(`反例重放中 · 等待 ${waiting} 的下一状态`, 'checking');
      return;
    }
    showCounterexample();
    setStatus(`${ada} 等待 migration，${lin} 等待 schema · 形成有向环`, 'fail');
    setStepLocked(false);
  };
  setNode('ada', 'active', `${ada} · acquire schema.prisma`);
  setNode('lin', 'active', `${lin} · acquire migration.sql`);
  startProgress('ada', run.ada, token, () => complete('ada'));
  startProgress('lin', run.lin, token, () => complete('lin'));
}

function render(step) {
  const token = ++renderToken;
  clear();
  if (!step) return;
  setStatus(step.status, step.mode === 'counterexample' ? 'checking' : step.mode === 'pass' || step.mode === 'enforce' ? 'pass' : 'checking');
  if (step.mode === 'candidate') showCandidate();
  if (step.mode === 'translate') showTranslated();
  if (step.mode === 'counterexample') replayCounterexample(token);
  if (step.mode === 'repair') showRepair();
  if (step.mode === 'pass') showPass();
  if (step.mode === 'enforce') {
    showPass();
    setText('[data-checker-title]', 'Runtime Monitor', root);
    setNode('checker', 'enforce', '限制可用锁与协调通道');
    setProperty('pass', '已验证进程体已下发 · 拓扑约束已启用');
  }
}

makeStepper({
  root,
  steps,
  render,
  delay: 1350,
  onReset() {
    buildRun();
    clear();
  },
});
