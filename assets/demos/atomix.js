import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setText } from '../site.js';

const [ada, lin, mira, , , , sora] = AGENT_NAMES;
const root = qs('[data-demo="atomix"]');
const abortButton = qs('[data-action="abort-mode"]', root);
const effects = [
  { id: 'draft', agent: ada },
  { id: 'hotel', agent: lin },
  { id: 'payment', agent: mira },
  { id: 'email', agent: sora },
];
const steps = [
  { mode: 'open', label: '主 Agent 为 trip-42 开启一次差旅事务；四类工具副作用进入同一结算范围。', status: '事务 trip-42 已开启 · 工具副作用尚未执行' },
  { mode: 'execute', label: `${ada}、${lin}、${mira} 与 ${sora} 并行登记工具调用；不同 effect class 决定外部可见时机。`, status: '四个 Agent 正在并行登记工具副作用' },
  { mode: 'seal', label: '所有读取范围和副作用登记完成，Runtime seal 事务 footprint，之后不再接收新的工具调用。', status: '事务 footprint 已封闭 · 等待资源进度' },
  { mode: 'hotel-frontier', label: '酒店库存上的更早事务已经结束；差旅预算仍可能收到更早冲突工作。', status: '酒店库存 frontier 已通过 · 仍等待差旅预算' },
  { mode: 'ready', label: '两个冲突资源的 frontier 都确认不再有更早工作到达，trip-42 可以统一结算。', status: '所有相关资源 frontier 已通过 · 事务可结算' },
  { mode: 'settle', label: '提交会释放缓冲和不可逆效果；中止会丢弃未释放效果，并尽力补偿已外部化的可逆效果。', status: '正在按 effect class 统一结算' },
];

let abortMode = false;
let run;
let renderToken = 0;

function randomUnit() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x100000000;
}

function buildRun() {
  const order = effects.map(({ id }) => id);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const target = Math.floor(randomUnit() * (index + 1));
    [order[index], order[target]] = [order[target], order[index]];
  }
  const durations = {};
  order.forEach((id, rank) => { durations[id] = 560 + rank * 115 + Math.round(randomUnit() * 55); });
  run = { durations };
}

function setTask(id, state = '', detail) {
  const node = qs(`[data-atomix-task="${id}"]`, root);
  node.dataset.state = state;
  if (detail !== undefined) setText('span', detail, node);
}

function setEffect(id, state = '', detail) {
  const node = qs(`[data-atomix-effect="${id}"]`, root);
  node.dataset.state = state;
  if (detail !== undefined) setText('[data-effect-state]', detail, node);
}

function setSink(id, state = '', detail) {
  const node = qs(`[data-atomix-sink="${id}"]`, root);
  node.dataset.state = state;
  if (detail !== undefined) setText('span', detail, node);
}

function setPath(id, state = '') {
  qs(`[data-atomix-path="${id}"]`, root).dataset.state = state;
}

function setFrontier(id, state = '', detail) {
  const node = qs(`[data-resource-frontier="${id}"]`, root);
  node.dataset.state = state;
  setText('span', detail, node);
}

function setStatus(message, state = 'active') {
  const status = qs('[data-atomix-state]', root);
  status.dataset.state = state;
  status.textContent = message;
  setText('[data-status]', message, root);
}

function setGate(message, state = '') {
  const gate = qs('[data-atomix-gate]', root);
  gate.dataset.state = state;
  gate.textContent = message;
}

function setStepLocked(locked) {
  qs('[data-action="step"]', root).disabled = locked;
}

function startProgress(id, duration, token, onComplete) {
  const node = qs(`[data-atomix-task="${id}"]`, root);
  const bar = qs('[data-atomix-progress]', node);
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
  effects.forEach(({ id, agent }) => {
    const task = qs(`[data-atomix-task="${id}"]`, root);
    task.dataset.state = '';
    task.dataset.running = 'false';
    task.style.removeProperty('--task-duration');
    qs('[data-atomix-progress]', task).style.animation = 'none';
    setText('span', `${agent} · ${{ draft: 'bufferable', hotel: 'reversible', payment: 'reversible', email: 'irreversible' }[id]}`, task);
    setEffect(id, '', { draft: '等待登记', hotel: '等待执行', payment: '等待执行', email: '等待登记' }[id]);
    setSink(id, '', { draft: '尚未写入', hotel: '尚无预留', payment: '尚无意图', email: '尚未发送' }[id]);
  });
  qsa('[data-atomix-path]', root).forEach((path) => { path.dataset.state = ''; });
  setFrontier('hotel', '', '有更早事务');
  setFrontier('budget', '', '有更早事务');
  setGate('SETTLEMENT GATE · CLOSED');
  setStatus('等待开启事务', '');
}

function showOpen() {
  effects.forEach(({ id, agent }) => {
    setTask(id, 'ready', `${agent} · 等待调用`);
    setPath(`task-${id}`, 'pending');
    setPath(`release-${id}`, 'pending');
  });
}

