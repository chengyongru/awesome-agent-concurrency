# Awesome Agent Concurrency

[上一次](https://x.com/chengyongru/status/2089289757138575737)我们讨论了 multiagent system（后面我就简写成 mas 了）设计中存在的一些问题。如果还没读过，也没什么影响。anyway，我们继续在这篇文章里聊聊现代 mas 设计中的一些协议和算法。

一是我自己做个总结回顾，希望也能对各位有帮助，所以姑且就用 awesome-xxx 来命名吧🤔

下面这个 live demo，和文章配合起来看, 应该会有助于理解(如果觉得示例不够清晰, 可以点击右上角的github图标跳到仓库提issue)

[click here](https://chengyongru.github.io/awesome-agent-concurrency)

回到正题, `agent concurrency` 目前还不是一个有统一定义的术语, 我们暂且把它定义为：

> 多个 agent 的执行在时间上发生重叠，并且它们会读取或修改同一份可变状态，或者产生外部可见的副作用。

传统程序读取状态和执行写入之间可能只隔了几微秒，但 LLM inference 大概率会持续数秒甚至数分钟, 对于 mas 来说， 这个过程中其他 agent 仍然在改变系统状态，于是，当李华终于写好了给peter的信(没错，事到如今我们仍然在给李华写信)，peter早就搬家了。

position paper *Multi-Agent Systems Should Prioritize Concurrency Control*[^1] 的结论是很多被描述成“沟通失败”或“协作失败”的问题，其实可以更准确地映射为 stale read、lost update、conflicting write 等经典 concurrency anomaly。

| 表面现象                     | 更底层的问题                    |
| ------------------------ | ------------------------- |
| 旧任务的回复进入了新任务             | stale read / stale commit |
| 两个 agent 同时修改同一文件，后者覆盖前者 | lost update               |
| 两个 agent 都认为自己认领了同一任务    | write-write race          |
|  ...   |  ...         |


接下以 raft.build 为例来接着讨论, raft是一个我还挺喜欢的产品，他们的一篇文章 *Is Having Agents in the Room Meant to Be Chaotic?*[^2] 提到：

> Agents don't inhabit the room the way humans do.

人类打字时，如果注意到群里有人发了新消息, 临时改变主意是个很自然的事情, 而现在的通用 agent 基于ReAct loop, 没办法一边这样一边那样

raft 采用了一种叫Held Draft的协议解决这个问题, 流程大致是：

```text
Agent 读取 room version = 17

Agent 开始生成 draft

其他成员继续发送消息
room version = 20

Agent 提交：
draft.base_version = 17

base_version != current_version
-> hold
```

draft 被 hold 后连同推理期间出现的新信息一起返回给 agent, 这样agent 就可以继续推理，做出各种各样的选择。这比依赖 prompt说一句"发送消息之前请重新检查聊天记录"要靠谱得多。

但 Held Draft 的成本也很明显, Raft 使用的报数例子中, 很容易推理得出计算复杂度是n^2级别的,当然这只是对公开协议最坏情况的分析, 此事在[live demo](https://chengyongru.github.io/awesome-agent-concurrency/#held-draft)中亦有记载

held draft之外还有众多的算法用于解决此类问题, 不同的场景有不同的解法, 这里有个表格供大家参考

| 工作结构          | 更适合的机制                                        |
| ------------- | --------------------------------------------- |
| 已知严格全序        | sequencer、ticket、turn token                   |
| 存在明确或可发现的依赖关系 | DAG、ready frontier、work stealing[^3][^4]       |
| 冲突少，重试成本低     | OCC、Held Draft[^2][^5]                         |
| 冲突频繁，资源边界清楚   | lock、lease、ownership                          |
| 冲突频繁，但可以局部修复  | dependency-aware notification、targeted repair[^6] |
| 更新可交换或单调增长    | CRDT、CALM、coordination avoidance[^7][^8]       |
| 包含不可逆副作用      | prepare、validate、commit gate[^9][^10]          |
| 多种工作混合        | adaptive protocol selection                   |
| 协调协议本身        | TLA+、model checking、runtime monitor[^11]       |


突然发现已经写了这么长了, 就学到这里吧🤔💖

## 参考文献

[^1]: [Position: Multi-Agent Systems Should Prioritize Concurrency Control](https://arxiv.org/abs/2608.18092)
[^2]: [Is Having Agents in the Room Meant to Be Chaotic?](https://raft.build/resources/blog/is-having-agents-in-the-room-meant-to-be-chaotic/)
[^3]: [Improving the Efficiency of Language Agent Teams with Adaptive Task Graphs](https://arxiv.org/abs/2605.06320)
[^4]: [SyncPlan: Long-Horizon LLM Coordination with Explicit Synchronization and Adaptive Correction](https://arxiv.org/abs/2608.01652)
[^5]: [On Optimistic Methods for Concurrency Control](https://dl.acm.org/doi/10.1145/319566.319567)
[^6]: [CoAgent: Concurrency Control for Multi-Agent Systems](https://arxiv.org/abs/2606.15376)
[^7]: [Conflict-free Replicated Data Types](https://arxiv.org/abs/1805.06358)
[^8]: [Keeping CALM: When Distributed Consistency Is Easy](https://arxiv.org/abs/1901.01930)
[^9]: [Atomix: Timely, Transactional Tool Use for Reliable Agentic Workflows](https://arxiv.org/abs/2602.14849)
[^10]: [Cordon: Semantic Transactions for Tool-Using LLM Agents](https://arxiv.org/abs/2606.17573)
[^11]: [TraceFix: Repairing Agent Coordination Protocols with TLA+ Counterexamples](https://arxiv.org/abs/2605.07935)
