import type { HoldingItem, Portfolio, FundDailyReturn, TradeOperation } from "../domain";

/** 单只基金更新前后对比 */
export interface HoldingDiff {
  readonly fundCode: string;
  readonly fundName?: string;
  readonly dailyReturn: number;
  readonly before: { readonly amount: number; readonly returnRate: number };
  readonly after: { readonly amount: number; readonly returnRate: number };
  /** 每日涨跌金额 */
  readonly dailyChange: number;
  /** 用户操作金额（0 表示无操作） */
  readonly tradeAmount: number;
}

/**
 * 根据每日涨跌幅更新持仓金额。
 *
 * newAmount = oldAmount × (1 + dailyReturn)
 * newReturnRate 由隐含净值与 costBasis 推导
 *
 * @param holdings - 当前持仓列表
 * @param returnMap - 基金代码 → 每日涨跌数据
 * @returns 更新后的持仓列表
 */
export function updateByDailyReturn(
  holdings: readonly HoldingItem[],
  returnMap: ReadonlyMap<string, FundDailyReturn>,
): HoldingItem[] {
  return holdings.map((h) => {
    const fund = returnMap.get(h.fundCode);
    if (!fund) return { ...h };

    const newAmount = round2(h.amount * (1 + fund.dailyReturn));
    const fundName = fund.fundName ?? h.fundName;

    // 推导新收益率：隐含当前净值 = costBasis × (1 + oldReturnRate) × (1 + dailyReturn)
    // newReturnRate = oldNav × (1 + dailyReturn) / costBasis - 1
    let newReturnRate = h.returnRate;
    if (h.costBasis && h.returnRate != null) {
      const oldNav = h.costBasis * (1 + h.returnRate);
      const newNav = oldNav * (1 + fund.dailyReturn);
      newReturnRate = round4((newNav - h.costBasis) / h.costBasis);
    }

    return { ...h, fundName, amount: newAmount, returnRate: newReturnRate };
  });
}

/**
 * 应用用户交易操作。
 *
 * 加仓（amount > 0）：
 * - newAmount += tradeAmount
 * - costBasis 加权平均：隐含 NAV = costBasis × (1 + returnRate)
 *   newCostBasis = (oldInvested + tradeAmount) / (oldShares + newShares)
 *
 * 减仓（amount < 0）：
 * - newAmount -= |tradeAmount|
 * - costBasis 不变
 *
 * @param holdings - 当前持仓列表（已按涨跌更新）
 * @param operations - 用户操作列表
 * @returns 操作后的持仓列表
 */
export function applyTrades(
  holdings: readonly HoldingItem[],
  operations: readonly TradeOperation[],
): HoldingItem[] {
  const opMap = new Map(operations.map((op) => [op.fundCode, op]));

  return holdings.map((h) => {
    const op = opMap.get(h.fundCode);
    if (!op) return { ...h };

    if (op.amount > 0) {
      // 加仓：加权平均成本
      const newAmount = round2(h.amount + op.amount);

      if (h.costBasis && h.returnRate != null) {
        const currentNav = h.costBasis * (1 + h.returnRate);
        const oldShares = h.amount / currentNav;
        const newShares = op.amount / currentNav;
        const totalShares = oldShares + newShares;
        const newCostBasis = round4(
          (oldShares * h.costBasis + newShares * currentNav) / totalShares,
        );
        const newReturnRate = round4((currentNav - newCostBasis) / newCostBasis);
        return { ...h, amount: newAmount, costBasis: newCostBasis, returnRate: newReturnRate };
      }

      return { ...h, amount: newAmount };
    } else {
      // 减仓：costBasis 不变
      const newAmount = round2(Math.max(0, h.amount + op.amount));
      return { ...h, amount: newAmount };
    }
  });
}

/**
 * 生成持仓变更对比。
 *
 * @param before - 更新前持仓（原始数据）
 * @param after - 更新后持仓（应用涨跌 + 操作后）
 * @param returnMap - 基金代码 → 每日涨跌数据
 * @param operations - 用户操作列表
 */
export function buildDiff(
  before: readonly HoldingItem[],
  after: readonly HoldingItem[],
  returnMap: ReadonlyMap<string, FundDailyReturn>,
  operations: readonly TradeOperation[],
): HoldingDiff[] {
  const opMap = new Map(operations.map((op) => [op.fundCode, op.amount]));

  return before.map((b, i) => {
    const a = after[i];
    const fund = returnMap.get(b.fundCode);
    const dailyReturn = fund?.dailyReturn ?? 0;
    const tradeAmount = opMap.get(b.fundCode) ?? 0;
    const dailyChange = round2(b.amount * dailyReturn);

    return {
      fundCode: b.fundCode,
      fundName: a.fundName ?? b.fundName,
      dailyReturn,
      before: {
        amount: b.amount,
        returnRate: b.returnRate ?? 0,
      },
      after: {
        amount: a.amount,
        returnRate: a.returnRate ?? 0,
      },
      dailyChange,
      tradeAmount,
    };
  });
}

/**
 * 将更新后的持仓合并回完整的 Portfolio 对象。
 */
export function mergePortfolio(
  original: Portfolio,
  updatedHoldings: readonly HoldingItem[],
): Portfolio {
  return {
    ...original,
    holdings: [...updatedHoldings],
  };
}

/** 保留 2 位小数 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 保留 4 位小数 */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
