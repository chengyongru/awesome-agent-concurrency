import { AGENT_NAMES } from '../agents.js';
import { makeStepper, qs, qsa, setText } from '../site.js';

const [ada, lin, mira, noah] = AGENT_NAMES;
const root = qs('[data-demo="syncplan"]');
const deadlockButton = qs('[data-action="deadlock"]', root);
const steps = [
  { mode: 'plan', label: `Coordinator 一次生成 ${ada}、${lin}、${mira} 与 ${noah} 的发布行动链。`, status: '联合计划已生成 · 三条前置链可并行执行' },
  { mode: 'initial-run', label: `${ada} 构建镜像，${lin} 准备测试，${mira} 生成 prod-cn 配置；三条行动链异步推进。`, status: '三个 Agent 正在并行执行前置动作' },
  { mode: 'test-run', label: `${lin} 的 Wait_agents 条件在 ${ada} 发布镜像摘要后满足，回归测试开始。`, status: `${ada} 的里程碑解除 ${lin} 的显式等待` },
  { mode: 'barrier-open', label: `回归测试和配置检查都完成，${noah} 的部署动作才进入可执行状态。`, status: '测试与配置条件均已满足 · 部署已解锁' },
  { mode: 'stale', label: '目标集群在部署前从 prod-cn 改为 prod-sg；计划有效性检测器标记配置后缀与部署动作失效。', status: '环境变化 · 剩余计划部分失效' },
  { mode: 'correct', label: `Coordinator 保留已完成的镜像和测试，只让 ${mira} 重做受影响的 prod-sg 配置。`, status: `${mira} 正在修正受影响的剩余动作` },
  { mode: 'deploy', label: `${noah} 使用已验证镜像、测试结果和 prod-sg 配置完成部署。`, status: '修正后的联合计划执行完成' },
];

const basePaths = ['build-image', 'prepare-test', 'wait-image', 'manifest-policy', 'test-barrier', 'policy-barrier', 'barrier-deploy', 'event-detector'];
const progressNodes = ['build', 'prepare', 'manifest', 'test', 'deploy'];
let run;
let renderToken = 0;
let deadlock = false;

function randomUnit() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x100000000;
}

function randomDuration(minimum, maximum) {
  return Math.round(minimum + randomUnit() * (maximum - minimum));
}

function buildRun() {
  run = {
    initial: {
      build: randomDuration(720, 980),
      prepare: randomDuration(440, 650),
      manifest: randomDuration(560, 820),
    },
    test: randomDuration(650, 900),
    correction: randomDuration(580, 820),
    deploy: randomDuration(520, 760),
  };
}

function setNode(id, state = '', detail) {
  const node = qs(`[data-sync-node="${id}"]`, root);
  node.dataset.state = state;
  if (detail !== undefined) setText('span', detail, node);
}

function setPath(id, state = '') {
  qs(`[data-sync-path="${id}"]`, root).dataset.state = state;
}

function setPaths(ids, state) {
  ids.forEach((id) => setPath(id, state));
}

function setStatus(message, state = 'active') {
  const status = qs('[data-sync-state]', root);
  status.dataset.state = state;
  status.textContent = message;
  setText('[data-status]', message, root);
}

function setStepLocked(locked) {
  qs('[data-action="step"]', root).disabled = locked;
}

function startProgress(id, duration, token, onComplete) {
  const node = qs(`[data-sync-node="${id}"]`, root);
  const bar = qs('[data-sync-progress]', node);
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
  qsa('[data-sync-node]', root).forEach((node) => {
    node.dataset.state = '';
    node.dataset.running = 'false';
    node.dataset.visible = 'true';
    node.style.removeProperty('--task-duration');
    const bar = qs('[data-sync-progress]', node);
    if (bar) bar.style.animation = 'none';
  });
  qsa('[data-sync-path]', root).forEach((path) => { path.dataset.state = ''; });
  setText('[data-manifest-title]', '生成 prod-cn 配置', root);
  setText('[data-target-cluster]', 'prod-cn', root);
  setNode('build', '', ada);
  setNode('image', '', `等待 ${ada}`);
  setNode('prepare', '', lin);
  setNode('test', '', '等待镜像摘要');
  setNode('manifest', '', mira);
  setNode('policy', '', `等待 ${mira}`);
  setNode('deploy', '', `${noah} · 等待测试与配置`);
  setNode('detector', '', '剩余动作有效');
  setStatus('等待生成联合计划', '');
}

