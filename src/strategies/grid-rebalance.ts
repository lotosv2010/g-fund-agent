import type { Strategy, StrategySignal, StrategyContext } from "./types";
import { RULES, TARGET_TOTAL, getTargetAllocation } from "../rules/rules-config";
import { FUND_REGISTRY } from "../rules/fund-registry";
import { loadTriggeredTiers } from "../state/store";

/**
 * 网格补仓策略（Grid Rebalance Strategy）
 *
 * 这是将 Phase 0-1 的规则引擎封装为策略的版本。
 * 策略逻辑：
 * - 根据资产类别设置不同的补仓/止盈档位
 * - 档位去重：已触发档位不重复触发
 * - 补仓金额 = 类别目标金额 × 档位百分比
 */
export const gridRebalanceStrategy: Strategy = {
  metadata: {
    name: "grid-rebalance",
    displayName: "网格补仓策略",
    version: "1.0.0",
    description: "按预设档位执行补仓和止盈操作，采用网格化仓位管理",
    author: "G-Fund-Agent",
    createdAt: "2026-03-30T00:00:00Z",
    updatedAt: "2026-03-30T00:00:00Z",
    tags: ["grid", "rebalance", "rule-based"],
  },

  params: {
    // 参数从 rules-config.ts 读取，此处为占位符
    // 未来可支持自定义参数覆盖
  },

  riskConstraints: {
    maxSinglePosition: 25,       // 单只基金最大25%
    maxCategoryWeight: 1.5,      // 类别最大为目标的1.5倍
    maxDrawdown: 35,             // 最大回撤35%
  },

  enabled: true,
  weight: 1.0,

  async generateSignals(context: StrategyContext): Promise<StrategySignal[]> {
    const signals: StrategySignal[] = [];
    const triggeredTiers = await loadTriggeredTiers();

    for (const fund of context.funds) {
      const meta = FUND_REGISTRY.find((f) => f.code === fund.code);
      if (!meta) continue;

      const rule = RULES[meta.category];
      if (!rule) continue;

      const market = context.marketData.find((m) => m.code === fund.code);
      if (!market) continue;

      // 检查补仓档位
      const drop = Math.abs(market.dropFromHigh);
      const lastBuyTier = triggeredTiers[fund.code]?.buy || 0;

      for (let i = rule.buyTiers.length - 1; i >= 0; i--) {
        const tier = rule.buyTiers[i];
        const currentTier = i + 1;

        if (drop >= tier.dropPercent && currentTier > lastBuyTier) {
          const categoryTarget = TARGET_TOTAL * getTargetAllocation(meta.category);
          const amount = categoryTarget * (tier.buyPercent / 100);

          signals.push({
            code: fund.code,
            action: "buy",
            tier: currentTier,
            strength: currentTier === 3 ? "strong" : currentTier === 2 ? "medium" : "weak",
            confidence: 1.0, // 规则信号置信度为100%
            reason: `较近期高点下跌 ${drop.toFixed(1)}%，触发第 ${currentTier} 档补仓（阈值 -${tier.dropPercent}%）`,
            amount,
          });
          break;
        }
      }

      // 检查止盈档位
      if (market.buyPoints.length > 0) {
        const lastSellTier = triggeredTiers[fund.code]?.sell || 0;

        for (let i = rule.sellTiers.length - 1; i >= 0; i--) {
          const tier = rule.sellTiers[i];
          const currentTier = i + 1;

          if (market.riseFromBuyPoint >= tier.risePercent && currentTier > lastSellTier) {
            const amount = fund.holdingAmount * tier.sellFraction;

            signals.push({
              code: fund.code,
              action: "sell",
              tier: currentTier,
              strength: currentTier === 3 ? "strong" : currentTier === 2 ? "medium" : "weak",
              confidence: 1.0,
              reason: `较补仓点上涨 ${market.riseFromBuyPoint.toFixed(1)}%，触发第 ${currentTier} 档止盈（阈值 +${tier.risePercent}%）`,
              amount,
            });
            break;
          }
        }
      }
    }

    return signals;
  },

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证规则配置
    if (!RULES || Object.keys(RULES).length === 0) {
      errors.push("规则配置 (RULES) 不能为空");
    }

    // 验证基金注册表
    if (!FUND_REGISTRY || FUND_REGISTRY.length === 0) {
      errors.push("基金注册表 (FUND_REGISTRY) 不能为空");
    }

    // 验证目标金额
    if (!TARGET_TOTAL || TARGET_TOTAL <= 0) {
      errors.push("目标金额 (TARGET_TOTAL) 必须大于0");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};
