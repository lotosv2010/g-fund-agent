# 编码规范

> 本文件由 Claude Code 自动加载，是项目代码规范的唯一来源。
> 项目级约束（核心规则、依赖规则）见 `CLAUDE.md`。

## TypeScript 细则

- 严格模式 (`strict: true`)
- 禁止 `any` / `@ts-ignore`，用 Zod `z.infer<>` 推导类型
- 函数参数和返回值必须显式标注类型
- 使用 `readonly` 修饰不可变属性
- 优先使用 `const` 声明，避免 `let`

## Zod 使用规范

- Tool 输入/输出必须定义 Zod Schema
- 类型通过 `z.infer<typeof XxxSchema>` 导出，不手写重复类型
- Schema 命名：`PascalCase` + `Schema` 后缀（如 `PortfolioSchema`）

## 命名规范

| 类型 | 风格 | 示例 |
|------|------|------|
| 文件 | kebab-case | `fund-search.tool.ts` |
| 类/接口 | PascalCase | `FundSearchTool` |
| 函数/变量 | camelCase | `getFundDetail` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Schema | PascalCase + Schema | `FundSchema` |
| 文件后缀 | 按职责 | `*.tool.ts` / `*.service.ts` / `*.schema.ts` / `*.spec.ts` |

## 模块结构

```
modules/<name>/
├── index.ts              # 唯一公开出口
├── <name>.service.ts     # 业务逻辑
├── <name>.tool.ts        # LangChain Tool
└── __tests__/
```

- 新增模块必须包含 `index.ts` 作为唯一出口
- 模块间禁止直接引用，通过 `domain/` 共享类型

## 错误处理

- 业务错误使用自定义 Error 类（`domain/errors.ts`）
- 禁止空 catch
- Agent Tool 内部必须 try-catch 并返回结构化错误

## 注释与文档

- 代码注释和项目文档统一使用中文
- 公开 API 必须有 JSDoc
- 注释说明"为什么"，而非"做什么"

## 依赖规则

> 详见 `CLAUDE.md` 编码规范 → 依赖规则
