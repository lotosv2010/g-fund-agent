import { readFile } from "fs/promises";
import { resolve } from "path";
import type { FundMeta } from "../rules/fund-registry";
import { FUND_REGISTRY } from "../rules/fund-registry";
import type { AssetCategory } from "../state/types";

/**
 * 动态加载基金列表
 * 优先级：
 * 1. 环境变量 FUND_LIST_PATH 指定的文件
 * 2. 默认的 docs/portfolio.md
 * 3. 兜底使用 fund-registry.ts
 */
export async function loadFundList(): Promise<FundMeta[]> {
  const customPath = process.env.FUND_LIST_PATH;

  try {
    if (customPath) {
      console.log(`[fund-loader] 尝试从自定义路径加载: ${customPath}`);
      return await loadFromFile(customPath);
    }

    // 默认路径
    const defaultPath = resolve(process.cwd(), "docs/portfolio.md");
    console.log(`[fund-loader] 从 portfolio.md 加载基金列表`);
    return await loadFromPortfolio(defaultPath);
  } catch (error) {
    console.warn(`[fund-loader] 动态加载失败，使用静态注册表:`, error instanceof Error ? error.message : error);
    return FUND_REGISTRY;
  }
}

/**
 * 从 portfolio.md 解析基金列表
 */
async function loadFromPortfolio(filePath: string): Promise<FundMeta[]> {
  const content = await readFile(filePath, "utf-8");
  const funds: FundMeta[] = [];

  // 当前资产类别（从标题推断）
  let currentCategory: AssetCategory | null = null;

  const lines = content.split("\n");

  for (const line of lines) {
    // 匹配 ## 标题，推断资产类别
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      const headerText = headerMatch[1];

      // 跳过已知的非资产类别标题（汇总、总计等）
      const isNonCategoryHeader = /^(汇总|总计|合计|小计|说明|备注)$/i.test(headerText);
      if (isNonCategoryHeader) {
        currentCategory = null;
        continue;
      }

      const newCategory = inferCategory(headerText);
      if (newCategory === null) {
        console.warn(`[fund-loader] ⚠️  无法识别的资产类别: "${headerText}"，该分类下的基金将被跳过`);
      }
      currentCategory = newCategory;
      continue;
    }

    // 跳过非数据行
    if (!line.startsWith("|") || line.includes("---") || line.includes("名称")) {
      continue;
    }

    // 解析表格行：| 申万菱信沪深300指数增强A | 310318 | ...
    const cells = line.split("|").map(c => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const [name, code] = cells;

    // 跳过汇总行
    if (name.includes("小计") || name.includes("合计") || name.includes("**")) {
      continue;
    }

    if (code && /^\d{6}$/.test(code) && currentCategory) {
      // 生成短名称（取第一个有意义的部分）
      const shortName = extractShortName(name);

      funds.push({
        code,
        name,
        shortName,
        category: currentCategory,
      });
    }
  }

  if (funds.length === 0) {
    throw new Error("未能从 portfolio.md 解析到任何基金");
  }

  console.log(`[fund-loader] 成功加载 ${funds.length} 只基金`);
  return funds;
}

/**
 * 从自定义格式文件加载（支持简化格式）
 * 格式示例：
 * # 宽基类
 * - 310318  申万菱信沪深300指数增强A
 * - 022445  景顺长城中证A500ETF联接C
 */
async function loadFromFile(filePath: string): Promise<FundMeta[]> {
  const content = await readFile(filePath, "utf-8");
  const funds: FundMeta[] = [];

  let currentCategory: AssetCategory | null = null;

  for (const line of content.split("\n")) {
    // 匹配标题
    const headerMatch = line.match(/^#\s+(.+)/);
    if (headerMatch) {
      const headerText = headerMatch[1];

      // 跳过已知的非资产类别标题（汇总、总计等）
      const isNonCategoryHeader = /^(汇总|总计|合计|小计|说明|备注)$/i.test(headerText);
      if (isNonCategoryHeader) {
        currentCategory = null;
        continue;
      }

      const newCategory = inferCategory(headerText);
      if (newCategory === null) {
        console.warn(`[fund-loader] ⚠️  无法识别的资产类别: "${headerText}"，该分类下的基金将被跳过`);
      }
      currentCategory = newCategory;
      continue;
    }

    // 匹配列表项：- 310318  申万菱信沪深300指数增强A
    const itemMatch = line.match(/^-\s+(\d{6})\s+(.+)/);
    if (itemMatch && currentCategory) {
      const [, code, name] = itemMatch;
      funds.push({
        code,
        name: name.trim(),
        shortName: extractShortName(name),
        category: currentCategory,
      });
    }
  }

  if (funds.length === 0) {
    throw new Error(`未能从 ${filePath} 解析到任何基金`);
  }

  console.log(`[fund-loader] 从自定义文件加载 ${funds.length} 只基金`);
  return funds;
}

/**
 * 根据标题文本推断资产类别
 *
 * @param header 标题文本（如"宽基类"、"科技主题类"等）
 * @returns 资产类别或 null（无法识别时）
 *
 * 支持的标题模式：
 * - 宽基 / broad
 * - 科技 / tech
 * - 标普 / sp500
 * - 纳斯达克 / nasdaq
 * - 中概 + internet / china + internet
 * - 债 / bond
 * - 黄金 / gold
 * - 海外 / overseas / qdii（默认归为 overseas_sp500）
 *
 * 注意：返回 null 时，该分类下的基金会被跳过并输出警告
 */
function inferCategory(header: string): AssetCategory | null {
  const h = header.toLowerCase();

  if (h.includes("宽基") || h.includes("broad")) return "broad_base";
  if (h.includes("科技") || h.includes("tech")) return "tech";
  if (h.includes("标普") || h.includes("sp500")) return "overseas_sp500";
  if (h.includes("纳斯达克") || h.includes("nasdaq")) return "overseas_nasdaq";
  if (h.includes("中概") || h.includes("china") && h.includes("internet")) return "overseas_china_internet";
  if (h.includes("债") || h.includes("bond")) return "bond";
  if (h.includes("黄金") || h.includes("gold")) return "gold";

  // 海外类统一处理
  if (h.includes("海外") || h.includes("overseas") || h.includes("qdii")) {
    return "overseas_sp500"; // 默认归类
  }

  return null;
}

/**
 * 提取短名称
 */
function extractShortName(fullName: string): string {
  // 移除括号内容（如 "(QDII)"）
  const cleaned = fullName.replace(/\s*\([^)]*\)/g, "");

  // 常见模式：公司名 + 具体基金名
  // 例如："申万菱信沪深300指数增强A" -> "沪深300增强"
  const patterns = [
    /沪深\d+/,
    /中证[A-Z0-9]+/,
    /标普\d+/,
    /纳斯达克/,
    /中概/,
    /创业板/,
    /人工智能/,
    /半导体/,
    /机器人/,
    /黄金/,
    /纯债/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // 如果没有匹配模式，取最后几个有意义的字
  const parts = cleaned.split(/[A-Z]$/); // 移除尾部的 A/B/C
  const main = parts[0] || cleaned;

  // 取后缀（假设前面是公司名）
  const words = main.split(/基金|指数|ETF|联接/).filter(Boolean);
  return words[words.length - 1]?.trim() || cleaned;
}
