import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const expected = [
  'index.html',
  ...Array.from({ length: 8 }, (_, index) => `algorithms/${String(index + 1).padStart(2, '0')}-${[
    'held-draft', 'ticket-sequencer', 'coagent', 'latte', 'syncplan', 'atomix', 'cordon', 'tracefix',
  ][index]}.html`),
];
const errors = [];

for (const relative of expected) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    errors.push(`Missing required page: ${relative}`);
    continue;
  }
  const html = fs.readFileSync(absolute, 'utf8');
  const required = [
    ['Chinese document language', /<html[^>]+lang="zh-CN"/],
    ['viewport meta', /<meta[^>]+name="viewport"/],
    ['skip link', /class="skip-link"/],
    ['single main landmark', /<main\b/],
    ['page heading', /<h1\b/],
    ['page title', /<title>[^<]+<\/title>/],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(html)) errors.push(`${relative}: missing ${label}`);
  }
  if (/<\w+[^>]+tabindex="[1-9]/.test(html)) errors.push(`${relative}: positive tabindex is not allowed`);

  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const link = match[1];
    if (/^(?:https?:|mailto:|data:)/.test(link)) continue;
    const target = path.resolve(path.dirname(absolute), link.split('?')[0]);
    if (!fs.existsSync(target)) errors.push(`${relative}: broken local reference ${link}`);
  }
}

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!/<title>awesome-agent-concurrency<\/title>/.test(indexHtml)) errors.push('index.html: browser title must use the repository name');
if (/navigator-label|Canvas index/i.test(indexHtml)) errors.push('index.html: navigator must not render a redundant heading');
if (!/data-navigator-toggle[^>]+aria-controls="canvas-index"[^>]+aria-expanded="true"[^>]+aria-label="收起算法导航"/.test(indexHtml)) {
  errors.push('index.html: navigator collapse control must expose its target, state, and accessible name');
}
if ((indexHtml.match(/data-canvas-node=/g) ?? []).length !== 8) errors.push('index.html: expected 8 canvas locations');
if ((indexHtml.match(/data-demo-slot=/g) ?? []).length !== 8) errors.push('index.html: expected 8 embedded algorithm demos');
if (/href="algorithms\//.test(indexHtml)) errors.push('index.html: algorithm demos must stay inside the canvas');
const githubControl = indexHtml.match(/<a class="canvas-github"[\s\S]*?<\/a>/)?.[0] ?? '';
if (!/<svg\b/.test(githubControl) || !/aria-label="[^"]*GitHub[^"]*"/.test(githubControl)) errors.push('index.html: GitHub control must be an icon-only accessible link');
if (/">\s*GitHub\s*</.test(githubControl)) errors.push('index.html: GitHub control must not render a text label');

const css = fs.readFileSync(path.join(root, 'assets/site.css'), 'utf8');
if (/transition\s*:\s*all\b/.test(css)) errors.push('site.css: transition: all is not allowed');
if (!css.includes(':focus-visible')) errors.push('site.css: missing visible keyboard focus');
if (!css.includes('prefers-reduced-motion')) errors.push('site.css: missing reduced-motion support');

const siteJs = fs.readFileSync(path.join(root, 'assets/site.js'), 'utf8');
const indexJs = fs.readFileSync(path.join(root, 'assets/index.js'), 'utf8');
if (!siteJs.includes("typeof steps === 'function'")) errors.push('site.js: stepper must support dynamic step sequences');
if (!/navigator\.dataset\.collapsed/.test(indexJs) || !/aria-expanded/.test(indexJs) || !/navigatorInset/.test(indexJs)) {
  errors.push('assets/index.js: navigator collapse must update accessibility state and camera inset');
}
const heldDraftJs = fs.readFileSync(path.join(root, 'assets/demos/held-draft.js'), 'utf8');
if (!/function buildSteps\(\)/.test(heldDraftJs) || !/timeline\s*=\s*buildSteps\(\)/.test(heldDraftJs)) {
  errors.push('assets/demos/held-draft.js: reset must rebuild the randomized Agent timeline');
}
if (!/crypto\.getRandomValues/.test(heldDraftJs) || !/animationend/.test(heldDraftJs)) {
  errors.push('assets/demos/held-draft.js: winner selection must follow randomized continuous completion times');
}
if (/data-decisions/.test(heldDraftJs) || /本轨迹检查/.test(fs.readFileSync(path.join(root, 'algorithms/01-held-draft.html'), 'utf8'))) {
  errors.push('Held Draft freshness checks must use direct interface terminology');
}
if (/data-target-sequence/.test(heldDraftJs) || /data-target-sequence/.test(fs.readFileSync(path.join(root, 'algorithms/01-held-draft.html'), 'utf8'))) {
  errors.push('Held Draft must express target positions and room commits in one sequence');
}
const heldDraftHtml = fs.readFileSync(path.join(root, 'algorithms/01-held-draft.html'), 'utf8');
if (!/paint-bucket-fill/.test(heldDraftHtml) || /number-cell\[data-state="commit"\][^{]*\{[^}]*border-style:\s*solid/.test(heldDraftHtml)) {
  errors.push('Held Draft commits must use fill animation instead of a solid border');
}
if (!/房间版本<\/span><strong data-room-version>0/.test(heldDraftHtml) || />v₀<\/span>/.test(heldDraftHtml)) {
  errors.push('Held Draft room version must use an explicit label instead of a bare v-number');
}
const agentNamesJs = fs.readFileSync(path.join(root, 'assets/agents.js'), 'utf8');
if ((agentNamesJs.match(/'[^']+'/g) ?? []).length !== 8) errors.push('assets/agents.js: expected 8 named Agents');
if (/String\.fromCharCode/.test(heldDraftJs) || /String\.fromCharCode/.test(fs.readFileSync(path.join(root, 'assets/demos/ticket-sequencer.js'), 'utf8'))) {
  errors.push('Agent interfaces must use names rather than alphabetic placeholders');
}
const sequencerJs = fs.readFileSync(path.join(root, 'assets/demos/ticket-sequencer.js'), 'utf8');
if (!/function buildSteps\(\)/.test(sequencerJs) || !/timeline\s*=\s*buildSteps\(\)/.test(sequencerJs) || !/steps:\s*\(\)\s*=>\s*timeline/.test(sequencerJs)) {
  errors.push('assets/demos/ticket-sequencer.js: reset must rebuild its Agent-dependent timeline');
}
if (!/crypto\.getRandomValues/.test(sequencerJs) || !/animationend/.test(sequencerJs)) {
  errors.push('assets/demos/ticket-sequencer.js: allocation and compute order must follow continuous randomized timings');
}
if (!/ready\.has\(frontier\)/.test(sequencerJs) || !/drainContiguousPrefix/.test(sequencerJs)) {
  errors.push('assets/demos/ticket-sequencer.js: publication must drain only the contiguous ready prefix');
}
const sequencerHtml = fs.readFileSync(path.join(root, 'algorithms/02-ticket-sequencer.html'), 'utf8');
if (/class="allocator"|class="slot-row"|class="release-line"/.test(sequencerHtml)) {
  errors.push('Ticket / Sequencer must use the unified ordered lane instead of disconnected allocator and slot diagrams');
}
if (!/检查部署变更/.test(sequencerJs) || !/等待前序/.test(sequencerJs) || !/CONTEXT_RESULTS/.test(sequencerJs) || !/主 Agent 上下文/.test(sequencerHtml)) {
  errors.push('Ticket / Sequencer must demonstrate deterministic sub-Agent result aggregation into the main Agent context');
}
if (!/appendReturn/.test(sequencerJs) || !/data-return-order/.test(sequencerHtml)) {
  errors.push('Ticket / Sequencer must expose the actual sub-Agent completion order');
}

const redesignedDemos = {
  coagent: {
    html: fs.readFileSync(path.join(root, 'algorithms/03-coagent.html'), 'utf8'),
    js: fs.readFileSync(path.join(root, 'assets/demos/coagent.js'), 'utf8'),
  },
  latte: {
    html: fs.readFileSync(path.join(root, 'algorithms/04-latte.html'), 'utf8'),
    js: fs.readFileSync(path.join(root, 'assets/demos/latte.js'), 'utf8'),
  },
  syncplan: {
    html: fs.readFileSync(path.join(root, 'algorithms/05-syncplan.html'), 'utf8'),
    js: fs.readFileSync(path.join(root, 'assets/demos/syncplan.js'), 'utf8'),
  },
  atomix: {
    html: fs.readFileSync(path.join(root, 'algorithms/06-atomix.html'), 'utf8'),
    js: fs.readFileSync(path.join(root, 'assets/demos/atomix.js'), 'utf8'),
  },
  cordon: {
    html: fs.readFileSync(path.join(root, 'algorithms/07-cordon.html'), 'utf8'),
    js: fs.readFileSync(path.join(root, 'assets/demos/cordon.js'), 'utf8'),
  },
  tracefix: {
    html: fs.readFileSync(path.join(root, 'algorithms/08-tracefix.html'), 'utf8'),
    js: fs.readFileSync(path.join(root, 'assets/demos/tracefix.js'), 'utf8'),
  },
};
if (!/class="coagent-scene"/.test(redesignedDemos.coagent.html) || !/data-edge="lin-read"/.test(redesignedDemos.coagent.html)
  || !/data-edge="parser-current"/.test(redesignedDemos.coagent.html) || !/data-edge="test-used"/.test(redesignedDemos.coagent.html)
  || !/data-edge="notify"/.test(redesignedDemos.coagent.html) || !/data-conflict-engine/.test(redesignedDemos.coagent.html)
  || (redesignedDemos.coagent.html.match(/marker-end="url\(#coagent-arrow\)"/g) ?? []).length !== 8
  || !/data-artifact="test"/.test(redesignedDemos.coagent.html) || !/data-artifact="docs"/.test(redesignedDemos.coagent.html)
  || !/R\(\$\{lin\}\)=\{parser\.py\}/.test(redesignedDemos.coagent.js) || !/W\(\$\{ada\}\)=\{parser\.py\}/.test(redesignedDemos.coagent.js)
  || !/要求.*重做/.test(redesignedDemos.coagent.js) || !/不接收通知/.test(redesignedDemos.coagent.js) || !/migration\.md 保留/.test(redesignedDemos.coagent.js)) {
  errors.push('CoAgent must derive selective repair from runtime-recorded tool footprints instead of a predeclared task dependency');
}
if (!/class="latte-scene"/.test(redesignedDemos.latte.html) || (redesignedDemos.latte.html.match(/class="dynamic-edge"/g) ?? []).length !== 8
  || !/data-path="discover-trunk"/.test(redesignedDemos.latte.html) || !/data-path="merge-report"/.test(redesignedDemos.latte.html)
  || (redesignedDemos.latte.html.match(/class="claim-edge"/g) ?? []).length !== 5
  || (redesignedDemos.latte.html.match(/<i data-task-progress/g) ?? []).length !== 5
  || !/data-path="claim-seed"/.test(redesignedDemos.latte.html) || !/data-path="claim-report"/.test(redesignedDemos.latte.html)
  || !/data-task="seed"/.test(redesignedDemos.latte.html) || !/data-task="report"/.test(redesignedDemos.latte.html) || !/data-lead/.test(redesignedDemos.latte.html)
  || /dag-area|frontier-strip|worker-strip/.test(redesignedDemos.latte.html)
  || !/data-task-owner/.test(redesignedDemos.latte.html) || !/budget\.xlsx/.test(redesignedDemos.latte.html)
  || !/阅读本周资料/.test(redesignedDemos.latte.html) || !/生成项目周报/.test(redesignedDemos.latte.html)
  || !/连续调用 Discover/.test(redesignedDemos.latte.js) || !/保持无环/.test(redesignedDemos.latte.js)
  || !/三项办公任务同时进入 frontier/.test(redesignedDemos.latte.js) || !/claim 已解锁的周报节点/.test(redesignedDemos.latte.js)
  || !/setPath\('claim-seed', 'active'\)/.test(redesignedDemos.latte.js)
  || !/function runParallelAnalyses\(token\)/.test(redesignedDemos.latte.js)
  || !/analyses\.forEach\(\(\{ id, worker, agent, task, path, claim \}\) =>/.test(redesignedDemos.latte.js)
  || !/setPath\(claim, 'active'\)/.test(redesignedDemos.latte.js)
  || !/remaining = new Set/.test(redesignedDemos.latte.js) || !/if \(waiting\.length\)/.test(redesignedDemos.latte.js)
  || !/crypto\.getRandomValues/.test(redesignedDemos.latte.js) || !/animationend/.test(redesignedDemos.latte.js)
  || /mode: '(?:budget|schedule|risk)-claim'/.test(redesignedDemos.latte.js)
  || !/setPath\('claim-report', 'active'\)/.test(redesignedDemos.latte.js)) {
  errors.push('LATTE must expose task ownership and review a dynamically proposed graph node before scheduling it');
}
if (!/class="sync-scene"/.test(redesignedDemos.syncplan.html)
  || (redesignedDemos.syncplan.html.match(/<i data-sync-progress/g) ?? []).length !== 5
  || !/data-sync-path="wait-image"/.test(redesignedDemos.syncplan.html)
  || !/data-sync-path="test-barrier"/.test(redesignedDemos.syncplan.html)
  || !/data-sync-path="policy-barrier"/.test(redesignedDemos.syncplan.html)
  || !/data-sync-path="detector-impact"/.test(redesignedDemos.syncplan.html)
  || !/data-sync-path="deadlock-a-b"/.test(redesignedDemos.syncplan.html)
  || !/data-sync-path="deadlock-b-a"/.test(redesignedDemos.syncplan.html)
  || /timeline-board|runtime-primitives|action-block/.test(redesignedDemos.syncplan.html)
  || !/Wait_agents/.test(redesignedDemos.syncplan.js)
  || !/crypto\.getRandomValues/.test(redesignedDemos.syncplan.js) || !/animationend/.test(redesignedDemos.syncplan.js)
  || !/setPath\('wait-image', 'active'\)/.test(redesignedDemos.syncplan.js)
  || !/setPath\('detector-impact', 'stale'\)/.test(redesignedDemos.syncplan.js)
  || !/setPath\('deadlock-a-b', 'deadlock'\)/.test(redesignedDemos.syncplan.js)
  || !/检测到等待环/.test(redesignedDemos.syncplan.js)) {
  errors.push('SyncPlan must expose its synchronization conditions and reject a cyclic wait plan');
}
if (!/class="atomix-scene"/.test(redesignedDemos.atomix.html)
  || (redesignedDemos.atomix.html.match(/<i data-atomix-progress/g) ?? []).length !== 4
  || !/data-atomix-effect="draft"/.test(redesignedDemos.atomix.html)
  || !/data-atomix-effect="hotel"/.test(redesignedDemos.atomix.html)
  || !/data-atomix-effect="payment"/.test(redesignedDemos.atomix.html)
  || !/data-atomix-effect="email"/.test(redesignedDemos.atomix.html)
  || (redesignedDemos.atomix.html.match(/data-resource-frontier=/g) ?? []).length !== 2
  || !/data-atomix-path="compensate-hotel"/.test(redesignedDemos.atomix.html)
  || !/data-atomix-path="compensate-payment"/.test(redesignedDemos.atomix.html)
  || /transaction-flow|effect-stack|class="frontier"/.test(redesignedDemos.atomix.html)
  || !/crypto\.getRandomValues/.test(redesignedDemos.atomix.js) || !/animationend/.test(redesignedDemos.atomix.js)
  || !/调用未执行 · 已缓冲/.test(redesignedDemos.atomix.js)
  || !/已预留 · 可取消/.test(redesignedDemos.atomix.js)
  || !/支付意图已取消/.test(redesignedDemos.atomix.js)
  || !/邮件未发送/.test(redesignedDemos.atomix.js)) {
  errors.push('Atomix must settle one coherent travel transaction and gate irreversible notification until commit');
}
if (!/class="cordon-scene"/.test(redesignedDemos.cordon.html)
  || !/data-cordon-node="ticket"/.test(redesignedDemos.cordon.html)
  || !/data-cordon-node="order"/.test(redesignedDemos.cordon.html)
  || !/data-cordon-node="decision"/.test(redesignedDemos.cordon.html)
  || !/shadow state/.test(redesignedDemos.cordon.html) || !/effect outbox/.test(redesignedDemos.cordon.html)
  || !/data-cordon-check="lineage"/.test(redesignedDemos.cordon.html)
  || !/data-cordon-check="authority"/.test(redesignedDemos.cordon.html)
  || !/data-cordon-check="current"/.test(redesignedDemos.cordon.html)
  || /class="lineage"|validation-grid|settlement-banner/.test(redesignedDemos.cordon.html)
  || !/crypto\.getRandomValues/.test(redesignedDemos.cordon.js) || !/animationend/.test(redesignedDemos.cordon.js)
  || !/订单 #482 已退款/.test(redesignedDemos.cordon.js)
  || !/shadow state 已丢弃/.test(redesignedDemos.cordon.js)
  || !/outbox 已取消 · 未退款/.test(redesignedDemos.cordon.js)
  || !/未执行重复退款/.test(redesignedDemos.cordon.js)) {
  errors.push('Cordon must revalidate live evidence and block a stale authorized action');
}
if (!/class="trace-scene"/.test(redesignedDemos.tracefix.html)
  || (redesignedDemos.tracefix.html.match(/<i data-trace-progress/g) ?? []).length !== 2
  || !/data-trace-path="ada-schema"/.test(redesignedDemos.tracefix.html)
  || !/data-trace-path="lin-migration"/.test(redesignedDemos.tracefix.html)
  || !/data-trace-path="ada-wait-migration"/.test(redesignedDemos.tracefix.html)
  || !/data-trace-path="lin-wait-schema"/.test(redesignedDemos.tracefix.html)
  || !/data-trace-path="lock-order"/.test(redesignedDemos.tracefix.html)
  || /code-panel|model-space|counterexample-trace/.test(redesignedDemos.tracefix.html)
  || !/crypto\.getRandomValues/.test(redesignedDemos.tracefix.js) || !/animationend/.test(redesignedDemos.tracefix.js)
  || !/PlusCal/.test(redesignedDemos.tracefix.js) || !/TLA\+/.test(redesignedDemos.tracefix.js)
  || !/setPath\('ada-wait-migration', 'wait'\)/.test(redesignedDemos.tracefix.js)
  || !/setPath\('lin-wait-schema', 'wait'\)/.test(redesignedDemos.tracefix.js)
  || !/schema\.prisma → migration\.sql/.test(redesignedDemos.tracefix.js)
  || !/有界状态空间内未发现死锁/.test(redesignedDemos.tracefix.js)
  || !/Runtime Monitor/.test(redesignedDemos.tracefix.js)) {
  errors.push('TraceFix must show the conflicting file-lock order, repair it, and state the bounded verification result precisely');
}
const scenarioTitles = ['局部依赖修复', '项目周报整理', '服务发布同步', '差旅副作用结算', '客服退款提交', '共享文件锁验证'];
if (!scenarioTitles.every((title) => indexHtml.includes(`<h2>${title}</h2>`))) {
  errors.push('index.html: redesigned canvas nodes must use concrete scenario titles');
}
if (/data-focus-mode|canvas-frame:not\(\[data-active/.test(`${indexJs}\n${fs.readFileSync(path.join(root, 'assets/canvas.css'), 'utf8')}`)) {
  errors.push('Canvas nodes must be separated spatially instead of hidden outside the active focus');
}
const canvasPositions = [...indexHtml.matchAll(/data-canvas-node="([^"]+)"[^>]+style="--x:\s*(-?\d+)px;\s*--y:\s*(-?\d+)px;\s*--node-width:\s*(\d+)px;\s*--node-height:\s*(\d+)px;/g)]
  .map((match) => ({ id: match[1], x: Number(match[2]), y: Number(match[3]), width: Number(match[4]), height: Number(match[5]) }));
if (canvasPositions.length !== 8) {
  errors.push('index.html: every canvas node must expose numeric bounds');
} else {
  for (let left = 0; left < canvasPositions.length; left += 1) {
    for (let right = left + 1; right < canvasPositions.length; right += 1) {
      const a = canvasPositions[left];
      const b = canvasPositions[right];
      const horizontalGap = Math.abs(a.x - b.x) - Math.max(a.width, b.width);
      const verticalGap = Math.abs(a.y - b.y) - Math.max(a.height, b.height);
      if (horizontalGap < 1200 && verticalGap < 1200) errors.push(`index.html: canvas nodes ${a.id} and ${b.id} are too close`);
    }
  }
}
if (/data-canvas-node="overview"|data-compare-(left|right)|data-jump="overview"/.test(indexHtml)) errors.push('index.html: invalid universal comparison must be absent');
if (/class="node-facts"/.test(indexHtml)) errors.push('index.html: duplicated node fact rows must be absent');
if (/class="node-index"/.test(indexHtml)) errors.push('index.html: canvas headings must not duplicate navigator metadata');
if (/class="step-count"/.test(indexHtml) || expected.slice(1).some((relative) => /class="step-count"/.test(fs.readFileSync(path.join(root, relative), 'utf8')))) {
  errors.push('Algorithm controls must not render redundant step counters');
}
for (const relative of expected.slice(1)) {
  const html = fs.readFileSync(path.join(root, relative), 'utf8');
  if (/class="stage-topbar"|class="phase-rail"|class="progress-track"/.test(html)) errors.push(`${relative}: duplicated stage chrome must be absent`);
  if (/class="range-wrap">Agent 数量/.test(html)) errors.push(`${relative}: range value must share a line with its label`);
}

if (errors.length) {
  console.error(`Validation failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${expected.length} HTML pages and shared accessibility rules.`);
