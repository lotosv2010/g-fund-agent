# AGENTS.md — 项目开发规范

本文件是项目的单一事实来源，所有 AI 开发工具（Claude Code、Codex、Kimi 等）均以此为准。

## 1. 概述

基金持仓自动分析 Agent。每周分析持仓基金是否需要调仓，输出调仓建议。

**核心原则：纯规则驱动，禁止 LLM 主观判断。**

完整业务需求见 `docs/spec/SPEC.md`，架构设计见 `docs/ARCHITECTURE.md`。

## 2. 项目范围

### 已完成

- DeepAgent 主编排器 + 2 个子 Agent + 分析引擎工具已接入
- 规则引擎（rules-config）和基金注册表（fund-registry）已完成
- 状态存储（store）已完成
- 3 个纯计算函数（market-calculator / rule-matcher / portfolio-optimizer）已通过 `analysis-engine.ts` 接入主编排器
- MCP 数据层已连通（qieman MCP，73 个工具）

### 当前阶段：Phase 3 - 回测 + 自优化

- Phase 0 已完成：规则引擎稳定运行，核心功能齐全
- Phase 1 已完成：数据聚合 + 三层风控体系 + 定时触发
- Phase 2 已完成：策略抽象层 + LLM 信号增强 + 信号合并
- 开发规划和进度见 `docs/PLAN.md`

## 3. 技术栈与运行方式

| 项 | 值 |
|----|-----|
| 语言 | TypeScript (ESNext, bundler moduleResolution) |
| 包管理 | **pnpm**（禁止 npm / yarn） |
| AI 框架 | deepagents + langchain + @langchain/langgraph |
| LLM | Ollama（本地模型），配置在 `src/models.ts` |
| 数据源 | qieman MCP（且慢） |
| CLI | langgraphjs |
| 追踪 | LangSmith |
| Node | 20+ |

### 常用命令

```bash
pnpm install      # 安装依赖
pnpm dev          # 启动 langgraphjs 开发服务器 (port 2024)
pnpm build        # 构建
pnpm up / down    # 启动 / 停止服务
npx tsc --noEmit  # 类型检查
```

## 4. 项目结构

```
g-fund-agent/
├── src/
│   ├── index.ts                   # 导出 agent（langgraphjs 入口）
│   ├── agent.ts                   # DeepAgent 主编排器
│   ├── models.ts                  # LLM 模型配置（ChatOllama）
│   ├── agents/
│   │   ├── data-fetcher.ts        # 子 Agent 规格：数据获取
│   │   ├── reporter.ts            # 子 Agent 规格：报告生成 + save_report 工具
│   │   ├── analysis-engine.ts     # 分析引擎 Tool（封装下面三个纯函数）
│   │   ├── market-calculator.ts   # 纯函数：市场计算
│   │   ├── rule-matcher.ts        # 纯函数：规则匹配
│   │   └── portfolio-optimizer.ts # 纯函数：组合优化
│   ├── rules/
│   │   ├── rules-config.ts        # 5 类基金补仓/止盈规则配置
│   │   └── fund-registry.ts       # 12 只基金注册表（代码/名称/分类）
│   ├── state/
│   │   ├── types.ts               # 业务类型定义（含风控、市场上下文）
│   │   └── store.ts               # JSON 状态读写（补仓点、近期高点、已触发档位）
│   ├── data/                      # 数据聚合层（Phase 1）
│   │   ├── context.ts             # 市场上下文聚合
│   │   └── providers/             # 数据源适配器
│   │       ├── qieman.ts          # 且慢 MCP（文档）
│   │       ├── macro.ts           # 宏观指标（MVP）
│   │       └── sentiment.ts       # 市场情绪（MVP）
│   ├── risk/                      # 风控层（Phase 1）
│   │   ├── index.ts               # 风控聚合器
│   │   ├── drawdown.ts            # 回撤控制
│   │   ├── concentration.ts       # 集中度检查
│   │   └── liquidity.ts           # 流动性检查
│   ├── scheduler/                 # 定时任务（Phase 1）
│   │   └── config.ts              # Cron 配置
│   ├── strategies/                # 策略层（Phase 2）
│   │   ├── types.ts               # 策略类型定义
│   │   ├── registry.ts            # 策略注册表
│   │   ├── grid-rebalance.ts      # 网格补仓策略
│   │   ├── llm-signal.ts          # LLM 信号增强
│   │   ├── version-manager.ts     # 策略版本管理
│   │   └── index.ts               # 统一导出
│   ├── mcp/
│   │   └── client.ts              # qieman MCP 客户端 + mcpServers 配置
│   └── utils/
│       └── calc.ts                # 涨跌幅计算、格式化、周标识工具
├── data/                          # 运行时状态（已加入 .gitignore）
│   ├── buy-points.json            # 补仓点记录
│   ├── high-points.json           # 近期高点记录
│   └── triggered-tiers.json       # 已触发档位记录
├── docs/
│   ├── TESTING.md                 # 联调测试指南（Phase 0）
│   └── SCHEDULING.md              # 定时运行指南（Phase 1）
├── docs/                          # 项目文档（见第 9 节）
├── langgraph.json                 # langgraphjs CLI 配置
├── .env                           # 环境变量（不提交）
├── package.json
├── tsconfig.json
├── AGENTS.md                      # 本文件：项目开发规范
└── CLAUDE.md                      # Claude Code 专属指令
```

## 5. 配置格式

