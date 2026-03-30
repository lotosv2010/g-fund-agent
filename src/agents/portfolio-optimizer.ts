import type { FundInfo, RuleResult, Suggestion } from "../state/types";
import { RULES, TARGET_TOTAL, BOND_AMMO_SELL_RANGE, BOND_OVERWEIGHT_THRESHOLD } from "../rules/rules-config";
import { FUND_REGISTRY } from "../rules/fund-registry";

/**
 * 组合优化（纯规则，无 LLM）
 * 总仓位校验、目标偏离校正、债券弹药库联动
 */
export function optimizePortfolio(funds: FundInfo[], ruleResults: RuleResult[]): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // 1. 将 ruleResults 转换为具体买卖建议
  for (const result of ruleResults) {
    const meta = FUND_REGISTRY.find((f) => f.code === result.code);
    if (!meta) continue;

    const rule = RULES[meta.category];
    if (!rule) continue;

    if (result.action === "buy") {
      const tier = rule.buyTiers[result.tier - 1];
      if (tier) {
        const amount = TARGET_TOTAL * (tier.buyPercent / 100);
        suggestions.push({
          code: result.code,
          name: result.name,
          action: "buy",
          amount,
          reason: result.triggerReason,
        });
      }
    } else if (result.action === "sell") {
      const fund = funds.find((f) => f.code === result.code);
      const tier = rule.sellTiers[result.tier - 1];
      if (fund && tier) {
        const amount = fund.holdingAmount * tier.sellFraction;
        suggestions.push({
          code: result.code,
          name: result.name,
          action: "sell",
          amount,
          reason: result.triggerReason,
        });
      }
    }
  }

  // 2. 债券弹药库联动
  const hasDeepBuy = ruleResults.some((r) => r.action === "buy" && r.tier === 3);
  if (hasDeepBuy) {
    const bondFunds = funds.filter(
      (f) => FUND_REGISTRY.find((m) => m.code === f.code)?.category === "bond"
    );
    const totalBondAmount = bondFunds.reduce((s, f) => s + f.holdingAmount, 0);
    const sellAmount = totalBondAmount * BOND_AMMO_SELL_RANGE.min;
    for (const bond of bondFunds) {
      const ratio = bond.holdingAmount / totalBondAmount;
      suggestions.push({
        code: bond.code,
        name: FUND_REGISTRY.find((m) => m.code === bond.code)?.shortName || bond.code,
        action: "sell",
        amount: sellAmount * ratio,
        reason: "债券弹药库联动：其他资产触发第3档补仓",
      });
    }
  }

  // 3. 债券占比超标检查
  const totalHolding = funds.reduce((s, f) => s + f.holdingAmount, 0);
  const bondTotal = funds
    .filter((f) => FUND_REGISTRY.find((m) => m.code === f.code)?.category === "bond")
    .reduce((s, f) => s + f.holdingAmount, 0);
  if (totalHolding > 0 && bondTotal / totalHolding > BOND_OVERWEIGHT_THRESHOLD) {
    const excess = bondTotal - totalHolding * BOND_OVERWEIGHT_THRESHOLD;
    if (excess > 0 && !hasDeepBuy) {
      suggestions.push({
        code: "BOND_EXCESS",
        name: "债券整体",
        action: "sell",
        amount: excess,
        reason: `债券占比 ${((bondTotal / totalHolding) * 100).toFixed(1)}% 超过 ${BOND_OVERWEIGHT_THRESHOLD * 100}%，建议卖出超出部分`,
      });
    }
  }

  return suggestions;
}
