import type { FundInfo, MarketData, RuleResult } from "../state/types";
import { RULES } from "../rules/rules-config";
import { FUND_REGISTRY } from "../rules/fund-registry";

/**
 * 规则匹配（纯规则，无 LLM）
 * 按 5 类基金规则判断是否触发补仓/止盈
 */
export function matchRules(funds: FundInfo[], marketData: MarketData[]): RuleResult[] {
  const results: RuleResult[] = [];

  for (const fund of funds) {
    const meta = FUND_REGISTRY.find((f) => f.code === fund.code);
    if (!meta) continue;

    const rule = RULES[meta.category];
    if (!rule) continue;

    const market = marketData.find((m) => m.code === fund.code);
    if (!market) continue;

    // 检查补仓档位
    for (let i = 0; i < rule.buyTiers.length; i++) {
      const tier = rule.buyTiers[i];
      const drop = Math.abs(market.dropFromHigh);
      if (drop >= tier.dropPercent) {
        results.push({
          code: fund.code,
          name: meta.shortName,
          action: "buy",
          tier: i + 1,
          triggerReason: `较近期高点下跌 ${drop.toFixed(1)}%，触发第 ${i + 1} 档补仓（阈值 -${tier.dropPercent}%）`,
          amount: 0,
        });
      }
    }

    // 检查止盈档位
    if (market.buyPoints.length > 0) {
      for (let i = 0; i < rule.sellTiers.length; i++) {
        const tier = rule.sellTiers[i];
        if (market.riseFromBuyPoint >= tier.risePercent) {
          results.push({
            code: fund.code,
            name: meta.shortName,
            action: "sell",
            tier: i + 1,
            triggerReason: `较补仓点上涨 ${market.riseFromBuyPoint.toFixed(1)}%，触发第 ${i + 1} 档止盈（阈值 +${tier.risePercent}%）`,
            amount: 0,
          });
        }
      }
    }
  }

  return results;
}
