import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setText } from '../site.js';

const root = qs('[data-demo="sequencer"]');
const range = qs('[data-agent-range]', root);
const output = qs('[data-agent-output]', root);
let count = Number(range.value);
let plan;
let timeline = [];
let renderToken = 0;
let publicationTimers = [];

const DIAGNOSTIC_TASKS = Object.freeze([
  '检查部署变更',
  '查询错误日志',
  '检查数据库指标',
  '核对运行配置',
  '检查服务依赖',
  '分析请求链路',
  '检查容量水位',
  '核对告警时间线',
]);

const CONTEXT_RESULTS = Object.freeze([
  'v2.4.1',
  '5xx /pay',
  'DB 96%',
  '配置一致',
  '支付超时',
  'DB span',
  'CPU 72%',
  '14:32',
]);

function randomUnit() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x100000000;
}

function shuffled(size) {
  const values = Array.from({ length: size }, (_, index) => index);
  for (let index = size - 1; index > 0; index -= 1) {
    const target = Math.floor(randomUnit() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

function rankedDurations(order, start, interval) {
  const durations = Array(order.length);
  order.forEach((agentIndex, rank) => {
    durations[agentIndex] = start + rank * interval + Math.round(randomUnit() * 68);
  });
  return durations;
}

function buildPlan() {
  const allocationOrder = shuffled(count);
  const ticketByAgent = Array(count);
  allocationOrder.forEach((agentIndex, rank) => { ticketByAgent[agentIndex] = rank + 1; });

  const computeOrder = shuffled(count);
  const ticketOneAgent = allocationOrder[0];
  if (computeOrder[0] === ticketOneAgent) {
    const laterIndex = Math.min(2, computeOrder.length - 1);
    [computeOrder[0], computeOrder[laterIndex]] = [computeOrder[laterIndex], computeOrder[0]];
  }

  return {
    allocationOrder,
    ticketByAgent,
    requestMs: rankedDurations(allocationOrder, 500, 108),
    computeMs: rankedDurations(computeOrder, 620, 142),
  };
}

function buildSteps() {
  return [
    { phase: 'allocate', label: `主 Agent 按计划顺序向 ${count} 个空闲子 Agent 派发诊断任务。` },
    { phase: 'compute', label: '子 Agent 可以乱序返回；结果仍按任务序号写入主 Agent 上下文。' },
  ];
}

function clearPublicationTimers() {
  publicationTimers.forEach((timer) => window.clearTimeout(timer));
  publicationTimers = [];
}

function makeCell(className, text = '') {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

function resetReturnOrder() {
  const order = qs('[data-return-order]', root);
  order.replaceChildren(makeCell('return-order-empty', '尚无结果'));
}

function appendReturn(agentIndex, ticket, rank) {
  const order = qs('[data-return-order]', root);
  if (rank === 1) order.replaceChildren();
  const entry = makeCell('return-order-entry', `${rank} ${AGENT_NAMES[agentIndex]}·#${ticket}`);
  entry.dataset.returnAgent = agentIndex;
  entry.dataset.returnTicket = ticket;
  entry.setAttribute('aria-label', `第 ${rank} 个返回：${AGENT_NAMES[agentIndex]}，任务 ${ticket}`);
  order.append(entry);
}

function buildRows() {
  const rowsContainer = qs('[data-sequence-rows]', root);
  rowsContainer.replaceChildren();
  for (let agentIndex = 0; agentIndex < count; agentIndex += 1) {
    const row = document.createElement('div');
    row.className = 'sequence-row';
    row.dataset.sequenceRow = '';
    row.dataset.agentIndex = agentIndex;
    row.dataset.state = 'idle';
    row.style.order = agentIndex;

    const diagnosticTask = makeCell('sequence-case', '等待派发');
    diagnosticTask.dataset.case = '';
    const agent = makeCell('sequence-agent', AGENT_NAMES[agentIndex]);

    const work = document.createElement('span');
    work.className = 'sequence-work';
    const workLabel = makeCell('', '未运行');
    workLabel.dataset.workLabel = '';
    const track = document.createElement('i');
    track.className = 'sequence-track';
    const progress = document.createElement('i');
    progress.className = 'sequence-progress';
    progress.dataset.sequenceProgress = '';
    track.append(progress);
    work.append(workLabel, track);

    const state = makeCell('sequence-state', '未派发');
    state.dataset.rowState = '';
    row.append(diagnosticTask, agent, work, state);
    rowsContainer.append(row);
  }

  const log = qs('[data-publish-log]', root);
  log.replaceChildren();
  log.style.setProperty('--case-count', count);
  for (let ticket = 1; ticket <= count; ticket += 1) {
    const entry = document.createElement('i');
    entry.dataset.logTicket = ticket;
    entry.textContent = `#${ticket}`;
    entry.title = `等待任务 #${ticket} 的结果`;
    log.append(entry);
  }
  resetReturnOrder();
}

function rows() {
  return qsa('[data-sequence-row]', root);
}

function setRow(row, { state, ticket, work, status }) {
  if (state) row.dataset.state = state;
  if (ticket !== undefined) {
    if (ticket === null) {
      delete row.dataset.ticket;
      setText('[data-case]', '等待派发', row);
    } else {
      row.dataset.ticket = ticket;
      setText('[data-case]', `#${ticket} ${DIAGNOSTIC_TASKS[ticket - 1]}`, row);
    }
  }
  if (work !== undefined) setText('[data-work-label]', work, row);
  if (status !== undefined) setText('[data-row-state]', status, row);
}

function showFrontier(ticket) {
  rows().forEach((row) => { delete row.dataset.frontier; });
  if (ticket > count) return;
  const frontierRow = rows().find((row) => Number(row.dataset.ticket) === ticket);
  if (frontierRow) frontierRow.dataset.frontier = 'true';
}

function startProgress(row, milliseconds, token, onComplete) {
  const progress = qs('[data-sequence-progress]', row);
  delete progress.dataset.running;
  void progress.offsetWidth;
  progress.style.setProperty('--work-duration', `${milliseconds}ms`);
  progress.addEventListener('animationend', () => {
    if (token === renderToken) onComplete();
  }, { once: true });
  progress.dataset.running = 'true';
}

function primeTicketAssignments() {
  rows().forEach((row) => {
    const agentIndex = Number(row.dataset.agentIndex);
    const ticket = plan.ticketByAgent[agentIndex];
    row.style.order = ticket;
    setRow(row, { state: 'assigned', ticket, work: '已取得任务', status: '已派发' });
  });
}

function runAllocation() {
  const token = ++renderToken;
  clearPublicationTimers();
  setText('[data-sequencer-phase]', '子 Agent 请求下一任务', root);
  setText('[data-sequencer-frontier]', '下一任务 #1', root);
  resetReturnOrder();

  let allocated = 0;
  rows().forEach((row) => {
    const agentIndex = Number(row.dataset.agentIndex);
    const duration = plan.requestMs[agentIndex];
    row.style.order = agentIndex;
    delete row.dataset.frontier;
    setRow(row, {
      state: 'requesting',
      ticket: null,
      work: `空闲于 ${(duration / 1000).toFixed(2)} s`,
      status: '等待派发',
    });
    startProgress(row, duration, token, () => {
      allocated += 1;
      const ticket = plan.ticketByAgent[agentIndex];
      setRow(row, { state: 'assigned', ticket, work: `派发于 ${(duration / 1000).toFixed(2)} s`, status: '已派发' });
      setText('[data-sequencer-frontier]', allocated === count ? '全部已派发' : `下一任务 #${allocated + 1}`, root);
      if (allocated === count) {
        rows().forEach((assignedRow) => {
          assignedRow.style.order = plan.ticketByAgent[Number(assignedRow.dataset.agentIndex)];
        });
        setText('[data-sequencer-phase]', '诊断任务派发完成', root);
      }
    });
  });
}

function runComputeAndPublish() {
  const token = ++renderToken;
  clearPublicationTimers();
  primeTicketAssignments();
  setText('[data-sequencer-phase]', '子 Agent 并行调查', root);
  setText('[data-sequencer-frontier]', '待写入上下文 #1', root);

  const ready = new Set();
  let frontier = 0;
  let publishing = false;
  let returnRank = 0;
  resetReturnOrder();

  function updateFrontier() {
    showFrontier(frontier + 1);
    if (frontier === count) {
      setText('[data-sequencer-phase]', '主 Agent 开始综合诊断', root);
      setText('[data-sequencer-frontier]', `上下文 ${count} / ${count}`, root);
    } else {
      setText('[data-sequencer-frontier]', `待写入上下文 #${frontier + 1}`, root);
    }
  }

  function drainContiguousPrefix() {
    if (publishing || !ready.has(frontier) || token !== renderToken) return;
    publishing = true;

    function publishNext() {
      if (token !== renderToken || !ready.has(frontier)) {
        publishing = false;
        updateFrontier();
        return;
      }
      const ticket = frontier + 1;
      const row = rows().find((candidate) => Number(candidate.dataset.ticket) === ticket);
      ready.delete(frontier);
      setRow(row, { state: 'published', status: '已写入上下文' });
      const contextEntry = qs(`[data-log-ticket="${ticket}"]`, root);
      contextEntry.dataset.state = 'published';
      contextEntry.textContent = `#${ticket} ${CONTEXT_RESULTS[ticket - 1]}`;
      contextEntry.title = `${DIAGNOSTIC_TASKS[ticket - 1]}：${CONTEXT_RESULTS[ticket - 1]}`;
      frontier += 1;
      updateFrontier();

      const timer = window.setTimeout(publishNext, 140);
      publicationTimers.push(timer);
    }

    publishNext();
  }

  updateFrontier();
  rows().forEach((row) => {
    const agentIndex = Number(row.dataset.agentIndex);
    const ticket = plan.ticketByAgent[agentIndex];
    const duration = plan.computeMs[agentIndex];
    setRow(row, {
      state: 'computing',
      work: `调查 ${(duration / 1000).toFixed(2)} s`,
      status: '调查中',
    });
    startProgress(row, duration, token, () => {
      returnRank += 1;
      appendReturn(agentIndex, ticket, returnRank);
      ready.add(ticket - 1);
      setRow(row, { state: 'buffered', work: `第 ${returnRank} 个返回`, status: '等待前序' });
      drainContiguousPrefix();
    });
  });
}

function build() {
  renderToken += 1;
  clearPublicationTimers();
  plan = buildPlan();
  timeline = buildSteps();
  buildRows();
}

function render(step) {
  if (!step) {
    renderToken += 1;
    clearPublicationTimers();
    setText('[data-sequencer-phase]', '诊断任务等待派发', root);
    setText('[data-sequencer-frontier]', '下一任务 #1', root);
    return;
  }
  if (step.phase === 'allocate') runAllocation();
  if (step.phase === 'compute') runComputeAndPublish();
}

const demo = makeStepper({ root, steps: () => timeline, render, onReset: build, delay: 2100 });
range.addEventListener('input', () => {
  count = Number(range.value);
  output.value = count;
  output.textContent = count;
  demo.reset();
});
