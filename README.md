# G-Fund-Agent

基金持仓自动分析 Agent。根据预设规则分析持仓基金，判断是否需要调仓并输出建议。

**核心原则：纯规则驱动，禁止 LLM 主观判断。**

## 核心功能

### Phase 0：规则引擎基础
- **纯规则驱动**: 所有买卖决策由配置规则触发，LLM 仅用于数据获取和报告生成
- **多源数据**: 通过 MCP 接口实时获取基金净值数据（qieman / 且慢）
- **分类策略**: 按 5 类资产（宽基、科技、海外、债券、黄金）分别执行补仓/止盈规则
- **智能高点**: 60日滚动窗口，超过60天未创新高自动重置，避免长期横盘导致规则失效
- **精准止盈**: 按所有补仓点的加权平均成本计算止盈基准，多次补仓时更准确
- **档位去重**: 同一档位不会重复触发，只有更高档位或状态重置后才会再次触发
- **债券弹药库**: 深度下跌时自动触发债券减仓为补仓提供资金

### Phase 1：数据聚合 + 风控层
- **多维数据**: 聚合宏观指标、市场情绪等多源数据（当前MVP阶段）
- **三层风控**: 回撤控制 + 集中度检查 + 流动性预警
- **风险阻断**: 自动阻止超过止损线或高风险的建议
- **定时触发**: 支持 cron 定时运行（双周周四/每月13号/自定义）

### Phase 2：策略抽象层
- **可插拔策略**: 策略注册表，支持多策略并行运行
- **LLM 信号增强**: 基于市场环境调整规则信号强度（可选）
- **信号合并**: 规则信号 + LLM 信号协同，加权平均置信度
- **策略版本管理**: 自动存档策略配置，参数变更可追溯
- **全程追踪**: 所有决策可通过 LangSmith 追踪审计

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
# 可选：设置 USE_STRATEGY_ENGINE=true 启用策略引擎（V2）

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
│   ├── analysis-engine.ts     # 分析引擎（集成风控层）
│   ├── market-calculator.ts   # 市场计算（高点、涨跌幅）
│   ├── rule-matcher.ts        # 规则匹配（档位触发判断）
│   └── portfolio-optimizer.ts # 组合优化（建议生成）
├── rules/                # 规则配置 + 基金注册表
├── state/                # 类型定义 + 状态存储
│   └── store.ts              # 补仓点、高点、触发档位持久化
├── data/                 # 数据聚合层（Phase 1）
│   ├── context.ts            # 市场上下文聚合
│   └── providers/            # 数据源适配器
│       ├── qieman.ts         # 且慢 MCP
│       ├── macro.ts          # 宏观指标（MVP）
│       └── sentiment.ts      # 市场情绪（MVP）
├── risk/                 # 风控层（Phase 1）
│   ├── index.ts              # 风控聚合器
│   ├── drawdown.ts           # 回撤控制
│   ├── concentration.ts      # 集中度检查
│   └── liquidity.ts          # 流动性检查
├── scheduler/            # 定时任务（Phase 1）
│   └── config.ts             # Cron 配置
├── strategies/           # 策略层（Phase 2）
│   ├── types.ts              # 策略类型定义
│   ├── registry.ts           # 策略注册表
│   ├── grid-rebalance.ts     # 网格补仓策略
│   ├── llm-signal.ts         # LLM 信号增强
│   ├── version-manager.ts    # 策略版本管理
│   └── index.ts              # 统一导出
├── mcp/                  # qieman MCP 客户端
└── utils/                # 工具函数

data/                     # 运行时状态（已加入 .gitignore）
├── buy-points.json       # 补仓点记录
├── high-points.json      # 近期高点记录
└── triggered-tiers.json  # 已触发档位记录
```

## 文档

| 文档 | 说明 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 项目开发规范（AI 开发工具共用） |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | **架构设计文档（技术架构 + 业务流程）** |
| [docs/PLAN.md](./docs/PLAN.md) | 开发规划和进度（Phase 0-4） |
| [docs/USAGE.md](./docs/USAGE.md) | 使用说明和操作步骤 |
| [docs/TESTING.md](./docs/TESTING.md) | 联调测试指南（Phase 0） |
| [docs/SCHEDULING.md](./docs/SCHEDULING.md) | 定时运行配置指南（Phase 1） |
| [docs/STRATEGY-GUIDE.md](./docs/STRATEGY-GUIDE.md) | **策略使用指南（Phase 2）** |
| [docs/spec/SPEC.md](./docs/spec/SPEC.md) | 完整需求规格 |
| [docs/HOME.md](./docs/HOME.md) | 操作首页（持仓总览、规则速查） |
| [docs/portfolio.md](./docs/portfolio.md) | 当前持仓数据（自动更新） |

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
