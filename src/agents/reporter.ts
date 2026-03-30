import type { SubAgent } from "deepagents";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getWeekId } from "../utils/calc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, "../../docs/reports");

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
  description: "格式化生成每周基金分析报告，并保存到指定目录",
  systemPrompt:
    `你是基金报告格式化助手。根据提供的结构化数据，生成 Markdown 格式的周报。

参考模板：docs/reports/TEMPLATE.md

核心要求：
1. 不要添加任何主观分析或建议，只按数据如实输出
2. 严格按照模板格式生成三份报告：weekly（持仓快照）、analysis（仓位分析）、suggestions（调仓建议）
3. 使用 save_report 工具将报告保存到对应目录

特别注意：
- 如果有补仓建议，必须在建议后附上补仓点记录命令
- 命令格式：node -e "require('./dist/state/store').addBuyPoint({...})"
- 参数包含：code（基金代码）、date（日期）、nav（净值）、amount（金额）
- 这样用户执行补仓后可以直接复制命令记录补仓点

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
  tools: [saveReportTool],
};
