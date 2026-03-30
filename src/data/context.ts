import type { FundInfo, MarketData, ExtendedMarketContext } from "../state/types";
import { getMacroIndicators } from "./providers/macro";
import { getSentimentIndicators } from "./providers/sentiment";

/**
 * 市场上下文聚合器
 * 整合多源数据为统一的 ExtendedMarketContext
 *
 * 作用：
 * 1. 归一化不同数据源的返回格式
 * 2. 处理数据源异常（单个数据源失败不影响整体）
 * 3. 提供统一的数据访问接口
 */

/**
 * 构建扩展市场上下文
 *
 * @param funds - 基金净值数据（来自 MCP）
 * @param marketData - 市场计算结果（来自 market-calculator）
 * @returns 包含多源数据的完整市场上下文
 */
export async function buildMarketContext(
  funds: FundInfo[],
  marketData: MarketData[]
): Promise<ExtendedMarketContext> {
  const context: ExtendedMarketContext = {
    funds,
    marketData,
  };

  // 尝试获取宏观指标（失败不阻断）
  try {
    context.macro = await getMacroIndicators();
  } catch (error) {
    console.warn("[context] 宏观指标获取失败:", error instanceof Error ? error.message : String(error));
  }

  // 尝试获取市场情绪（失败不阻断）
  try {
    context.sentiment = await getSentimentIndicators();
  } catch (error) {
    console.warn("[context] 市场情绪获取失败:", error instanceof Error ? error.message : String(error));
  }

  // TODO: Phase 1 暂不接入行业指数，Phase 2 再扩展
  // context.industries = await getIndustryIndices();

  return context;
}

/**
 * 生成市场环境摘要
 * 用于报告中的"市场环境"章节
 */
export function summarizeMarketContext(context: ExtendedMarketContext): string {
  const sections: string[] = [];

  // 宏观环境
  if (context.macro) {
    const macroItems: string[] = [];
    if (context.macro.bondYield10Y !== undefined) {
      macroItems.push(`国债收益率 ${context.macro.bondYield10Y.toFixed(2)}%`);
    }
    if (context.macro.pmi !== undefined) {
      macroItems.push(`PMI ${context.macro.pmi.toFixed(1)}`);
    }
    if (macroItems.length > 0) {
      sections.push(`**宏观**: ${macroItems.join("、")}`);
    }
  }

  // 市场情绪
  if (context.sentiment) {
    const sentimentItems: string[] = [];
    if (context.sentiment.marginBalance !== undefined) {
      sentimentItems.push(`融资余额 ${(context.sentiment.marginBalance / 10000).toFixed(2)}万亿`);
    }
    if (context.sentiment.northboundFlow !== undefined) {
      const sign = context.sentiment.northboundFlow >= 0 ? "+" : "";
      sentimentItems.push(`北向资金 ${sign}${context.sentiment.northboundFlow.toFixed(0)}亿`);
    }
    if (sentimentItems.length > 0) {
      sections.push(`**情绪**: ${sentimentItems.join("、")}`);
    }
  }

  if (sections.length === 0) {
    return "市场环境数据暂不可用（Phase 1 MVP阶段）";
  }

  return sections.join("\n\n");
}
