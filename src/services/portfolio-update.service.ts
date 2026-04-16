/**
 * 持仓更新核心业务逻辑。
 *
 * 提供 Agent 回复解析、涨跌数据标准化、更新计算、持久化等能力，
 * CLI 和 LangGraph 两种模式共享。
 */
import { z } from "zod";
import type { Portfolio, HoldingItem } from "../domain";
import {
  FundDailyReturnSchema,
  type FundDailyReturn,
  type TradeOperation,
} from "../domain";
import { loadPortfolio, findLatestPortfolioFile } from "../utils/portfolio-loader";
import { savePortfolio } from "../utils/portfolio-writer";
import {
  updateByDailyReturn,
  applyTrades,
  buildDiff,
  mergePortfolio,
  type HoldingDiff,
} from "../utils/portfolio-updater";

// ─── 类型定义 ───

/** Agent 返回的更新数据（含交易日期 + 基金涨跌） */
export interface UpdateResponse {
  readonly tradeDate: string;
  readonly funds: readonly FundDailyReturn[];
}

/** 持仓更新计算结果 */
export interface PortfolioUpdateResult {
  readonly updatedHoldings: readonly HoldingItem[];
  readonly diffs: readonly HoldingDiff[];
  readonly returnMap: ReadonlyMap<string, FundDailyReturn>;
  readonly missingFunds: readonly string[];
}

// ─── Agent 回复解析用 Schema ───

/** 对象格式：{ tradeDate, funds } */
const AgentReplyObjectSchema = z.object({
  tradeDate: z.string().default(""),
  funds: z.array(FundDailyReturnSchema),
});

// ─── Agent 回复解析 ───

/**
 * 从 Agent 回复文本中解析更新数据。
 *
 * 支持两种格式：
 * 1. 对象格式：{ tradeDate, funds: [...] }
 * 2. 回退数组格式：[{ fundCode, dailyReturn, ... }]（tradeDate 为空）
 *
 * 使用 Zod Schema 做运行时校验，确保数据完整性。
 *
 * @param text - Agent 原始回复文本
 * @returns 解析结果，解析失败返回 null
 */
export function parseAgentUpdateReply(text: string): UpdateResponse | null {
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  const raw = jsonBlockMatch ? jsonBlockMatch[1].trim() : text;

  // 对象格式：{ tradeDate, funds }
  try {
    const parsed = JSON.parse(raw);
    const result = AgentReplyObjectSchema.safeParse(parsed);
    if (result.success && result.data.funds.length > 0) {
      return { tradeDate: result.data.tradeDate, funds: result.data.funds };
    }
  } catch {
    // 继续尝试其他方式
  }

  // 回退：数组格式
  const arrayMatch = raw.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      const result = z.array(FundDailyReturnSchema).safeParse(parsed);
      if (result.success && result.data.length > 0) {
        return { tradeDate: "", funds: result.data };
      }
    } catch {
      // 解析失败
    }
  }

  return null;
}

// ─── 数据标准化 ───

/**
 * 将涨跌数据标准化为 Map。
 *
 * 自动处理百分比/小数格式：|dailyReturn| > 1 视为百分比，自动除以 100。
 */
function normalizeDailyReturns(
  funds: readonly FundDailyReturn[],
): Map<string, FundDailyReturn> {
  const map = new Map<string, FundDailyReturn>();

  for (const item of funds) {
    if (!item.fundCode || item.dailyReturn == null) continue;
    const normalized =
      Math.abs(item.dailyReturn) > 1 ? item.dailyReturn / 100 : item.dailyReturn;
    map.set(item.fundCode, { ...item, dailyReturn: normalized });
  }

  return map;
}

// ─── 核心计算 ───

/**
 * 计算持仓更新。
 *
 * 应用涨跌幅 → 应用交易操作 → 生成变更对比。
 *
 * @param portfolio - 当前持仓数据
 * @param funds - Agent 返回的涨跌数据
 * @param trades - 用户交易操作（可选）
 * @returns 计算结果（含更新后持仓、变更对比、缺失基金列表）
 */
export function computePortfolioUpdate(
  portfolio: Portfolio,
  funds: readonly FundDailyReturn[],
  trades: readonly TradeOperation[] = [],
): PortfolioUpdateResult {
  const returnMap = normalizeDailyReturns(funds);
  const fundCodes = portfolio.holdings.map((h) => h.fundCode);
  const missingFunds = fundCodes.filter((c) => !returnMap.has(c));

  const originalHoldings = portfolio.holdings.map((h) => ({ ...h }));
  let holdings = updateByDailyReturn(portfolio.holdings, returnMap);

  if (trades.length > 0) {
    holdings = applyTrades(holdings, trades);
  }

  const diffs = buildDiff(originalHoldings, holdings, returnMap, trades);

  return { updatedHoldings: holdings, diffs, returnMap, missingFunds };
}

// ─── 持久化 ───

/**
 * 保存更新后的持仓数据。
 *
 * @param portfolio - 原始 Portfolio（保留 name、target 等元数据）
 * @param updatedHoldings - 更新后的持仓列表
 * @param tradeDate - 交易日期（用于文件命名）
 * @returns 保存的文件路径
 */
export function persistPortfolioUpdate(
  portfolio: Portfolio,
  updatedHoldings: readonly HoldingItem[],
  tradeDate: string,
): string {
  const updated = mergePortfolio(portfolio, updatedHoldings);
  return savePortfolio(updated, tradeDate);
}

// ─── 便捷函数 ───

export { loadPortfolio, findLatestPortfolioFile };
export type { FundDailyReturn, TradeOperation, HoldingDiff };
