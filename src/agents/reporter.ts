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
 * 报告生成子 Agent 规格
 * 使用 LLM + save_report 工具格式化并保存报告
 */
export const reporterSpec: SubAgent = {
  name: "reporter",
  description: "格式化生成每周基金分析报告，并保存到指定目录",
  systemPrompt:
    `你是基金报告格式化助手。根据提供的结构化数据，生成 Markdown 格式的周报。\n` +
    `不要添加任何主观分析或建议，只按数据如实输出。\n` +
    `使用 save_report 工具将报告保存到对应目录。`,
  tools: [saveReportTool],
};
