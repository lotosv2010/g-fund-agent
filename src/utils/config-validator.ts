import { RULES, TARGET_ALLOCATION, getTargetAllocation } from "../rules/rules-config";
import type { AssetCategory } from "../state/types";

/**
 * 配置一致性检查
 * 启动时调用，确保规则配置和目标配置一致
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. 检查每个规则是否有对应的目标配置
  const ruleCategories = Object.keys(RULES) as AssetCategory[];
  for (const category of ruleCategories) {
    const targetAllocation = getTargetAllocation(category);
    if (targetAllocation === 0 && category !== "bond") {
      // 债券可以没有目标（弹药库）
      errors.push(`❌ 规则 "${category}" 没有对应的目标配置`);
    }
  }

  // 2. 检查每个目标配置是否有对应的规则
  const allocationCategories = Object.keys(TARGET_ALLOCATION) as AssetCategory[];
  for (const category of allocationCategories) {
    if (!RULES[category]) {
      errors.push(`❌ 目标配置 "${category}" 没有对应的规则定义`);
    }
  }

  // 3. 检查目标占比总和是否为 100%
  const totalAllocation = allocationCategories.reduce(
    (sum, cat) => sum + TARGET_ALLOCATION[cat],
    0
  );
  const tolerance = 0.0001; // 允许浮点误差
  if (Math.abs(totalAllocation - 1.0) > tolerance) {
    errors.push(
      `❌ 目标占比总和为 ${(totalAllocation * 100).toFixed(2)}%，应为 100%`
    );
  }

  // 4. 检查规则配置完整性
  for (const category of ruleCategories) {
    const rule = RULES[category];

    // 检查补仓档位是否递增
    for (let i = 1; i < rule.buyTiers.length; i++) {
      if (rule.buyTiers[i].dropPercent <= rule.buyTiers[i - 1].dropPercent) {
        errors.push(
          `❌ ${category} 补仓档位 ${i + 1} 的跌幅 (${rule.buyTiers[i].dropPercent}%) 应大于档位 ${i} (${rule.buyTiers[i - 1].dropPercent}%)`
        );
      }
    }

    // 检查止盈档位是否递增
    for (let i = 1; i < rule.sellTiers.length; i++) {
      if (rule.sellTiers[i].risePercent <= rule.sellTiers[i - 1].risePercent) {
        errors.push(
          `❌ ${category} 止盈档位 ${i + 1} 的涨幅 (${rule.sellTiers[i].risePercent}%) 应大于档位 ${i} (${rule.sellTiers[i - 1].risePercent}%)`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 打印配置检查结果
 */
export function printValidationResult(result: { valid: boolean; errors: string[] }): void {
  if (result.valid) {
    console.log("✅ 配置一致性检查通过");
  } else {
    console.error("\n⚠️  配置一致性检查失败：\n");
    result.errors.forEach((error) => console.error(`  ${error}`));
    console.error("\n请修复以上问题后重新启动\n");
  }
}
