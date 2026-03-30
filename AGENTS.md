# AGENTS.md — 项目开发规范

本文件是项目的单一事实来源，所有 AI 开发工具（Claude Code、Codex、Kimi 等）均以此为准。

## 1. 概述

基金持仓自动分析 Agent。每周分析持仓基金是否需要调仓，输出调仓建议。

**核心原则：纯规则驱动，禁止 LLM 主观判断。**

完整业务需求见 `docs/spec/SPEC.md`。

## 2. 项目范围

### 当前阶段（骨架搭建）

- DeepAgent 主编排器 + 2 个子 Agent 规格已就绪
- 规则引擎（rules-config）和基金注册表（fund-registry）已完成
- 状态存储（store）已完成
- 3 个纯计算函数已实现但**尚未接入主编排器**（联调阶段接入）

### 待开发

- MCP 数据获取联调（data_fetcher 子 Agent 对接 qieman）
- 纯计算函数接入主编排器
- 报告生成联调（reporter 子 Agent）
- 端到端测试

开发规划和进度见 `docs/PLAN.md`。

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
│   │   ├── market-calculator.ts   # [待接入] 纯函数：市场计算
│   │   ├── rule-matcher.ts        # [待接入] 纯函数：规则匹配
│   │   └── portfolio-optimizer.ts # [待接入] 纯函数：组合优化
│   ├── rules/
│   │   ├── rules-config.ts        # 5 类基金补仓/止盈规则配置
│   │   └── fund-registry.ts       # 12 只基金注册表（代码/名称/分类）
│   ├── state/
│   │   ├── types.ts               # 业务类型定义
│   │   └── store.ts               # JSON 状态读写（补仓点、近期高点）
│   ├── mcp/
│   │   └── client.ts              # qieman MCP 客户端 + mcpServers 配置
│   └── utils/
│       └── calc.ts                # 涨跌幅计算、格式化、周标识工具
├── data/
│   ├── buy-points.json            # 补仓点记录（运行时写入）
│   └── high-points.json           # 近期高点记录（运行时写入）
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

通过 `@langchain/mcp-adapters` 的 `MultiServerMCPClient` 接入，SSE 传输协议。

### 服务配置（`src/mcp/client.ts`）

```typescript
export const mcpServers = {
  qieman: {
    transport: "http" as const,
    url: process.env.QIEMAN_MCP_URL,
    headers: {
      "x-api-key": process.env.QIEMAN_API_KEY,
      Accept: "application/json, text/event-stream",
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
2. **补仓点必须持久化** — 每次补仓操作记录到 `data/buy-points.json`，止盈规则依赖此数据
3. **净值检查必输出** — 每次运行必须输出净值检查表，无论是否触发操作
4. **债券弹药库联动** — 其他资产触发第 3 档补仓时，自动触发债券减仓

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
| `docs/HOME.md` | 操作首页（持仓总览、规则速查） | 每周随持仓更新 |
| `docs/spec/SPEC.md` | 需求规格（规则权威定义） | 需求变更时 |
| `docs/PLAN.md` | 开发规划和进度 | 开发阶段变更时 |
| `docs/portfolio.md` | 当前持仓数据（唯一数据源） | 每周更新 |
| `docs/reports/TEMPLATE.md` | 周报输出模板 | 模板变更时 |
| `docs/reports/weekly/` | 每周持仓快照 | Agent 自动生成 |
| `docs/reports/analysis/` | 每周分析报告 | Agent 自动生成 |
| `docs/reports/suggestions/` | 调仓建议 | 触发规则时生成 |
| `docs/records/` | 实际操作记录 | 手动记录 |

## 10. 安全与合规

1. **API Key 不入库** — `.env` 已在 `.gitignore` 中，禁止在代码中硬编码密钥
2. **只读建议** — Agent 只输出调仓建议，不执行实际交易
3. **数据本地化** — 持仓数据和补仓记录存储在本地 JSON，不上传第三方
4. **LangSmith 追踪** — 所有 Agent 调用可通过 LangSmith 审计
