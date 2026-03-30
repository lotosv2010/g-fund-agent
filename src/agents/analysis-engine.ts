import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { FundInfo } from "../state/types";
import { calculateMarket } from "./market-calculator";
import { matchRules } from "./rule-matcher";
import { optimizePortfolio } from "./portfolio-optimizer";
import { buildMarketContext, summarizeMarketContext } from "../data/context";
import { performRiskChecks, filterBlockedSuggestions, summarizeRiskChecks } from "../risk";

/**
 * 分析引擎工具（Phase 1：集成数据上下文 + 风控层）
 * 内部固定执行流程，确保决策可审计
 *
 * 流程：
 * 1. buildMarketContext() - 聚合多源数据
 * 2. calculateMarket() - 计算市场指标
 * 3. matchRules() - 匹配触发规则
 * 4. optimizePortfolio() - 生成调仓建议
 * 5. performRiskChecks() - 风控检查
 * 6. filterBlockedSuggestions() - 过滤被阻止的建议
 */
export const analyzePortfolioTool = tool(
  async ({ funds }: { funds: FundInfo[] }) => {
    // 第零步：构建市场上下文（Phase 1 新增）
    const marketData = await calculateMarket(funds);
    const marketContext = await buildMarketContext(funds, marketData);

    // 第一步：规则匹配（判断是否触发补仓/止盈）
    const ruleResults = await matchRules(funds, marketData);

    // 第二步：组合优化（生成具体建议 + 债券联动）
    let suggestions = optimizePortfolio(funds, ruleResults);

    // 第三步：风控检查（Phase 1 新增）
    const riskResults = performRiskChecks(funds, marketData, suggestions);

    // 第四步：过滤被阻止的建议（Phase 1 新增）
    const originalCount = suggestions.length;
    suggestions = filterBlockedSuggestions(suggestions, riskResults);
    const blockedCount = originalCount - suggestions.length;

    // 生成摘要
    const marketSummary = summarizeMarketContext(marketContext);
    const riskSummary = summarizeRiskChecks(riskResults);

    // 返回结构化结果
    return {
      summary: {
        totalFunds: funds.length,
        triggeredRules: ruleResults.length,
        totalSuggestions: suggestions.length,
        blockedSuggestions: blockedCount,
        riskChecks: riskResults.length,
      },
      marketContext,
      marketData,
      ruleResults,
      suggestions,
      riskResults,
      marketSummary,
      riskSummary,
      message: suggestions.length > 0
        ? `检测到 ${suggestions.length} 条调仓建议${blockedCount > 0 ? `（风控阻止 ${blockedCount} 条）` : ""}，请查看详情。`
        : "本周无触发规则，持仓保持不变。",
    };
  },
  {
    name: "analyze_portfolio",
    description: "分析基金持仓并生成调仓建议。输入基金数据，自动执行：数据聚合、市场计算、规则匹配、组合优化、风控检查。Phase 1 新增多源数据整合和风控层，确保决策合规且可审计。",
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
    }),
  }
);