function showEffectRegistered(id, duration) {
  const seconds = `${(duration / 1000).toFixed(2)}s`;
  setTask(id, 'done', `${effects.find((effect) => effect.id === id).agent} · ${seconds}`);
  setPath(`task-${id}`, 'active');
  if (id === 'draft') {
    setEffect(id, 'staged', '调用未执行 · 已缓冲');
    setPath('release-draft', 'blocked');
  }
  if (id === 'hotel') {
    setEffect(id, 'staged', '已预留 · 可取消');
    setSink(id, 'visible', '预留 H-73');
    setPath('release-hotel', 'done');
  }
  if (id === 'payment') {
    setEffect(id, 'staged', '已创建 · 可取消');
    setSink(id, 'visible', '意图 P-42');
    setPath('release-payment', 'done');
  }
  if (id === 'email') {
    setEffect(id, 'staged', '调用未执行 · 已闸住');
    setPath('release-email', 'blocked');
  }
}

function showStaged() {
  effects.forEach(({ id }) => showEffectRegistered(id, run.durations[id]));
  setGate('SEALED · WAITING FOR RESOURCE FRONTIERS');
}

function showFrontiers(hotelReady, budgetReady) {
  showStaged();
  setFrontier('hotel', hotelReady ? 'ready' : 'wait', hotelReady ? '更早事务已结束' : '等待更早事务');
  setFrontier('budget', budgetReady ? 'ready' : 'wait', budgetReady ? '更早事务已结束' : '等待更早事务');
  if (hotelReady && budgetReady) setGate('SETTLEMENT GATE · READY', 'ready');
}

function runEffects(token) {
  showOpen();
  setStepLocked(true);
  const remaining = new Set(effects.map(({ id }) => id));
  effects.forEach(({ id, agent }) => {
    setTask(id, 'active', `${agent} · 登记中`);
    startProgress(id, run.durations[id], token, () => {
      remaining.delete(id);
      showEffectRegistered(id, run.durations[id]);
      if (remaining.size) {
        const waiting = effects.filter((effect) => remaining.has(effect.id)).map((effect) => effect.agent);
        setStatus(`副作用登记中 · 等待 ${waiting.join('、')}`);
        return;
      }
      setStatus('四类副作用已登记 · 可封闭事务 footprint');
      setStepLocked(false);
    });
  });
}

function settleCommit() {
  showFrontiers(true, true);
  setGate('SETTLEMENT GATE · COMMITTED', 'ready');
  setEffect('draft', 'released', '提交时执行 · 已写入');
  setSink('draft', 'visible', '行程已保存');
  setPath('release-draft', 'active');
  setEffect('hotel', 'released', '预留接受为最终状态');
  setSink('hotel', 'visible', '酒店已确认');
  setEffect('payment', 'released', '支付意图接受为最终状态');
  setSink('payment', 'visible', '支付意图已确认');
  setEffect('email', 'released', '提交后执行 · 已发送');
  setSink('email', 'visible', '确认邮件已发送');
  setPath('release-email', 'active');
  setStatus('trip-42 已提交 · 四类副作用按各自规则结算');
}

function settleAbort() {
  showFrontiers(true, true);
  setGate('SETTLEMENT GATE · ABORTED', 'abort');
  setEffect('draft', 'discarded', '缓冲已丢弃 · 工具未运行');
  setPath('release-draft', 'blocked');
  setEffect('hotel', 'compensated', '补偿操作已执行');
  setSink('hotel', 'cancelled', '酒店预留已取消');
  setPath('compensate-hotel', 'compensate');
  setEffect('payment', 'compensated', '补偿操作已执行');
  setSink('payment', 'cancelled', '支付意图已取消');
  setPath('compensate-payment', 'compensate');
  setEffect('email', 'discarded', '闸门未打开');
  setSink('email', '', '邮件未发送');
  setPath('release-email', 'blocked');
  setStatus('trip-42 已中止 · 未释放效果被抑制，可逆效果已补偿', 'abort');
}

function render(step) {
  const token = ++renderToken;
  clear();
  if (!step) return;
  setStatus(step.status, step.mode.includes('frontier') ? 'wait' : 'active');
  if (step.mode === 'open') showOpen();
  if (step.mode === 'execute') runEffects(token);
  if (step.mode === 'seal') showStaged();
  if (step.mode === 'hotel-frontier') showFrontiers(true, false);
  if (step.mode === 'ready') showFrontiers(true, true);
  if (step.mode === 'settle') {
    if (abortMode) settleAbort();
    else settleCommit();
  }
}

const demo = makeStepper({
  root,
  steps,
  render,
  delay: 1350,
  onReset() {
    buildRun();
    clear();
  },
});

abortButton.addEventListener('click', () => {
  abortMode = !abortMode;
  abortButton.setAttribute('aria-pressed', String(abortMode));
  abortButton.textContent = abortMode ? '恢复正常提交' : '模拟预算拒绝';
  demo.reset();
  setStatus(abortMode ? '预算策略将在结算前拒绝 trip-42' : '等待开启事务', abortMode ? 'abort' : '');
});
