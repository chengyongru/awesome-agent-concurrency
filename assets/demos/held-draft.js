import { makeStepper, qs, setPhases, setText } from '../site.js';

const root = qs('[data-demo="held-draft"]');
const range = qs('[data-agent-range]', root);
const output = qs('[data-agent-output]', root);
let count = Number(range.value);

const steps = [
  { label: '所有 Agent 读取 room version v₀。', phase: 0, mode: 'read', room: 0, round: 0, held: 0, decisions: 0, headline: '所有 Agent 读取同一快照', subline: 'base_room_version = v₀' },
  { label: '所有 Agent 并行生成数字 1 的 draft。', phase: 1, mode: 'draft', room: 0, round: 1, held: 0, decisions: 0, headline: '每个人都得出同一个答案', subline: 'draft = “1” · base = v₀' },
  { label: 'Agent A 先提交，房间版本前进到 v₁。', phase: 2, mode: 'first', room: 1, round: 1, held: 0, decisions: 1, headline: 'A 抢先提交成功', subline: 'current_room_version = v₁' },
  { label: '其余 draft 版本过期，全部进入 Held Draft。', phase: 2, mode: 'held', room: 1, round: 1, held: -1, decisions: -1, headline: '其余 draft 同时过期', subline: 'base v₀ ≠ current v₁' },
  { label: 'Agent B 基于 v₁ 修订为数字 2。', phase: 3, mode: 'retry', room: 1, round: 2, held: -2, decisions: -1, headline: 'B 修订，其他 Agent 也在重判', subline: 'optimistic retry · round 2' },
  { label: 'B 提交后，其他 draft 再次过期。', phase: 3, mode: 'second', room: 2, round: 2, held: -2, decisions: -2, headline: 'B 提交，房间再次前进', subline: 'current_room_version = v₂' },
  { label: '最坏情况下，n 个 Agent 需要 n(n+1)/2 次判断。', phase: 3, mode: 'result', room: -1, round: -1, held: -1, decisions: -1, headline: '安全，但高竞争时昂贵', subline: 'thundering herd + coarse version' },
];

function build() {
  const agents = qs('[data-agents]', root);
  const messages = qs('[data-messages]', root);
  agents.replaceChildren();
  messages.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const name = String.fromCharCode(65 + index);
    const agent = document.createElement('span');
    agent.className = 'agent';
    agent.dataset.agent = index;
    agent.innerHTML = `<span>Agent ${name}<small data-agent-detail>${index + 1}</small></span>`;
    agents.append(agent);
    const message = document.createElement('div');
    message.className = 'message';
    message.dataset.message = index;
    message.innerHTML = `<span>Agent ${name}</span><strong data-message-copy>draft “1”</strong><span class="pill" data-message-state>idle</span>`;
    messages.append(message);
  }
}

function render(step) {
  if (!step) {
    setText('[data-status]', '等待开始', root);
    setText('[data-headline]', '所有 Agent 读取同一快照', root);
    setText('[data-subline]', 'base_room_version = v₀', root);
    setText('[data-room-version]', 'v₀', root);
    setText('[data-round]', 0, root); setText('[data-held]', 0, root); setText('[data-decisions]', 0, root);
    root.querySelectorAll('.agent, .message').forEach((node) => { node.dataset.state = ''; });
    root.querySelectorAll('[data-message-state]').forEach((node) => { node.textContent = 'idle'; });
    setPhases(-1, root);
    return;
  }
  const total = (count * (count + 1)) / 2;
  const held = step.mode === 'result' ? 0 : step.held === -1 ? count - 1 : step.held === -2 ? Math.max(0, count - 2) : step.held;
  const decisions = step.mode === 'result' ? total : step.decisions === -1 ? count : step.decisions === -2 ? count + (count - 1) : step.decisions;
  const room = step.room === -1 ? count : step.room;
  const round = step.round === -1 ? count : step.round;
  setText('[data-status]', step.mode === 'result' ? '退化完成' : `room v${room}`, root);
  setText('[data-headline]', step.headline, root); setText('[data-subline]', step.subline, root);
  setText('[data-room-version]', `v${room}`, root); setText('[data-round]', round, root); setText('[data-held]', held, root); setText('[data-decisions]', decisions, root);
  setPhases(step.phase, root);
  root.querySelectorAll('[data-agent]').forEach((agent, index) => {
    let state = '';
    if (step.mode === 'read' || step.mode === 'draft') state = 'thinking';
    if (step.mode === 'first') state = index === 0 ? 'committed' : 'thinking';
    if (step.mode === 'held') state = index === 0 ? 'committed' : 'conflict';
    if (step.mode === 'retry') state = index === 0 ? 'committed' : index === 1 ? 'thinking' : 'conflict';
    if (step.mode === 'second') state = index < 2 ? 'committed' : 'conflict';
    if (step.mode === 'result') state = 'committed';
    agent.dataset.state = state;
  });
  root.querySelectorAll('[data-message]').forEach((message, index) => {
    const badge = qs('[data-message-state]', message);
    const copy = qs('[data-message-copy]', message);
    let state = '';
    let text = 'draft';
    let body = 'draft “1”';
    if (step.mode === 'draft') { state = ''; text = 'base v₀'; }
    if (step.mode === 'first') { state = index === 0 ? 'commit' : ''; text = index === 0 ? 'commit' : 'checking'; }
    if (step.mode === 'held') { state = index === 0 ? 'commit' : 'held'; text = index === 0 ? 'commit' : 'held'; }
    if (step.mode === 'retry') { state = index === 0 ? 'commit' : index === 1 ? '' : 'held'; text = index === 0 ? 'commit' : index === 1 ? 'base v₁' : 'held'; body = index === 1 ? 'draft “2”' : body; }
    if (step.mode === 'second') { state = index < 2 ? 'commit' : 'held'; text = index < 2 ? 'commit' : 'held again'; body = index === 1 ? 'draft “2”' : body; }
    if (step.mode === 'result') { state = 'commit'; text = 'commit'; body = `draft “${index + 1}”`; }
    message.dataset.state = state; badge.textContent = text; copy.textContent = body;
  });
}

const demo = makeStepper({ root, steps, render, onReset: build, delay: 1050 });
range.addEventListener('input', () => { count = Number(range.value); output.value = count; output.textContent = count; demo.reset(); });
