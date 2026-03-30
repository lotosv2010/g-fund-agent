import type { FundInfo, MarketData } from "../state/types";
import { loadBuyPoints, loadHighPoints, saveHighPoints, clearTriggeredTiers } from "../state/store";
import { changePercent } from "../utils/calc";

/**
 * 市场计算（纯计算，无 LLM）
 * 计算近期高点（60日滚动窗口）、较高点跌幅、较补仓点涨幅
 * 自动更新近期高点：如果当前净值创新高，更新记录
 * 滚动窗口：超过60日未创新高的高点会被重置，避免长期横盘导致规则失效
 */
export async function calculateMarket(funds: FundInfo[]): Promise<MarketData[]> {
  const highPoints = await loadHighPoints();
  const buyPoints = await loadBuyPoints();
  let highPointsUpdated = false;
  const now = new Date();
  const results: MarketData[] = [];

  for (const fund of funds) {
    // 获取历史高点记录
    const storedHigh = highPoints[fund.code];

    // 60日滚动窗口：如果高点超过60天未更新，重置为当前净值
    const ROLLING_WINDOW_DAYS = 60;
    let recentHigh: number;

    if (!storedHigh) {
      // 首次记录，使用当前净值
      recentHigh = fund.nav;
      highPoints[fund.code] = { value: recentHigh, date: now.toISOString() };
      highPointsUpdated = true;
      console.log(`[market-calculator] ${fund.code} 首次记录高点: ${recentHigh.toFixed(4)}`);
    } else {
      const highPointDate = new Date(storedHigh.date);
      const daysSinceHigh = (now.getTime() - highPointDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceHigh > ROLLING_WINDOW_DAYS) {
        // 超过60天未创新高，重置为当前净值，并清除补仓触发记录
        recentHigh = fund.nav;
        highPoints[fund.code] = { value: recentHigh, date: now.toISOString() };
        highPointsUpdated = true;
        await clearTriggeredTiers(fund.code, "buy");
        console.log(`[market-calculator] ${fund.code} 高点已过期(${daysSinceHigh.toFixed(0)}天)，重置为当前净值并清除补仓触发记录: ${recentHigh.toFixed(4)}`);
      } else if (fund.nav > storedHigh.value) {
        // 创新高，更新记录
        recentHigh = fund.nav;
        highPoints[fund.code] = { value: recentHigh, date: now.toISOString() };
        highPointsUpdated = true;
        console.log(`[market-calculator] ${fund.code} 创新高: ${storedHigh.value.toFixed(4)} -> ${recentHigh.toFixed(4)}`);
      } else {
        // 在60天窗口内且未创新高，使用存储的高点
        recentHigh = storedHigh.value;
      }
    }

    const dropFromHigh = changePercent(fund.nav, recentHigh);
    const fundBuyPoints = buyPoints.filter((bp) => bp.code === fund.code);

    // 计算加权平均补仓成本（而非只取最后一次补仓点）
    let riseFromBuyPoint = 0;
    if (fundBuyPoints.length > 0) {
      const totalAmount = fundBuyPoints.reduce((sum, bp) => sum + bp.amount, 0);
      const weightedNav = fundBuyPoints.reduce((sum, bp) => sum + bp.nav * bp.amount, 0) / totalAmount;
      riseFromBuyPoint = changePercent(fund.nav, weightedNav);
    }

    results.push({
      code: fund.code,
      recentHigh,
      dropFromHigh,
      riseFromBuyPoint,
      buyPoints: fundBuyPoints,
    });
  }

  // 如果有更新，保存到文件
  if (highPointsUpdated) {
    await saveHighPoints(highPoints);
    console.log(`[market-calculator] 近期高点已更新并保存`);
  }

  return results;
}