function showPlan() {
  setPaths(basePaths.slice(0, 7), 'pending');
  setPath('event-detector', 'pending');
  setNode('build', 'ready', ada);
  setNode('prepare', 'ready', lin);
  setNode('manifest', 'ready', mira);
  setNode('test', 'wait', 'Wait_agents(镜像摘要)');
  setNode('deploy', 'wait', '等待测试与配置');
}

function showInitialDone() {
  showPlan();
  setNode('build', 'done', `${ada} · 完成`);
  setNode('image', 'done', 'sha256:a81f');
  setNode('prepare', 'done', `${lin} · 准备完成`);
  setNode('manifest', 'done', `${mira} · prod-cn`);
  setNode('policy', 'done', 'prod-cn · 检查通过');
  setPath('build-image', 'done');
  setPath('prepare-test', 'done');
  setPath('manifest-policy', 'done');
  setPath('wait-image', 'active');
  setNode('test', 'ready', '镜像摘要已到达');
}

function showTestDone() {
  showInitialDone();
  setNode('test', 'done', `${lin} · 测试通过`);
  setPath('wait-image', 'done');
  setPath('test-barrier', 'done');
  setPath('policy-barrier', 'done');
}

function showCorrected() {
  showTestDone();
  setText('[data-target-cluster]', 'prod-sg', root);
  setText('[data-manifest-title]', '生成 prod-sg 配置', root);
  setNode('manifest', 'done', `${mira} · prod-sg`);
  setNode('policy', 'done', 'prod-sg · 检查通过');
  setNode('event', 'done', 'prod-sg');
  setNode('detector', 'done', '修正后计划有效');
  setPath('event-detector', 'done');
  setPath('detector-impact', 'done');
  setPath('barrier-deploy', 'active');
  setNode('deploy', 'ready', `${noah} · 可执行`);
}

function runInitial(token) {
  showPlan();
  setStepLocked(true);
  const remaining = new Set(['build', 'prepare', 'manifest']);
  const complete = (id) => {
    remaining.delete(id);
    if (id === 'build') {
      setNode('build', 'done', `${ada} · ${(run.initial.build / 1000).toFixed(2)}s`);
      setNode('image', 'done', 'sha256:a81f');
      setPath('build-image', 'active');
      setPath('wait-image', 'active');
      setNode('test', 'ready', '镜像摘要已到达');
    }
    if (id === 'prepare') {
      setNode('prepare', 'done', `${lin} · ${(run.initial.prepare / 1000).toFixed(2)}s`);
      setPath('prepare-test', 'done');
      if (remaining.has('build')) setNode('test', 'wait', `Wait_agents(${ada} · 镜像摘要)`);
    }
    if (id === 'manifest') {
      setNode('manifest', 'done', `${mira} · ${(run.initial.manifest / 1000).toFixed(2)}s`);
      setNode('policy', 'done', 'prod-cn · 检查通过');
      setPath('manifest-policy', 'active');
    }
    if (remaining.size) {
      const names = [...remaining].map((task) => ({ build: ada, prepare: lin, manifest: mira })[task]);
      setStatus(`异步执行中 · 等待 ${names.join('、')}`, 'wait');
      return;
    }
    setStatus('前置动作完成 · Lin 的镜像等待已解除');
    setStepLocked(false);
  };
  ['build', 'prepare', 'manifest'].forEach((id) => {
    setNode(id, 'active', `${({ build: ada, prepare: lin, manifest: mira })[id]} · 执行中`);
    startProgress(id, run.initial[id], token, () => complete(id));
  });
}

