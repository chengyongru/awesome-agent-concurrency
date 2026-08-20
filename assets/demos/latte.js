import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setText } from '../site.js';

const [ada, lin, mira, noah] = AGENT_NAMES;
const root = qs('[data-demo="latte"]');
const steps = [
  { label: `${noah} 只知道“生成周报”这个目标，先建立一个“阅读本周资料”节点。`, mode: 'ready', status: '初始图只有一个可执行任务' },
  { label: `${ada} 从 frontier 主动 claim 资料阅读任务。`, mode: 'seed-claim', status: `${ada} 正在阅读邮件、纪要和预算表` },
  { label: `${ada} 发现预算合计不一致、里程碑延期和客户升级邮件，连续调用 Discover 提议三个处理节点与一个周报节点。`, mode: 'discover', status: `${ada} 从资料中发现计划外工作` },
  { label: `${noah} 按依赖顺序合并四次 Discover；新图保持无环，三项办公任务同时进入 frontier。`, mode: 'accept', status: '三项新任务可以并行领取' },
  { label: `${ada}、${lin}、${mira} 同时从公共 frontier claim 不同节点，并以各自的实际耗时并行执行。`, mode: 'parallel-run', status: '三个 Worker 同时 claim · 并行执行' },
  { label: `${lin} claim 已解锁的周报节点，读取三项局部结果并整理成稿。`, mode: 'report-claim', status: `${lin} 正在生成项目周报` },
];

const order = steps.map((step) => step.mode);
const reached = (current, target) => order.indexOf(current) >= order.indexOf(target);
const dynamicTasks = ['budget', 'schedule', 'risk', 'report'];
const branchPaths = ['discover-trunk', 'seed-budget', 'seed-schedule', 'seed-risk'];
const resultPaths = ['budget-merge', 'schedule-merge', 'risk-merge'];
const allDependencyPaths = [...branchPaths, ...resultPaths, 'merge-report'];
const analyses = [
  { id: 'budget', worker: 0, agent: ada, task: '核对预算差异', path: 'budget-merge', claim: 'claim-budget' },
  { id: 'schedule', worker: 1, agent: lin, task: '更新延期进度', path: 'schedule-merge', claim: 'claim-schedule' },
  { id: 'risk', worker: 2, agent: mira, task: '整理客户风险', path: 'risk-merge', claim: 'claim-risk' },
];
const ownerDefaults = {
  seed: '等待初始化',
  budget: '尚未发现',
  schedule: '尚未发现',
  risk: '尚未发现',
  report: '等待三项任务',
};

let run;
let renderToken = 0;

function randomUnit() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x100000000;
}

