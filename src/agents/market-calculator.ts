import type { FundInfo, MarketData } from "../state/types";
import { loadBuyPoints, loadHighPoints, saveHighPoints } from "../state/store";
import { changePercent } from "../utils/calc";

/**
 * 市场计算（纯计算，无 LLM）
 * 计算近期高点（60日）、较高点跌幅、较补仓点涨幅
 * 自动更新近期高点：如果当前净值创新高，更新记录
 */
export async function calculateMarket(funds: FundInfo[]): Promise<MarketData[]> {
  const highPoints = await loadHighPoints();
  const buyPoints = await loadBuyPoints();
  let highPointsUpdated = false;

  const results = funds.map((fund) => {
    // 获取历史高点，如果没有则使用当前净值作为初始高点
    const historicalHigh = highPoints[fund.code] ?? fund.nav;

    // 判断是否创新高
    const recentHigh = Math.max(fund.nav, historicalHigh);

    // 如果创新高，标记需要更新
    if (recentHigh > historicalHigh) {
      highPoints[fund.code] = recentHigh;
      highPointsUpdated = true;
      console.log(`[market-calculator] ${fund.code} 创新高: ${historicalHigh.toFixed(4)} -> ${recentHigh.toFixed(4)}`);
    }

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

  // 如果有更新，保存到文件
  if (highPointsUpdated) {
    await saveHighPoints(highPoints);
    console.log(`[market-calculator] 近期高点已更新并保存`);
  }

  return results;
}
