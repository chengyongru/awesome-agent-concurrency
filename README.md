# Awesome Agent Concurrency

[上一次](https://x.com/chengyongru/status/2089289757138575737)我们讨论了 multiagent system（后面我就简写成 mas 了）设计中存在的一些问题。如果还没读过，也应该没什么影响。anyway，我们继续在这篇文章里讨论一下现代 mas 设计中的一些协议和算法。

其实只是我自己做个总结回顾，希望也能对大家有帮助，所以姑且就用 awesome-xxx 来命名吧🤔

我还准备了一个 live demo，可以和文章配合起来看， 希望能有所帮助

[click here](https://chengyongru.github.io/awesome-agent-concurrency)

其实`agent concurrency` 目前还不是一个有统一定义的术语, 我们暂且把它定义为：

> 多个 agent 的执行在时间上发生重叠，并且它们会读取或修改同一份可变状态，或者产生外部可见的副作用。

这份共享状态可以是：

```text
一个 Git repository
一个共享 workspace
一份 task graph
一个聊天房间
一组 Kubernetes resources
一个浏览器 session
一个游戏世界
一份长期 memory
```

副作用则可能是：

```text
修改文件
发送消息
发邮件
提交代码
部署服务
创建订单
操作数据库
调用真实世界中的设备
```

只要多个 agent 会在没有完整全局视图的情况下，对这些对象并发地观察和行动，我们就进入了 concurrency control 的问题域。

一个典型的 agent 执行过程大概长这样：

```text
read snapshot S_v
→ LLM inference
→ propose action
→ validate
→ commit
```

传统程序读取状态和执行写入之间可能只隔了几微秒，但 LLM inference 可能持续数秒甚至数分钟。对于mas 来说， 这个过程中其他 agent 仍然在改变系统状态，于是，当李华终于写好了给peter的信(没错，事到如今我们仍然在给李华写信)，peter早就搬家了。

position paper [Multi-Agent Systems Should Prioritize Concurrency Control](https://arxiv.org/abs/2608.18092) 正是在强调这一点：很多被描述成“沟通失败”或“协作失败”的问题，其实可以更准确地映射为 stale read、lost update、conflicting write 等经典 concurrency anomaly。

例如：

| 表面现象                     | 更底层的问题                    |
| ------------------------ | ------------------------- |
| 旧任务的回复进入了新任务             | stale read / stale commit |
| 两个 agent 同时修改同一文件，后者覆盖前者 | lost update               |
| 两个 agent 都认为自己认领了同一任务    | write-write race          |
| 所有 agent 都在等待其他 agent    | deadlock                  |
| retry 后发送了两封相同邮件         | duplicate external effect |
| Agent 使用旧审批执行了已经变化的新操作   | stale authorization       |
| agent 完成推理时环境已变化         | validation failure        |
| 多个 agent 对“任务已完成”得出不同结论  | inconsistent termination  |


raft.build是一个我很喜欢的产品，他们的一篇文章 [Is Having Agents in the Room Meant to Be Chaotic?](https://raft.build/resources/blog/is-having-agents-in-the-room-meant-to-be-chaotic/) 中提出了一个很有意思的观察：

> Agents don't inhabit the room the way humans do.

人类可以一边打字，一边注意到群里有人发了新消息, 所以在准备发言时临时改变主意是个很自然的事情。

而agent 的工作方式则更接近：

```text
读取房间快照
→ 开始推理
→ 生成回复
→ 几秒或几分钟后提交消息
```

raft 为了解决这个消息可能已经过时的问题，采用了一种叫Held Draft的协议，它的流程大致是：

```text
Agent 读取 room version = 17

Agent 开始生成 draft

其他成员继续发送消息
room version = 20

Agent 提交：
draft.base_version = 17

base_version != current_version
→ hold
```

draft 被 hold 后不会直接丢失，而是连同推理期间出现的新信息一起返回给 agent。agent 就可以继续推理，做出各种各样的选择。

Raft 还将收消息设计成 pull-based inbox：新的 signal 不直接全部灌入工作上下文，而是先成为可查询的 inbox item，由 agent 判断哪些内容值得进入 context。

Held Draft 聪明的地方在于，它把两个问题拆开了：

```text
runtime：
房间是否发生了变化？

agent：
这种变化是否让我的内容失效？
```

前者是确定性的，可以由系统检查。

后者是语义问题，通常需要 agent 自己判断。

这比完全依赖 prompt：

```text
发送消息之前请重新检查聊天记录。
```

要可靠得多。

## Held Draft 本质上是什么？

如果从数据库角度看，Held Draft 很像一个作用在消息提交边界上的 **optimistic concurrency control，OCC**。

OCC 的基本思想不是提前把资源锁住，而是：

```text
先读取
→ 乐观地继续计算
→ 提交时检查读取期间有没有发生冲突
→ 无冲突则提交
→ 有冲突则重试或放弃
```

经典 OCC 工作可以追溯到 Kung 和 Robinson 1981 年的 [On Optimistic Methods for Concurrency Control](https://dl.acm.org/doi/10.1145/319566.319567)。

Held Draft 做的正是：

```text
read room version
→ expensive inference
→ validate room version
→ commit or reconsider
```

当然，它并不是传统数据库 transaction 的完整实现。它没有自动判断两个 draft 在语义上是否冲突，也没有保证多个 tool effect 的 atomicity。

更准确地说：

> Held Draft 是一个位于消息 commit boundary 的 freshness check。

另外，这个方向也不是完全凭空出现的。

早在实时协作软件和 groupware 的研究中，人们就在讨论：多个参与者并发修改共享对象时，locking、serialization 和 optimistic coordination 会怎样影响系统行为与用户体验。Ellis 和 Gibbs 1989 年的 [Concurrency Control in Groupware Systems](https://dl.acm.org/doi/10.1145/67544.66963) 就已经在研究共享工作空间中的并发操作；后续研究还进一步指出，groupware 的 concurrency control 不只是后端正确性问题，它会直接改变参与者对协作过程的感知。

Raft 真正做得比较好的地方，是把这个问题重新放到了 turn-based agent 的执行模型中。

## 但 Held Draft 的成本也很明显

回到 Raft 官方使用的“从 1 数到 20”的例子。

假设三个 agent 同时读到：

```text
room version = 0
current number = 0
```

它们都会生成：

```text
1
```

Agent A 先提交：

```text
A → 1
room version = 1
```

B 和 C 的 draft 过期，被 hold。

然后 B、C 重新判断：

```text
B → 2
C → 2
```

B 先提交后，C 再次过期。

最终总共需要的判断次数是：

```text
第一个数字：3 个 agent 判断
第二个数字：2 个 agent 判断
第三个数字：1 个 agent 判断
```

也就是：

[
3 + 2 + 1 = 6
]

推广到 (n) 个 agent，在所有 agent 每一轮都同时竞争、每次只有一个成功的最坏协议模型下，总判断或提交尝试次数是：

[
n+(n-1)+\cdots+1=\frac{n(n+1)}{2}
]

额外重试次数则是：

[
\frac{n(n-1)}{2}
]

20 个 agent 最坏可能产生：

[
210
]

次判断或提交尝试，而不是 20 次。

不过，这里必须说清楚：

> 这是对公开协议的最坏情况分析，不代表 Raft 实际会执行 210 次完整 LLM inference。

agent 在 draft 被 hold 后也可以直接 `stay silent`、`send as-is`，Raft 也可能在实现中合并唤醒或复用 context。官方没有公开足够细节，让我们精确计算真实 token 成本。

但协议层面的退化是存在的：

```text
optimistic retry
+
thundering herd
+
coarse room version
```

还有一个可能的问题。

Raft 的公开描述使用的是 room version。如果这个 version 真的是整个房间的单一版本号，那么房间里任何变化都可能触发 hold：

```text
另一个无关 task 更新
一个 emoji
一条不相关 thread 消息
```

即使这些变化完全不影响当前 draft，agent 也需要重新判断。

这是根据公开设计做出的推论，不是对 Raft 内部实现的确认。但它说明了一个普遍问题：

> conflict detection 的粒度越粗，误报越多；粒度越细，系统需要维护的 dependency metadata 越复杂。

Raft 自己也明确承认，Inbox 和 Held Draft 只是两个具体设计，ownership、coordination 和 real-time awareness 仍然是开放问题。

所以 Held Draft 更适合被理解为：

> 一个很好的 stale-action safety valve，但不是通用调度算法，更不是 transaction protocol。

## 那有没有比 Held Draft 更高级的算法？

有很多。

但不存在一个在所有场景中都更高级的算法。

并发控制的核心，从来不是找到一个万能协议，而是先判断任务具有什么结构：

| 工作结构          | 更适合的机制                                        |
| ------------- | --------------------------------------------- |
| 已知严格全序        | sequencer、ticket、turn token                   |
| 存在明确或可发现的依赖关系 | DAG、ready frontier、work stealing              |
| 冲突少，重试成本低     | OCC、Held Draft                                |
| 冲突频繁，资源边界清楚   | lock、lease、ownership                          |
| 冲突频繁，但可以局部修复  | dependency-aware notification、targeted repair |
| 更新可交换或单调增长    | CRDT、CALM、coordination avoidance              |
| 包含不可逆副作用      | prepare、validate、commit gate                  |
| 多种工作混合        | adaptive protocol selection                   |

在选择协议前，至少应该先问三个问题：

```text
1. 这些操作可以交换顺序吗？

2. 副作用可以被暂存、撤销或补偿吗？

3. 系统能否较低成本地描述 read/write/dependency scope？
```

很多所谓的“高级算法”，只是利用了任务本身的某种结构。

## 从 1 数到 n：根本不应该让 LLM 竞争

从 1 数到 (n) 是一个顺序已经完全确定的问题。

最简单的做法是给每个 agent 分配一个 ticket：

```python
slot = atomic_fetch_add(next_slot, 1)
```

然后：

```text
Agent A 得到 slot = 1
Agent B 得到 slot = 2
Agent C 得到 slot = 3
```

如果输出内容就是数字，甚至根本不需要调用 LLM。

如果每个 slot 要生成复杂内容，也可以：

```text
A 并行生成 slot 1
B 并行生成 slot 2
C 并行生成 slot 3

服务器按照：
1 → 2 → 3
依次 release
```

这里区分了两件事：

```text
compute 可以并行
commit 可以有序
```

复杂度从 Held Draft 最坏的 (O(n^2)) 尝试，下降到 (O(n)) 的 ticket 分配和发布。

也可以使用 turn token：

```text
runtime → A：轮到你
A → runtime：完成，把 token 给 B
runtime → B：轮到你
```

这种方式不会浪费推理，但 wall-clock 完全串行。

所以我们总是在交换成本：

```text
先调度
→ 少浪费计算，但可能降低并行度

先并行猜测
→ 提高潜在并行度，但需要验证和修复
```

如果第 (i) 步在语义上真的依赖第 (i-1) 步的结果，那么它本来就存在长度为 (n) 的 serial critical path。

任何算法都无法凭空消除因果依赖。

真正能优化的是：

```text
不要让所有 agent 在每个顺序点上一起猜。
```

## LATTE：不要在房间变化时唤醒所有 agent

[Improving the Efficiency of Language Agent Teams with Adaptive Task Graphs](https://arxiv.org/abs/2605.06320) 提出了 LATTE，也就是 Language Agent Teams for Task Evolution。

它没有让所有 agent 一直盯着同一个聊天房间，而是维护一张动态 task DAG：

```text
Task A ──→ Task C
Task B ──→ Task C

Task D 与它们无关
```

其中：

```text
node
= subtask

edge
= completion dependency

status
= pending / assigned / in_progress / done / verified
```

LATTE 定义了一个 frontier：

```text
frontier
= 当前所有依赖都已满足、可以立即执行的 pending task
```

例如：

```text
A done
B done

A ──┐
    ├──→ C
B ──┘

那么 C 进入 frontier
```

空闲 worker 只需要从 frontier 中 claim 工作，而不是每次全局状态发生变化时都重新思考：

```text
我现在是不是应该做点什么？
```

LATTE 提供了几个显式 graph operator：

```text
Discover
发现新任务

Assign
Lead 分配任务

Claim
Worker 主动认领 frontier task

Complete
Worker 声明本地工作完成

Release
释放卡住的任务

Close
强制关闭任务

Verify
触发额外验证
```

多个 worker 同时 claim 同一 task 时，由 orchestrator 串行决定谁成功。

所以 LATTE 并不是一个完全去中心化的系统。它采用的是 hybrid coordination：

```text
Worker：
根据局部执行发现任务、认领任务、提出更新

Lead：
审核会影响全局 task graph 的结构变化

Orchestrator：
保证 graph mutation 和 task claim 的一致性
```

这种设计的关键不是“用了图”，而是：

> 只有当一个 agent 真正拥有 ready work 时，系统才 dispatch 它。

在论文的 300 次实验中，LATTE 报告的聚合准确率为 80%，Leader–Worker 为 70%，完全去中心化团队为 74%；聚合 token 使用量分别约为 148K、379K 和 419K，wall-clock 则约为 3.5、5.9 和 3.7 分钟。实验覆盖三类任务、两种基础模型和五种协作结构，但这些任务规模仍然有限，结果不能直接外推到开放式生产环境。论文已经公开了 [LATTE 的代码](https://github.com/emieczkowski/latte)。

LATTE 给出的启发是：

```text
Held Draft：
所有人都可以先行动，冲突以后再重试

LATTE：
先暴露当前可以安全并行的工作，只调度相关 agent
```

它从源头减少了不必要的 agent invocation。

## SyncPlan：把“等一下”变成 runtime primitive

自然语言里经常出现这样的计划：

```text
A 先去打开门。

B 等 A 到达以后再搬箱子。

C 在敌人出现以后开始攻击。
```

问题是，“等待 A 到达”只是一句自然语言。

runtime 不一定知道：

```text
A 到达的 machine-checkable condition 是什么？
B 现在是否真的应该停下来？
A 和 B 有没有互相等待？
环境变化后，这个计划是否仍然有效？
```

[SyncPlan](https://arxiv.org/abs/2608.01652) 的做法是，先由一个中心 coordinator 用一次 LLM 调用为每个 agent 生成较长的 action chain，然后把依赖关系变成显式的 runtime primitive：

```text
Wait_agents
等待另一个 agent 到达指定 milestone

Wait_entity
等待环境对象满足指定 condition
```

例如：

```text
Agent B:
Wait_agents(A, door_opened)
→ carry_box
```

runtime 可以检查这个 predicate，而不是让 B 每一轮重新问：

```text
门开了吗？
我该行动了吗？
A 现在在哪里？
```

显式 wait 也会产生 deadlock，所以 SyncPlan 将 agent 间的等待关系建成 wait graph：

```text
A → B
表示 A 正在等 B
```

如果图中出现 cycle：

```text
A → B → C → A
```

runtime 就能检测到 deadlock，并触发 replanning。

同时，它使用一个轻量的 Plan Staleness Detector 判断环境变化是否真的使剩余计划失效，只在必要时重新调用 coordinator，而不是固定频率地重新规划。

论文在 Overcooked 上报告，SyncPlan 相比各设置中的最强 LLM baseline 平均提升 12.2 个百分点，同时使用不到其 0.05% 的 wall-clock runtime；在 Honor of Kings 环境中报告了 86.3% 的 task achievement。这些结果依赖特定游戏环境、训练流程和中心化 coordinator，而且论文刚刚发布，暂时更适合视为一个明确同步原语的研究信号。

SyncPlan 的核心贡献可以浓缩成一句话：

> `wait`、`barrier`、`dependency` 和 `deadlock` 不应该只存在于自然语言计划中，而应该成为 runtime 能执行和验证的对象。

## CoAgent：不要推倒重来，只修复真正受影响的部分

传统 OCC 在发生冲突时通常会：

```text
abort
→ retry entire transaction
```

对数据库 transaction 来说，这可能只是重新执行几毫秒的代码。

对 agent 来说，一次 transaction 可能包含几分钟的 inference、几十个 tool call 和大量中间推理。

全部重跑会非常昂贵。

悲观 locking 也不理想：

```text
Agent A 在推理期间一直持有 parser.py 的锁

Agent B 等待几分钟

A 可能最后发现根本不需要修改 parser.py
```

[CoAgent: Concurrency Control for Multi-Agent Systems](https://arxiv.org/abs/2606.15376) 正是从这个矛盾出发。

它提出的 MTPO，Monotonic Trajectory Pre-Order，大致是：

```text
1. 在执行开始时确定一个 serialization order

2. tool call 声明自己的 read/write footprint

3. agent 可以继续 speculative execution

4. 低序 agent 的写入如果影响了高序 agent 已读取的对象，
   runtime 向高序 agent 发 notification

5. 高序 agent 判断：
   这个变化是否真的使我的计划失效？

6. 只修复依赖这个旧前提的操作

7. runtime 使用工具预先注册的 inverse，
   机械地撤销和重新排列错误顺序的写入
```

它的原则是：

> runtime informs，agent repairs。

例如：

```text
Agent B 读取：
config.api_name = "old_api"

Agent A 在更低 serialization order 中修改：
config.api_name = "new_api"
```

runtime 不会直接让 B 整个任务失败，而是告诉 B：

```text
你读取过的 config.api_name 已经变化。
```

B 再根据语义判断：

```text
这个变化与我的计划无关
→ 继续

只影响最后一个 tool call
→ 局部修复

使整个方案失效
→ 扩大 repair scope
```

它和 Held Draft 的区别很明显：

```text
Held Draft：
房间变化了
→ 重新判断整条 draft

CoAgent：
对象 X 变化了
→ 检查依赖 X 的那些操作
```

论文在十个竞争工作负载上报告，CoAgent 的正确率与串行执行相差不超过 5%，获得约 1.4 倍加速，并维持接近串行的 token 成本；在 bash-only 目标系统中，它在线扩展出 25 个工具，将通过数从 45/71 提高到 63/71，时间和成本分别约为原来的 0.80 和 0.86。

但 CoAgent 有几个非常强的前提：

```text
所有共享状态访问都必须经过受控 tool

每个 tool 必须正确声明 read/write footprint

可撤销 tool 必须提供正确 inverse

agent 必须可靠判断冲突是否影响自己的计划
```

任何一个前提出错，都可能破坏协议保证。

所以它更像一个很有价值的研究原型，还不是可以无条件套用到任何 agent runtime 的答案。

## 另一条路线：根本不要协调

前面讨论的算法都在处理冲突。

但更好的问题可能是：

> 能不能设计数据结构，让某些并发更新根本不构成冲突？

假设多个 agent 都在维护：

```text
已发现证据的集合
```

Agent A 添加：

```text
evidence_1
```

Agent B 添加：

```text
evidence_2
```

最终结果可以直接是并集：

```text
{evidence_1, evidence_2}
```

更新顺序不重要。

这就是 CRDT 一类设计的价值。

[Conflict-free Replicated Data Types](https://arxiv.org/abs/1805.06358) 允许不同 replica 在不协调的情况下独立更新；当它们接收到同一组 update 后，能够按照确定的规则收敛到相同状态。

适合 agent 系统的例子包括：

```text
append-only event log
grow-only evidence set
每个 agent 独立维护的 counter
只增加、不撤回的 discovery ledger
immutable artifact history
```

与之相关的 [CALM theorem](https://arxiv.org/abs/1901.01930) 提出了更深一层的结论：能够获得一致、coordination-free 分布式实现的程序，恰好对应逻辑上 monotonic 的程序。简单理解就是，如果新信息只会增加结论，而不会推翻旧结论，那么系统更容易在没有全局协调的情况下正确运行。

例如：

```text
已经发现 bug A
```

之后又发现 bug B：

```text
{A}
→ {A, B}
```

旧结论没有失效。

但下面这类操作通常不是 monotonic 的：

```text
撤回一条 claim
决定哪个 patch 是正确的
将 task owner 从 A 改成 B
宣布任务已完成
执行不可逆外部操作
```

它们需要 coordination。

### CodeCRDT

[CodeCRDT](https://arxiv.org/abs/2510.18893) 尝试将 CRDT 用于多 agent 代码生成，让 agent 通过观察共享状态的更新进行协调，而不是持续显式发送消息。

论文在 600 次实验中报告：

```text
某些任务最高加速 21.1%
另一些任务最高减速 39.4%
100% convergence
0 merge failure
但仍有 5%–10% semantic conflict
```

最后一项非常关键：

> structural convergence 不等于 semantic correctness。

两个 agent 的代码可以完美 merge：

```text
没有 conflict marker
文件内容一致
所有 replica 收敛
```

但最终程序仍然可能：

```text
编译失败
API 语义冲突
重复实现同一功能
一起建立在错误假设上
```

CRDT 解决的是“并发更新如何确定性合并”，不是“哪个更新在语义上正确”。

所以 CRDT 很适合存储：

```text
事件
证据
计数器
不可变 artifact
```

但不应该被误解为：

```text
只要用了 CRDT，多个 coding agent 就可以随便改同一份代码。
```

## 只 hold 最终消息，无法处理真实副作用

Held Draft 对聊天消息很有用。

因为在 commit 以前，draft 只是一个尚未进入房间的字符串。

但假设 agent 在生成回复的过程中已经做了这些事情：

```text
修改了生产数据库
发出一封邮件
部署了服务
取消了订单
向用户转账
删除了云资源
```

这时最终回复是否被 hold 已经不重要了。

外部世界已经变化。

因此：

> Held Draft 不是 transaction。

要处理 tool effect，首先要区分副作用类型。

| 类型                                   | 示例                      | 更合适的处理方式                         |
| ------------------------------------ | ----------------------- | -------------------------------- |
| Read-only                            | 查询、搜索、读取文件              | 不产生 commit effect                |
| Bufferable                           | worktree patch、草稿、内存状态  | stage，commit 时才可见                |
| Idempotent known-outcome             | 带 idempotency key 的 API | 可以安全重试                           |
| Reversible                           | 可恢复文件、可取消预订             | abort 时执行 compensation           |
| Reversible with cost                 | 退款、取消酒店                 | compensation，但可能留下费用或痕迹          |
| Irreversible-gated                   | 发邮件、转账、物理动作             | commit 前禁止真正执行                   |
| Multiple heterogeneous irreversibles | 转账 + 邮件 + 第三方 API       | 很难在 runtime 上层实现真正 atomic commit |

这里还需要区分两个经常被混用的词：

```text
rollback
```

表示状态仿佛从未发生过。

```text
compensation
```

表示执行一个新的动作，尽量抵消原动作的后果。

例如：

```text
预订酒店
→ 取消酒店
```

不是 rollback。

酒店系统已经观察到了预订，取消也可能产生手续费。

同样：

```text
发送错误邮件
→ 再发一封“请忽略上一封”
```

并不能让第一封邮件从收件箱里消失。

长事务使用 compensation 的经典来源是 Garcia-Molina 和 Salem 1987 年提出的 [Sagas](https://dl.acm.org/doi/10.1145/38713.38742)。Saga 将长期 transaction 拆成多个子 transaction，并在失败时执行相应的 compensating transaction。

## Atomix：tool return 不等于 effect 已经结算

[Atomix: Timely, Transactional Tool Use for Reliable Agentic Workflows](https://arxiv.org/abs/2602.14849) 研究的就是 agent tool effect 应该在什么时候真正结算。

普通 agent runtime 往往这样处理：

```text
tool call 返回 success
→ 默认这项操作已经完成
```

但在下面这些情况中，这个假设很危险：

```text
tool 已执行，但 response 丢失
agent retry，导致重复副作用

两个 speculative branch 都执行了工具
最后只有一个 branch 被选中

agent 基于 stale state 执行写入

多个 agent 同时操作同一订单
```

Atomix 将执行和 settlement 分开：

```text
open
→ 执行并记录 read/effect scope
→ seal
→ 等待相关 resource frontier
→ commit 或 abort
```

`seal` 表示 transaction footprint 已冻结，之后不能再偷偷增加新的 effect。

Atomix 为每个资源维护一个 monotonic frontier。一个 transaction 只有在系统能够确定：

```text
所有更早、并且可能影响这个资源的 transaction
都已经完成
```

之后，才能 commit。

注意，这里的 frontier 与 LATTE 的 frontier 不是一个概念：

```text
LATTE frontier
= 当前依赖已满足、可以开始执行的 task

Atomix frontier
= 可以证明更早冲突工作已经耗尽的 progress cursor
```

Atomix 根据 effect 类型采用不同处理：

```text
bufferable
→ 暂存，commit 时真正执行

reversible
→ 可以先执行，abort 时 compensation

irreversible-gated
→ adapter 先拦住，commit 时才真正释放

idempotent-known-outcome
→ 依赖服务端 idempotency key 安全重试
```

在论文的实验中，Atomix 在重 fault injection 的 τ-bench 设置中报告了 57% clean task success；在不可逆消息实验中，正确分类时没有泄漏 500 个无效 send，并释放了全部 500 个有效 send。不过 TCC 和显式 Mutex+WAL+Rollback 在那个特定实验中同样做到了零泄漏，Atomix 的主要优势之一是试图用统一 effect classification 降低每个工具的定制成本。

它的局限也很明确：

* 原型大约是 2000 行的 single-process Python runtime；
* 不声称已经实现 distributed crash-safe exactly-once；
* 所有有副作用的调用必须经过 adapter；
* scope、effect class、idempotency key 和 compensation metadata 都必须正确；
* scope 太粗会失去并发，scope 太窄会漏掉冲突；
* 多个异构、不可逆外部系统之间，runtime 上层无法凭空实现原子提交；
* 真正的跨系统 atomicity 仍然需要 tool endpoint 自己支持 TCC、2PC 或类似协议。

所以可以用一句话区分：

> Held Draft 问的是：这条回复现在还能不能进入房间？

> Atomix 问的是：这一组 tool effect 什么时候可以成为永久事实？

论文已经公开了 [Atomix 的研究实现](https://github.com/mpi-dsg/atomix)。

## Cordon：不仅追踪 effect，还追踪 effect 为什么被允许

Atomix 主要关心：

```text
哪些 effect 应该一起结算？
什么时候更早的冲突工作已经结束？
```

[Cordon: Semantic Transactions for Tool-Using LLM Agents](https://arxiv.org/abs/2606.17573) 又向前走了一步。

它认为，agent task 不应该只是多个彼此独立的 tool RPC：

```text
search()
read_file()
summarize()
send_email()
```

因为最终的 `send_email()` 是否合理，取决于前面所有步骤之间的 lineage：

```text
哪个 observation
→ 产生了哪个 summary
→ 支持了哪个 decision
→ 最终形成了哪个 external effect
```

Cordon 定义的 semantic transaction 是 task-level boundary，它将以下内容绑定在一起：

```text
tool intent
result lineage
reversible local state
staged external effect
delegated authority
audit metadata
```

它的 runtime 包括：

### Shadow State

文件修改、删除和支持的本地 mutation 先发生在 transaction-scoped view 中。

agent 可以看到自己的 speculative change，但其他参与者看不到。

```text
commit
→ promote 到真实 workspace

abort
→ discard shadow state
```

### Effect Outbox

外部操作先进入 outbox：

```yaml
sink: email
payload: ...
lineage: ...
authority: approval_9
idempotency_key: ...
release_status: pending
```

验证通过后才 release。

如果 validation 失败，pending effect 可以直接取消，不会真正离开系统边界。

### Lineage Validation

runtime 不依赖模型最后说：

```text
我之所以发这封邮件，是因为……
```

而是在执行过程中记录 result handle 和 dependency edge：

```text
log_17
→ summary_4
→ decision_2
→ email_payload_1
```

这样 validation 可以检查真实 operational history，而不是相信模型对自己推理过程的回忆。

在论文的 45 个 risk-bearing multi-tool workflow 中，普通执行在 45/45 情况下提交了违反 policy 的 effect；Cordon 报告在 commit 前拦截了 45/45。不过它同样是一篇很新的预印本，实验规模和威胁模型都需要更多独立复现。

可以暂时这样区分：

```text
Atomix
更关注 progress、ordering 和 effect settlement

Cordon
更关注 task lineage、authority 和 semantic containment
```

两者不是互斥关系。

一个成熟系统很可能同时需要：

```text
Atomix-style resource frontier

+

Cordon-style lineage and effect outbox
```

## Approval 也会过期

很多 agent 产品把人类 approval 理解成：

```text
用户点过一次 approve
→ 后续操作被授权
```

但 approval 和读取到的文件版本一样，也会 stale。

例如：

```text
用户批准部署 commit v1

agent 开始执行验证

期间 branch 被更新到 v2

agent 最终部署了当前 branch，也就是 v2
```

从 endpoint 看：

```text
部署成功
```

但用户批准的其实是 v1，不是 v2。

[Temporary Authority, Permanent Effects: Commit-Time Authorization for LLM Agents](https://arxiv.org/abs/2607.10487) 将这个问题定义为 commit-time authorization。

它要求 durable effect 在 commit 时满足四个条件：

```text
freshness
授权 witness 仍然有效

causal priority
授权发生在被授权 effect 之前

effect binding
授权绑定的就是这个具体 effect

commit eligibility
当前状态下仍然允许提交
```

论文构建了一个包含 browser、tool/API 和 multi-agent workflow 的 controlled-invalidation suite。在主要的 54-task matrix 中，270 次运行里有 262 次到达了表面上的目标结果，但只有 55 次是 authorized completion；在 216 个授权关系被故意破坏的运行中，有 207 次仍然提交了 effect。

这个结果表达了一件很重要的事：

> endpoint success 是 utility metric，authorized commit 是 safety property。

它也可以被看成 Held Draft 的推广：

```text
Held Draft：
这条回复基于的 room state 还新鲜吗？

Commit-Time Authorization：
授权这项 durable effect 的 witness，
现在是否仍然有效并绑定于同一个 effect？
```

## 协议本身也可能写错

即使我们使用：

```text
task graph
ownership
lease
wait primitive
commit gate
```

协议本身仍然可能因为某个罕见 interleaving 进入死锁。

比如：

```text
A 先等待 B 的 review
B 先等待 C 的 test
C 先等待 A 的 commit
```

每个局部规则看起来都合理，组合起来却永远无法前进。

[TraceFix: Repairing Agent Coordination Protocols with TLA+ Counterexamples](https://arxiv.org/abs/2605.07935) 尝试用形式化方法检查 agent coordination protocol：

```text
LLM 生成 protocol topology / IR

→ 生成 PlusCal / TLA+ specification

→ TLC model checker 枚举 interleaving

→ 返回 deadlock 或 safety counterexample

→ LLM 根据 counterexample 修复协议

→ 将已验证 process body 编译成各 agent 的 prompt

→ runtime monitor 拒绝违反 topology 的操作
```

论文在 48 个任务、16 类场景上报告：

```text
全部通过 bounded TLC verification
62.5% 第一次就通过
最多不超过四轮 repair
所有 model-checking run 均在 60 秒内完成
```

在 3456 次 runtime 对比中，topology-monitored execution 的平均 task completion 为 89.4%，full completion 为 81.5%；固定 runtime 的 paired ablation 中，经过 TLC 验证的协议将 deadlock/livelock 从 31.1% 降到 14.1%。

TraceFix 已有 [ACM CAIS 2026 版本](https://dl.acm.org/doi/10.1145/3786335.3813159)，代码也已公开在 [GitHub](https://github.com/Sensing-And-Reasoning/TraceFix)。

不过，形式化验证也不是魔法。

它只能验证：

```text
你建模进去的 state
你写出的 transition
你明确声明的 invariant
有界 model checker 实际探索到的范围
```

它不能自动证明：

```text
Agent 的证据是真的
自然语言被正确理解
任务分解是合理的
工具 metadata 没有写错
最终答案具有语义正确性
```

所以 TraceFix 更准确的价值是：

> 不要只验证 agent 的最终答案，也要验证协调协议是否存在已知的 safety violation 和 deadlock interleaving。

## Agentic Transaction：这个方向正在逐渐汇合

2026 年 8 月刚发布的 [Agentic Transaction: Towards ACID-Compliant Agent Systems](https://arxiv.org/abs/2608.13900) 尝试将数据库 ACID 重新解释为：

```text
Semantic Atomicity
Semantic Consistency
Semantic Isolation
Semantic Durability
```

并构建了一个面向 data agent 的 ACID-Agent，将 exploration、execution 和 validation 组织成 transaction unit。论文报告其系统相对包括 Claude Code 在内的基线提升了 10.6%，代码已经公开在 [TsinghuaDatabaseGroup/ACID-Agent](https://github.com/TsinghuaDatabaseGroup/ACID-Agent)。

这篇论文非常新，暂时没有必要过度解读它的 benchmark 数字。

但它和 Atomix、Cordon、CoAgent、Commit-Time Authorization 同时出现，至少说明研究方向正在发生一个很明显的变化：

```text
以前：
如何让多个 agent 更聪明地聊天？

现在：
如何定义 agent transaction？
什么时候允许 commit？
谁能观察 speculative state？
失败以后怎样恢复？
外部 effect 何时可以成为永久事实？
```

也就是说，multiagent 研究开始从 conversation protocol，逐渐进入 transaction protocol。

## 把这些工作拼起来，一套 runtime 可能长什么样？

下面不是任何一篇论文的原样设计，而是我把前面的工作拼在一起之后，得到的一版工程化草图。

### 第一层：Attention 与 Message

负责：

```text
Agent Inbox
pull-based message consumption

Held Draft
room-level stale reply detection

message_id / task_id / epoch
防止旧消息污染新任务
```

这一层处理的是：

> agent 应该看到什么，以及它基于旧房间生成的消息还能不能提交。

### 第二层：Task Scheduling

负责：

```text
dynamic DAG
ready frontier
claim
lease
release
heartbeat
straggler detection
barrier
deadlock detection
```

这一层处理的是：

> 谁现在有 ready work，谁拥有这项工作，以及依赖关系允许多少并行度。

### 第三层：Shared-State Concurrency

负责：

```text
read/write scope
resource version
OCC validation
lock / lease
CRDT merge
dependency notification
targeted repair
```

这一层处理的是：

> 多个 agent 对同一共享对象的读写能否组成一个合法 execution。

### 第四层：Effect Commit

负责：

```text
staging
shadow state
effect outbox
idempotency key
compensation
irreversible gate
commit-time authorization
```

这一层处理的是：

> 哪些 speculative effect 可以变成外部世界中的永久事实。

### 第五层：Protocol Verification

负责：

```text
invariant
deadlock / livelock
termination
model checking
runtime monitor
audit log
lineage
```

这一层处理的是：

> 协议本身是否允许某些不应该出现的 interleaving。

一个 agent 提出的 action intent 可能不再只是：

```json
{
  "tool": "send_email",
  "args": {
    "to": "user@example.com"
  }
}
```

而是：

```yaml
intent:
  task_id: task_17
  epoch: 4
  agent_id: agent_b

base:
  room_version: 108
  workspace_version: 42

reads:
  - repo:/src/parser.py
  - claim:parser_boundary_bug

writes:
  - repo:/src/parser.py

effects:
  - type: send_email
    scope: mailbox:user@example.com
    class: irreversible_gated
    idempotency_key: task_17:notify

authority:
  witness: approval_9
  target: deploy:v1

postconditions:
  - tests_passed
  - no_new_security_findings
```

runtime 的执行流程可能变成：

```text
plan

→ declare or derive footprint

→ admission
  检查 task、ownership、权限和预算

→ isolated / speculative execution

→ dependency validation

→ authority validation

→ commit or abort

→ release external effects
```

更进一步，runtime 不一定永远使用同一种 concurrency strategy。

它可以根据实际 conflict rate 动态升级：

```text
低冲突
→ OCC

同一 scope 连续发生冲突
→ lease 或 sequencer

操作满足 commutativity
→ CRDT merge

冲突可以局部修复
→ targeted repair

副作用可补偿
→ speculative execution + compensation

副作用不可逆
→ serialize + commit gate
```

这可能才是真正的 agent-native concurrency control：

> 不是先选择一个万能协议，而是根据 task dependency、resource contention 和 effect class 动态选择协议。

## 一个简单的对照表

| 机制                        | 主要协调什么                     | 核心思路                                      | 适合的场景                   | 主要限制                            |
| ------------------------- | -------------------------- | ----------------------------------------- | ----------------------- | ------------------------------- |
| Held Draft                | 房间消息                       | 版本检查后重新判断                                 | 聊天、thread reply         | 粒度可能较粗，高竞争时重复判断                 |
| Ticket / Sequencer        | 严格顺序                       | 预分配 slot                                  | 数数、顺序发布                 | 串行关键路径无法消除                      |
| LATTE                     | task scheduling            | 动态 DAG + ready frontier                   | 可拆解的复杂工作                | 需要维护 graph，仍有 Lead              |
| SyncPlan                  | 执行同步                       | 显式 wait + deadlock detection              | 长周期环境协作                 | 中心化，依赖计划质量                      |
| CoAgent                   | 共享状态读写                     | dependency notification + targeted repair | 长推理、高冲突工具调用             | footprint、inverse 和语义判断要求高      |
| CRDT / CALM               | 可交换更新                      | coordination avoidance                    | 日志、证据集、计数器              | convergence 不保证语义正确             |
| Atomix                    | tool effect settlement     | resource frontier + effect class          | fault、speculation、外部副作用 | adapter metadata 是强前提           |
| Cordon                    | task-level semantic effect | lineage + shadow state + outbox           | 多步高风险工具任务               | 中介范围外的 effect 无法回滚              |
| Commit-Time Authorization | durable effect 权限          | commit 时重新验证 witness                      | deploy、付款、审批工作流         | runtime 必须提供完整 witness metadata |
| TraceFix                  | 协调协议本身                     | TLA+ counterexample repair                | 明确状态机和 invariant        | 只证明模型化的性质                       |

## 还有哪些问题没有解决？

虽然 2026 年突然出现了很多 agent transaction 和 concurrency 相关工作，但真正困难的问题仍然很多。

### 1. Read/write footprint 怎么获得？

让开发者手写：

```text
这个 tool 可能读取哪些资源
这个 tool 可能修改哪些资源
```

在十几个工具时还勉强可行。

到了 shell、Python、浏览器和任意 MCP server，这个 scope 可能根本无法静态知道。

可能的方向包括：

```text
静态分析
sandbox trace
filesystem monitor
API schema
LLM prediction
conservative may-touch scope
执行后动态 refinement
```

但 scope 太宽会失去并发，scope 太窄会破坏安全。

### 2. 什么叫 semantic conflict？

两个 agent 都修改同一文件，未必冲突。

一个改注释，一个修函数，可能完全兼容。

两个 agent 修改不同文件，也可能发生语义冲突：

```text
A 重命名 API
B 在另一个文件继续调用旧 API
```

所以 path-level conflict detection 不够。

但让 LLM 判断所有 semantic conflict，又会增加成本和不确定性。

### 3. 如何自动分类副作用？

runtime 怎么知道一个 tool call 是：

```text
read-only
bufferable
idempotent
reversible
reversible-with-cost
irreversible
```

开发者标错 effect class，安全保证就会失效。

Atomix 的实验也显示，错误分类不可逆 effect 会直接导致泄漏。

### 4. 如何生成可靠 compensation？

Agent 很容易生成一个“看起来像 inverse”的操作。

但：

```text
UPDATE balance = balance - 100
```

的 inverse 不一定只是：

```text
UPDATE balance = balance + 100
```

期间可能已经发生其他交易。

可靠 compensation 需要业务语义，而不仅是语法上的反向操作。

### 5. 如何实现 distributed crash safety？

很多研究原型仍然是 single-process。

真正分布式以后还需要：

```text
replicated effect log
shared frontier store
leader failure recovery
durable idempotency key
transaction ownership transfer
partial network failure
```

这时经典 Raft consensus algorithm 之类的协议，才可能作为底层基础设施出现。

注意，它解决的是 runtime 自身的 replicated state，不是 agent 如何分工。

### 6. runtime 能否自动切换协议？

一个任务开始时可能低冲突，适合 OCC。

后来多个 agent 集中修改同一模块，OCC 开始频繁 abort。

runtime 是否可以自动观察：

```text
conflict rate
retry cost
resource overlap
effect reversibility
```

然后从 OCC 升级成 lease 或 serialization？

这可能比发明一个固定“multiagent protocol”更有价值。

### 7. Agent memory 需要什么 isolation level？

一个 agent 的 memory 可能读取到：

```text
尚未验证的 claim
已经被撤销的计划
另一个 speculative branch 的结果
旧 task 的 stale message
```

我们今天对 memory 的讨论大多集中在 retrieval quality，但未来可能还需要讨论：

```text
read committed memory
snapshot memory
versioned memory
transaction-local memory
verified-only memory
```

### 8. benchmark 应该测什么？

只测最终 task success 不够。

一个并发 benchmark 至少应该记录：

```text
task correctness
wall-clock
token cost
duplicate work
stale commit
lost update
deadlock / livelock
conflict repair cost
irreversible residue
authorization validity
recovery after agent failure
```

否则一个系统可能只是用了更多 token 和更多 retry，最终勉强得到了正确答案。

### 9. Exactly-once effect 是否可能？

对完全受 runtime 控制的本地状态，可以通过 transaction log 和 deduplication 接近 exactly-once。

但对任意 SMTP、REST API 和真实世界系统，runtime 无法单方面保证 exactly-once。

真正可靠的实现往往需要 endpoint 配合：

```text
idempotency key
prepare / commit
transaction ID
deduplication
queryable operation status
```

没有 endpoint support，runtime 最多只能缩小 failure window，而不能消灭它。

## 最后的结论

Held Draft 依然是一个很聪明的设计。

它准确抓住了 turn-based agent 与持续变化的 shared room 之间的错位：

```text
agent 读取的是 snapshot
推理需要时间
提交时世界已经变化
```

它将 freshness detection 交给 runtime，将 semantic relevance 交给 agent，比简单地把所有消息灌入 context 要合理得多。

但 Held Draft 最适合成为：

> 房间消息层的最后一道安全网。

它不应该承担：

```text
任务调度
资源所有权
依赖管理
tool transaction
不可逆 effect commit
authorization
```

更高级的设计，并不是让 agent 在每次冲突后“再聪明地想一次”。

而是尽量把可以确定的部分从 LLM inference 中拿出来：

```text
顺序
所有权
版本
依赖
同步
幂等性
commit
```

交给 deterministic runtime。

把 token 留给真正需要语义判断的部分：

```text
这个变化是否推翻了我的假设？
这两个 patch 在语义上是否冲突？
当前证据是否足以完成任务？
这个 compensation 是否符合业务含义？
```

所以我目前对 agent concurrency 最简洁的理解是：

> 把 token 花在真正的语义不确定性上，把身份、顺序、所有权、版本和 commit 交给 runtime。

否则我们只是花更多 token，让一群 agent 轮流发现自己刚才白想了😅。

---

# 参考资料

以下是本文使用或值得继续阅读的资料。2025–2026 年的数字来自各自论文的实验设置，不应直接横向比较。

## Raft 产品与 Raft 共识算法

* [Is Having Agents in the Room Meant to Be Chaotic?](https://raft.build/resources/blog/is-having-agents-in-the-room-meant-to-be-chaotic/)
* [Raft Consensus Algorithm](https://raft.github.io/)
* [In Search of an Understandable Consensus Algorithm](https://raft.github.io/raft.pdf)

## 经典并发、事务与协作系统

* [On Optimistic Methods for Concurrency Control](https://dl.acm.org/doi/10.1145/319566.319567)
* [Sagas](https://dl.acm.org/doi/10.1145/38713.38742)
* [Conflict-free Replicated Data Types](https://arxiv.org/abs/1805.06358)
* [Keeping CALM: When Distributed Consistency Is Easy](https://arxiv.org/abs/1901.01930)
* [Concurrency Control in Groupware Systems](https://dl.acm.org/doi/10.1145/67544.66963)
* [Real Time Groupware as a Distributed System: Concurrency Control and Its Effect on the Interface](https://grouplab.cpsc.ucalgary.ca/grouplab/uploads/Publications/Publications/1994-Concurrency.CSCW.pdf)

## Agent scheduling 与 concurrency control

* [Position: Multi-Agent Systems Should Prioritize Concurrency Control](https://arxiv.org/abs/2608.18092)
* [Improving the Efficiency of Language Agent Teams with Adaptive Task Graphs](https://arxiv.org/abs/2605.06320)
* [LATTE code](https://github.com/emieczkowski/latte)
* [SyncPlan: Long-Horizon LLM Coordination with Explicit Synchronization and Adaptive Correction](https://arxiv.org/abs/2608.01652)
* [CoAgent: Concurrency Control for Multi-Agent Systems](https://arxiv.org/abs/2606.15376)
* [CodeCRDT: Observation-Driven Coordination for Multi-Agent LLM Code Generation](https://arxiv.org/abs/2510.18893)

## Tool effect、transaction 与授权

* [Atomix: Timely, Transactional Tool Use for Reliable Agentic Workflows](https://arxiv.org/abs/2602.14849)
* [Atomix code](https://github.com/mpi-dsg/atomix)
* [Cordon: Semantic Transactions for Tool-Using LLM Agents](https://arxiv.org/abs/2606.17573)
* [Temporary Authority, Permanent Effects: Commit-Time Authorization for LLM Agents](https://arxiv.org/abs/2607.10487)
* [Agentic Transaction: Towards ACID-Compliant Agent Systems](https://arxiv.org/abs/2608.13900)
* [ACID-Agent code](https://github.com/TsinghuaDatabaseGroup/ACID-Agent)

## 协议验证

* [TraceFix: Repairing Agent Coordination Protocols with TLA+ Counterexamples](https://arxiv.org/abs/2605.07935)
* [TraceFix — ACM CAIS 2026](https://dl.acm.org/doi/10.1145/3786335.3813159)
* [TraceFix code](https://github.com/Sensing-And-Reasoning/TraceFix)

最后，以上提及的 LATTE、SyncPlan、CoAgent、Atomix、Cordon、Agentic Transaction 等工作都还是比较新的，其中相当一部分仍然只是 arXiv preprint， 报告的数字来自不同模型、任务、基线和实验环境，没办法直接横向比较或者当成某种标准, 不过我更关注的主要是它们提出了什么问题，以及给出了什么新的协议设计， 数字也就无所谓啦。

累了，就写到这里吧🤔💖