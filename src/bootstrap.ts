import type { DeepAgent, DeepAgentTypeConfig } from "deepagents";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { validateEnv, type AppEnv } from "./domain";
import { loadPortfolio, findLatestPortfolioFile, formatPortfolioContext } from "./utils/portfolio-loader";
import { loadStrategy, formatStrategyContext } from "./utils/strategy-loader";
import { getModel, type ModelId } from "./modules/llm";
import { McpService } from "./modules/mcp";
import { createFundAgent } from "./modules/agent";
import { updatePortfolioTool } from "./services";
import { chalk } from "./utils/colors";

/** 启动结果 — 持有初始化后的 Agent 和 MCP 服务实例 */
export interface BootstrapResult {
  readonly agent: DeepAgent<DeepAgentTypeConfig>;
  readonly tools: StructuredToolInterface[];
  readonly mcp: McpService;
}

/**
 * 安全加载可选资源，失败时打印警告并返回 undefined。
 *
 * 持仓和策略均为可选数据，加载失败不应阻塞启动。
 */
function safeLoad<T>(loader: () => T, label: string): T | undefined {
  try {
    return loader();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(chalk.yellow(`${label}加载跳过: ${msg}`));
    return undefined;
  }
}

/**
 * 应用启动流程：校验环境 → 加载持仓/策略 → 初始化 LLM → 连接 MCP → 创建 Agent。
 *
 * 持仓数据和操作策略均注入 System Prompt，CLI 和 LangGraph 两种模式共享。
 *
 * @param modelId - LLM 模型标识
 * @returns 初始化完成的 Agent 和 MCP 服务句柄
 */
export async function bootstrap(modelId: ModelId): Promise<BootstrapResult> {
  const env: AppEnv = validateEnv();

  const portfolioDate = safeLoad(
    () => findLatestPortfolioFile()?.date,
    "持仓日期",
  );
  const portfolioContext = safeLoad(
    () => formatPortfolioContext(loadPortfolio(), portfolioDate),
    "持仓数据",
  );
  const strategyContext = safeLoad(
    () => formatStrategyContext(loadStrategy()),
    "策略数据",
  );

  const model = getModel(modelId, env);
  const mcp = new McpService(env);
  const mcpTools = await mcp.getTools();

  // 合并 MCP 工具 + 自定义业务工具
  const tools: StructuredToolInterface[] = [
    ...mcpTools,
    updatePortfolioTool as unknown as StructuredToolInterface,
  ];

  const agent = createFundAgent({ model, tools, portfolioContext, strategyContext });

  return { agent, tools, mcp };
}

/** 注册 SIGTERM/SIGINT 处理器，优雅关闭 MCP 连接 */
export function registerShutdownHooks(mcp: McpService): void {
  const shutdown = async (): Promise<void> => {
    await mcp.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
