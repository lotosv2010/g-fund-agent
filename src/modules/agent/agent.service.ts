import {
  createDeepAgent,
  type DeepAgent,
  type DeepAgentTypeConfig,
} from "deepagents";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { buildSystemPrompt } from "./prompt";

/** Agent 名称常量 */
const AGENT_NAME = "g-fund-agent";

/** createFundAgent 的参数 */
interface CreateFundAgentParams {
  readonly model: BaseChatModel;
  readonly tools: StructuredToolInterface[];
  /** 持仓上下文文本（可选，注入 System Prompt） */
  readonly portfolioContext?: string;
  /** 操作策略上下文文本（可选，注入 System Prompt） */
  readonly strategyContext?: string;
}

/**
 * 创建基金顾投 Agent。
 *
 * 组装 LLM + Tools + Prompt → DeepAgent。
 * System Prompt 包含角色定义 + 持仓数据 + 操作策略。
 * CLI 模式通过 user message 传入显式场景指令，
 * LangGraph 模式由用户自由输入，Agent 根据 System Prompt 中的场景说明自主处理。
 *
 * @param params - LLM 实例、工具列表、持仓上下文、策略上下文
 * @returns 配置完成的 DeepAgent 实例
 */
export function createFundAgent(
  params: CreateFundAgentParams,
): DeepAgent<DeepAgentTypeConfig> {
  return createDeepAgent({
    model: params.model,
    name: AGENT_NAME,
    tools: params.tools,
    systemPrompt: buildSystemPrompt({
      portfolioContext: params.portfolioContext,
      strategyContext: params.strategyContext,
    }),
  });
}
