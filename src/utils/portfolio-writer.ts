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
 * 将持仓数据写入指定交易日的 JSON 文件。
 *
 * 文件名：data/portfolio-{tradeDate}.json
 * - 同一交易日多次更新：覆盖该日文件
 * - 历史文件不受影响
 *
 * @param portfolio - 校验通过的持仓数据
 * @param tradeDate - 涨跌数据对应的交易日期（YYYY-MM-DD）
 * @returns 写入的文件路径
 */
export function savePortfolio(portfolio: Portfolio, tradeDate: string): string {
  const filePath = getPortfolioPath(tradeDate);
  const json = JSON.stringify(portfolio, null, 2);
  writeFileSync(filePath, json + "\n", "utf-8");
  return filePath;
}
