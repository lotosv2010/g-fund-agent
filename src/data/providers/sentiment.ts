import type { SentimentIndicators } from "../../state/types";

/**
 * 市场情绪指标数据提供者
 *
 * 数据源：
 * - 交易所公开数据（融资融券、北向资金）
 * - 基金公司披露数据（申赎比）
 * - 第三方金融数据平台
 *
 * Phase 1 MVP：返回模拟数据，待后续接入真实API
 */

/**
 * 获取市场情绪指标
 */
export async function getSentimentIndicators(): Promise<SentimentIndicators> {
  // TODO: Phase 1 MVP - 返回模拟数据，后续接入真实API
  // 可选数据源：
  // 1. 东方财富网 API
  // 2. AkShare 提供的融资融券数据
  // 3. 交易所官网爬虫

  return {
    marginBalance: undefined,      // 融资融券余额（亿元）
    northboundFlow: undefined,     // 北向资金净流入（亿元）
    fundRedemption: undefined,     // 基金申赎比
    timestamp: new Date().toISOString(),
  };
}

/**
 * 解读市场情绪
 * 基于情绪指标判断市场热度
 */
export function interpretSentiment(indicators: SentimentIndicators): string {
  const messages: string[] = [];

  if (indicators.marginBalance !== undefined) {
    if (indicators.marginBalance > 18000) {
      messages.push("融资余额 > 1.8万亿，市场情绪乐观");
    } else if (indicators.marginBalance < 15000) {
      messages.push("融资余额 < 1.5万亿，市场情绪谨慎");
    }
  }

  if (indicators.northboundFlow !== undefined) {
    if (indicators.northboundFlow > 50) {
      messages.push("北向资金大幅流入，外资看好A股");
    } else if (indicators.northboundFlow < -50) {
      messages.push("北向资金大幅流出，外资撤离");
    }
  }

  if (messages.length === 0) {
    return "市场情绪数据暂不可用";
  }

  return messages.join("；");
}
