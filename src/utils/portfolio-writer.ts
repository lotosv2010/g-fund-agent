import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Portfolio } from "../domain";

/** 持仓文件目录 */
const DATA_DIR = resolve("data");

/**
 * 生成指定日期的持仓文件路径。
 *
 * 格式：data/portfolio-YYYY-MM-DD.json
 *
 * @param date - 交易日期，格式 YYYY-MM-DD
 */
export function getPortfolioPath(date: string): string {
  return resolve(DATA_DIR, `portfolio-${date}.json`);
}

/**
 * 格式化单个 holding 对象为单行紧凑 JSON。
 *
 * 字段顺序：fundCode, fundName, amount, returnRate, costBasis
 */
function formatHolding(h: Portfolio["holdings"][number]): string {
  const parts: string[] = [];
  parts.push(`"fundCode": "${h.fundCode}"`);
  if (h.fundName) parts.push(`"fundName": "${h.fundName}"`);
  parts.push(`"amount": ${h.amount}`);
  if (h.returnRate != null) parts.push(`"returnRate": ${h.returnRate}`);
  if (h.costBasis != null) parts.push(`"costBasis": ${h.costBasis}`);
  return `{ ${parts.join(", ")} }`;
}

/**
 * 格式化单个 targetAllocation 对象为单行紧凑 JSON。
 *
 * 字段顺序：fundCode, fundName (可选), targetWeight
 */
function formatTargetAllocation(t: NonNullable<Portfolio["targetAllocations"]>[number]): string {
  const parts: string[] = [];
  parts.push(`"fundCode": "${t.fundCode}"`);
  if (t.fundName) parts.push(`"fundName": "${t.fundName}"`);
  parts.push(`"targetWeight": ${t.targetWeight}`);
  return `{ ${parts.join(", ")} }`;
}

/**
 * 将持仓数据写入指定交易日的 JSON 文件。
 *
 * 文件名：data/portfolio-{tradeDate}.json
 * - 同一交易日多次更新：覆盖该日文件
 * - 历史文件不受影响
 * - 格式：holdings 数组中每个对象保持单行，与输入格式一致
 *
 * @param portfolio - 校验通过的持仓数据
 * @param tradeDate - 涨跌数据对应的交易日期（YYYY-MM-DD）
 * @returns 写入的文件路径
 */
export function savePortfolio(portfolio: Portfolio, tradeDate: string): string {
  const filePath = getPortfolioPath(tradeDate);

  // 自定义格式化：holdings 和 targetAllocations 数组中每项单行
  const holdingsLines = portfolio.holdings.map((h) => `    ${formatHolding(h)}`);
  const holdingsJson = `[\n${holdingsLines.join(",\n")}\n  ]`;

  let json = `{\n  "name": ${JSON.stringify(portfolio.name)},\n  "target": ${portfolio.target},\n  "holdings": ${holdingsJson}`;

  if (portfolio.targetAllocations && portfolio.targetAllocations.length > 0) {
    const targetLines = portfolio.targetAllocations.map((t) => `    ${formatTargetAllocation(t)}`);
    const targetJson = `[\n${targetLines.join(",\n")}\n  ]`;
    json += `,\n  "targetAllocations": ${targetJson}`;
  }

  json += "\n}\n";

  writeFileSync(filePath, json, "utf-8");
  return filePath;
}
