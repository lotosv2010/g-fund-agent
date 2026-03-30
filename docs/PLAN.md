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
