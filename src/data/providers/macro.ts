import type { MacroIndicators } from "../../state/types";

/**
 * 宏观经济指标数据提供者
 *
 * 数据源：
 * - 国家统计局 API
 * - Wind / 同花顺金融终端
 * - 第三方数据聚合服务
 *
 * Phase 1 MVP：返回模拟数据，待后续接入真实API
 */

/**
 * 获取宏观经济指标
 */
export async function getMacroIndicators(): Promise<MacroIndicators> {
  // TODO: Phase 1 MVP - 返回模拟数据，后续接入真实API
  // 可选数据源：
  // 1. 国家统计局开放API
  // 2. AkShare（开源金融数据接口）
  // 3. Tushare Pro（需付费订阅）

  return {
    bondYield10Y: undefined, // 十年期国债收益率（%）
    pmi: undefined,          // 制造业PMI
    socialFinancing: undefined, // 社融增速（%）
    timestamp: new Date().toISOString(),
  };
}

/**
 * 解读宏观环境
 * 基于宏观指标判断市场周期
 */
export function interpretMacro(indicators: MacroIndicators): string {
  const messages: string[] = [];

  if (indicators.bondYield10Y !== undefined) {
    if (indicators.bondYield10Y < 2.5) {
      messages.push("国债收益率处于低位，宽松货币环境");
    } else if (indicators.bondYield10Y > 3.5) {
      messages.push("国债收益率偏高，货币政策趋紧");
    }
  }

  if (indicators.pmi !== undefined) {
    if (indicators.pmi > 50) {
      messages.push("PMI > 50，制造业扩张");
    } else {
      messages.push("PMI < 50，制造业收缩");
    }
  }

  if (messages.length === 0) {
    return "宏观数据暂不可用";
  }

  return messages.join("；");
}
