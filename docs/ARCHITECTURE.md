# 架构设计（ARCHITECTURE）

> 本文档定义系统的技术架构，是 AI 辅助开发的技术约束。
> 所有代码实现必须与本文档保持一致，架构变更必须先更新本文档。

## 1. 技术选型

| 层级 | 选型 | 选型理由 |
|------|------|----------|
| 语言 | TypeScript (strict) | 类型安全 + Zod 运行时校验 |
| Agent | DeepAgents + LangGraph | Agent 编排 + 状态图 + LangGraph Server |
| LLM | 多模型注册表 | 灵活切换，不锁定厂商 |
| 数据源 | 且慢 MCP | 标准化协议，开箱即用 |
| Schema | Zod v4 | 运行时验证 + TypeScript 类型推导 |
| 可观测性 | LangSmith | LangChain 生态原生 Tracing |
| 包管理 | pnpm | 速度快 + 严格依赖 |

## 2. 分层架构

```
src/
├── index.ts / cli.ts       入口层（LangGraph / CLI）
├── bootstrap.ts             共享初始化（MCP + 工具注册）
├── domain/                  领域层（零外部依赖，Zod 除外）
│   ├── config.ts             环境变量 Schema + 校验
│   ├── errors.ts             自定义错误
│   └── schemas/              Zod Schema 定义
├── modules/                 功能模块（垂直切片）
│   ├── agent/                DeepAgent 工厂 + Prompt
│   ├── llm/                  多模型 LLM（注册表 + 工厂）
│   └── mcp/                  MCP 客户端生命周期
├── services/                业务服务层（跨模式共享）
│   ├── portfolio-update.service.ts  持仓更新核心逻辑
│   └── portfolio-update.tool.ts     LangChain Tool（LangGraph 模式）
└── utils/                   工具函数
    ├── portfolio-loader.ts   持仓加载（按日期查找最新文件）
    ├── portfolio-writer.ts   持仓写入（按交易日期命名）
    ├── portfolio-updater.ts  持仓计算（涨跌更新、交易操作）
    ├── strategy-loader.ts    操作策略加载
    └── colors.ts             CLI 颜色工具
```

### 依赖规则

> 分层约束详表和架构红线见 `.claude/rules/architecture.md`（自动加载）

```
domain/    → 零外部依赖（Zod 除外）
modules/   → 可依赖 domain，模块间禁止直接引用
services/  → 可依赖 domain + utils，不依赖 modules
utils/     → 可依赖 domain，纯函数为主
```

## 3. 双模式架构

### CLI 模式 (`cli.ts`)

CLI 发送显式场景指令 → Agent 返回结构化文本 → CLI 解析处理 + 交互确认。

```
用户选择功能 → buildXxxInstruction() → Agent → 解析回复 → 交互确认 → 保存
```

### LangGraph 模式 (`index.ts`)

用户自由输入 → Agent 根据 System Prompt 自主选择工具 → 直接完成操作。

```
用户自然语言 → Agent → 自主调用 MCP + UpdatePortfolioFile → 返回结果
```

**共享层：** 两种模式共享 System Prompt、业务服务层（services/）、工具集。

## 4. 启动流程

```
bootstrap(modelId)
  → validateEnv()           环境变量 fail-fast 校验
  → loadPortfolio()         加载最新持仓文件（按日期匹配）
  → loadStrategy()          加载操作策略
  → getModel(modelId)       注册表查找 + 工厂创建
  → McpService.getTools()   幂等 MCP 客户端初始化
  → 合并工具列表             MCP 工具 + UpdatePortfolioFile
  → createFundAgent()       组装 model + tools + prompt
  ← { agent, tools, mcp }
```

## 5. 核心模块设计

### 5.1 LLM 模块（`modules/llm/`）

**模式：** 注册表 + 工厂

**扩展方式：**
1. `MODEL_REGISTRY` 添加模型配置
2. 如需新协议，`CLIENT_FACTORY` 添加构建函数

### 5.2 MCP 模块（`modules/mcp/`）

| 文件 | 职责 |
|------|------|
| `mcp.config.ts` | 服务注册表（新增数据源添加条目即可） |
| `mcp.service.ts` | 客户端生命周期（幂等初始化 + 优雅关闭） |

### 5.3 Agent 模块（`modules/agent/`）

工厂函数 `createFundAgent()`，接收抽象的 `BaseChatModel` + `StructuredToolInterface[]`，不绑定具体实现。

### 5.4 Services（`services/`）

跨模式共享的业务逻辑。CLI 和 LangGraph 模式都通过 services 层完成持仓更新的解析、计算和持久化。

## 6. 数据模型

### 持仓快照（`data/portfolio-YYYY-MM-DD.json`）

> 源码定义见 `src/domain/schemas/portfolio.schema.ts`

```typescript
const HoldingItemSchema = z.object({
  fundCode: z.string(),              // 基金代码（6 位数字）
  fundName: z.string().optional(),   // 基金名称（可选，可通过 MCP 补全）
  amount: z.number(),                // 持仓金额（元）
  returnRate: z.number().optional(), // 持仓收益率（小数，如 0.2953）
  costBasis: z.number().optional(),  // 成本净值
});

const TargetAllocationItemSchema = z.object({
  fundCode: z.string(),              // 基金代码
  fundName: z.string().optional(),   // 基金名称
  targetWeight: z.number(),          // 目标权重（%，0-100）
});

const PortfolioSchema = z.object({
  name: z.string().optional(),       // 组合名称
  target: z.number().optional(),     // 总目标仓位
  holdings: z.array(HoldingItemSchema),           // 当前持仓
  targetAllocations: z.array(TargetAllocationItemSchema).optional(), // 目标配置
});
```

### 操作策略（`data/strategy.json`）

按资产类别定义补仓/止盈触发规则，结构化 JSON 格式。详见 `docs/fund-manual.md`。

## 7. 技术决策记录（ADR）

### ADR-01: 双模式架构

- **背景：** 需要同时支持开发调试（CLI）和生产部署（LangGraph Server）
- **决策：** 共享 bootstrap + services 层，入口层分离
- **后果：** 业务逻辑只写一份，两个入口各自处理 I/O 差异

### ADR-02: 多模型注册表

- **背景：** 不同场景对模型能力/成本要求不同，且需降低厂商锁定风险
- **决策：** 注册表 + 工厂模式，运行时按 modelId 选择
- **后果：** 新增模型只需注册配置，不改业务代码

### ADR-03: MCP 统一数据源

- **背景：** 基金数据获取方式多样（API / 爬虫 / SDK）
- **决策：** 统一走且慢 MCP，不自建爬虫
- **后果：** 数据层标准化，维护成本低；依赖且慢服务可用性

### ADR-04: 本地 JSON 持久化

- **背景：** 个人工具无需数据库级别的持久化
- **决策：** 按交易日期命名 JSON 文件，同日覆盖、历史不删
- **后果：** 零运维成本，天然版本化；不支持多用户并发
