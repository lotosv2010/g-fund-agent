# G-Fund-Agent

面向个人投资者的基金顾投 AI 助手。基于 DeepAgents + LangGraph，支持多模型 LLM，通过且慢 MCP 获取基金数据。

## 功能

- **查看持仓** — 获取基金信息和净值，表格展示
- **分析持仓** — 多维度诊断（资产配置、行业集中度、相关性、风险、策略评估）
- **更新持仓** — 自动获取涨跌幅，支持加仓/减仓记录，按交易日期保存
- **自由对话** — 基金相关问答

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少配置：
- `QIEMAN_API_KEY` — 且慢 MCP API Key（必需，基金数据源）
- 至少一个 LLM 的 API Key（如 `DEEPSEEK_API_KEY`、`GEMINI_API_KEY`，或使用本地 Ollama）

### 3. 准备持仓数据

复制模板并填入你的实际持仓：

```bash
cp data/portfolio.xxxx-xx-xx.json data/portfolio-2026-04-16.json
```

文件名格式：`portfolio-YYYY-MM-DD.json`（日期为数据对应的交易日）。

### 4. 运行

```bash
# CLI 交互模式
pnpm cli

# LangGraph Studio（localhost:2024）
pnpm dev
```

## 使用指南

### CLI 模式

启动后依次：
1. **选择模型** — 从已配置的 LLM 中选择
2. **选择功能** — 更新持仓 / 查看持仓 / 分析持仓 / 自由对话

#### 更新持仓

```
? 选择功能: 更新持仓 — 拉取涨跌 + 记录操作
数据来源: D:\...\data\portfolio-2026-04-15.json
⠋ 思考中...
已获取 13 只基金的涨跌数据，交易日: 2026-04-16
? 2026-04-16 有加仓/减仓操作吗？ No

持仓变更对比:
  161631 融通人工智能指数(LOF  2557.38 → 2574.37  +0.66% (+16.99)  累计 +29.53%
  ...
  合计  49134.74 → 49195.89  +61.15

? 确认保存更新？ Yes
持仓数据已更新并保存到 D:\...\data\portfolio-2026-04-16.json
```

- 加仓/减仓输入格式：`基金代码 金额`（如 `161631 500` 或 `014320 -200`）
- 同一交易日多次更新会覆盖当日文件，历史文件不受影响

#### 分析持仓

Agent 自动调用且慢 MCP 工具，从持仓概览、业绩表现、资产配置、行业集中度、基金相关性、组合风险、综合诊断等维度逐步分析，结合操作策略给出建议。

#### 查看持仓

获取各基金最新净值和近期收益，用表格展示。

### LangGraph 模式

通过 LangGraph Studio（`pnpm dev`）与 Agent 自然语言交互。直接输入：

- "帮我更新持仓" — Agent 自动获取涨跌幅并调用 UpdatePortfolioFile 工具保存
- "分析一下我的持仓" — Agent 自动执行多维度分析
- "查看持仓概览" — Agent 获取数据并展示

### 持仓文件说明

```
data/
├── portfolio.xxxx-xx-xx.json   # 模板文件（提交到 git）
├── portfolio-2026-04-15.json   # 历史记录（gitignored）
├── portfolio-2026-04-16.json   # 最新数据（gitignored）
└── strategy.json               # 操作策略
```

- 系统自动加载日期最新的 `portfolio-YYYY-MM-DD.json`
- 更新时按涨跌幅数据对应的交易日期保存新文件
- `strategy.json` 定义操作策略，分析时自动参考

## 项目结构

```
src/
  index.ts             # LangGraph 入口
  cli.ts               # CLI 交互入口
  bootstrap.ts         # 共享初始化（MCP + 自定义工具注册）
  domain/              # 领域层（配置 + 错误 + Schema）
  modules/
    agent/             # DeepAgent 工厂 + Prompt
    llm/               # 多模型注册表 + 工厂
    mcp/               # MCP 客户端管理
  services/            # 业务服务层（CLI / LangGraph 共享）
  utils/               # 工具函数（加载、写入、计算）
```

## 文档

| 文档 | 说明 |
|------|------|
| [SPEC.md](docs/SPEC.md) | 产品规格说明 |
| [DESIGN.md](docs/DESIGN.md) | 视觉与交互设计规范 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技术架构设计 |
| [CURRENT.md](docs/tasks/CURRENT.md) | 任务跟踪 |

## 免责声明

所有分析和建议仅供参考，不构成投资建议。投资有风险，决策需谨慎。
