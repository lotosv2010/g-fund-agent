import { z } from "zod";

/** 买入触发条件 */
export const BuyTriggerSchema = z.object({
  drawdown: z.number(),
  action: z.string(),
});

/** 卖出触发条件 */
export const SellTriggerSchema = z.object({
  gain: z.number(),
  action: z.string(),
});

/** 资产类别策略 */
export const CategoryStrategySchema = z.object({
  name: z.string(),
  funds: z.array(z.string()),
  buyTriggers: z.array(BuyTriggerSchema),
  sellTriggers: z.array(SellTriggerSchema),
});

/** 弹药库（债券）策略 */
export const AmmoFundSchema = z.object({
  name: z.string(),
  role: z.string(),
  triggerRule: z.string(),
  capRule: z.string(),
});

/**
 * 操作策略 — 定义各资产类别的补仓/止盈规则。
 *
 * 数据来源：data/strategy.json
 */
export const StrategySchema = z.object({
  name: z.string(),
  principle: z.string(),
  ammoFund: AmmoFundSchema,
  categories: z.array(CategoryStrategySchema),
  disciplineRules: z.array(z.string()),
});

export type Strategy = z.infer<typeof StrategySchema>;
