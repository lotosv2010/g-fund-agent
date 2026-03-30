import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { FundInfo, Suggestion } from "../state/types";
import { calculateMarket } from "./market-calculator";
import { buildMarketContext, summarizeMarketContext } from "../data/context";
import { performRiskChecks, filterBlockedSuggestions, summarizeRiskChecks } from "../risk";
import { strategyRegistry, gridRebalanceStrategy, LLMSignalStrategy } from "../strategies";
import type { StrategyContext, MergedSignal } from "../strategies/types";

/**
 * 分析引擎 V2（Phase 2：策略驱动）
 *
 * 核心变化：
 * - 引入策略注册表，支持多策略并行
 * - LLM 信号增强（可选）
 * - 信号合并机制
 * - 保持风控层和数据聚合
 *
 * 流程：
 * 1. 构建市场上下文
 * 2. 执行所有启用的策略
 * 3. 合并策略信号
 * 4. 转换为调仓建议
 * 5. 风控检查和过滤
 */

/**
 * 初始化策略注册表
 */
function initializeStrategies() {
  // 注册网格补仓策略（规则信号）
  if (!strategyRegistry.get("grid-rebalance")) {
    strategyRegistry.register(gridRebalanceStrategy);
  }

  // 注册 LLM 信号增强策略（可选，通过环境变量控制）
  const enableLLM = process.env.ENABLE_LLM_SIGNAL === "true";
  if (enableLLM && !strategyRegistry.get("llm-signal")) {
    strategyRegistry.register(new LLMSignalStrategy(true, 0.3));
  }
}

/**
 * 将合并信号转换为调仓建议
 */
function convertSignalsToSuggestions(
  mergedSignals: MergedSignal[],
  funds: FundInfo[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const signal of mergedSignals) {
    if (signal.action === "hold") continue;

    const fund = funds.find((f) => f.code === signal.code);
    if (!fund || !signal.amount) continue;

    suggestions.push({
      code: signal.code,
      name: fund.name,
      action: signal.action,
      amount: signal.amount,
      reason: signal.reason,
    });
  }

  return suggestions;
}

export const analyzePortfolioV2Tool = tool(
  async ({ funds, enableLLM = false }: { funds: FundInfo[]; enableLLM?: boolean }) => {
    // 初始化策略
    initializeStrategies();

    // 如果运行时指定启用 LLM，注册 LLM 策略
    if (enableLLM && !strategyRegistry.get("llm-signal")) {
      strategyRegistry.register(new LLMSignalStrategy(true, 0.3));
    }

    // 第一步：构建市场上下文
    const marketData = await calculateMarket(funds);
    const marketContext = await buildMarketContext(funds, marketData);

    // 第二步：执行所有策略
    const strategyContext: StrategyContext = {
      funds,
      marketData,
      marketContext,
      timestamp: new Date().toISOString(),
    };

    const signalsByStrategy = await strategyRegistry.executeAll(strategyContext);

    // 第三步：合并策略信号
    const mergedSignals = strategyRegistry.mergeSignals(signalsByStrategy);

    // 第四步：转换为调仓建议
    let suggestions = convertSignalsToSuggestions(mergedSignals, funds);

    // 第五步：风控检查
    const riskResults = performRiskChecks(funds, marketData, suggestions);

    // 第六步：过滤被阻止的建议
    const originalCount = suggestions.length;
    suggestions = filterBlockedSuggestions(suggestions, riskResults);
    const blockedCount = originalCount - suggestions.length;

    // 生成摘要
    const marketSummary = summarizeMarketContext(marketContext);
    const riskSummary = summarizeRiskChecks(riskResults);
    const strategyStats = strategyRegistry.getStats();

    // 返回结构化结果
    return {
      summary: {
        totalFunds: funds.length,
        activeStrategies: strategyRegistry.getEnabledStrategies().length,
        totalSignals: mergedSignals.length,
        totalSuggestions: suggestions.length,
        blockedSuggestions: blockedCount,
        riskChecks: riskResults.length,
      },
      marketContext,
      marketData,
      strategySignals: Object.fromEntries(signalsByStrategy),
      mergedSignals,
      suggestions,
      riskResults,
      marketSummary,
      riskSummary,
      strategyStats,
      message: suggestions.length > 0
        ? `策略分析完成，检测到 ${suggestions.length} 条调仓建议${blockedCount > 0 ? `（风控阻止 ${blockedCount} 条）` : ""}，涉及 ${strategyRegistry.getEnabledStrategies().length} 个策略。`
        : "策略分析完成，当前无需调仓。",
    };
  },
  {
    name: "analyze_portfolio_v2",
    description: "策略驱动的持仓分析工具（Phase 2）。支持多策略并行、LLM 信号增强、信号合并。输入基金数据和是否启用 LLM，自动执行策略管道并输出建议。",
    schema: z.object({
      funds: z.array(
        z.object({
          name: z.string(),
          code: z.string(),
          category: z.string(),
          nav: z.number(),
          navLastWeek: z.number(),
          holdingAmount: z.number(),
          holdingCost: z.number(),
          returnRate: z.number(),
        })
      ),
      enableLLM: z.boolean().optional().default(false).describe("是否启用 LLM 信号增强"),
    }),
  }
);
