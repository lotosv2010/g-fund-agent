# G-Fund-Agent — 顾投 AI 助手

## 项目定位

面向个人投资者的基金顾投 AI 助手，基于 DeepAgents + LangGraph + 多模型 LLM，通过且慢 MCP 获取基金数据。

## 技术栈

- TypeScript (strict) + Zod v4
- DeepAgents + LangGraph（Agent 编排）
- 多模型 LLM（DeepSeek / Gemini / Moonshot / MiniMax / Ollama）
- 且慢 MCP（@langchain/mcp-adapters）
- LangSmith（可观测性）

## 核心规则

1. Tool I/O 必须 Zod Schema 定义，禁止裸类型
2. `domain/` 零外部依赖（Zod 除外），模块间不直接 import
3. 基金数据统一走且慢 MCP，不自建爬虫
4. 禁止 `any` / `@ts-ignore` / 硬编码密钥
5. 模块代码禁止 `console.log`（CLI 入口例外）
6. 代码注释和项目文档统一使用中文
7. **禁止自动提交 Git** — 不主动执行 git commit/push，由用户手动触发
8. 编码细则见 `.claude/rules/coding.md`

## 开发流程

1. 查阅 `docs/tasks/CURRENT.md` 确认优先级
2. 查阅 `docs/PRODUCT.md`（需求边界）+ `docs/ARCHITECTURE.md`（技术约束）
3. 编写代码 → 遵循 `.claude/rules/coding.md`
4. 新增模块必须包含 `index.ts` 作为唯一出口
5. 更新 `docs/tasks/CURRENT.md` 任务状态
