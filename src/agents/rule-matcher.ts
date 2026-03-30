import type { FundInfo, MarketData, RuleResult } from "../state/types";
import { RULES } from "../rules/rules-config";
import { FUND_REGISTRY } from "../rules/fund-registry";
import { loadTriggeredTiers } from "../state/store";

/**
 * 规则匹配（纯规则，无 LLM）
 * 按 5 类基金规则判断是否触发补仓/止盈
 * 防重复：同一档位不会重复触发，只有更高档位或状态重置后才会再次触发
 */
export async function matchRules(funds: FundInfo[], marketData: MarketData[]): Promise<RuleResult[]> {
  const results: RuleResult[] = [];
  const triggeredTiers = await loadTriggeredTiers();

  for (const fund of funds) {
    const meta = FUND_REGISTRY.find((f) => f.code === fund.code);
    if (!meta) continue;

    const rule = RULES[meta.category];
    if (!rule) continue;

    const market = marketData.find((m) => m.code === fund.code);
    if (!market) continue;

    // 检查补仓档位（从高档到低档，只触发最高档，且必须高于已触发档位）
    const drop = Math.abs(market.dropFromHigh);
    const lastBuyTier = triggeredTiers[fund.code]?.buy || 0;

    for (let i = rule.buyTiers.length - 1; i >= 0; i--) {
      const tier = rule.buyTiers[i];
      const currentTier = i + 1;

      // 只触发比上次更高的档位
      if (drop >= tier.dropPercent && currentTier > lastBuyTier) {
        results.push({
          code: fund.code,
          name: meta.shortName,
          action: "buy",
          tier: currentTier,
          triggerReason: `较近期高点下跌 ${drop.toFixed(1)}%，触发第 ${currentTier} 档补仓（阈值 -${tier.dropPercent}%）`,
          amount: 0,
        });
        break; // 只触发最高档，不继续检查低档
      }
    }

    // 检查止盈档位（从高档到低档，只触发最高档，且必须高于已触发档位）
    if (market.buyPoints.length > 0) {
      const lastSellTier = triggeredTiers[fund.code]?.sell || 0;

      for (let i = rule.sellTiers.length - 1; i >= 0; i--) {
        const tier = rule.sellTiers[i];
        const currentTier = i + 1;

        // 只触发比上次更高的档位
        if (market.riseFromBuyPoint >= tier.risePercent && currentTier > lastSellTier) {
          results.push({
            code: fund.code,
            name: meta.shortName,
            action: "sell",
            tier: currentTier,
            triggerReason: `较补仓点上涨 ${market.riseFromBuyPoint.toFixed(1)}%，触发第 ${currentTier} 档止盈（阈值 +${tier.risePercent}%）`,
            amount: 0,
          });
          break; // 只触发最高档，不继续检查低档
        }
      }
    }
  }

  return results;
}
