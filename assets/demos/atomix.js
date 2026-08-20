import { makeStepper, qs, qsa, setPhases, setText } from '../site.js';

const root = qs('[data-demo="atomix"]');
const abortButton = qs('[data-action="abort-mode"]', root);
let abortMode = false;
const steps = [
  { label: '主 Agent 为 trip-42 开启一次差旅事务。', phase: 0, mode: 'open', status: '差旅事务已开启', frontier: 0, settled: '0 / 2' },
  { label: '四个 Agent 执行工具；确认邮件仍被提交门阻挡。', phase: 1, mode: 'execute', status: '副作用已登记', frontier: 0, settled: '0 / 2' },
  { label: 'Runtime 冻结事务 footprint，不再接受新的预订操作。', phase: 2, mode: 'seal', status: '事务范围已冻结', frontier: 0, settled: '0 / 2' },
  { label: '酒店资源上的更早事务已经结算；支付资源仍有前序事务。', phase: 3, mode: 'wait', status: '等待冲突前序完成', frontier: 50, settled: '1 / 2' },
  { label: '两个资源上的更早冲突事务都已结算，trip-42 可以提交。', phase: 3, mode: 'ready', status: '资源 frontier 已覆盖本事务', frontier: 100, settled: '2 / 2' },
  { label: 'Runtime 根据事务结果统一结算所有副作用。', phase: 4, mode: 'settle', status: '差旅事务已结算', frontier: 100, settled: '2 / 2' },
];

function clear() {
  qsa('[data-tx]', root).forEach((node) => { node.dataset.state = ''; });
  qsa('[data-effect]', root).forEach((effect) => { effect.dataset.state = ''; qs('.effect-state', effect).textContent = effect.dataset.effect === 'email' ? '等待提交' : '未执行'; });
  qs('[data-frontier]', root).style.setProperty('--frontier', '0%'); setText('[data-frontier-label]', '0 / 2', root); setPhases(-1, root);
}

function render(step) {
  clear();
  if (!step) { setText('[data-status]', 'transaction closed', root); return; }
  const finalStatus = step.mode === 'settle' && abortMode ? 'transaction aborted' : step.status;
  setText('[data-status]', finalStatus, root); setPhases(step.phase, root);
  qsa('[data-tx]', root).forEach((node, index) => { if (index < step.phase) node.dataset.state = 'done'; if (index === step.phase) node.dataset.state = step.mode === 'settle' && abortMode ? 'abort' : 'active'; });
  qs('[data-frontier]', root).style.setProperty('--frontier', `${step.frontier}%`); setText('[data-frontier-label]', step.settled, root);
  if (['execute', 'seal', 'wait', 'ready'].includes(step.mode)) {
    ['patch', 'booking', 'payment'].forEach((id) => { const effect = qs(`[data-effect="${id}"]`, root); effect.dataset.state = 'staged'; qs('.effect-state', effect).textContent = id === 'booking' ? '酒店已预留' : id === 'payment' ? '支付意图已创建' : '草稿已暂存'; });
    qs('[data-effect="email"]', root).dataset.state = 'blocked'; qs('.effect-state', qs('[data-effect="email"]', root)).textContent = '等待事务提交';
  }
  if (step.mode === 'settle') {
    if (abortMode) {
      const patch = qs('[data-effect="patch"]', root); patch.dataset.state = 'blocked'; qs('.effect-state', patch).textContent = '草稿已丢弃';
      const booking = qs('[data-effect="booking"]', root); booking.dataset.state = 'compensated'; qs('.effect-state', booking).textContent = '酒店预留已取消';
      const payment = qs('[data-effect="payment"]', root); payment.dataset.state = 'compensated'; qs('.effect-state', payment).textContent = '支付意图已取消';
      const email = qs('[data-effect="email"]', root); email.dataset.state = 'blocked'; qs('.effect-state', email).textContent = '邮件未发送';
    } else {
      const labels = { patch: '行程已保存', booking: '酒店已确认', payment: '支付意图已确认', email: '邮件已发送' };
      qsa('[data-effect]', root).forEach((effect) => { effect.dataset.state = 'released'; qs('.effect-state', effect).textContent = labels[effect.dataset.effect]; });
    }
  }
}

const demo = makeStepper({ root, steps, render, onReset: clear, delay: 1150 });
abortButton.addEventListener('click', () => { abortMode = !abortMode; abortButton.setAttribute('aria-pressed', String(abortMode)); abortButton.textContent = abortMode ? '恢复正常结算' : '模拟预算拒绝'; demo.reset(); setText('[data-status]', abortMode ? '预算策略将在结算时拒绝事务' : '差旅事务关闭', root); });
