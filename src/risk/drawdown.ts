import type { FundInfo, MarketData, RiskCheckResult, DrawdownData } from "../state/types";
import { FUND_REGISTRY } from "../rules/fund-registry";

/**
 * 回撤控制
 *
 * 风险点：
 * 1. 单只基金回撤过大可能陷入长期亏损
 * 2. 总组合回撤过大影响心态和资金安全
 *
 * 策略：
 * - 单只基金回撤超过阈值时发出预警
 * - 严重回撤时阻止继续补仓建议
 * - 总组合回撤超过阈值时降低操作频率
 */

/** 回撤阈值配置 */
export const DRAWDOWN_THRESHOLDS = {
  fund: {
    warning: 15,    // 单只基金回撤15%预警
    critical: 25,   // 单只基金回撤25%严重预警
    stopLoss: 35,   // 单只基金回撤35%建议止损
  },
  portfolio: {
    warning: 10,    // 组合回撤10%预警
    critical: 20,   // 组合回撤20%严重预警
  },
};

/**
 * 计算回撤数据
 */
export function calculateDrawdown(funds: FundInfo[], marketData: MarketData[]): DrawdownData[] {
  return funds.map((fund) => {
    const market = marketData.find((m) => m.code === fund.code);

    // 当前回撤 = 持仓成本与当前净值的跌幅
    const currentDrawdown = ((fund.nav - fund.holdingCost) / fund.holdingCost) * 100;

    // TODO: 历史最大回撤需要从历史数据计算，Phase 1 暂用当前回撤
    const maxDrawdown = currentDrawdown < 0 ? currentDrawdown : 0;

    // TODO: 回撤持续天数需要历史数据支持，Phase 1 暂不计算
    const daysInDrawdown = 0;

    return {
      code: fund.code,
      currentDrawdown,
      maxDrawdown,
      daysInDrawdown,
    };
  });
}

/**
 * 检查回撤风险
 *
 * @param funds - 基金数据
 * @param marketData - 市场数据
 * @returns 风控检查结果
 */
export function checkDrawdownRisk(
  funds: FundInfo[],
  marketData: MarketData[]
): RiskCheckResult[] {
  const results: RiskCheckResult[] = [];
  const drawdownData = calculateDrawdown(funds, marketData);

  // 检查单只基金回撤
  for (const dd of drawdownData) {
    const fund = funds.find((f) => f.code === dd.code);
    if (!fund) continue;

    const meta = FUND_REGISTRY.find((f) => f.code === dd.code);
    const fundName = meta?.shortName || dd.code;

    if (dd.currentDrawdown <= -DRAWDOWN_THRESHOLDS.fund.stopLoss) {
      results.push({
        passed: false,
        level: "error",
        message: `${fundName} 回撤 ${Math.abs(dd.currentDrawdown).toFixed(1)}%，超过止损线（${DRAWDOWN_THRESHOLDS.fund.stopLoss}%），建议止损`,
        blockedSuggestions: [dd.code],
      });
    } else if (dd.currentDrawdown <= -DRAWDOWN_THRESHOLDS.fund.critical) {
      results.push({
        passed: true,
        level: "warning",
        message: `${fundName} 回撤 ${Math.abs(dd.currentDrawdown).toFixed(1)}%，接近止损线，谨慎补仓`,
      });
    } else if (dd.currentDrawdown <= -DRAWDOWN_THRESHOLDS.fund.warning) {
      results.push({
        passed: true,
        level: "info",
        message: `${fundName} 回撤 ${Math.abs(dd.currentDrawdown).toFixed(1)}%，需关注`,
      });
    }
  }

  // 检查总组合回撤
  const totalCost = funds.reduce((sum, f) => sum + f.holdingAmount * (f.holdingCost / f.nav), 0);
  const totalValue = funds.reduce((sum, f) => sum + f.holdingAmount, 0);
  const portfolioDrawdown = ((totalValue - totalCost) / totalCost) * 100;

  if (portfolioDrawdown <= -DRAWDOWN_THRESHOLDS.portfolio.critical) {
    results.push({
      passed: true,
      level: "error",
      message: `组合总回撤 ${Math.abs(portfolioDrawdown).toFixed(1)}%，超过严重预警线（${DRAWDOWN_THRESHOLDS.portfolio.critical}%），建议暂停补仓`,
    });
  } else if (portfolioDrawdown <= -DRAWDOWN_THRESHOLDS.portfolio.warning) {
    results.push({
      passed: true,
      level: "warning",
      message: `组合总回撤 ${Math.abs(portfolioDrawdown).toFixed(1)}%，需关注风险`,
    });
  }

  return results;
}
