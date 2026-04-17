import "dotenv/config";
import { select, input, confirm } from "@inquirer/prompts";
import type { DeepAgent, DeepAgentTypeConfig } from "deepagents";
import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { validateEnv, type AppEnv } from "./domain";
import { getModelChoices, type ModelId } from "./modules/llm";
import {
  buildViewInstruction,
  buildUpdateInstruction,
  buildAnalyzeInstruction,
} from "./modules/agent";
import { bootstrap, registerShutdownHooks } from "./bootstrap";
import {
  parseAgentUpdateReply,
  computePortfolioUpdate,
  persistPortfolioUpdate,
  loadPortfolio,
  findLatestPortfolioFile,
  type TradeOperation,
  type HoldingDiff,
} from "./services";
import { chalk } from "./utils/colors";

/** Agent 类型简写 */
type Agent = DeepAgent<DeepAgentTypeConfig>;

/** 功能菜单选项 */
type Feature = "update" | "analyze" | "view" | "chat";

// ─── UI 基础组件 ───

/** 交互式选择 LLM 模型 */
async function selectModel(env: AppEnv): Promise<ModelId> {
  const choices = getModelChoices(env).map((c) => ({
    name: c.label,
    value: c.id,
  }));

  return select<ModelId>({
    message: "选择 LLM 模型:",
    choices,
    default: "ollama",
  });
}

/** 功能选择菜单 */
async function selectFeature(): Promise<Feature> {
  return select<Feature>({
    message: "选择功能:",
    choices: [
      { name: `更新持仓 ${chalk.dim("— 拉取涨跌 + 记录操作")}`, value: "update" },
      { name: `查看持仓 ${chalk.dim("— 查看持仓概览")}`, value: "view" },
      { name: `分析持仓 ${chalk.dim("— 全面诊断当前持仓")}`, value: "analyze" },
      { name: `自由对话 ${chalk.dim("— 基金问答")}`, value: "chat" },
    ],
  });
}

/** 简易 spinner */
function createSpinner(text: string): { stop: () => void } {
  const frames = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
  let i = 0;

  const timer = setInterval(() => {
    process.stdout.write(`\r${chalk.cyan(frames[i % frames.length])} ${chalk.cyan(text)}`);
    i++;
  }, 80);

  return {
    stop() {
      clearInterval(timer);
      process.stdout.write("\r" + " ".repeat(text.length + 4) + "\r");
    },
  };
}

// ─── Agent 交互 ───

/** 从 BaseMessage.content 中提取纯文本 */
function extractText(content: BaseMessage["content"]): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .filter((block): block is { type: "text"; text: string } =>
        typeof block === "object" && block !== null && block.type === "text"
      )
      .map((block) => block.text)
      .join("\n");
  }

  return String(content);
}

/**
 * 向 Agent 发送消息并返回 AI 回复文本。
 *
 * @returns AI 回复文本，失败时返回 null
 */
async function invokeAgent(agent: Agent, message: string): Promise<string | null> {
  const spinner = createSpinner("思考中...");

  try {
    const result = await agent.invoke({
      messages: [new HumanMessage(message)],
    });

    spinner.stop();

    const messages: BaseMessage[] = result.messages ?? [];
    const lastAiMessage = [...messages].reverse().find(AIMessage.isInstance);

    if (lastAiMessage) {
      return extractText(lastAiMessage.content);
    }

    return null;
  } catch (error) {
    spinner.stop();
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`\n${chalk.red("错误:")} ${msg}\n`);
    return null;
  }
}

/** 向 Agent 发送消息并打印回复 */
async function sendMessage(agent: Agent, message: string): Promise<void> {
  const reply = await invokeAgent(agent, message);

  if (reply) {
    console.log(`\n${reply}\n`);
  } else {
    console.log(`\n${chalk.yellow("（无回复）")}\n`);
  }
}

// ─── 自由对话 ───

/** 自由对话循环 */
async function chatLoop(agent: Agent): Promise<void> {
  console.log(`\n${chalk.gray("输入问题开始对话，输入 exit 退出。")}\n`);

  while (true) {
    const question = await input({ message: ">" });
    const trimmed = question.trim();

    if (!trimmed) continue;
    if (trimmed === "exit" || trimmed === "quit") {
      console.log(chalk.gray("Bye!"));
      break;
    }

    await sendMessage(agent, trimmed);
  }
}

