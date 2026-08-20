import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setText } from '../site.js';

const [ada, lin, mira, , , omar] = AGENT_NAMES;
const root = qs('[data-demo="cordon"]');
const staleButton = qs('[data-action="stale-mode"]', root);
const steps = [
  { mode: 'ticket', label: `${ada} 在语义事务中读取客服工单 #913；结果对象及来源被 Runtime 记录。`, status: `${ada} 正在读取客户退款请求` },
  { mode: 'order', label: `${lin} 使用工单中的订单号查询 #482；订单金额和支付状态继续接入同一条 result lineage。`, status: `${lin} 正在核对订单 #482` },
  { mode: 'decision', label: `${mira} 依据工单和订单结果生成 ¥85 原路退款决定，而不是孤立地调用退款工具。`, status: `${mira} 正在生成退款决定` },
  { mode: 'stage', label: `${omar} 将客服备注写入 shadow state，并把退款和邮件放入 effect outbox；真实外部系统尚未改变。`, status: '本地修改和外部动作已暂存 · 尚未提交' },
  { mode: 'validate', label: '提交前，Runtime 一次检查结果 lineage、委托权限和最新订单状态。', status: '正在验证整条执行流与待释放效果' },
  { mode: 'settle', label: '全部条件成立时统一提交；若订单已被其他流程退款，则中止 shadow state 和 outbox，避免重复退款。', status: '正在决定提交或中止语义事务' },
];

const lineagePaths = ['ticket-order', 'order-decision'];
const stagingPaths = ['decision-trunk', 'decision-shadow', 'decision-refund', 'decision-email'];
const gatePaths = ['shadow-gate', 'refund-gate', 'email-gate'];
let staleMode = false;
let run;
let renderToken = 0;

function randomUnit() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x100000000;
}

function buildRun() {
  run = {
    ticket: 580 + Math.round(randomUnit() * 240),
    order: 620 + Math.round(randomUnit() * 260),
    decision: 560 + Math.round(randomUnit() * 250),
  };
}

function setNode(id, state = '', detail) {
  const node = qs(`[data-cordon-node="${id}"]`, root);
  node.dataset.state = state;
  if (detail !== undefined) setText('span', detail, node);
}

function setPath(id, state = '') {
  qs(`[data-cordon-path="${id}"]`, root).dataset.state = state;
}

function setPaths(ids, state) {
  ids.forEach((id) => setPath(id, state));
}

function setCheck(id, state = '', detail) {
  const check = qs(`[data-cordon-check="${id}"]`, root);
  check.dataset.state = state;
  if (detail !== undefined) setText('span', detail, check);
}

function setStatus(message, state = 'active') {
  const status = qs('[data-cordon-state]', root);
  status.dataset.state = state;
  status.textContent = message;
  setText('[data-status]', message, root);
}

function setStepLocked(locked) {
  qs('[data-action="step"]', root).disabled = locked;
}

function startProgress(id, duration, token, onComplete) {
  const node = qs(`[data-cordon-node="${id}"]`, root);
  const bar = qs('[data-cordon-progress]', node);
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
  qsa('[data-cordon-node]', root).forEach((node) => {
    node.dataset.state = '';
    node.dataset.running = 'false';
    node.style.removeProperty('--task-duration');
    const bar = qs('[data-cordon-progress]', node);
    if (bar) bar.style.animation = 'none';
  });
  qsa('[data-cordon-path]', root).forEach((path) => { path.dataset.state = ''; });
  qsa('[data-cordon-check]', root).forEach((check) => { check.dataset.state = ''; });
  setNode('ticket', '', `${ada} · 读取 #913`);
  setNode('order', '', `${lin} · 查询支付状态`);
  setNode('decision', '', `${mira} · 由工单和订单推导`);
  setNode('shadow', '', 'shadow state · 未提交');
  setNode('refund', '', 'effect outbox · pending');
  setNode('email', '', 'effect outbox · pending');
  setNode('gate', '', '尚未验证');
  setCheck('lineage', '', '工单 #913 → 订单 #482 → ¥85');
  setCheck('authority', '', '客服退款上限 ¥100');
  setCheck('current', '', staleMode ? '已被其他流程退款' : '尚未退款');
  setText('[data-current-order]', staleMode ? '已被其他流程退款' : '尚未退款', root);
  setStatus('等待开启语义事务', '');
}

