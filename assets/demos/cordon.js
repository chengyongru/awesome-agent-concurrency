import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="cordon"]');
const staleButton = qs('[data-action="stale-mode"]', root);
let staleMode = false;
const steps = [
  { label: 'Prepare 捕获当前观察，并打开 tx-17。', phase: 0, mode: 'observe', status: 'observation captured' },
  { label: 'Agent 从观察中形成可追溯总结。', phase: 1, mode: 'summary', status: 'summary derived' },
  { label: '总结支持一个具体、可审计的 scale 决策。', phase: 1, mode: 'decision', status: 'decision linked' },
  { label: '部署与通知 effect 被暂存，还没有外部释放。', phase: 1, mode: 'effect', status: 'effects staged' },
  { label: 'Validate 同时检查 lineage、authority 与当前用户意图。', phase: 2, mode: 'validate', status: 'semantic validation' },
  { label: 'Runtime 计算验证结果。', phase: 2, mode: 'verdict', status: 'validation verdict' },
  { label: '事务进入最终结算。', phase: 3, mode: 'settle', status: 'transaction settled' },
];

function clear() {
  qsa('[data-lineage]', root).forEach((node) => { node.dataset.state = ''; });
  qsa('[data-check]', root).forEach((node) => { node.dataset.state = ''; });
  qs('[data-settlement]', root).dataset.state = ''; setText('[data-settlement]', 'effects remain staged', root); setPhases(-1, root);
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
    }
  }
  if (step.mode === 'effect' || step.mode === 'validate' || step.mode === 'verdict') setText('[data-settlement]', 'deploy + notify staged behind gate', root);
  if (step.mode === 'settle') {
    qs('[data-settlement]', root).dataset.state = staleMode ? 'abort' : 'commit';
    setText('[data-settlement]', staleMode ? 'ABORT · local mutation reverted · effects blocked' : 'COMMIT · effects released with tx-bound authority', root);
    setText('[data-status]', staleMode ? 'lineage invalid → abort' : 'all checks valid → commit', root);
  }
}

const demo = makeStepper({ root, steps, render, onReset: clear, delay: 1100 });
staleButton.addEventListener('click', () => { staleMode = !staleMode; staleButton.setAttribute('aria-pressed', String(staleMode)); staleButton.textContent = staleMode ? '观察已过期' : '使观察过期'; demo.reset(); });
