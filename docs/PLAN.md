# G-Fund-Agent 开发规划

## 一、开发清单

| 阶段 | 任务 | 说明 | 状态 |
|------|------|------|------|
| 1 | 项目初始化 | pnpm, tsconfig, .env, langgraph.json | DONE |
| 2 | MCP 数据层 | 接入 qieman MCP，获取基金净值、持仓数据 | DONE(骨架) |
| 3 | 规则引擎 | 5 类基金的补仓/止盈规则配置化 + 基金注册表 | DONE |
| 4 | 状态存储 | 补仓点、近期高点、历史操作的结构化存储 (JSON) | DONE |
| 5 | DeepAgent 编排 | 主编排器 + 2 个子 Agent + 3 个纯计算函数 | DONE |
| 6 | 输出层 | 生成每周持仓快照、分析报告、调仓建议 (Markdown) | DONE(骨架) |
| 7 | 联调测试 | MCP 数据 -> 计算 -> 规则 -> 输出 全链路 | TODO |

## 二、项目架构

### 技术栈

- Runtime: Node.js + TypeScript + pnpm
- AI 框架: deepagents + langchain + @langchain/langgraph
- CLI: langgraphjs (dev/build/up/down)
- LLM: Ollama (本地模型)
- 数据源: qieman MCP (且慢)
- 追踪: LangSmith
- 存储: 本地 JSON 文件

### DeepAgent 架构

```
createDeepAgent (主编排器)
├── data_fetcher (子 Agent: LLM + qieman MCP Tools)
├── reporter     (子 Agent: LLM + save_report Tool)
└── 纯计算函数（可被编排器调用）
    ├── calculateMarket()
    ├── matchRules()
    └── optimizePortfolio()
```

| 模块 | 类型 | 职责 |
|------|------|------|
| 主编排器 | DeepAgent | 协调子 Agent 和计算流程 |
| data_fetcher | SubAgent (LLM + MCP) | 通过 MCP 拉取最新净值、持仓数据 |
| reporter | SubAgent (LLM + Tools) | 格式化 Markdown 报告并保存到文件 |
| calculateMarket | 纯函数 | 计算近期高点、涨跌幅、补仓点偏移 |
| matchRules | 纯函数 | 按 5 类基金规则判断是否触发补仓/止盈 |
| optimizePortfolio | 纯函数 | 总仓位校验、目标偏离校正、债券弹药库联动 |

### 关键区分

- **子 Agent (SubAgent)**：声明式规格（name + description + systemPrompt + tools），由 DeepAgent 编排调度
- **纯计算函数**：无 LLM，纯规则/计算逻辑，确保决策可审计

## 三、目录结构

```
g-fund-agent/
├── src/
│   ├── index.ts                   # 导出 agent（langgraphjs 入口）
│   ├── agent.ts                   # DeepAgent 主编排器
│   ├── models.ts                  # LLM 模型配置
│   ├── agents/
│   │   ├── data-fetcher.ts        # 子 Agent 规格：数据获取
│   │   ├── reporter.ts            # 子 Agent 规格：报告生成
│   │   ├── market-calculator.ts   # [待接入] 纯函数：市场计算
│   │   ├── rule-matcher.ts        # [待接入] 纯函数：规则匹配
│   │   └── portfolio-optimizer.ts # [待接入] 纯函数：组合优化
│   ├── rules/
│   │   ├── rules-config.ts        # 5 类基金规则配置
│   │   └── fund-registry.ts       # 基金注册表
│   ├── state/
│   │   ├── types.ts               # 类型定义
│   │   └── store.ts               # 状态读写 (补仓点、近期高点)
│   ├── mcp/
│   │   └── client.ts              # qieman MCP 客户端 + 服务配置
│   └── utils/
│       └── calc.ts                # 计算工具函数
├── data/
│   ├── buy-points.json            # 补仓点记录
│   └── high-points.json           # 近期高点记录
├── docs/
│   ├── HOME.md                    # 基金操作首页
│   ├── PLAN.md                    # 开发规划（本文件）
│   ├── portfolio.md               # 当前持仓数据
│   ├── spec/
│   │   └── SPEC.md                # 需求规格说明书
│   ├── reports/
│   │   ├── TEMPLATE.md            # 报告模板
│   │   ├── weekly/                # 每周持仓快照
│   │   ├── analysis/              # 每周分析报告
│   │   └── suggestions/           # 每周调仓建议
│   └── records/                   # 历次操作记录
├── langgraph.json                 # LangGraph CLI 配置
├── .env                           # 环境变量（不提交）
├── .env.example
├── package.json
├── tsconfig.json
├── AGENTS.md                      # 项目开发规范（单一事实来源）
└── CLAUDE.md                      # Claude Code 专属指令
```

