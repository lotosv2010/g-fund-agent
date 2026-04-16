# G-Fund-Agent — 顾投 AI 助手

## 项目定位

面向个人投资者的基金顾投 AI 助手，基于 DeepAgents + LangGraph + 多模型 LLM，通过且慢 MCP 获取基金数据。支持 CLI 交互和 LangGraph Server 两种运行模式。

> 产品规格见 `docs/SPEC.md` | 视觉交互见 `docs/DESIGN.md` | 技术架构见 `docs/ARCHITECTURE.md`

## 技术栈

| 类别 | 选型 |
|------|------|
| 语言 | TypeScript (strict) + Zod v4 |
| Agent | DeepAgents + LangGraph |
| LLM | 多模型注册表（DeepSeek / Gemini / Moonshot / MiniMax / Ollama） |
| 数据源 | 且慢 MCP（@langchain/mcp-adapters） |
| 可观测性 | LangSmith |
| 运行时 | Node.js >= 20 |
| 包管理 | pnpm |

## 项目结构

```
├── CLAUDE.md                 # 项目入口文档（本文件）
├── .claude/                  # Vibe Coding 配置
│   ├── rules/                #   自动加载的规则
│   │   ├── coding.md         #     代码规范
│   │   ├── architecture.md   #     架构规则
│   │   └── review.md         #     审查规则
│   └── skills/               #   可复用 Skills（/skill-name 调用）
│       ├── spec-breakdown/   #     /spec-breakdown — 需求拆解
│       ├── solution-design/  #     /solution-design — 方案设计
│       └── code-review/      #     /code-review — 代码审查
├── docs/                     # 项目文档
│   ├── SPEC.md               #   产品规格说明
│   ├── DESIGN.md             #   视觉与交互设计规范
│   ├── ARCHITECTURE.md       #   技术架构设计
│   ├── fund-manual.md        #   基金手册
│   └── tasks/CURRENT.md      #   任务跟踪
├── data/                     # 数据文件
│   ├── portfolio-YYYY-MM-DD.json  # 持仓快照（按交易日期）
│   └── strategy.json              # 操作策略
├── src/
│   ├── index.ts              # LangGraph Server 入口
│   ├── cli.ts                # CLI 交互入口
│   ├── bootstrap.ts          # 共享初始化（MCP + 工具注册）
│   ├── domain/               # 领域层（零外部依赖，Zod 除外）
│   │   ├── config.ts         #   环境变量 Schema + 校验
│   │   ├── errors.ts         #   自定义错误
│   │   └── schemas/          #   Zod Schema 定义
│   ├── modules/              # 功能模块（垂直切片）
│   │   ├── agent/            #   DeepAgent 工厂 + Prompt
│   │   ├── llm/              #   多模型 LLM 注册表 + 工厂
│   │   └── mcp/              #   MCP 客户端生命周期
│   ├── services/             # 业务服务层（跨模式共享）
│   └── utils/                # 工具函数
├── package.json
├── tsconfig.json
└── langgraph.json
```

> 详细架构设计见 `docs/ARCHITECTURE.md`

## 编码规范

### 核心规则

1. Tool I/O 必须 Zod Schema 定义，禁止裸类型
2. `domain/` 零外部依赖（Zod 除外），模块间不直接 import
3. 基金数据统一走且慢 MCP，不自建爬虫
4. 禁止 `any` / `@ts-ignore` / 硬编码密钥
5. 模块代码禁止 `console.log`（CLI 入口例外）
6. 代码注释和项目文档统一使用中文
7. **禁止自动提交 Git** — 不主动执行 git commit/push，由用户手动触发

### 依赖规则 & 架构约束

> 详见 `.claude/rules/architecture.md`（分层约束表、扩展检查清单、架构红线）

### 代码规范

> 详见 `.claude/rules/coding.md`（TypeScript、Zod、命名、模块结构、错误处理、注释）

### 开发流程

1. 查阅 `docs/tasks/CURRENT.md` 确认优先级
2. 查阅 `docs/SPEC.md`（需求边界）+ `docs/DESIGN.md`（视觉交互）+ `docs/ARCHITECTURE.md`（技术约束）
3. 编写代码 → 遵循 `.claude/rules/coding.md`
4. 新增模块必须包含 `index.ts` 作为唯一出口
5. 更新 `docs/tasks/CURRENT.md` 任务状态

## 常用命令

```bash
# 安装依赖
pnpm install

# CLI 交互模式
pnpm cli

# LangGraph 开发服务器
pnpm dev

# 构建
pnpm build
```
