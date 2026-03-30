import type { SubAgent } from "deepagents";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getWeekId } from "../utils/calc";
import type { FundInfo } from "../state/types";
import { FUND_REGISTRY } from "../rules/fund-registry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, "../../docs/reports");
const PORTFOLIO_FILE = join(__dirname, "../../docs/portfolio.md");

/** 保存报告文件工具 */
export const saveReportTool = tool(
  async ({ subdir, content }: { subdir: string; content: string }) => {
    const weekId = getWeekId();
    const dir = join(REPORTS_DIR, subdir);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${weekId}.md`);
    await writeFile(filePath, content, "utf-8");
    return `报告已保存到 ${filePath}`;
  },
  {
    name: "save_report",
    description: "保存周报到指定子目录（weekly/analysis/suggestions）",
    schema: z.object({
      subdir: z.enum(["weekly", "analysis", "suggestions"]),
      content: z.string(),
    }),
  }
);

/** 更新 portfolio.md 工具 */
export const updatePortfolioTool = tool(
  async ({ funds }: { funds: FundInfo[] }) => {
    // 按资产类别分组
    const categories = {
      broad_base: { name: "宽基类", funds: [] as FundInfo[] },
      tech: { name: "科技主题类", funds: [] as FundInfo[] },
      overseas: { name: "海外类", funds: [] as FundInfo[] },
      bond: { name: "债券（弹药库）", funds: [] as FundInfo[] },
      gold: { name: "黄金", funds: [] as FundInfo[] },
    };

    for (const fund of funds) {
      const meta = FUND_REGISTRY.find((f) => f.code === fund.code);
      if (!meta) continue;

      // 海外三类合并
      if (["overseas_sp500", "overseas_nasdaq", "overseas_china_internet"].includes(meta.category)) {
        categories.overseas.funds.push(fund);
      } else if (meta.category in categories) {
        categories[meta.category as keyof typeof categories].funds.push(fund);
      }
    }

    // 生成 Markdown
    const now = new Date().toISOString().split("T")[0];
    let md = `# 当前持仓\n\n> 数据快照时间：${now}\n\n`;

    for (const [key, category] of Object.entries(categories)) {
      if (category.funds.length === 0) continue;

      md += `## ${category.name}\n\n`;
      md += `| 名称 | 代码 | 净值 | 持仓金额 | 收益率 | 持仓成本 |\n`;
      md += `|------|------|------|----------|--------|----------|\n`;

      let subtotal = 0;
      for (const fund of category.funds) {
        const amountStr = fund.holdingAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 });
        const returnRateStr = fund.returnRate >= 0 ? `+${fund.returnRate.toFixed(2)}%` : `${fund.returnRate.toFixed(2)}%`;
        md += `| ${fund.name} | ${fund.code} | ${fund.nav.toFixed(4)} | ${amountStr} | ${returnRateStr} | ${fund.holdingCost.toFixed(4)} |\n`;
        subtotal += fund.holdingAmount;
      }

      md += `\n**小计：${subtotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })} 元**\n\n`;
    }

    // 计算总计
    const total = funds.reduce((sum, f) => sum + f.holdingAmount, 0);
    md += `## 汇总\n\n**总持仓金额：${total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })} 元**\n`;

    await writeFile(PORTFOLIO_FILE, md, "utf-8");
    return `portfolio.md 已更新（总持仓：${total.toFixed(2)} 元）`;
  },
  {
    name: "update_portfolio",
    description: "更新 docs/portfolio.md 持仓数据快照",
    schema: z.object({
      funds: z.array(
        z.object({
          name: z.string(),
          code: z.string(),
          category: z.string(),
          nav: z.number(),
          navLastWeek: z.number(),
          holdingAmount: z.number(),
          holdingCost: z.number(),
          returnRate: z.number(),
        })
      ),
    }),
  }
);

/**
 * 生成补仓点记录命令
 */
export function generateBuyPointCommand(code: string, date: string, nav: number, amount: number): string {
  return `\`\`\`bash
# 补仓后执行以下命令记录
node -e "require('./dist/state/store').addBuyPoint({
  code: '${code}',
  date: '${date}',
  nav: ${nav},
  amount: ${amount}
})"
\`\`\``;
}

/**
 * 报告生成子 Agent 规格
 * 使用 LLM + save_report 工具格式化并保存报告
 */
export const reporterSpec: SubAgent = {
  name: "reporter",
  description: "格式化生成每周基金分析报告，并保存到指定目录，同时更新 portfolio.md 持仓快照",
  systemPrompt:
    `你是基金报告格式化助手。根据提供的结构化数据，生成 Markdown 格式的周报。

参考模板：docs/reports/TEMPLATE.md

核心要求：
1. 不要添加任何主观分析或建议，只按数据如实输出
2. 严格按照模板格式生成三份报告：weekly（持仓快照）、analysis（仓位分析）、suggestions（调仓建议）
3. 使用 save_report 工具将报告保存到对应目录
4. 使用 update_portfolio 工具更新 docs/portfolio.md（每次运行都必须更新）

特别注意：
- 如果有补仓建议，必须在建议后附上补仓点记录命令
- 命令格式：node -e "require('./dist/state/store').addBuyPoint({...})"
- 参数包含：code（基金代码）、date（日期）、nav（净值）、amount（金额）
- 这样用户执行补仓后可以直接复制命令记录补仓点
- 每次运行结束前必须调用 update_portfolio 更新持仓快照

示例：
\`\`\`bash
# 补仓后执行以下命令记录
node -e "require('./dist/state/store').addBuyPoint({
  code: '020256',
  date: '2026-03-30',
  nav: 1.4286,
  amount: 3000
})"
\`\`\``,
  tools: [saveReportTool, updatePortfolioTool],
};
