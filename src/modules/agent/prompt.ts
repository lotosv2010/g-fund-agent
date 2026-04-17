/**
 * System Prompt 与场景指令构建。
 *
 * 设计原则：
 * - System Prompt 定义角色、行为准则、参考数据（持仓 + 策略）
 * - 场景指令通过 user message 注入，CLI 模式使用显式指令，LangGraph 模式由用户自由输入
 * - 不硬编码 MCP 工具名，Agent 根据目标自行选择工具
 */

/** System Prompt — 角色定义与行为准则 */
const BASE_PROMPT = `你是一个专业的基金顾投 AI 助手。

## 行为准则

1. 所有数据均来自且慢（Qieman）数据源，优先使用工具获取实时数据
2. 涉及投资建议时，始终附加风险提示
3. 使用清晰的中文回复，必要时用表格展示数据
4. 工具调用失败时，向用户说明原因并建议替代方案

## 场景说明

- 当用户要求"查看持仓"时：获取基金信息和净值，用表格展示数据即可，不做深度分析
- 当用户要求"分析持仓"时：从持仓概览、业绩表现、资产配置、行业集中度、基金相关性、组合风险、综合诊断等维度逐步分析，如有操作策略则结合策略评估是否触发补仓/止盈/纪律预警，给出具体操作建议；如无需操作则明确说明
- 当用户要求"更新持仓"时：根据当前持仓数据日期，获取该日期之后最近一个交易日的涨跌幅（即下一个交易日），确认交易日期，然后询问用户是否有加仓/减仓操作，最后调用 UpdatePortfolioFile 工具保存更新结果

## 风险声明

所有分析和建议仅供参考，不构成投资建议。投资有风险，决策需谨慎。`;

/** buildSystemPrompt 的参数 */
interface BuildSystemPromptParams {
  /** 格式化后的持仓数据文本 */
  readonly portfolioContext?: string;
  /** 格式化后的操作策略文本 */
  readonly strategyContext?: string;
}

/**
 * 构建 System Prompt。
 *
 * 包含角色定义 + 持仓数据 + 操作策略（均作为参考数据）。
 * CLI 和 LangGraph 两种模式共享同一 System Prompt。
 */
export function buildSystemPrompt(params?: BuildSystemPromptParams): string {
  const parts = [BASE_PROMPT];

  if (params?.portfolioContext) {
    parts.push(params.portfolioContext);
  }

  if (params?.strategyContext) {
    parts.push(params.strategyContext);
  }

  return parts.join("\n\n");
}

/**
 * 构建"查看持仓"场景的用户指令（CLI 模式专用）。
 *
 * 纯数据展示，不做深度分析。
 */
export function buildViewInstruction(): string {
  return [
    "请查看我的持仓概览，要求：",
    "1. 获取每只基金的基本信息和最新净值",
    "2. 获取近期收益表现",
    "3. 用表格展示：基金名称、代码、最新净值、持仓金额、收益率、近期涨跌",
    "4. 仅展示数据，不需要做分析或建议",
  ].join("\n");
}

/**
 * 构建"更新持仓"场景的用户指令（CLI 模式专用）。
 *
 * 告知 Agent 当前持仓日期，要求获取该日期之后最近一个交易日的涨跌幅，
 * 以 JSON 格式返回，便于程序解析后做持仓更新计算。
 *
 * @param fundCodes - 需要查询的基金代码列表
 * @param portfolioDate - 当前持仓快照日期（YYYY-MM-DD），用于定位下一个交易日
 */
export function buildUpdateInstruction(
  fundCodes: readonly string[],
  portfolioDate?: string,
): string {
  const dateHint = portfolioDate
    ? `当前持仓数据日期为 ${portfolioDate}，请获取 ${portfolioDate} 之后最近一个交易日的涨跌幅数据。`
    : "请获取最近一个交易日的涨跌幅数据。";

  return [
    `${dateHint}`,
    "",
    `基金列表：${fundCodes.join(", ")}`,
    "",
    "要求：",
    "1. 通过工具获取每只基金在该交易日的涨跌幅（日涨跌率）",
    "2. 如果能获取到基金名称也一并返回",
    "3. 必须返回该涨跌幅对应的交易日期（tradeDate），格式为 YYYY-MM-DD",
    "4. 将结果严格按以下 JSON 格式返回，放在 ```json 代码块中：",
    "",
    "```json",
    "{",
    '  "tradeDate": "2026-06-16",',
    '  "funds": [',
    '    { "fundCode": "000001", "dailyReturn": 0.0123, "fundName": "基金名称" }',
    "  ]",
    "}",
    "```",
    "",
    "注意：",
    "- tradeDate 是涨跌幅数据对应的交易日期，不是今天的日期",
    `${portfolioDate ? `- tradeDate 必须晚于当前持仓日期 ${portfolioDate}` : ""}`,
    "- dailyReturn 为小数形式（如 1.23% 写为 0.0123，-0.5% 写为 -0.005）",
    "- 必须包含 ```json 代码块，便于程序解析",
    "- 只返回 JSON 数据，不需要其他分析",
  ].filter(Boolean).join("\n");
}

/**
 * 构建"分析持仓"场景的用户指令（CLI 模式专用）。
 *
 * 不指定具体工具名，由 Agent 根据目标自主选择。
 */
export function buildAnalyzeInstruction(): string {
  return [
    "请对我的持仓进行全面分析，按以下维度逐步执行：",
    "",
    "1. **持仓概览** — 获取各基金基本信息",
    "2. **业绩表现** — 获取近期收益数据",
    "3. **资产配置** — 穿透分析股票/债券/现金比例",
    "4. **行业集中度** — 分析前 5 大行业占比",
    "5. **基金相关性** — 评估基金间的分散度",
    "6. **组合风险** — 计算组合整体风险指标",
    "7. **综合诊断** — 给出诊断建议",
    "8. **策略评估** — 结合操作策略，判断是否触发补仓/止盈/纪律预警，给出具体操作建议。如无需操作，明确说明",
    "",
    "要求：每个维度用独立章节展示，最后给出整体优化方案。如果持仓状态良好无需优化，明确告知。",
  ].join("\n");
}
