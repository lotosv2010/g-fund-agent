import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ConfigError, StrategySchema, type Strategy } from "../domain";

/** 策略文件路径 */
const STRATEGY_PATH = resolve("data/strategy.json");

/**
 * 加载并校验用户操作策略数据。
 *
 * 使用 Zod Schema 做运行时校验，确保数据结构符合预期。
 *
 * @throws {ConfigError} 文件不存在、JSON 格式错误或数据校验失败时抛出
 */
export function loadStrategy(): Strategy {
  if (!existsSync(STRATEGY_PATH)) {
    throw new ConfigError("策略文件不存在: data/strategy.json");
  }

  const raw = readFileSync(STRATEGY_PATH, "utf-8");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ConfigError(`策略文件 JSON 格式错误: ${STRATEGY_PATH}`);
  }

  const result = StrategySchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`策略数据校验失败:\n${issues}`);
  }

  return result.data;
}

/**
 * 将策略数据格式化为 Agent 可读的文本，注入 System Prompt。
 */
export function formatStrategyContext(strategy: Strategy): string {
  let text = `## 用户操作策略：${strategy.name}\n\n`;
  text += `核心理念：${strategy.principle}\n\n`;

  // 弹药库
  text += `### 弹药库 — ${strategy.ammoFund.name}\n`;
  text += `- 角色：${strategy.ammoFund.role}\n`;
  text += `- 动用规则：${strategy.ammoFund.triggerRule}\n`;
  text += `- 上限规则：${strategy.ammoFund.capRule}\n\n`;

  // 各类资产策略
  text += `### 各类资产补仓/止盈规则\n\n`;
  for (const cat of strategy.categories) {
    text += `**${cat.name}**（${cat.funds.join("、")}）\n`;

    text += `补仓：`;
    text += cat.buyTriggers
      .map((t) => `跌${(t.drawdown * 100).toFixed(0)}% → ${t.action}`)
      .join("；");
    text += `\n`;

    text += `止盈：`;
    text += cat.sellTriggers
      .map((t) => `涨${(t.gain * 100).toFixed(0)}% → ${t.action}`)
      .join("；");
    text += `\n\n`;
  }

  // 纪律规则
  text += `### 纪律规则\n`;
  for (const rule of strategy.disciplineRules) {
    text += `- ${rule}\n`;
  }

  text += `\n> 分析持仓时，请结合上述策略规则评估当前持仓状态，判断是否触发补仓/止盈/纪律预警。\n`;

  return text;
}
