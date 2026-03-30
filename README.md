# G-Fund-Agent

基金持仓自动分析 Agent。根据预设规则分析持仓基金，判断是否需要调仓并输出建议。

**核心原则：纯规则驱动，禁止 LLM 主观判断。**

## 功能

- 通过 MCP 接口实时获取基金净值数据
- 按 5 类资产（宽基、科技、海外、债券、黄金）分别执行补仓/止盈规则
- 自动生成净值检查表、调仓建议、仓位偏离分析
- 支持债券弹药库联动（深度下跌时自动触发债券减仓补仓）
- 所有决策可通过 LangSmith 追踪审计

## 目标仓位

| 资产类别 | 目标占比 | 包含基金 |
|----------|----------|----------|
| 宽基类 | 35% | 沪深300、A500、创业板 |
| 科技主题类 | 15% | 人工智能、半导体、机器人 |
| 海外类 | 15% | 标普500、纳斯达克科技、中概互联 |
| 债券（弹药库） | 30% | 华泰柏瑞纯债、裕祥回报债券 |
| 黄金 | 5% | 华安黄金ETF |

## 快速开始

详细步骤见 [docs/USAGE.md](./docs/USAGE.md)。

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 API Key

# 3. 启动开发服务器
pnpm dev

# 4. 打开 LangSmith Studio
# 访问控制台输出的 URL，输入"分析我的持仓并给出调仓建议"
```

## 技术栈

| 项 | 值 |
|----|-----|
| 语言 | TypeScript |
| 包管理 | pnpm |
| AI 框架 | deepagents + langchain + @langchain/langgraph |
| LLM | Ollama（本地模型） |
| 数据源 | qieman MCP（且慢） |
| CLI | langgraphjs |
| 追踪 | LangSmith |

## 项目结构

```
src/
├── agent.ts              # DeepAgent 主编排器（入口）
├── models.ts             # LLM 模型配置
├── agents/               # 子 Agent 和纯计算函数
├── rules/                # 规则配置 + 基金注册表
├── state/                # 类型定义 + 状态读写
├── mcp/                  # qieman MCP 客户端
└── utils/                # 工具函数
```

## 文档

| 文档 | 说明 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 项目开发规范（AI 开发工具共用） |
| [docs/USAGE.md](./docs/USAGE.md) | 使用说明和操作步骤 |
| [docs/spec/SPEC.md](./docs/spec/SPEC.md) | 完整需求规格 |
| [docs/HOME.md](./docs/HOME.md) | 操作首页（持仓总览、规则速查） |
| [docs/PLAN.md](./docs/PLAN.md) | 开发规划和进度 |
| [docs/portfolio.md](./docs/portfolio.md) | 当前持仓数据 |

## 常用命令

```bash
pnpm dev          # 启动开发服务器 (port 2024)
pnpm build        # 构建
pnpm up           # 启动服务
pnpm down         # 停止服务
npx tsc --noEmit  # 类型检查
```

## License

ISC
