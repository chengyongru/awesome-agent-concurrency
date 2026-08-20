# Awesome Agent Concurrency

一组可交互、可逐步演算的多 Agent 协作机制演示。所有机制位于同一张浅色网格画布中，使用原生 HTML、CSS、SVG 和 JavaScript 表达状态转移。

> 这是教学型可视化，不是论文实现或性能复现。涉及的 2026 年论文多数仍为预印本，请以原文为准。

## 打开演示

```bash
npm start
```

然后访问 `http://localhost:4173`。也可以直接打开 `index.html`。

## 演示入口

| 机制 | 画布位置 | 参考资料 |
| --- | --- | --- |
| Held Draft / Global OCC | [定位](index.html#held-draft) | [Raft: Is Having Agents in the Room Meant to Be Chaotic?](https://raft.build/resources/blog/is-having-agents-in-the-room-meant-to-be-chaotic/) |
| Ticket / Sequencer | [定位](index.html#sequencer) | 经典原子计数器与确定性排序模式 |
| CoAgent / MTPO | [定位](index.html#coagent) | [CoAgent: Concurrency Control for Multi-Agent Systems](https://arxiv.org/abs/2606.15376) |
| LATTE | [定位](index.html#latte) | [Improving the Efficiency of Language Agent Teams with Adaptive Task Graphs](https://arxiv.org/abs/2605.06320) |
| SyncPlan | [定位](index.html#syncplan) | [SyncPlan: Long-Horizon LLM Coordination with Explicit Synchronization and Adaptive Correction](https://arxiv.org/abs/2608.01652) |
| Atomix | [定位](index.html#atomix) | [Atomix: Timely, Transactional Tool Use for Reliable Agentic Workflows](https://arxiv.org/abs/2602.14849) |
| Cordon | [定位](index.html#cordon) | [Cordon: Semantic Transactions for Tool-Using LLM Agents](https://arxiv.org/abs/2606.17573) |
| TraceFix | [定位](index.html#tracefix) | [TraceFix: Repairing Agent Coordination Protocols with TLA+ Counterexamples](https://arxiv.org/abs/2605.07935) |

## 设计原则

- 左侧索引将画布精确定位到一个机制；拖动或缩放可恢复全局视图。
- 森林绿表示当前状态或有效状态，红色只表示冲突、反例或中止。
- 每个演示支持播放、暂停、单步与重置；状态、标签和数字与动画同步更新。
- 支持键盘操作、窄屏重排与 `prefers-reduced-motion`。

## 验证

```bash
npm test
```

验证脚本检查页面结构、本地链接、关键无障碍标记与禁用的 CSS 反模式。

## License

[MIT](LICENSE)