// ─── 更新持仓 UI ───

/** 收集用户交易操作 */
async function collectTrades(
  fundCodes: readonly string[],
  tradeDate: string,
): Promise<TradeOperation[]> {
  const hasTrades = await confirm({ message: `${tradeDate} 有加仓/减仓操作吗？`, default: false });
  if (!hasTrades) return [];

  const operations: TradeOperation[] = [];
  console.log(chalk.gray("输入操作：基金代码 金额（正数加仓，负数减仓），输入 done 结束"));
  console.log(chalk.gray(`可用基金: ${fundCodes.join(", ")}`));

  while (true) {
    const line = await input({ message: "操作>" });
    const trimmed = line.trim();

    if (!trimmed || trimmed === "done") break;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      console.log(chalk.yellow("格式：基金代码 金额，例如 161631 500 或 014320 -200"));
      continue;
    }

    const [code, amountStr] = parts;
    const amount = parseFloat(amountStr);

    if (!fundCodes.includes(code)) {
      console.log(chalk.yellow(`基金代码 ${code} 不在持仓中，请重新输入`));
      continue;
    }
    if (!isFinite(amount) || amount === 0) {
      console.log(chalk.yellow("金额必须是非零数字"));
      continue;
    }

    operations.push({ fundCode: code, amount });
    const action = amount > 0 ? chalk.green(`+${amount}`) : chalk.red(`${amount}`);
    console.log(chalk.gray(`  已记录: ${code} ${action}`));
  }

  return operations;
}

/** 格式化涨跌数值（带颜色和符号） */
function colorChange(value: number, suffix = ""): string {
  const str = value >= 0 ? `+${value.toFixed(2)}${suffix}` : `${value.toFixed(2)}${suffix}`;
  return value >= 0 ? chalk.green(str) : chalk.red(str);
}

