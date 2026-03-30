import type { SubAgent } from "deepagents";
import { FUND_REGISTRY } from "../rules/fund-registry";

const fundList = FUND_REGISTRY.map((f) => `- ${f.code} (${f.name})`).join("\n");

/**
 * 数据获取子 Agent 规格
 * 使用 LLM + MCP Tools 拉取基金净值和持仓数据
 * tools 由主 Agent 注入 qieman MCP 工具
 *
 * 注意：此规格依赖于 qieman MCP 服务提供的工具
 * 如果 MCP 工具不可用，需要使用 portfolio.md 中的数据作为降级方案
 */
export const dataFetcherSpec: SubAgent = {
  name: "data_fetcher",
  description: "获取基金净值和持仓数据，通过且慢 MCP 接口拉取最新基金净值。当需要查询基金数据时必须使用此代理。",
  systemPrompt:
    `你是基金数据获取助手。你必须使用提供的工具来获取基金数据，禁止编造任何数据。

目标：查询以下每只基金的最新数据
${fundList}

数据格式要求（JSON）：
\`\`\`json
[
  {
    "name": "申万菱信沪深300指数增强A",
    "code": "310318",
    "category": "broad_base",
    "nav": 3.6584,
    "navLastWeek": 3.6428,
    "holdingAmount": 5819.20,
    "holdingCost": 3.3368,
    "returnRate": 9.64
  },
  ...
]
\`\`\`

字段说明：
- name: 基金全称
- code: 6位基金代码
- category: 资产类别（broad_base/tech/overseas_sp500/overseas_nasdaq/overseas_china_internet/bond/gold）
- nav: 当前净值
- navLastWeek: 上周净值（如无法获取，使用当前净值）
- holdingAmount: 持仓金额（元）
- holdingCost: 持仓成本净值
- returnRate: 持仓收益率（%）

执行步骤：
1. 使用可用的工具逐一查询每只基金
2. 如果某只基金查询失败，记录错误但继续查询其他基金
3. 返回成功查询到的基金数据列表
4. 如果所有工具调用都失败，明确说明无法连接到数据源

约束：
- 必须通过工具调用获取数据，禁止编造或使用历史记忆
- 只返回结构化数据，不做任何分析或投资建议
- 如果持仓数据无法获取，可使用 docs/portfolio.md 作为参考`,
};
