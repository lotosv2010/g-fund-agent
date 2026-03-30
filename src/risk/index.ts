import type { FundInfo, MarketData, Suggestion, RiskCheckResult } from "../state/types";
import { checkDrawdownRisk } from "./drawdown";
import { checkConcentrationRisk } from "./concentration";
import { checkLiquidityRisk } from "./liquidity";

/**
 * 风控聚合器
 * 统一执行所有风控检查并整合结果
 */

/**
 * 执行全部风控检查
 *
 * @param funds - 基金数据
 * @param marketData - 市场数据
 * @param suggestions - 调仓建议
 * @returns 所有风控检查结果
 */
export function performRiskChecks(
  funds: FundInfo[],
  marketData: MarketData[],
  suggestions: Suggestion[]
): RiskCheckResult[] {
  const results: RiskCheckResult[] = [];

  // 1. 回撤风险检查
  const drawdownResults = checkDrawdownRisk(funds, marketData);
  results.push(...drawdownResults);

  // 2. 集中度风险检查
  const concentrationResults = checkConcentrationRisk(funds);
  results.push(...concentrationResults);

  // 3. 流动性风险检查
  const liquidityResults = checkLiquidityRisk(funds, suggestions);
  results.push(...liquidityResults);

  return results;
}

/**
 * 过滤被阻止的建议
 * 如果某个建议被风控标记为阻止，则从建议列表中移除
 *
 * @param suggestions - 原始建议
 * @param riskResults - 风控检查结果
 * @returns 过滤后的建议
 */
export function filterBlockedSuggestions(
  suggestions: Suggestion[],
  riskResults: RiskCheckResult[]
): Suggestion[] {
  const blockedCodes = new Set<string>();

  for (const result of riskResults) {
    if (!result.passed && result.blockedSuggestions) {
      result.blockedSuggestions.forEach((code) => blockedCodes.add(code));
    }
  }

  if (blockedCodes.size === 0) {
    return suggestions;
  }

  const filtered = suggestions.filter((s) => !blockedCodes.has(s.code));

  if (filtered.length < suggestions.length) {
    console.log(
      `[risk] 风控阻止了 ${suggestions.length - filtered.length} 条建议：${Array.from(blockedCodes).join(", ")}`
    );
  }

  return filtered;
}

/**
 * 生成风控摘要
 * 用于报告中的"风险提示"章节
 *
 * @param riskResults - 风控检查结果
 * @returns Markdown 格式的风控摘要
 */
export function summarizeRiskChecks(riskResults: RiskCheckResult[]): string {
  if (riskResults.length === 0) {
    return "✅ 无风险预警";
  }

  const errors = riskResults.filter((r) => r.level === "error");
  const warnings = riskResults.filter((r) => r.level === "warning");
  const infos = riskResults.filter((r) => r.level === "info");

  const sections: string[] = [];

  if (errors.length > 0) {
    sections.push("### ❌ 严重风险\n\n" + errors.map((r) => `- ${r.message}`).join("\n"));
  }

  if (warnings.length > 0) {
    sections.push("### ⚠️ 风险预警\n\n" + warnings.map((r) => `- ${r.message}`).join("\n"));
  }

  if (infos.length > 0) {
    sections.push("### ℹ️ 提示信息\n\n" + infos.map((r) => `- ${r.message}`).join("\n"));
  }

  return sections.join("\n\n");
}

// 导出子模块
export * from "./drawdown";
export * from "./concentration";
export * from "./liquidity";
