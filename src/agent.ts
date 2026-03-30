import "dotenv/config";
import { createDeepAgent } from "deepagents";
import type { DeepAgent, DeepAgentTypeConfig } from "deepagents";
import { ollamaModel } from "./models";
import { getMcpTools } from "./mcp/client";
import { dataFetcherSpec } from "./agents/data-fetcher";
import { reporterSpec } from "./agents/reporter";
import { analyzePortfolioTool } from "./agents/analysis-engine";
import { analyzePortfolioV2Tool } from "./agents/analysis-engine-v2";
import { loadFundList } from "./utils/fund-loader";
import { validateConfig, printValidationResult } from "./utils/config-validator";

/** 创建 DeepAgent 主编排器 */
async function createFundAgent() {
  // 配置一致性检查
  console.log("[agent] 正在检查配置一致性...");
  const validationResult = validateConfig();
  printValidationResult(validationResult);

  if (!validationResult.valid) {
    throw new Error("配置检查失败，请修复后重新启动");
  }

  // 动态加载基金列表
  const fundRegistry = await loadFundList();
  const fundCodes = fundRegistry.map((f) => f.code).join("、");

  // Phase 2: 支持策略驱动的分析引擎（通过环境变量启用）
  const useV2Engine = process.env.USE_STRATEGY_ENGINE === "true";
  const analysisTools = useV2Engine
    ? [analyzePortfolioV2Tool]
    : [analyzePortfolioTool];

  const SYSTEM_PROMPT = `你是基金持仓分析编排器。你必须严格按照以下流程执行，禁止跳过任何步骤。

## 强制执行流程

### 第一步：获取数据（必须执行）
使用 task 工具调用 data_fetcher 子代理，获取以下基金的最新净值数据：
${fundCodes}

你不能凭记忆或猜测回答任何基金数据。所有净值、持仓数据必须通过工具实时获取。
如果你没有调用工具就给出了净值数据，那就是错误的。

### 第二步：分析数据（必须执行）
使用 ${useV2Engine ? "analyze_portfolio_v2" : "analyze_portfolio"} 工具分析获取到的基金数据。
${useV2Engine ? "该工具是策略驱动的分析引擎，支持多策略并行和 LLM 信号增强（可选）。" : "该工具是确定性规则引擎，会自动执行以下计算："}
- 市场计算：计算近期高点、跌幅、涨幅
- ${useV2Engine ? "策略执行：运行所有已注册的策略" : "规则匹配：判断是否触发补仓/止盈"}
- ${useV2Engine ? "信号合并：合并多个策略的信号" : "组合优化：生成调仓建议、债券联动"}
- 风控检查：回撤、集中度、流动性检查

你只需要将第一步获取的基金数据传入此工具，不需要也不允许做任何主观判断。

### 第三步：生成报告（必须执行）
使用 task 工具调用 reporter 子代理，将分析结果格式化为 Markdown 周报并保存。

## 约束
- 禁止凭空编造任何基金净值或持仓数据
- 禁止跳过工具调用直接回答
- 禁止做任何主观投资建议
- 所有买卖建议必须由规则触发，不由你决定`;

  const qiemanTools = await getMcpTools("qieman");

  if (useV2Engine) {
    console.log("[agent] ✅ 使用策略驱动的分析引擎（V2）");
  } else {
    console.log("[agent] ℹ️  使用规则驱动的分析引擎（V1）");
    console.log("[agent] 提示: 设置 USE_STRATEGY_ENGINE=true 启用策略引擎");
  }

  return createDeepAgent({
    model: ollamaModel,
    tools: [...qiemanTools, ...analysisTools],
    subagents: [
      { ...dataFetcherSpec, tools: qiemanTools },
      reporterSpec,
    ],
    systemPrompt: SYSTEM_PROMPT,
  });
}

/** langgraphjs CLI 入口 */
export const agent: Promise<DeepAgent<DeepAgentTypeConfig>> = createFundAgent();