function showTicketDone() {
  setNode('ticket', 'done', `${ada} · 工单 #913`);
  setPath('ticket-order', 'active');
}

function showOrderDone() {
  showTicketDone();
  setNode('order', 'done', `${lin} · 订单 #482`);
  setPath('ticket-order', 'done');
  setPath('order-decision', 'active');
}

function showDecisionDone() {
  showOrderDone();
  setNode('decision', 'done', `${mira} · 退款 ¥85`);
  setPath('order-decision', 'done');
  setPaths(stagingPaths, 'pending');
}

function showStaged() {
  showDecisionDone();
  setNode('shadow', 'staged', 'shadow state · 未提交');
  setNode('refund', 'staged', 'effect outbox · 未释放');
  setNode('email', 'staged', 'effect outbox · 未释放');
  setPaths(stagingPaths, 'active');
  setPaths(gatePaths, 'pending');
  setPath('gate-release', 'pending');
  setNode('gate', '', '等待语义验证');
}

function runLineageNode(id, detail, token, onComplete) {
  setNode(id, 'active', detail);
  setStepLocked(true);
  startProgress(id, run[id], token, () => {
    onComplete();
    setStepLocked(false);
  });
}

function render(step) {
  const token = ++renderToken;
  clear();
  if (!step) return;
  setStatus(step.status, step.mode === 'validate' ? 'checking' : 'active');

  if (step.mode === 'ticket') {
    setPaths(lineagePaths, 'pending');
    runLineageNode('ticket', `${ada} · 读取中`, token, () => {
      showTicketDone();
      setStatus(`${ada} 已读取工单 #913 · lineage 起点已记录`);
    });
  }
  if (step.mode === 'order') {
    showTicketDone();
    setPath('order-decision', 'pending');
    runLineageNode('order', `${lin} · 查询中`, token, () => {
      showOrderDone();
      setStatus(`${lin} 已将订单 #482 接入同一条 lineage`);
    });
  }
  if (step.mode === 'decision') {
    showOrderDone();
    runLineageNode('decision', `${mira} · 推导中`, token, () => {
      showDecisionDone();
      setStatus(`${mira} 已生成与来源绑定的 ¥85 退款决定`);
    });
  }
  if (step.mode === 'stage') showStaged();
  if (step.mode === 'validate') {
    showStaged();
    qsa('[data-cordon-check]', root).forEach((check) => { check.dataset.state = 'checking'; });
    setNode('gate', 'checking', '检查 lineage + authority + state');
    setPaths(gatePaths, 'active');
    if (staleMode) setCheck('current', 'checking', '重新读取订单状态…');
  }
  if (step.mode === 'settle') {
    showStaged();
    setCheck('lineage', 'valid', '工单 #913 → 订单 #482 → ¥85');
    setCheck('authority', 'valid', '¥85 ≤ ¥100');
    if (staleMode) {
      setCheck('current', 'invalid', '订单 #482 已退款');
      setNode('shadow', 'abort', 'shadow state 已丢弃');
      setNode('refund', 'abort', 'outbox 已取消 · 未退款');
      setNode('email', 'abort', 'outbox 已取消 · 未发送');
      setNode('gate', 'abort', 'ABORT · 防止重复退款');
      setPaths(gatePaths, 'blocked');
      setPath('gate-release', 'blocked');
      setStatus('订单状态已变化 · 语义事务中止 · 未执行重复退款', 'abort');
    } else {
      setCheck('current', 'valid', '订单 #482 尚未退款');
      setNode('shadow', 'commit', '客服备注已写入');
      setNode('refund', 'commit', '退款 ¥85 已释放');
      setNode('email', 'commit', '结果邮件已发送');
      setNode('gate', 'commit', 'COMMIT');
      setPaths(gatePaths, 'done');
      setPath('gate-release', 'active');
      setStatus('语义事务已提交 · 备注、退款和邮件作为一组生效');
    }
  }
}

const demo = makeStepper({
  root,
  steps,
  render,
  delay: 1300,
  onReset() {
    buildRun();
    clear();
  },
});

staleButton.addEventListener('click', () => {
  staleMode = !staleMode;
  staleButton.setAttribute('aria-pressed', String(staleMode));
  staleButton.textContent = staleMode ? '恢复未退款状态' : '模拟订单已退款';
  demo.reset();
  setStatus(staleMode ? '订单将在提交前被其他流程退款' : '等待开启语义事务', staleMode ? 'abort' : '');
});
