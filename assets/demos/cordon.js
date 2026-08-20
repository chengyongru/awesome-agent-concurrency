import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="cordon"]');
const staleButton = qs('[data-action="stale-mode"]', root);
let staleMode = false;
const steps = [
  { label: 'Ada 记录 payment-api 的当前队列与 CPU。', phase: 0, mode: 'observe', status: '监控事实已记录' },
  { label: 'Lin 根据同一观察判断当前容量不足。', phase: 1, mode: 'summary', status: '诊断已关联事实' },
  { label: 'Mira 提议将 payment-api 从 4 个副本扩到 6 个。', phase: 1, mode: 'decision', status: '扩容提议已生成' },
  { label: 'Omar 的部署操作保持暂存，不立即修改生产环境。', phase: 1, mode: 'effect', status: '外部操作仍被阻挡' },
  { label: 'Runtime 在提交前同时检查事实、动作权限和批准时间窗。', phase: 2, mode: 'validate', status: '提交条件检查中' },
  { label: 'Runtime 根据最新状态计算是否仍可执行扩容。', phase: 2, mode: 'verdict', status: '提交条件已判定' },
  { label: '只有三个条件均有效时，Omar 才能执行部署与通知。', phase: 3, mode: 'settle', status: '扩容事务已结算' },
];

function clear() {
  qsa('[data-lineage]', root).forEach((node) => { node.dataset.state = ''; });
  qsa('[data-check]', root).forEach((node) => { node.dataset.state = ''; });
  setText('[data-observation]', '队列 1280 · CPU 94%', root);
  setText('[data-lineage-check]', '队列与 CPU 仍超过阈值', root);
  qs('[data-settlement]', root).dataset.state = ''; setText('[data-settlement]', '扩容操作尚未执行', root); setPhases(-1, root);
}

function render(step) {
  clear();
  if (!step) { setText('[data-status]', staleMode ? 'stale observation armed' : 'transaction idle', root); return; }
  setText('[data-status]', step.status, root); setPhases(step.phase, root);
  const activeThrough = { observe: 0, summary: 1, decision: 2, effect: 3, validate: 3, verdict: 3, settle: 3 }[step.mode];
  qsa('[data-lineage]', root).forEach((node, index) => {
    if (index < activeThrough) node.dataset.state = 'valid';
    else if (index === activeThrough) node.dataset.state = 'active';
  });
  if (['validate', 'verdict', 'settle'].includes(step.mode)) qsa('[data-lineage]', root).forEach((node) => { node.dataset.state = 'valid'; });
  if (step.mode === 'validate') qsa('[data-check]', root).forEach((node) => { node.dataset.state = 'checking'; });
  if (['verdict', 'settle'].includes(step.mode)) {
    qsa('[data-check]', root).forEach((node) => { node.dataset.state = 'valid'; });
    if (staleMode) {
      qs('[data-lineage="0"]', root).dataset.state = 'invalid'; qs('[data-lineage="1"]', root).dataset.state = 'invalid'; qs('[data-check="lineage"]', root).dataset.state = 'invalid';
      setText('[data-observation]', '队列 180 · CPU 42%', root);
      setText('[data-lineage-check]', '负载已恢复，扩容依据失效', root);
    }
  }
  if (step.mode === 'effect' || step.mode === 'validate' || step.mode === 'verdict') setText('[data-settlement]', '部署与通知仍在提交门后', root);
  if (step.mode === 'settle') {
    qs('[data-settlement]', root).dataset.state = staleMode ? 'abort' : 'commit';
    setText('[data-settlement]', staleMode ? '已中止 · 负载恢复 · 未执行扩容' : '已提交 · payment-api 副本数 4 → 6', root);
    setText('[data-status]', staleMode ? '事实失效，拒绝扩容' : '三个条件有效，允许扩容', root);
  }
}

const demo = makeStepper({ root, steps, render, onReset: clear, delay: 1100 });
staleButton.addEventListener('click', () => { staleMode = !staleMode; staleButton.setAttribute('aria-pressed', String(staleMode)); staleButton.textContent = staleMode ? '恢复高负载' : '模拟负载恢复'; demo.reset(); });
