import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ConfigError } from "../domain";

/** 策略文件路径 */
const STRATEGY_PATH = resolve("data/strategy.json");

/** 买入触发条件 */
interface BuyTrigger {
  readonly drawdown: number;
  readonly action: string;
}

/** 卖出触发条件 */
interface SellTrigger {
  readonly gain: number;
  readonly action: string;
}

/** 资产类别策略 */
interface CategoryStrategy {
  readonly name: string;
  readonly funds: readonly string[];
  readonly buyTriggers: readonly BuyTrigger[];
  readonly sellTriggers: readonly SellTrigger[];
}

/** 弹药库（债券）策略 */
interface AmmoFund {
  readonly name: string;
  readonly role: string;
  readonly triggerRule: string;
  readonly capRule: string;
}

/** 策略数据结构 */
interface Strategy {
  readonly name: string;
  readonly principle: string;
  readonly ammoFund: AmmoFund;
  readonly categories: readonly CategoryStrategy[];
  readonly disciplineRules: readonly string[];
}

/**
 * 加载用户操作策略数据。
 *
 * @throws {ConfigError} 文件不存在或 JSON 格式错误时抛出
 */
export function loadStrategy(): Strategy {
  if (!existsSync(STRATEGY_PATH)) {
    throw new ConfigError("策略文件不存在: data/strategy.json");
  }

  const raw = readFileSync(STRATEGY_PATH, "utf-8");

  try {
    return JSON.parse(raw) as Strategy;
  } catch {
    throw new ConfigError(`策略文件 JSON 格式错误: ${STRATEGY_PATH}`);
  }
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
