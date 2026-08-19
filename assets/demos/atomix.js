import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="atomix"]');
const abortButton = qs('[data-action="abort-mode"]', root);
let abortMode = false;
const steps = [
  { label: 'Runtime 打开 epoch 4 transaction。', phase: 0, mode: 'open', status: 'transaction open', frontier: 25 },
  { label: '工具执行并登记 effect scope 与 effect class。', phase: 1, mode: 'execute', status: 'effects registered', frontier: 25 },
  { label: 'Seal 冻结 transaction footprint，禁止继续扩张。', phase: 2, mode: 'seal', status: 'footprint sealed', frontier: 50 },
  { label: 'Transaction 等待相关资源的更早 epoch 结束。', phase: 3, mode: 'wait', status: 'waiting resource frontier', frontier: 75 },
  { label: 'Frontier 到达 epoch 4，当前 transaction 可以结算。', phase: 3, mode: 'ready', status: 'frontier safe', frontier: 100 },
  { label: '结算路径完成。', phase: 4, mode: 'settle', status: 'transaction settled', frontier: 100 },
];

function clear() {
  qsa('[data-tx]', root).forEach((node) => { node.dataset.state = ''; });
  qsa('[data-effect]', root).forEach((effect) => { effect.dataset.state = ''; qs('.effect-state', effect).textContent = effect.dataset.effect === 'email' ? 'gated' : 'not run'; });
  qs('[data-frontier]', root).style.setProperty('--frontier', '0%'); setText('[data-frontier-label]', 'epoch 1 / 4', root); setPhases(-1, root);
}

function render(step) {
  clear();
  if (!step) { setText('[data-status]', 'transaction closed', root); return; }
  const finalStatus = step.mode === 'settle' && abortMode ? 'transaction aborted safely' : step.status;
  setText('[data-status]', finalStatus, root); setPhases(step.phase, root);
  qsa('[data-tx]', root).forEach((node, index) => { if (index < step.phase) node.dataset.state = 'done'; if (index === step.phase) node.dataset.state = step.mode === 'settle' && abortMode ? 'abort' : 'active'; });
  qs('[data-frontier]', root).style.setProperty('--frontier', `${step.frontier}%`); setText('[data-frontier-label]', step.frontier === 100 ? 'epoch 4 / 4' : step.frontier >= 75 ? 'epoch 3 / 4' : step.frontier >= 50 ? 'epoch 2 / 4' : 'epoch 1 / 4', root);
  if (['execute', 'seal', 'wait', 'ready'].includes(step.mode)) {
    ['patch', 'booking', 'payment'].forEach((id) => { const effect = qs(`[data-effect="${id}"]`, root); effect.dataset.state = 'staged'; qs('.effect-state', effect).textContent = id === 'booking' ? 'reserved' : id === 'payment' ? 'known outcome' : 'staged'; });
    qs('[data-effect="email"]', root).dataset.state = 'blocked'; qs('.effect-state', qs('[data-effect="email"]', root)).textContent = 'blocked by gate';
  }
  if (step.mode === 'settle') {
    if (abortMode) {
      const patch = qs('[data-effect="patch"]', root); patch.dataset.state = 'blocked'; qs('.effect-state', patch).textContent = 'discarded';
      const booking = qs('[data-effect="booking"]', root); booking.dataset.state = 'compensated'; qs('.effect-state', booking).textContent = 'compensated';
      const payment = qs('[data-effect="payment"]', root); payment.dataset.state = 'blocked'; qs('.effect-state', payment).textContent = 'not retried';
      const email = qs('[data-effect="email"]', root); email.dataset.state = 'blocked'; qs('.effect-state', email).textContent = 'never released';
    } else qsa('[data-effect]', root).forEach((effect) => { effect.dataset.state = 'released'; qs('.effect-state', effect).textContent = 'released'; });
  }
}

const demo = makeStepper({ root, steps, render, onReset: clear, delay: 1150 });
abortButton.addEventListener('click', () => { abortMode = !abortMode; abortButton.setAttribute('aria-pressed', String(abortMode)); abortButton.textContent = abortMode ? 'abort 路径' : '模拟 abort'; demo.reset(); setText('[data-status]', abortMode ? 'abort path armed' : 'transaction closed', root); });
