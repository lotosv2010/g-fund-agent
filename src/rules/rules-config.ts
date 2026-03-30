import type { AssetCategory } from "../state/types";

/** 单档补仓规则 */
interface BuyTier {
  dropPercent: number;      // 较近期高点跌幅（正数，如 8 表示跌 8%）
  buyPercent: number;       // 买入目标仓位的百分比
}

/** 单档止盈规则 */
interface SellTier {
  risePercent: number;      // 较补仓点涨幅（正数）
  sellFraction: number;     // 卖出仓位比例（如 1/3）
}

/** 单类资产的规则配置 */
export interface RuleConfig {
  buyTiers: BuyTier[];
  sellTiers: SellTier[];
}

/** 全部规则配置 */
export const RULES: Record<AssetCategory, RuleConfig> = {
  // 宽基类
  broad_base: {
    buyTiers: [
      { dropPercent: 8, buyPercent: 5 },
      { dropPercent: 15, buyPercent: 10 },
      { dropPercent: 25, buyPercent: 15 },
    ],
    sellTiers: [
      { risePercent: 15, sellFraction: 1 / 3 },
      { risePercent: 30, sellFraction: 1 / 3 },
      { risePercent: 50, sellFraction: 1 / 3 },
    ],
  },

  // 科技主题类
  tech: {
    buyTiers: [
      { dropPercent: 10, buyPercent: 5 },
      { dropPercent: 20, buyPercent: 10 },
      { dropPercent: 30, buyPercent: 20 },
    ],
    sellTiers: [
      { risePercent: 20, sellFraction: 1 / 3 },
      { risePercent: 40, sellFraction: 1 / 3 },
      { risePercent: 60, sellFraction: 1 / 3 },
    ],
  },

  // 标普500
  overseas_sp500: {
    buyTiers: [
      { dropPercent: 10, buyPercent: 5 },
      { dropPercent: 15, buyPercent: 10 },
      { dropPercent: 20, buyPercent: 15 },
    ],
    sellTiers: [
      { risePercent: 15, sellFraction: 1 / 3 },
      { risePercent: 25, sellFraction: 1 / 3 },
      { risePercent: 35, sellFraction: 1 / 3 },
    ],
  },

  // 纳斯达克科技
  overseas_nasdaq: {
    buyTiers: [
      { dropPercent: 12, buyPercent: 5 },
      { dropPercent: 20, buyPercent: 10 },
      { dropPercent: 30, buyPercent: 15 },
    ],
    sellTiers: [
      { risePercent: 20, sellFraction: 1 / 3 },
      { risePercent: 35, sellFraction: 1 / 3 },
      { risePercent: 50, sellFraction: 1 / 3 },
    ],
  },

  // 中概互联
  overseas_china_internet: {
    buyTiers: [
      { dropPercent: 15, buyPercent: 8 },
      { dropPercent: 25, buyPercent: 12 },
      { dropPercent: 35, buyPercent: 15 },
    ],
    sellTiers: [
      { risePercent: 25, sellFraction: 1 / 3 },
      { risePercent: 40, sellFraction: 1 / 3 },
      { risePercent: 60, sellFraction: 1 / 3 },
    ],
  },

  // 债券（弹药库，无常规补仓/止盈档位）
  bond: {
    buyTiers: [],
    sellTiers: [],
  },

  // 黄金
  gold: {
    buyTiers: [
      { dropPercent: 12, buyPercent: 5 },
      { dropPercent: 20, buyPercent: 10 },
      { dropPercent: 30, buyPercent: 15 },
    ],
    sellTiers: [
      { risePercent: 20, sellFraction: 1 / 2 },
      { risePercent: 35, sellFraction: 1 / 2 },
    ],
  },
};

/** 目标仓位配置（各类别独立配置，海外三类合计 15%） */
export const TARGET_ALLOCATION: Record<string, number> = {
  broad_base: 0.35,
  tech: 0.15,
  overseas_sp500: 0.05,
  overseas_nasdaq: 0.05,
  overseas_china_internet: 0.05,
  bond: 0.30,
  gold: 0.05,
};

/** 获取资产类别的目标占比（支持合并查询海外类） */
export function getTargetAllocation(category: AssetCategory): number {
  return TARGET_ALLOCATION[category] || 0;
}

/** 获取海外类总目标占比 */
export function getOverseasTotalAllocation(): number {
  return TARGET_ALLOCATION.overseas_sp500 +
         TARGET_ALLOCATION.overseas_nasdaq +
         TARGET_ALLOCATION.overseas_china_internet;
}

/** 总目标金额（补仓金额 = TARGET_TOTAL × 类别占比 × 档位百分比） */
export const TARGET_TOTAL = 200_000;

/** 债券弹药库规则 */
export const BOND_AMMO_SELL_RANGE = { min: 0.10, max: 0.20 };

/** 债券止盈触发线：占比超过此值 */
export const BOND_OVERWEIGHT_THRESHOLD = 0.30;