function shuffled(items) {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(randomUnit() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

function buildRun() {
  const completionOrder = shuffled(analyses.map(({ id }) => id));
  const durations = {};
  completionOrder.forEach((id, rank) => {
    durations[id] = 620 + (rank * 160) + Math.round(randomUnit() * 70);
  });
  run = {
    completionOrder,
    durations,
    seedDuration: 650 + Math.round(randomUnit() * 260),
    reportDuration: 680 + Math.round(randomUnit() * 250),
  };
}

function setState(selector, state = '') {
  const node = qs(selector, root);
  if (node) node.dataset.state = state;
}

function setTask(id, state, owner) {
  const task = qs(`[data-task="${id}"]`, root);
  task.dataset.state = state;
  if (owner) setText('[data-task-owner]', owner, task);
}

function setWorker(index, state, task) {
  const worker = qs(`[data-worker="${index}"]`, root);
  worker.dataset.state = state;
  setText('[data-worker-task]', task, worker);
}

function setPath(id, state) {
  setState(`[data-path="${id}"]`, state);
}

function setPaths(ids, state) {
  ids.forEach((id) => setPath(id, state));
}

function setSceneStatus(status, state = 'active') {
  setText('[data-status]', status, root);
  setText('[data-scene-state]', status, root);
  setState('[data-scene-state]', state);
}

function setStepLocked(locked) {
  const control = qs('[data-action="step"]', root);
  if (control) control.disabled = locked;
}

function revealDynamicTasks() {
  dynamicTasks.forEach((id) => { qs(`[data-task="${id}"]`, root).dataset.visible = 'true'; });
}

function startProgress(id, duration, token, onComplete) {
  const task = qs(`[data-task="${id}"]`, root);
  const progress = qs('[data-task-progress]', task);
  task.dataset.running = 'false';
  task.style.setProperty('--task-duration', `${duration}ms`);
  progress.style.animation = 'none';
  void progress.offsetWidth;
  progress.style.removeProperty('animation');
  progress.addEventListener('animationend', () => {
    if (token !== renderToken) return;
    task.dataset.running = 'false';
    onComplete();
  }, { once: true });
  task.dataset.running = 'true';
}

function clearVisuals() {
  setStepLocked(false);
  qsa('[data-task]', root).forEach((task) => {
    task.dataset.state = '';
    task.dataset.running = 'false';
    task.dataset.visible = task.dataset.task === 'seed' ? 'true' : 'false';
    task.style.removeProperty('--task-duration');
    const progress = qs('[data-task-progress]', task);
    progress.style.animation = 'none';
    setText('[data-task-owner]', ownerDefaults[task.dataset.task], task);
  });
  qsa('[data-path]', root).forEach((path) => { path.dataset.state = ''; });
  [ada, lin, mira].forEach((name, index) => setWorker(index, 'idle', '空闲'));
  setState('[data-lead]');
  setText('[data-lead-state]', '等待图变更', root);
  setState('[data-scene-state]');
  setText('[data-scene-state]', '等待建立初始任务图', root);
}

function showAcceptedGraph() {
  revealDynamicTasks();
  setTask('seed', 'done', `${ada} · 完成`);
  setTask('budget', 'ready', '可领取');
  setTask('schedule', 'ready', '可领取');
  setTask('risk', 'ready', '可领取');
  setTask('report', '', '等待三项任务');
  setPaths(branchPaths, 'done');
  setPaths(resultPaths, 'pending');
  setPath('merge-report', 'pending');
  setState('[data-lead]', 'accepted');
  setText('[data-lead-state]', '无环 · 已合并', root);
}

function showCompletedAnalyses() {
  analyses.forEach(({ id, worker, agent, path }) => {
    const duration = run.durations[id];
    setTask(id, 'done', `${agent} · ${(duration / 1000).toFixed(2)}s`);
    setWorker(worker, 'idle', '空闲');
    setPath(path, 'done');
  });
  setTask('report', 'ready', '依赖完成 · 可领取');
  setPath('merge-report', 'done');
}

function runParallelAnalyses(token) {
  setStepLocked(true);
  const remaining = new Set(analyses.map(({ id }) => id));
  analyses.forEach(({ id, worker, agent, task, path, claim }) => {
    const duration = run.durations[id];
    setTask(id, 'claimed', `${agent} · 执行中`);
    setWorker(worker, 'active', task);
    setPath(claim, 'active');
    startProgress(id, duration, token, () => {
      remaining.delete(id);
      setTask(id, 'done', `${agent} · ${(duration / 1000).toFixed(2)}s`);
      setWorker(worker, 'idle', '空闲');
      setPath(path, 'done');
      const waiting = analyses.filter((analysis) => remaining.has(analysis.id)).map((analysis) => analysis.agent);
      if (waiting.length) {
        setTask('report', '', `等待 ${waiting.join('、')}`);
        setSceneStatus(`${agent} 完成 ${task} · 仍等待 ${waiting.join('、')}`);
        return;
      }
      setTask('report', 'ready', '依赖完成 · 可领取');
      setPath('merge-report', 'active');
      setSceneStatus('三个并行任务全部完成 · 周报节点已解锁');
      setStepLocked(false);
    });
  });
}

function render(step) {
  const token = ++renderToken;
  clearVisuals();
  if (!step) return;
  setSceneStatus(step.status, step.mode === 'discover' ? 'review' : 'active');

  if (reached(step.mode, 'ready')) setTask('seed', 'ready', '可领取');

  if (step.mode === 'seed-claim') {
    setTask('seed', 'claimed', `${ada} · 读取中`);
    setWorker(0, 'active', '阅读本周资料');
    setPath('claim-seed', 'active');
    setStepLocked(true);
    startProgress('seed', run.seedDuration, token, () => {
      setTask('seed', 'done', `${ada} · ${(run.seedDuration / 1000).toFixed(2)}s`);
      setWorker(0, 'idle', '空闲');
      setSceneStatus(`${ada} 已读完资料 · 发现计划外工作`);
      setStepLocked(false);
    });
  } else if (reached(step.mode, 'discover')) {
    setTask('seed', 'done', `${ada} · ${(run.seedDuration / 1000).toFixed(2)}s`);
  }

  if (reached(step.mode, 'discover')) {
    revealDynamicTasks();
    if (step.mode === 'discover') {
      dynamicTasks.forEach((id) => setTask(id, 'review', `${ada} Discover · 待审核`));
      setPaths(allDependencyPaths, 'review');
      setWorker(0, 'active', '发布 4 个新节点');
      setState('[data-lead]', 'review');
      setText('[data-lead-state]', '检查依赖与环', root);
    }
  }

  if (reached(step.mode, 'accept')) showAcceptedGraph();

  if (step.mode === 'parallel-run') runParallelAnalyses(token);
  else if (reached(step.mode, 'report-claim')) showCompletedAnalyses();

  if (step.mode === 'report-claim') {
    setTask('report', 'claimed', `${lin} · 执行中`);
    setWorker(1, 'active', '生成项目周报');
    setPath('claim-report', 'active');
    setStepLocked(true);
    startProgress('report', run.reportDuration, token, () => {
      setTask('report', 'done', `${lin} · ${(run.reportDuration / 1000).toFixed(2)}s`);
      setWorker(1, 'idle', '空闲');
      setText('[data-lead-state]', '任务图已完成', root);
      setSceneStatus('项目周报整理完成');
      setStepLocked(false);
    });
  }
}

makeStepper({ root, steps, render, onReset: buildRun, delay: 1250 });
