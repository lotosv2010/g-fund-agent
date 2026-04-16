import { z } from "zod";

/**
 * 基金每日涨跌数据（从 MCP 获取）。
 *
 * 用于持仓更新计算的输入数据。
 */
export const FundDailyReturnSchema = z.object({
  /** 基金代码 */
  fundCode: z.string(),
  /** 日涨跌幅（小数，如 0.0123 表示 +1.23%） */
  dailyReturn: z.number(),
  /** 基金名称（可选） */
  fundName: z.string().optional(),
});

export type FundDailyReturn = z.infer<typeof FundDailyReturnSchema>;

/**
 * 用户交易操作。
 *
 * 正数加仓，负数减仓。
 */
export const TradeOperationSchema = z.object({
  /** 基金代码 */
  fundCode: z.string(),
  /** 操作金额：正数加仓，负数减仓 */
  amount: z.number(),
});

export type TradeOperation = z.infer<typeof TradeOperationSchema>;

/**
 * Agent 返回的更新数据 Schema。
 *
 * 用于校验 Agent 回复中的 JSON 数据。
 */
export const AgentUpdateResponseSchema = z.object({
  tradeDate: z.string(),
  funds: z.array(FundDailyReturnSchema),
});

export type AgentUpdateResponse = z.infer<typeof AgentUpdateResponseSchema>;
