import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, setText } from '../site.js';

const root = qs('[data-demo="held-draft"]');
const range = qs('[data-agent-range]', root);
const output = qs('[data-agent-output]', root);
let count = Number(range.value);
let timeline = [];
let renderToken = 0;

function buildSteps() {
  const randomUnit = () => {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] / 2 ** 32;
  };
  const shuffle = (items) => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(randomUnit() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  };

  const remaining = Array.from({ length: count }, (_, index) => index);
  const rounds = [];
  let checksBefore = 0;
  for (let index = 0; index < count; index += 1) {
    const completionOrder = shuffle(remaining);
    const attempts = completionOrder.map((agent, rank) => ({
      agent,
      duration: 0.55 + (rank * 0.13) + (randomUnit() * 0.07),
    }));
    const winner = attempts[0].agent;
    const value = index + 1;
    rounds.push({
      label: `${remaining.length} 个 Agent 基于 v${index} 并发生成候选值 ${value}；最先完成者提交。`,
      value,
      base: index,
      winner,
      attempts,
      priorWinners: rounds.map((round) => round.winner),
      checksBefore,
    });
    checksBefore += remaining.length;
    remaining.splice(remaining.indexOf(winner), 1);
  }
  return rounds;
}

function build() {
  const messages = qs('[data-messages]', root);
  const room = qs('[data-room-sequence]', root);
  root.dataset.agentDensity = count >= 7 ? 'compact' : 'normal';
  timeline = buildSteps();
  room.style.setProperty('--agent-count', count);
  room.replaceChildren();
  messages.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const name = AGENT_NAMES[index];
    const committed = document.createElement('span');
    committed.className = 'number-cell';
    committed.dataset.roomNumber = index;
    committed.innerHTML = `<strong>${index + 1}</strong><small></small>`;
    room.append(committed);
    const message = document.createElement('div');
    message.className = 'message';
    message.dataset.message = index;
    message.innerHTML = `<span>${name}</span><span class="draft-cell"><strong data-message-copy>—</strong><i class="race-track" aria-hidden="true"><i data-race-progress></i></i></span><span class="pill" data-message-state>未运行</span>`;
    messages.append(message);
  }
}

function setRoomSlot(index, owner) {
  const slot = root.querySelector(`[data-room-number="${index}"]`);
  slot.dataset.state = owner === undefined ? '' : 'commit';
  qs('strong', slot).textContent = index + 1;
  qs('small', slot).textContent = owner === undefined ? '' : AGENT_NAMES[owner];
}

function render(step) {
  renderToken += 1;
  const token = renderToken;
  if (!step) {
    setText('[data-status]', '等待开始', root);
    setText('[data-room-version]', 0, root);
    setText('[data-round]', 0, root); setText('[data-held]', 0, root); setText('[data-version-checks]', 0, root);
    root.querySelectorAll('.message').forEach((node) => { node.dataset.state = ''; });
    root.querySelectorAll('[data-message-copy]').forEach((node) => { node.textContent = '—'; });
    root.querySelectorAll('[data-message-state]').forEach((node) => { node.textContent = '未运行'; });
    root.querySelectorAll('[data-race-progress]').forEach((node) => { node.style.animation = 'none'; });
    root.querySelectorAll('[data-room-number]').forEach((_, index) => setRoomSlot(index));
    return;
  }

  const priorByAgent = new Map(step.priorWinners.map((agent, index) => [agent, index]));
  const attemptByAgent = new Map(step.attempts.map((attempt) => [attempt.agent, attempt]));
  step.priorWinners.forEach((owner, index) => setRoomSlot(index, owner));
  for (let index = step.priorWinners.length; index < count; index += 1) setRoomSlot(index);
  setText('[data-status]', `room v${step.base}`, root);
  setText('[data-room-version]', step.base, root);
  setText('[data-round]', step.base, root);
  setText('[data-held]', 0, root);
  setText('[data-version-checks]', step.checksBefore, root);

  let finished = 0;
  let held = 0;
  root.querySelectorAll('[data-message]').forEach((message, index) => {
    const badge = qs('[data-message-state]', message);
    const copy = qs('[data-message-copy]', message);
    const progress = qs('[data-race-progress]', message);
    const committedAt = priorByAgent.get(index);
    if (committedAt !== undefined) {
      const pastAttempt = timeline[committedAt].attempts.find((attempt) => attempt.agent === index);
      message.dataset.state = 'commit';
      copy.textContent = `提交 ${committedAt + 1} · ${pastAttempt.duration.toFixed(2)}s`;
      badge.textContent = `占用 #${committedAt + 1}`;
      progress.style.animation = 'none';
      return;
    }

    const attempt = attemptByAgent.get(index);
    message.dataset.state = 'racing';
    copy.textContent = `候选 ${step.value} · base v${step.base}`;
    badge.textContent = `${attempt.duration.toFixed(2)}s`;
    progress.style.setProperty('--race-duration', `${attempt.duration}s`);
    progress.style.animation = 'none';
    void progress.offsetWidth;
    progress.style.animation = '';
    progress.addEventListener('animationend', () => {
      if (token !== renderToken) return;
      finished += 1;
      setText('[data-version-checks]', step.checksBefore + finished, root);
      if (index === step.winner) {
        message.dataset.state = 'commit';
        copy.textContent = `提交 ${step.value} · ${attempt.duration.toFixed(2)}s`;
        badge.textContent = `占用 #${step.value}`;
        setRoomSlot(step.value - 1, index);
        setText('[data-room-version]', step.value, root);
        setText('[data-round]', step.value, root);
        setText('[data-status]', step.value === count ? '运行完成' : `room v${step.value}`, root);
      } else {
        held += 1;
        message.dataset.state = 'held';
        badge.textContent = 'held';
        setText('[data-held]', held, root);
      }
    }, { once: true });
  });
}

const demo = makeStepper({ root, steps: () => timeline, render, onReset: build, delay: 1800 });
range.addEventListener('input', () => { count = Number(range.value); output.value = count; output.textContent = count; demo.reset(); });
