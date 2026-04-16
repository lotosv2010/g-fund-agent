# 架构规则

> 本文件由 Claude Code 自动加载，指导架构决策和模块扩展。
> 完整架构设计见 `docs/ARCHITECTURE.md`。

## 分层约束

| 层级 | 可依赖 | 禁止依赖 |
|------|--------|----------|
| `domain/` | Zod | 任何外部包、其他层 |
| `modules/` | domain | 其他 module、services、utils |
| `services/` | domain、utils | modules |
| `utils/` | domain | modules、services |
| 入口层（`index.ts`/`cli.ts`） | 所有层 | — |

**违规判断：** 如果一个 import 路径跨越了上表的禁止边界，必须重构。

## 新增模块检查清单

新建 `modules/<name>/` 时必须满足：

1. 包含 `index.ts` 作为唯一公开出口
2. 内部文件按职责命名：`<name>.service.ts` / `<name>.tool.ts`
3. 仅依赖 `domain/`，不直接引用其他 module
4. Tool 的输入/输出必须定义 Zod Schema
5. 公开 API 必须有 JSDoc

## 新增 LLM 模型

1. `modules/llm/llm.service.ts` → `MODEL_REGISTRY` 添加配置条目
2. 如需新协议 → `CLIENT_FACTORY` 添加构建函数
3. 不修改任何调用方代码

## 新增 MCP 数据源

1. `modules/mcp/mcp.config.ts` → 添加服务配置条目
2. 不修改 `mcp.service.ts`（幂等初始化自动适配）

## 新增业务服务

1. 在 `services/` 下创建 `<name>.service.ts`（核心逻辑）
2. 如需 LangGraph Tool → 创建 `<name>.tool.ts`
3. 在 `services/index.ts` 统一导出
4. 可依赖 `domain/` + `utils/`，禁止依赖 `modules/`

## 架构红线

- **禁止循环依赖** — 任何层级间不得出现循环 import
- **禁止跨模块直接引用** — modules 之间通过 domain 共享类型，通过 bootstrap 组装
- **禁止在非入口层使用 `process.env`** — 环境变量统一由 `domain/config.ts` 校验后注入
- **禁止在 domain 层引入运行时副作用** — domain 必须是纯数据定义 + 校验
