/**
 * LLM 模块公开 API。
 *
 * 基于注册表的模型工厂，新增 Provider 无需修改已有代码（OCP）。
 */
export {
  getModel,
  getModelChoices,
  isValidModelId,
  type ModelId,
  type ModelChoice,
} from "./llm.service";

