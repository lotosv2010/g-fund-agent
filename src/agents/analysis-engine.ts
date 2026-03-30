import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { FundInfo } from "../state/types";
import { calculateMarket } from "./market-calculator";
import { matchRules } from "./rule-matcher";
import { optimizePortfolio } from "./portfolio-optimizer";

/**
 * 分析引擎工具
 * 内部固定执行三个纯计算函数，确保流程完全确定性
 *
 * 流程：
 * 1. calculateMarket() - 计算市场指标
 * 2. matchRules() - 匹配触发规则
 * 3. optimizePortfolio() - 生成调仓建议
 */
export const analyzePortfolioTool = tool(
  async ({ funds }: { funds: FundInfo[] }) => {
    // 第一步：计算市场数据（跌幅、涨幅、补仓点）
    const marketData = await calculateMarket(funds);

    // 第二步：规则匹配（判断是否触发补仓/止盈）
    const ruleResults = matchRules(funds, marketData);

    // 第三步：组合优化（生成具体建议 + 债券联动）
    const suggestions = optimizePortfolio(funds, ruleResults);

    // 返回结构化结果
    return {
      summary: {
        totalFunds: funds.length,
        triggeredRules: ruleResults.length,
        totalSuggestions: suggestions.length,
      },
      marketData,
      ruleResults,
      suggestions,
      message: suggestions.length > 0
        ? `检测到 ${suggestions.length} 条调仓建议，请查看详情。`
        : "本周无触发规则，持仓保持不变。",
    };
  },
  {
    name: "analyze_portfolio",
    description: "分析基金持仓并生成调仓建议。输入基金数据，自动执行市场计算、规则匹配、组合优化三步流程，返回结构化分析结果。这是确定性规则引擎，不需要 LLM 判断。",
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
