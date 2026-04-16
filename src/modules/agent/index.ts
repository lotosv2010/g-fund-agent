/**
 * Agent 模块公开 API。
 *
 * 封装 DeepAgent 的创建与配置，
 * 对外提供工厂函数和场景指令构建器。
 */
export { createFundAgent } from "./agent.service";
export {
  buildSystemPrompt,
  buildViewInstruction,
  buildUpdateInstruction,
  buildAnalyzeInstruction,
} from "./prompt";