### 5.1 langgraph.json

```json
{
  "node_version": "20",
  "graphs": {
    "fund_agent": "./src/agent.ts:agent"
  },
  "env": ".env",
  "dependencies": ["./src"]
}
```

### 5.2 环境变量（.env）

```bash
# LangSmith 追踪
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=<your_key>
LANGSMITH_PROJECT="g-fund-agent"

# Ollama LLM
OLLAMA_MODEL=qwen3:8b
OLLAMA_BASE_URL=http://localhost:11434

# qieman MCP
QIEMAN_MCP_URL=https://stargate.yingmi.com/mcp/v2
QIEMAN_API_KEY=<your_key>

# Phase 2: 策略引擎（可选）
USE_STRATEGY_ENGINE=false  # true: 启用策略驱动引擎（V2）
ENABLE_LLM_SIGNAL=false    # true: 启用 LLM 信号增强
```

### 5.3 子 Agent 规格格式

```typescript
import type { SubAgent } from "deepagents";

export const myAgentSpec: SubAgent = {
  name: "agent_name",           // 编排器中的标识
  description: "做什么的",       // 编排器选择调度的依据
  systemPrompt: "你是...",       // 子 Agent 的系统提示
  tools: [myTool],              // 可选，该子 Agent 可用的工具
};
```

## 6. MCP 规范

### 接入方式

通过 `@langchain/mcp-adapters` 的 `MultiServerMCPClient` 接入，Streamable HTTP 传输协议（自动回退 SSE）。

### 服务配置（`src/mcp/client.ts`）

```typescript
export const mcpServers = {
  qieman: {
    url: process.env.QIEMAN_MCP_URL,
    headers: {
      "x-api-key": process.env.QIEMAN_API_KEY,
    },
  },
};
```

### 使用方式

```typescript
import { getMcpTools } from "./mcp/client";
const tools = await getMcpTools("qieman");
```

### 新增 MCP 服务

在 `mcpServers` 对象中添加新的服务配置即可。

## 7. 约束

### 7.1 业务约束

1. **纯规则驱动** — 所有买卖决策必须由 `rules-config.ts` 中的规则触发，LLM 只用于数据获取和报告格式化
2. **补仓点必须持久化** — 每次补仓操作记录到 `data/buy-points.json`，止盈规则依赖加权平均补仓成本
3. **档位去重** — 已触发档位记录到 `data/triggered-tiers.json`，避免重复触发同一档位
4. **滚动窗口高点** — 近期高点采用60日滚动窗口，超过60天未创新高则自动重置
5. **风控优先** — Phase 1 新增三层风控（回撤/集中度/流动性），自动阻止高风险建议
6. **数据容错** — 多源数据聚合，单个数据源失败不影响整体运行
7. **净值检查必输出** — 每次运行必须输出净值检查表，无论是否触发操作
8. **债券弹药库联动** — 其他资产触发第 3 档补仓时，自动触发债券减仓

### 7.2 架构约束

1. **子 Agent 只做工具调用** — `data_fetcher` 调用 MCP 获取数据，`reporter` 调用工具保存文件，都不做决策
2. **纯计算函数无 LLM** — `calculateMarket`、`matchRules`、`optimizePortfolio` 禁止引入 LLM
3. **单一数据源** — 基金信息只在 `fund-registry.ts`，规则阈值只在 `rules-config.ts`

## 8. 代码规范

### 通用

- import 路径**不加** `.js` 后缀（bundler moduleResolution）
- 使用 pnpm，不使用 npm / yarn
- TypeScript strict 模式

### 新增基金

只需在 `src/rules/fund-registry.ts` 添加一条记录，指定 `category`，对应类别的规则自动生效。

### 新增子 Agent

1. 在 `src/agents/` 创建文件，导出 `SubAgent` 规格
2. 在 `src/agent.ts` 的 `subagents` 数组中注册

### 新增纯计算函数

1. 在 `src/agents/` 创建文件，导出纯函数
2. 参数使用 `src/state/types.ts` 中的类型
3. 禁止依赖 LLM

### 调整规则阈值

只改 `src/rules/rules-config.ts`，不要在其他文件中硬编码数字。

## 9. 文档规范

| 文件 | 用途 | 更新频率 |
|------|------|----------|
| `docs/HOME.md` | 操作首页（规则速查、文档导航） | 规则变更时 |
| `docs/spec/SPEC.md` | 需求规格（规则权威定义） | 需求变更时 |
| `docs/PLAN.md` | 开发规划和待办 | 开发阶段变更时 |
| `docs/portfolio.md` | 当前持仓数据（唯一数据源） | 每次分析后更新 |
| `docs/reports/TEMPLATE.md` | 周报输出模板 | 模板变更时 |
| `docs/reports/weekly/` | 持仓快照 | Agent 自动生成 |
| `docs/reports/analysis/` | 分析报告 | Agent 自动生成 |
| `docs/reports/suggestions/` | 调仓建议 | 触发规则时生成 |
| `docs/records/` | 实际操作记录 | 手动记录 |

## 10. 安全与合规

1. **API Key 不入库** — `.env` 已在 `.gitignore` 中，禁止在代码中硬编码密钥
2. **只读建议** — Agent 只输出调仓建议，不执行实际交易
3. **数据本地化** — 持仓数据和补仓记录存储在本地 JSON，不上传第三方
4. **LangSmith 追踪** — 所有 Agent 调用可通过 LangSmith 审计
