import { makeStepper, qs, setPhases, setText } from '../site.js';

const root = qs('[data-demo="sequencer"]');
const range = qs('[data-agent-range]', root);
const output = qs('[data-agent-output]', root);
let count = Number(range.value);

const steps = [
  { label: 'Agent 同时向原子 allocator 申请 slot。', phase: 0, mode: 'request', counter: 1, headline: '所有 Agent 同时申请 ticket', subline: '一个极短的原子临界区' },
  { label: 'Allocator 给每个 Agent 返回唯一且递增的 slot。', phase: 0, mode: 'reserved', counter: -1, headline: '顺序一次性确定', subline: 'A→1 · B→2 · C→3 · …' },
  { label: '有了 slot 后，所有 Agent 并行计算。', phase: 1, mode: 'compute', counter: -1, headline: '计算仍然完全并行', subline: '顺序约束不等于计算串行' },
  { label: '先完成的高 slot 结果留在对应 buffer。', phase: 2, mode: 'buffer', counter: -1, headline: '完成顺序可以不同', subline: 'buffer[slot] 保存结果' },
  { label: 'Runtime 按 slot 1 到 n 依次 release。', phase: 3, mode: 'release', counter: -1, headline: '服务器按 ticket 发布', subline: 'publish[1] → publish[2] → …' },
  { label: 'n 个 Agent 只需要 n 次分配与 n 次有序发布。', phase: 3, mode: 'result', counter: -1, headline: '线性协调，没有 retry storm', subline: 'coordination = O(n)' },
];

function build() {
  const agents = qs('[data-agents]', root); const slots = qs('[data-slots]', root);
  agents.replaceChildren(); slots.replaceChildren(); slots.style.setProperty('--slot-count', count);
  for (let index = 0; index < count; index += 1) {
    const name = String.fromCharCode(65 + index);
    const agent = document.createElement('span'); agent.className = 'agent'; agent.dataset.agent = index; agent.innerHTML = `<span>Agent ${name}<small data-ticket>no ticket</small></span>`; agents.append(agent);
    const slot = document.createElement('span'); slot.className = 'slot'; slot.dataset.slot = index; slot.innerHTML = `<span>slot ${index + 1}<br><small>empty</small></span>`; slots.append(slot);
  }
}

function render(step) {
  if (!step) {
    setText('[data-status]', '等待申请', root); setText('[data-headline]', 'next_slot 尚未被读取', root); setText('[data-subline]', 'atomic_fetch_add(next_slot, 1)', root); setText('[data-counter]', 1, root); setPhases(-1, root);
    root.querySelectorAll('.agent, .slot').forEach((node) => { node.dataset.state = ''; });
    qs('[data-release-marker]', root).style.setProperty('--release', '0%');
    return;
  }
  setText('[data-status]', step.mode === 'result' ? '发布完成' : step.headline, root); setText('[data-headline]', step.headline, root); setText('[data-subline]', step.subline, root); setText('[data-counter]', step.counter === -1 ? count + 1 : step.counter, root); setPhases(step.phase, root);
  root.querySelectorAll('[data-agent]').forEach((agent, index) => {
    const ticket = qs('[data-ticket]', agent);
    agent.dataset.state = ['request'].includes(step.mode) ? 'thinking' : step.mode === 'reserved' ? 'ready' : ['compute', 'buffer'].includes(step.mode) ? 'thinking' : ['release', 'result'].includes(step.mode) ? 'committed' : '';
    ticket.textContent = step.mode === 'request' ? 'requesting…' : `ticket ${index + 1}`;
  });
  root.querySelectorAll('[data-slot]').forEach((slot, index) => {
    let state = '';
    let note = 'empty';
    if (step.mode === 'reserved') { state = 'reserved'; note = `Agent ${String.fromCharCode(65 + index)}`; }
    if (step.mode === 'compute') { state = 'reserved'; note = 'computing…'; }
    if (step.mode === 'buffer') { state = 'ready'; note = index % 2 ? 'ready first' : 'ready'; }
    if (step.mode === 'release' || step.mode === 'result') { state = 'released'; note = `value ${index + 1}`; }
    slot.dataset.state = state; slot.innerHTML = `<span>slot ${index + 1}<br><small>${note}</small></span>`;
  });
  const release = step.mode === 'release' || step.mode === 'result' ? 'calc(100% - 0.75rem)' : '0%';
  qs('[data-release-marker]', root).style.setProperty('--release', release);
}

const demo = makeStepper({ root, steps, render, onReset: build, delay: 1100 });
range.addEventListener('input', () => { count = Number(range.value); output.value = count; output.textContent = count; demo.reset(); });