function render(step) {
  const token = ++renderToken;
  clear();
  deadlock = false;
  deadlockButton.setAttribute('aria-pressed', 'false');
  deadlockButton.textContent = '模拟循环等待';
  if (!step) return;
  setStatus(step.status, step.mode === 'stale' ? 'stale' : 'active');

  if (step.mode === 'plan') showPlan();
  if (step.mode === 'initial-run') runInitial(token);
  if (step.mode === 'test-run') {
    showInitialDone();
    setStepLocked(true);
    setNode('test', 'active', `${lin} · 执行中`);
    startProgress('test', run.test, token, () => {
      setNode('test', 'done', `${lin} · ${(run.test / 1000).toFixed(2)}s`);
      setPath('wait-image', 'done');
      setPath('test-barrier', 'active');
      setStatus('回归测试通过 · 等待配置汇合');
      setStepLocked(false);
    });
  }
  if (step.mode === 'barrier-open') {
    showTestDone();
    setPath('barrier-deploy', 'active');
    setNode('deploy', 'ready', `${noah} · 可执行`);
  }
  if (step.mode === 'stale') {
    showTestDone();
    setText('[data-target-cluster]', 'prod-sg', root);
    setNode('event', 'stale', 'prod-cn → prod-sg');
    setNode('detector', 'stale', '配置与部署后缀失效');
    setNode('manifest', 'stale', `${mira} · prod-cn`);
    setNode('policy', 'stale', 'prod-cn · 已过期');
    setNode('deploy', 'stale', '目标集群已变化');
    setPath('event-detector', 'stale');
    setPath('detector-impact', 'stale');
    setPath('barrier-deploy', 'stale');
  }
  if (step.mode === 'correct') {
    showTestDone();
    setText('[data-target-cluster]', 'prod-sg', root);
    setText('[data-manifest-title]', '生成 prod-sg 配置', root);
    setNode('event', 'done', 'prod-sg');
    setNode('detector', 'active', '仅重排受影响后缀');
    setNode('manifest', 'active', `${mira} · 修正中`);
    setNode('policy', 'wait', `等待 ${mira}`);
    setPath('event-detector', 'done');
    setPath('detector-impact', 'active');
    setStepLocked(true);
    startProgress('manifest', run.correction, token, () => {
      setNode('manifest', 'done', `${mira} · prod-sg`);
      setNode('policy', 'done', 'prod-sg · 检查通过');
      setNode('detector', 'done', '修正后计划有效');
      setPath('manifest-policy', 'active');
      setPath('barrier-deploy', 'active');
      setNode('deploy', 'ready', `${noah} · 可执行`);
      setStatus('prod-sg 配置完成 · 部署重新解锁');
      setStepLocked(false);
    });
  }
  if (step.mode === 'deploy') {
    showCorrected();
    setNode('deploy', 'active', `${noah} · 部署中`);
    setStepLocked(true);
    startProgress('deploy', run.deploy, token, () => {
      setNode('deploy', 'done', `${noah} · prod-sg 已上线`);
      setPath('barrier-deploy', 'done');
      setStatus('payment-api 已部署到 prod-sg');
      setStepLocked(false);
    });
  }
}

const demo = makeStepper({
  root,
  steps,
  render,
  delay: 1400,
  onReset() {
    buildRun();
    clear();
  },
});

deadlockButton.addEventListener('click', () => {
  deadlock = !deadlock;
  demo.stop();
  clear();
  deadlockButton.setAttribute('aria-pressed', String(deadlock));
  if (!deadlock) {
    deadlockButton.textContent = '模拟循环等待';
    demo.reset();
    return;
  }
  deadlockButton.textContent = '恢复正常计划';
  showPlan();
  setNode('build', 'deadlock', `等待 ${lin} 的测试许可`);
  setNode('test', 'deadlock', `等待 ${ada} 的镜像摘要`);
  setPath('deadlock-a-b', 'deadlock');
  setPath('deadlock-b-a', 'deadlock');
  setStatus(`检测到等待环 ${ada} ↔ ${lin} · 计划被拒绝`, 'deadlock');
});
