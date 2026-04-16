import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { PortfolioSchema, type Portfolio, ConfigError } from "../domain";

/** 持仓文件目录 */
const DATA_DIR = resolve("data");

/** 持仓文件名匹配模式：portfolio-YYYY-MM-DD.json */
const PORTFOLIO_FILE_PATTERN = /^portfolio-(\d{4}-\d{2}-\d{2})\.json$/;

/**
 * 查找 data/ 目录下最新的持仓文件。
 *
 * 按文件名中的日期降序排序，返回最新的一条。
 *
 * @returns 最新持仓文件的绝对路径，未找到时返回 null
 */
export function findLatestPortfolioFile(): string | null {
  let files: string[];
  try {
    files = readdirSync(DATA_DIR, { encoding: "utf-8" });
  } catch {
    return null;
  }

  const dated = files
    .map((f) => {
      const match = PORTFOLIO_FILE_PATTERN.exec(basename(f));
      return match ? { file: f, date: match[1] } : null;
    })
    .filter((item): item is { file: string; date: string } => item !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  return dated.length > 0 ? resolve(DATA_DIR, dated[0].file) : null;
}

/**
 * 加载并校验用户持仓数据。
 *
 * 自动查找 data/ 目录下最新的 portfolio-YYYY-MM-DD.json 文件。
 *
 * @throws {ConfigError} 文件不存在或数据格式错误时抛出
 */
export function loadPortfolio(): Portfolio {
  const filePath = findLatestPortfolioFile();

  if (!filePath) {
    throw new ConfigError(
      "持仓文件不存在，请创建 data/portfolio-YYYY-MM-DD.json（参考 data/portfolio.example.json）"
    );
  }

  const raw = readFileSync(filePath, "utf-8");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ConfigError(`持仓文件 JSON 格式错误: ${filePath}`);
  }

  const result = PortfolioSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`持仓数据校验失败:\n${issues}`);
  }

  return result.data;
}

/**
 * 计算归一化权重（总和精确为 1）。
 *
 * 前 N-1 个按比例取 6 位小数，最后一个用 1 - 已分配之和补齐，
 * 避免浮点精度导致 MCP 报错。
 */
function normalizeWeights(amounts: readonly number[]): number[] {
  const total = amounts.reduce((sum, a) => sum + a, 0);
  if (total === 0) return amounts.map(() => 0);

  const weights = amounts.map((a) =>
    Math.round((a / total) * 1_000_000) / 1_000_000
  );

  // 最后一个补齐差值，确保总和 = 1
  const allocated = weights.slice(0, -1).reduce((sum, w) => sum + w, 0);
  weights[weights.length - 1] =
    Math.round((1 - allocated) * 1_000_000) / 1_000_000;

  return weights;
}

/**
 * 将持仓数据格式化为 Agent 可读的文本。
 *
 * 包含预计算的归一化权重，Agent 调用 AnalyzePortfolioRisk 时直接使用。
 */
export function formatPortfolioContext(portfolio: Portfolio): string {
  const amounts = portfolio.holdings.map((h) => h.amount);
  const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
  const weights = normalizeWeights(amounts);

  const holdingsText = portfolio.holdings
    .map((h, i) => {
      const pct = (weights[i] * 100).toFixed(2);
      const parts = [
        `基金代码: ${h.fundCode}`,
        h.fundName ? `名称: ${h.fundName}` : null,
        `金额: ${h.amount.toFixed(2)}元`,
        `占比: ${pct}%`,
        `权重(weight): ${weights[i]}`,
        h.returnRate != null ? `收益率: ${(h.returnRate * 100).toFixed(2)}%` : null,
        h.costBasis != null ? `成本净值: ${h.costBasis}` : null,
      ].filter(Boolean);
      return `- ${parts.join("，")}`;
    })
    .join("\n");

  let text = `## 用户持仓数据\n\n`;
  if (portfolio.name) text += `组合名称: ${portfolio.name}\n`;
  if (portfolio.target) {
    const completionRate = ((totalAmount / portfolio.target) * 100).toFixed(1);
    text += `目标总额: ${portfolio.target.toFixed(2)}元\n`;
    text += `持仓总额: ${totalAmount.toFixed(2)}元（完成度: ${completionRate}%）\n\n`;
  } else {
    text += `持仓总额: ${totalAmount.toFixed(2)}元\n\n`;
  }
  text += `### 当前持仓\n${holdingsText}\n`;
  text += `\n> 注意：调用 AnalyzePortfolioRisk 时请直接使用上述"权重(weight)"值，总和已精确归一化为 1。\n`;

  if (portfolio.targetAllocations?.length) {
    const targetText = portfolio.targetAllocations
      .map((t) => {
        const parts = [
          `基金代码: ${t.fundCode}`,
          t.fundName ? `名称: ${t.fundName}` : null,
          `目标权重: ${t.targetWeight}%`,
          portfolio.target
            ? `目标金额: ${(portfolio.target * t.targetWeight / 100).toFixed(2)}元`
            : null,
        ].filter(Boolean);
        return `- ${parts.join("，")}`;
      })
      .join("\n");
    text += `\n### 目标仓位\n${targetText}\n`;
  }

  return text;
}
