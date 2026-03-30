# CLAUDE.md — Claude Code 专属指令

完整项目规范见 [AGENTS.md](./AGENTS.md)，以下为 Claude Code 补充指令。

## 工作方式

- 修改代码前先读取相关文件，理解上下文
- 修改后运行 `npx tsc --noEmit` 验证类型
- 不要主动 commit，等用户指示

## 关键文件速查

| 要做什么 | 看哪个文件 |
|----------|-----------|
| 理解业务规则 | `docs/spec/SPEC.md` |
| 查看开发进度 | `docs/PLAN.md` |
| 查看当前持仓 | `docs/portfolio.md` |
| 改基金列表 | `docs/portfolio.md`（推荐）或 `src/rules/fund-registry.ts`（兜底） |
| 改补仓/止盈阈值 | `src/rules/rules-config.ts` |
| 改 Agent 编排 | `src/agent.ts` |
| 改分析引擎 | `src/agents/analysis-engine.ts`（三个纯计算函数的入口） |
| 改市场计算逻辑 | `src/agents/market-calculator.ts`（高点、涨跌幅计算） |
| 改规则匹配逻辑 | `src/agents/rule-matcher.ts`（补仓/止盈档位判断） |
| 改组合优化逻辑 | `src/agents/portfolio-optimizer.ts`（建议生成、债券联动） |
| 改状态存储 | `src/state/store.ts`（补仓点、高点、触发档位） |
| 改子 Agent | `src/agents/data-fetcher.ts` 或 `reporter.ts` |
| 改 MCP 配置 | `src/mcp/client.ts` |
| 改 LLM 模型 | `src/models.ts` |
