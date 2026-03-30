import "dotenv/config";
import { createDeepAgent } from "deepagents";
import type { DeepAgent, DeepAgentTypeConfig } from "deepagents";
import { ollamaModel } from "./models";
import { getMcpTools } from "./mcp/client";
import { dataFetcherSpec } from "./agents/data-fetcher";
import { reporterSpec } from "./agents/reporter";
import { analyzePortfolioTool } from "./agents/analysis-engine";
import { loadFundList } from "./utils/fund-loader";

/** 创建 DeepAgent 主编排器 */
async function createFundAgent() {
  // 动态加载基金列表
  const fundRegistry = await loadFundList();
  const fundCodes = fundRegistry.map((f) => f.code).join("、");

  const SYSTEM_PROMPT = `你是基金持仓分析编排器。你必须严格按照以下流程执行，禁止跳过任何步骤。

## 强制执行流程

### 第一步：获取数据（必须执行）
使用 task 工具调用 data_fetcher 子代理，获取以下基金的最新净值数据：
${fundCodes}

你不能凭记忆或猜测回答任何基金数据。所有净值、持仓数据必须通过工具实时获取。
如果你没有调用工具就给出了净值数据，那就是错误的。

### 第二步：分析数据（必须执行）
使用 analyze_portfolio 工具分析获取到的基金数据。
该工具是确定性规则引擎，会自动执行以下计算：
- 市场计算：计算近期高点、跌幅、涨幅
- 规则匹配：判断是否触发补仓/止盈
- 组合优化：生成调仓建议、债券联动

你只需要将第一步获取的基金数据传入此工具，不需要也不允许做任何主观判断。

### 第三步：生成报告（必须执行）
使用 task 工具调用 reporter 子代理，将分析结果格式化为 Markdown 周报并保存。

## 约束
- 禁止凭空编造任何基金净值或持仓数据
- 禁止跳过工具调用直接回答
- 禁止做任何主观投资建议
- 所有买卖建议必须由规则触发，不由你决定`;

  const qiemanTools = await getMcpTools("qieman");

  return createDeepAgent({
    model: ollamaModel,
    tools: [...qiemanTools, analyzePortfolioTool],
    subagents: [
      { ...dataFetcherSpec, tools: qiemanTools },
      reporterSpec,
    ],
    systemPrompt: SYSTEM_PROMPT,
  });
}

/** langgraphjs CLI 入口 */
export const agent: Promise<DeepAgent<DeepAgentTypeConfig>> = createFundAgent();
