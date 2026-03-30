import type { FundInfo, Suggestion, RiskCheckResult } from "../state/types";
import { FUND_REGISTRY } from "../rules/fund-registry";

/**
 * 流动性风险控制
 *
 * 风险点：
 * 1. QDII 基金赎回 T+7~10，资金占用时间长
 * 2. 大额赎回可能影响日常流动性
 *
 * 策略：
 * - QDII 补仓时提示资金到位时间
 * - 单笔赎回超过阈值时预警
 * - 总赎回超过阈值时预警
 */

/** 流动性阈值配置 */
export const LIQUIDITY_THRESHOLDS = {
  largeSellAmount: 5000,     // 单笔赎回超过5000元预警
  totalSellRatio: 0.20,      // 总赎回超过总仓位20%预警
};

/**
 * 检查流动性风险
 *
 * @param funds - 基金数据
 * @param suggestions - 调仓建议
 * @returns 风控检查结果
 */
export function checkLiquidityRisk(
  funds: FundInfo[],
  suggestions: Suggestion[]
): RiskCheckResult[] {
  const results: RiskCheckResult[] = [];

  // 检查 QDII 基金操作
  const qdiiFunds = new Set(
    FUND_REGISTRY.filter((f) =>
      ["overseas_sp500", "overseas_nasdaq", "overseas_china_internet"].includes(f.category)
    ).map((f) => f.code)
  );

  for (const suggestion of suggestions) {
    if (qdiiFunds.has(suggestion.code)) {
      const meta = FUND_REGISTRY.find((f) => f.code === suggestion.code);
      const fundName = meta?.shortName || suggestion.code;

      if (suggestion.action === "buy") {
        results.push({
          passed: true,
          level: "info",
          message: `${fundName} 为 QDII 基金，买入资金可能需要 T+1~2 日确认`,
        });
      } else if (suggestion.action === "sell") {
        results.push({
          passed: true,
          level: "info",
          message: `${fundName} 为 QDII 基金，赎回资金预计 T+7~10 日到账`,
        });
      }
    }
  }

  // 检查大额赎回
  const sellSuggestions = suggestions.filter((s) => s.action === "sell");
  for (const suggestion of sellSuggestions) {
    if (suggestion.amount > LIQUIDITY_THRESHOLDS.largeSellAmount) {
      const meta = FUND_REGISTRY.find((f) => f.code === suggestion.code);
      const fundName = meta?.shortName || suggestion.code;

      results.push({
        passed: true,
        level: "warning",
        message: `${fundName} 赎回金额 ${suggestion.amount.toFixed(0)} 元较大，注意资金流动性`,
      });
    }
  }

  // 检查总赎回比例
  const totalSellAmount = sellSuggestions.reduce((sum, s) => sum + s.amount, 0);
  const totalValue = funds.reduce((sum, f) => sum + f.holdingAmount, 0);

  if (totalValue > 0 && totalSellAmount / totalValue > LIQUIDITY_THRESHOLDS.totalSellRatio) {
    results.push({
      passed: true,
      level: "warning",
      message: `本次赎回占总仓位 ${((totalSellAmount / totalValue) * 100).toFixed(1)}%，超过阈值（${LIQUIDITY_THRESHOLDS.totalSellRatio * 100}%），注意流动性`,
    });
  }

  return results;
}
