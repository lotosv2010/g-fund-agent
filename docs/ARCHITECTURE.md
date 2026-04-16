# 架构设计

## 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 语言 | TypeScript (strict) | 类型安全 |
| Agent | DeepAgents + LangGraph | Agent 编排 + 状态图 |
| LLM | 多模型注册表 | DeepSeek / Gemini / Moonshot / MiniMax / Ollama |
| 数据源 | 且慢 MCP | @langchain/mcp-adapters |
| Schema | Zod v4 | 运行时验证 + 类型推导 |
| 可观测性 | LangSmith | Tracing |

## 分层架构

```
src/
├── index.ts / cli.ts      入口层（LangGraph / CLI）
├── bootstrap.ts            共享初始化（MCP + 自定义工具注册）
├── domain/                 领域层（零外部依赖，Zod 除外）
│   ├── config.ts            环境变量 Schema + 校验
│   ├── errors.ts            自定义错误
│   └── schemas/             Zod Schema 定义
├── modules/                功能模块（垂直切片）
│   ├── agent/               DeepAgent 工厂 + Prompt
│   ├── llm/                 多模型 LLM（注册表 + 工厂）
│   └── mcp/                 MCP 客户端生命周期
├── services/               业务服务层（跨模式共享）
│   ├── portfolio-update.service.ts  持仓更新核心逻辑
│   └── portfolio-update.tool.ts     LangChain Tool（LangGraph 模式）
└── utils/                  工具函数
    ├── portfolio-loader.ts  持仓加载（按日期查找最新文件）
    ├── portfolio-writer.ts  持仓写入（按交易日期命名）
    ├── portfolio-updater.ts 持仓计算（涨跌更新、交易操作）
    ├── strategy-loader.ts   操作策略加载
    └── colors.ts            CLI 颜色工具
```

## 启动流程

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

## 双模式架构

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

两种模式共享：System Prompt、业务服务层（services/）、工具集。

## 模块说明

### LLM（`modules/llm/`）

注册表 + 工厂模式，新增模型两步：
1. `MODEL_REGISTRY` 添加配置
2. 如需新协议，`CLIENT_FACTORY` 添加构建函数

### MCP（`modules/mcp/`）

- `mcp.config.ts` — 服务注册表，新增数据源添加条目即可
- `mcp.service.ts` — 客户端生命周期（幂等初始化 + 优雅关闭）

### Agent（`modules/agent/`）

工厂函数 `createFundAgent()`，接收抽象的 `BaseChatModel` + `StructuredToolInterface[]`，不绑定具体实现。

### Services（`services/`）

跨模式共享的业务逻辑。CLI 和 LangGraph 模式都通过 services 层完成持仓更新的解析、计算和持久化。

## 依赖规则

- `domain/` → 零外部依赖（Zod 除外）
- `modules/` → 可依赖 domain，模块间禁止直接引用
- `services/` → 可依赖 domain + utils，不依赖 modules
- `utils/` → 可依赖 domain，纯函数为主
