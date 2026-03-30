import type { FundInfo, MarketData } from "../state/types";
import { loadBuyPoints, loadHighPoints } from "../state/store";
import { changePercent } from "../utils/calc";

/**
 * 市场计算（纯计算，无 LLM）
 * 计算近期高点（60日）、较高点跌幅、较补仓点涨幅
 */
export async function calculateMarket(funds: FundInfo[]): Promise<MarketData[]> {
  const highPoints = await loadHighPoints();
  const buyPoints = await loadBuyPoints();

  return funds.map((fund) => {
    const recentHigh = highPoints[fund.code] ?? fund.nav;
    const dropFromHigh = changePercent(fund.nav, recentHigh);
    const fundBuyPoints = buyPoints.filter((bp) => bp.code === fund.code);
    const lastBuyPoint = fundBuyPoints.at(-1);
    const riseFromBuyPoint = lastBuyPoint
      ? changePercent(fund.nav, lastBuyPoint.nav)
      : 0;

    return {
      code: fund.code,
      recentHigh,
      dropFromHigh,
      riseFromBuyPoint,
      buyPoints: fundBuyPoints,
    };
  });
}
