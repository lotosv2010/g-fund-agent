import type { FundInfo, RiskCheckResult } from "../state/types";
import { FUND_REGISTRY } from "../rules/fund-registry";

/**
 * 集中度风险控制
 *
 * 风险点：
 * 1. 单只基金占比过高，个股风险集中
 * 2. 单一行业占比过高，行业周期风险
 *
 * 策略：
 * - 单只基金不超过总仓位的X%
 * - 单一类别不超过目标占比的1.5倍
 */

/** 集中度阈值配置 */
export const CONCENTRATION_THRESHOLDS = {
  singleFund: 20,      // 单只基金不超过20%
  categoryOverweight: 1.5, // 类别占比不超过目标的1.5倍
};

/**
 * 检查集中度风险
 *
 * @param funds - 基金数据
 * @returns 风控检查结果
 */
export function checkConcentrationRisk(funds: FundInfo[]): RiskCheckResult[] {
  const results: RiskCheckResult[] = [];
  const totalValue = funds.reduce((sum, f) => sum + f.holdingAmount, 0);

  if (totalValue === 0) {
    return results;
  }

  // 检查单只基金占比
  for (const fund of funds) {
    const percentage = (fund.holdingAmount / totalValue) * 100;
    if (percentage > CONCENTRATION_THRESHOLDS.singleFund) {
      const meta = FUND_REGISTRY.find((f) => f.code === fund.code);
      const fundName = meta?.shortName || fund.code;

      results.push({
        passed: true,
        level: "warning",
        message: `${fundName} 占比 ${percentage.toFixed(1)}%，超过单只基金阈值（${CONCENTRATION_THRESHOLDS.singleFund}%），建议控制仓位`,
      });
    }
  }

  // 检查类别占比
  const categoryAllocation: Record<string, number> = {};
  for (const fund of funds) {
    const meta = FUND_REGISTRY.find((f) => f.code === fund.code);
    if (!meta) continue;

    if (!categoryAllocation[meta.category]) {
      categoryAllocation[meta.category] = 0;
    }
    categoryAllocation[meta.category] += fund.holdingAmount;
  }

  // 类别目标占比（与 rules-config.ts 保持一致）
  const TARGET_ALLOCATION: Record<string, number> = {
    broad_base: 0.35,
    tech: 0.15,
    overseas_sp500: 0.05,
    overseas_nasdaq: 0.05,
    overseas_china_internet: 0.05,
    bond: 0.30,
    gold: 0.05,
  };

  for (const [category, amount] of Object.entries(categoryAllocation)) {
    const actualPercentage = (amount / totalValue);
    const targetPercentage = TARGET_ALLOCATION[category] || 0;

    if (actualPercentage > targetPercentage * CONCENTRATION_THRESHOLDS.categoryOverweight) {
      const categoryName = getCategoryName(category);
      results.push({
        passed: true,
        level: "warning",
        message: `${categoryName} 占比 ${(actualPercentage * 100).toFixed(1)}%，超过目标占比 ${(targetPercentage * 100).toFixed(0)}% 的 ${CONCENTRATION_THRESHOLDS.categoryOverweight} 倍，建议调整`,
      });
    }
  }

  return results;
}

/**
 * 获取类别中文名
 */
function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    broad_base: "宽基类",
    tech: "科技主题类",
    overseas_sp500: "标普500",
    overseas_nasdaq: "纳斯达克科技",
    overseas_china_internet: "中概互联",
    bond: "债券",
    gold: "黄金",
  };
  return names[category] || category;
}
