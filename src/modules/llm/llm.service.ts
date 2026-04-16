import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogle } from "@langchain/google";
import { ChatOllama } from "@langchain/ollama";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ConfigError, type AppEnv } from "../../domain";

/** 支持的模型标识，新增模型时扩展此联合类型 */
export type ModelId =
  | "deepseek"
  | "deepseek-reasoner"
  | "minimax"
  | "gemini"
  | "moonshot"
  | "ollama";

/** 所有合法的 ModelId 值集合，用于运行时校验 */
const VALID_MODEL_IDS = new Set<string>([
  "deepseek", "deepseek-reasoner", "minimax", "gemini", "moonshot", "ollama",
]);

/** API 协议类型，决定使用哪个 LangChain 客户端 */
type ApiProtocol = "deepseek" | "openai" | "anthropic" | "google" | "ollama";

interface ModelConfig {
  readonly protocol: ApiProtocol;
  readonly baseURL?: string;
  /** 实际 API Key 值（从已校验的 env 中注入） */
  readonly apiKey?: string;
  readonly modelName: string;
  /** 传递给模型的额外参数（如 thinking 控制） */
  readonly extraKwargs?: Readonly<Record<string, unknown>>;
}

/**
 * 根据已校验的环境变量构建模型注册表。
 *
 * 所有配置值均来自 domain/config.ts 校验后的 AppEnv，
 * 不直接读取 process.env（遵循架构红线）。
 */
function buildModelRegistry(env: AppEnv): Record<ModelId, ModelConfig> {
  return {
    deepseek: {
      protocol: "deepseek",
      baseURL: env.DEEPSEEK_BASE_URL,
      apiKey: env.DEEPSEEK_API_KEY,
      modelName: env.DEEPSEEK_MODEL,
    },
    "deepseek-reasoner": {
      protocol: "deepseek",
      baseURL: env.DEEPSEEK_BASE_URL,
      apiKey: env.DEEPSEEK_API_KEY,
      modelName: env.DEEPSEEK_REASONER_MODEL,
    },
    gemini: {
      protocol: "google",
      apiKey: env.GEMINI_API_KEY,
      modelName: env.GEMINI_MODEL,
    },
    /** Kimi 开启 thinking 模式时 tool call 消息缺少 reasoning_content 会报错，需显式关闭 */
    moonshot: {
      protocol: "openai",
      baseURL: env.MOONSHOT_BASE_URL,
      apiKey: env.MOONSHOT_API_KEY,
      modelName: env.MOONSHOT_MODEL,
      extraKwargs: { thinking: { type: "disabled" } },
    },
    minimax: {
      protocol: "anthropic",
      baseURL: env.MINIMAX_BASE_URL,
      apiKey: env.MINIMAX_API_KEY,
      modelName: env.MINIMAX_MODEL,
    },
    ollama: {
      protocol: "ollama",
      baseURL: env.OLLAMA_BASE_URL,
      modelName: env.OLLAMA_MODEL,
    },
  };
}

/**
 * 客户端工厂映射 —— 每种协议对应一个构建函数。
 * 新增 API 协议时在此扩展。
 */
const CLIENT_FACTORY: Record<
  ApiProtocol,
  (config: ModelConfig) => BaseChatModel
> = {
  deepseek: (config) =>
    new ChatDeepSeek({
      apiKey: config.apiKey,
      model: config.modelName,
      configuration: { baseURL: config.baseURL },
    }),

  openai: (config) =>
    new ChatOpenAI({
      model: config.modelName,
      apiKey: config.apiKey,
      configuration: { baseURL: config.baseURL },
      ...(config.extraKwargs ? { modelKwargs: config.extraKwargs } : {}),
    }),

  anthropic: (config) =>
    new ChatAnthropic({
      anthropicApiUrl: config.baseURL,
      anthropicApiKey: config.apiKey,
      modelName: config.modelName,
    }),

  google: (config) =>
    new ChatGoogle({
      apiKey: config.apiKey,
      model: config.modelName,
    }),

  ollama: (config) =>
    new ChatOllama({
      model: config.modelName,
      baseUrl: config.baseURL,
      temperature: 0,
      maxRetries: 2,
    }),
};

/** CLI 选择器展示用的模型选项 */
export interface ModelChoice {
  readonly id: ModelId;
  readonly label: string;
}

/**
 * 获取所有可用模型的选项列表，供 CLI 选择器使用。
 *
 * @param env - 已校验的环境变量
 */
export function getModelChoices(env: AppEnv): readonly ModelChoice[] {
  const registry = buildModelRegistry(env);
  return Object.entries(registry).map(([id, config]) => ({
    id: id as ModelId,
    label: `${id} (${config.modelName})`,
  }));
}

/**
 * 校验字符串是否为合法的 ModelId。
 *
 * @param value - 待校验的字符串
 * @returns 合法则返回 true
 */
export function isValidModelId(value: string): value is ModelId {
  return VALID_MODEL_IDS.has(value);
}

/**
 * 根据标识创建 LLM 实例。
 *
 * @param id - 模型标识，见 {@link ModelId}
 * @param env - 已校验的环境变量（来自 domain/config.ts）
 * @returns LangChain 兼容的 Chat Model
 * @throws {ConfigError} 需要 API Key 但未提供时抛出
 */
export function getModel(id: ModelId, env: AppEnv): BaseChatModel {
  const registry = buildModelRegistry(env);
  const config = registry[id];

  // 非本地模型需要 API Key
  if (config.protocol !== "ollama" && !config.apiKey) {
    throw new ConfigError(
      `Missing API key for model "${id}". Please set the corresponding environment variable.`
    );
  }

  const factory = CLIENT_FACTORY[config.protocol];
  return factory(config);
}
