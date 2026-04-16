import "dotenv/config";
import type { DeepAgent, DeepAgentTypeConfig } from "deepagents";
import { validateEnv, ConfigError } from "./domain";
import { isValidModelId } from "./modules/llm";
import { bootstrap, registerShutdownHooks } from "./bootstrap";
import { chalk } from "./utils/colors";

/**
 * LangGraph 入口。
 *
 * 从环境变量读取 LLM_PROVIDER，启动 Agent，
 * 导出 Promise 供 LangGraph Studio 消费。
 */
async function initAgent(): Promise<DeepAgent<DeepAgentTypeConfig>> {
  const env = validateEnv();

  const provider = env.LLM_PROVIDER;
  if (!isValidModelId(provider)) {
    throw new ConfigError(
      `Invalid LLM_PROVIDER "${provider}". Valid values: deepseek, deepseek-reasoner, gemini, moonshot, minimax, ollama`
    );
  }

  console.log(chalk.green(`Using LLM provider: ${provider}`));

  const { agent, mcp } = await bootstrap(provider);
  registerShutdownHooks(mcp);

  return agent;
}

export const agent: Promise<DeepAgent<DeepAgentTypeConfig>> = initAgent();