## 四、关键设计决策

1. **DeepAgent 编排** - 主编排器通过 `createDeepAgent` 创建，子 Agent 使用 `SubAgent` 声明式规格
2. **规则配置化** - 所有补仓/止盈阈值集中在 `rules-config.ts`
3. **基金注册表** - `fund-registry.ts` 统一管理基金代码、名称、分类映射
4. **补仓点结构化存储** - 每次补仓记录 `{基金代码, 日期, 净值, 金额}`，止盈依赖此数据
5. **债券弹药库联动** - 其他资产触发第3档补仓时，自动触发债券减仓
6. **langgraphjs CLI** - 通过 `pnpm dev` 启动开发服务器，支持 LangSmith 追踪

## 五、已知问题与改进计划

> 最后更新：2026-03-30

### P0 级别 - 阻塞问题（必须修复）✅ 全部完成

| ID | 问题 | 位置 | 影响 | 状态 |
|----|------|------|------|------|
| P0-1 | **档位触发逻辑错误**：跌幅满足多档时会重复触发（如 -26% 会触发 1/2/3 档） | `src/agents/rule-matcher.ts:23-36` | 生成错误的调仓建议 | ✅ DONE |
| P0-2 | **海外类配置不一致**：`TARGET_ALLOCATION` 中使用 `overseas`，但类型系统使用 `overseas_sp500/nasdaq/china_internet` | `src/rules/rules-config.ts:117` | `portfolio-optimizer` 无法计算目标金额 | ✅ DONE |
| P0-3 | **近期高点数据缺失**：`high-points.json` 为空，导致所有基金使用当前净值作为高点，永远不会触发补仓 | `data/high-points.json` + `src/agents/market-calculator.ts:14` | 补仓规则失效 | ✅ DONE |
| P0-4 | **目标金额计算策略不明确**：补仓金额基于 TARGET_TOTAL (200k) 还是当前持仓 (44k)？两者相差 4.5 倍 | `src/agents/portfolio-optimizer.ts:23` | 补仓金额偏差严重 | ✅ DONE |

> **修复总结**：详见 [P0-FIX-SUMMARY.md](./P0-FIX-SUMMARY.md)
> **完成日期**：2026-03-30

### P1 级别 - 功能缺失（影响使用）

| ID | 问题 | 位置 | 影响 | 状态 |
|----|------|------|------|------|
| P1-1 | **data-fetcher 未实现**：只有规格，缺少 MCP 数据转换逻辑 | `src/agents/data-fetcher.ts` | 无法获取实时数据 | ✅ DONE |
| P1-2 | **补仓点记录机制缺失**：生成建议后，无代码记录补仓点到 `buy-points.json` | 全局流程 | 止盈规则无法触发 | ✅ DONE |
| P1-3 | **近期高点更新机制缺失**：应每次运行时更新，确保 60 日高点准确 | `src/agents/market-calculator.ts` | 触发阈值不准确 | ✅ DONE |
| P1-4 | **报告模板过时**：`TEMPLATE.md` 未反映实际输出格式 | `docs/reports/TEMPLATE.md` | 报告格式混乱 | ✅ DONE |
| P1-5 | **MCP API 文档缺失**：不清楚 qieman MCP 返回格式 | 无 | 无法对接真实数据 | ✅ DONE |

### P2 级别 - 优化建议（可延后）