/** 打印变更对比表 */
function printDiff(diffs: readonly HoldingDiff[]): void {
  console.log(`\n${chalk.bold("持仓变更对比:")}\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let totalDailyChange = 0;
  let totalTrade = 0;

  for (const d of diffs) {
    totalBefore += d.before.amount;
    totalAfter += d.after.amount;
    totalDailyChange += d.dailyChange;
    totalTrade += d.tradeAmount;

    const name = (d.fundName ?? d.fundCode).slice(0, 14);
    const pctStr = colorChange(d.dailyReturn * 100, "%");
    const changeStr = colorChange(d.dailyChange);
    const tradeStr = d.tradeAmount === 0
      ? ""
      : d.tradeAmount > 0
        ? chalk.green(` [加仓 +${d.tradeAmount}]`)
        : chalk.red(` [减仓 ${d.tradeAmount}]`);
    const returnStr = colorChange(d.after.returnRate * 100, "%");

    console.log(
      `  ${chalk.bold(d.fundCode)} ${chalk.dim(name)}  ` +
      `${d.before.amount.toFixed(2)} → ${chalk.bold(d.after.amount.toFixed(2))}  ` +
      `${pctStr} (${changeStr})${tradeStr}  ` +
      `累计 ${returnStr}`
    );
  }

  // 汇总
  console.log();
  console.log(
    `  ${chalk.bold("合计")}  ` +
    `${totalBefore.toFixed(2)} → ${chalk.bold(totalAfter.toFixed(2))}  ` +
    `${colorChange(totalDailyChange)}` +
    (totalTrade !== 0 ? `  操作 ${colorChange(totalTrade)}` : "")
  );
  console.log();
}

/** 更新持仓主流程 */
async function updatePortfolioFlow(agent: Agent): Promise<void> {
  // 1. 加载最新持仓文件
  const fileInfo = findLatestPortfolioFile();
  let portfolio;
  try {
    portfolio = loadPortfolio();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`\n${chalk.red("加载持仓失败:")} ${msg}\n`);
    return;
  }

  const portfolioDate = fileInfo?.date;
  console.log(chalk.gray(`数据来源: ${fileInfo?.path ?? "未知"}（持仓日期: ${portfolioDate ?? "未知"}）`));
  const fundCodes = portfolio.holdings.map((h) => h.fundCode);

  // 2. 通过 Agent 调用 MCP 获取涨跌幅（传入持仓日期以定位下一个交易日）
  const reply = await invokeAgent(agent, buildUpdateInstruction(fundCodes, portfolioDate));
  if (!reply) {
    console.error(`\n${chalk.red("获取涨跌数据失败: Agent 无回复")}\n`);
    return;
  }

  // 3. 解析 Agent 回复（使用 service）
  const updateData = parseAgentUpdateReply(reply);
  if (!updateData || updateData.funds.length === 0) {
    console.error(`\n${chalk.red("解析涨跌数据失败，Agent 原始回复:")}\n${reply}\n`);
    return;
  }

  const { tradeDate, funds } = updateData;

  if (!tradeDate) {
    console.error(`\n${chalk.red("Agent 未返回交易日期（tradeDate），无法确定文件名")}\n`);
    return;
  }

  // 4. 重复更新检测：tradeDate 不能早于或等于当前持仓日期
  if (portfolioDate && tradeDate <= portfolioDate) {
    console.log(chalk.yellow(
      `持仓已包含 ${portfolioDate} 的数据，Agent 返回的交易日 ${tradeDate} 不晚于此日期。`
    ));
    const forceUpdate = await confirm({ message: "是否强制覆盖更新？", default: false });
    if (!forceUpdate) {
      console.log(chalk.gray("已跳过，持仓无需更新。"));
      return;
    }
  }

  console.log(chalk.green(`已获取 ${funds.length} 只基金的涨跌数据，交易日: ${tradeDate}`));

  // 5. 收集用户交易操作（CLI 交互）
  const trades = await collectTrades(fundCodes, tradeDate);

  // 6. 计算更新（使用 service）
  const { updatedHoldings, diffs, missingFunds } = computePortfolioUpdate(portfolio, funds, trades);

  if (missingFunds.length > 0) {
    console.log(chalk.yellow(`以下基金未获取到涨跌数据，将保持原值: ${missingFunds.join(", ")}`));
  }

  // 7. 展示变更对比
  printDiff(diffs);

  // 8. 确认写入
  const shouldSave = await confirm({ message: "确认保存更新？", default: true });
  if (!shouldSave) {
    console.log(chalk.gray("已取消。"));
    return;
  }

  // 9. 持久化（使用 service）
  const savedPath = persistPortfolioUpdate(portfolio, updatedHoldings, tradeDate);
  console.log(chalk.green(`持仓数据已更新并保存到 ${savedPath}`));
}

// ─── CLI 主流程 ───

async function main(): Promise<void> {
  // 0. 校验环境变量（fail-fast）
  const env = validateEnv();

  // 1. 选择模型
  const modelId = await selectModel(env);
  console.log(`\n${chalk.green("使用模型:")} ${chalk.bold(modelId)}`);

  // 2. 初始化 Agent
  const spinner = createSpinner("正在连接 MCP 服务...");

  let bootstrapResult: Awaited<ReturnType<typeof bootstrap>>;
  try {
    bootstrapResult = await bootstrap(modelId);
    spinner.stop();
  } catch (error) {
    spinner.stop();
    throw error;
  }

  const { agent, mcp, tools } = bootstrapResult;
  registerShutdownHooks(mcp);
  console.log(`${chalk.green("Agent 就绪。")}${chalk.gray(`可用工具: ${tools.length} 个`)}\n`);

  // 3. 功能循环
  try {
    while (true) {
      const feature = await selectFeature();

      if (feature === "chat") {
        await chatLoop(agent);
        break;
      }

      if (feature === "update") {
        await updatePortfolioFlow(agent);
      } else if (feature === "view") {
        await sendMessage(agent, buildViewInstruction());
      } else if (feature === "analyze") {
        await sendMessage(agent, buildAnalyzeInstruction());
      }
    }
  } finally {
    await mcp.close();
  }
}

main().catch((error) => {
  console.error(`${chalk.red("致命错误:")} ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
