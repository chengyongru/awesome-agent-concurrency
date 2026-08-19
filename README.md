# Awesome Agent Concurrency

一组可交互、可逐步演算的多 Agent 协作机制演示。页面采用接近 3Blue1Brown / Manim 的深色数学动画语言，但所有图形与交互均由原生 HTML、CSS、SVG 和 JavaScript 实现。

> 这是教学型可视化，不是论文实现或性能复现。涉及的 2026 年论文多数仍为预印本，请以原文为准。

## 打开演示

```bash
npm start
```

然后访问 `http://localhost:4173`。也可以直接打开 `index.html`。

## 演示入口

| 机制 | 交互演示 | 参考资料 |
| --- | --- | --- |
| Held Draft / Global OCC | [打开](algorithms/01-held-draft.html) | [Raft: Is Having Agents in the Room Meant to Be Chaotic?](https://raft.build/resources/blog/is-having-agents-in-the-room-meant-to-be-chaotic/) |
| Ticket / Sequencer | [打开](algorithms/02-ticket-sequencer.html) | 经典原子计数器与确定性排序模式 |
| CoAgent / MTPO | [打开](algorithms/03-coagent.html) | [CoAgent: Concurrency Control for Multi-Agent Systems](https://arxiv.org/abs/2606.15376) |
| LATTE | [打开](algorithms/04-latte.html) | [Improving the Efficiency of Language Agent Teams with Adaptive Task Graphs](https://arxiv.org/abs/2605.06320) |
| SyncPlan | [打开](algorithms/05-syncplan.html) | [SyncPlan: Long-Horizon LLM Coordination with Explicit Synchronization and Adaptive Correction](https://arxiv.org/abs/2608.01652) |
| Atomix | [打开](algorithms/06-atomix.html) | [Atomix: Timely, Transactional Tool Use for Reliable Agentic Workflows](https://arxiv.org/abs/2602.14849) |
| Cordon | [打开](algorithms/07-cordon.html) | [Cordon: Semantic Transactions for Tool-Using LLM Agents](https://arxiv.org/abs/2606.17573) |
| TraceFix | [打开](algorithms/08-tracefix.html) | [TraceFix: Repairing Agent Coordination Protocols with TLA+ Counterexamples](https://arxiv.org/abs/2605.07935) |

## 设计原则

- 每一种机制是独立 HTML 页面，有自动播放、暂停、单步与重置。
- 黄色表示计划，蓝色表示读取或依赖，红色表示冲突或污染，绿色表示已提交。
- 动画不是唯一信息通道：状态、标签和数字会同步更新。
- 支持键盘操作、窄屏重排与 `prefers-reduced-motion`。

## 验证

```bash
npm test
```

验证脚本检查页面结构、本地链接、关键无障碍标记与禁用的 CSS 反模式。

## License

[MIT](LICENSE)
