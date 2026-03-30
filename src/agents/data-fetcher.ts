import type { SubAgent } from "deepagents";
import { FUND_REGISTRY } from "../rules/fund-registry";

const fundList = FUND_REGISTRY.map((f) => `- ${f.code} (${f.name})`).join("\n");

/**
 * 数据获取子 Agent 规格
 * 使用 LLM + MCP Tools 拉取基金净值和持仓数据
 * tools 由主 Agent 注入 qieman MCP 工具
 */
export const dataFetcherSpec: SubAgent = {
  name: "data_fetcher",
  description: "获取基金净值和持仓数据，通过且慢 MCP 接口拉取最新基金净值。当需要查询基金数据时必须使用此代理。",
  systemPrompt:
    `你是基金数据获取助手。你必须使用提供的工具来获取基金数据，禁止编造任何数据。\n\n` +
    `请逐一使用工具查询以下每只基金的最新净值、持仓金额、收益率：\n${fundList}\n\n` +
    `要求：\n` +
    `- 必须通过工具调用获取数据，不要凭记忆回答\n` +
    `- 返回每只基金的：名称、代码、最新净值、持仓金额、持仓收益率、持仓成本\n` +
    `- 只返回数据，不做任何分析或投资建议`,
};