| ID | 问题 | 位置 | 影响 | 状态 |
|----|------|------|------|------|
| P2-1 | **错误处理不足**：MCP 连接、文件读写缺少健壮的 try-catch | 多个文件 | 崩溃风险 | ✅ DONE |
| P2-2 | **类型安全性**：`inferCategory()` 可能返回 null，未校验 | `src/utils/fund-loader.ts:135` | 运行时错误 | ✅ DONE |
| P2-3 | **配置一致性检查**：启动时应校验 RULES 和 TARGET_ALLOCATION 对应关系 | 启动流程 | 配置错误难发现 | ✅ DONE |
| P2-4 | **目录结构缺失**：`docs/records/` 不存在，手动操作记录无处存放 | 文件系统 | 文档混乱 | ✅ DONE |
| P2-5 | **补仓点记录提示**：报告中应自动生成记录命令，方便用户执行 | `src/agents/reporter.ts` | 用户体验差 | ✅ DONE |

## 六、待办任务拆解

### 阶段 1：修复阻塞问题（预计 1-2 小时）✅ 已完成

- [x] **P0-1** 修复档位触发逻辑
  - ✅ 修改 `rule-matcher.ts` 的循环逻辑，只保留最高档位
  - ✅ 从高到低遍历，找到最高档后 break

- [x] **P0-2** 统一海外类配置
  - ✅ 采用方案 A：修改 `TARGET_ALLOCATION` 拆分为 3 个子类别
  - ✅ 添加辅助函数 `getTargetAllocation()` 和 `getOverseasTotalAllocation()`

- [x] **P0-3** 初始化近期高点数据
  - ✅ 采用手动方案：根据历史数据填充 `high-points.json`
  - ✅ 实现自动更新机制：每次运行时更新创新高的基金

- [x] **P0-4** 明确目标金额计算策略
  - ✅ 选择策略：基于 TARGET_TOTAL（适合定投初期）
  - ✅ 更新文档说明计算逻辑和未来扩展方向

### 阶段 2：完善功能（预计 2-3 小时）✅ 已完成

- [x] **P1-1** 实现 data-fetcher
  - ✅ 增强 system prompt，明确数据格式要求
  - ✅ 添加 JSON 格式示例和字段说明
  - ✅ 处理异常情况的降级方案（使用 portfolio.md）

- [x] **P1-2** 设计补仓点记录机制
  - ✅ 采用方案 A：报告中生成记录命令，用户手动执行
  - ✅ 更新 reporter 的 system prompt，自动生成命令
  - ✅ 添加 `generateBuyPointCommand()` 辅助函数

- [x] **P1-3** 实现近期高点自动更新
  - ✅ 在 `calculateMarket` 中比较当前净值与历史高点
  - ✅ 如果更高，自动更新 `high-points.json`
  - ✅ 添加日志输出更新记录

- [x] **P1-4** 更新报告模板
  - ✅ 根据实际格式重写 `TEMPLATE.md`
  - ✅ 包含：持仓快照、仓位分析、调仓建议、补仓点记录命令

- [x] **P1-5** 创建 MCP 集成文档
  - ✅ 创建 `docs/MCP-INTEGRATION.md`
  - ✅ 记录配置方式、常见问题、降级方案

### 阶段 3：联调测试（预计 2-4 小时）

- [ ] 启动 `pnpm dev`，测试 MCP 连接
- [ ] 模拟完整流程：数据获取 → 分析 → 报告生成
- [ ] 验证 LangSmith 追踪完整性
- [ ] 生成第一份周报并人工审核
- [ ] 根据实际运行情况调整 prompt

### 阶段 4：优化增强（可选）✅ 已完成

- [x] P2-1: 完善错误处理（MCP连接、文件读写）
- [x] P2-2: 增强类型安全（inferCategory null处理）
- [x] P2-3: 添加配置一致性检查（启动时校验）
- [x] P2-4: 创建 `docs/records/` 目录并添加 README
- [x] P2-5: 补仓点记录提示（已集成到 reporter）
