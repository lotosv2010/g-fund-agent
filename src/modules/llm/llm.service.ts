import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogle } from "@langchain/google";
import { ChatOllama } from "@langchain/ollama";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ConfigError } from "../../domain";

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
  /** API Key 环境变量名，本地模型（如 Ollama）无需设置 */
  readonly apiKeyEnv?: string;
  readonly modelName: string;
  /** 传递给模型的额外参数（如 thinking 控制） */
  readonly extraKwargs?: Readonly<Record<string, unknown>>;
}

/**
 * 模型注册表 —— 所有 LLM 配置的唯一数据源。
 * 新增模型只需在此添加条目。
 */
const MODEL_REGISTRY: Record<ModelId, ModelConfig> = {
  deepseek: {
    protocol: "deepseek",
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelName: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  },
  "deepseek-reasoner": {
    protocol: "deepseek",
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelName: process.env.DEEPSEEK_REASONER_MODEL || "deepseek-reasoner",
  },
  gemini: {
    protocol: "google",
    apiKeyEnv: "GEMINI_API_KEY",
    modelName: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
  },
  /** Kimi 开启 thinking 模式时 tool call 消息缺少 reasoning_content 会报错，需显式关闭 */
  moonshot: {
    protocol: "openai",
    baseURL: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1",
    apiKeyEnv: "MOONSHOT_API_KEY",
    modelName: process.env.MOONSHOT_MODEL || "kimi-k2.5",
    extraKwargs: { thinking: { type: "disabled" } },
  },
  minimax: {
    protocol: "anthropic",
    baseURL: process.env.MINIMAX_BASE_URL || "https://api.minimax.chat/v1",
    apiKeyEnv: "MINIMAX_API_KEY",
    modelName: process.env.MINIMAX_MODEL || "MiniMax-M2.7",
  },
  ollama: {
    protocol: "ollama",
    baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    modelName: process.env.OLLAMA_MODEL || "qwen3.5:cloud",
  },
};

/**
 * 客户端工厂映射 —— 每种协议对应一个构建函数。
 * 新增 API 协议时在此扩展。
 */
const CLIENT_FACTORY: Record<
  ApiProtocol,
  (config: ModelConfig, apiKey: string | undefined) => BaseChatModel
> = {
  deepseek: (config, apiKey) =>
    new ChatDeepSeek({
      apiKey,
      model: config.modelName,
      configuration: { baseURL: config.baseURL },
    }),

  openai: (config, apiKey) =>
    new ChatOpenAI({
      model: config.modelName,
      apiKey,
      configuration: { baseURL: config.baseURL },
      ...(config.extraKwargs ? { modelKwargs: config.extraKwargs } : {}),
    }),

  anthropic: (config, apiKey) =>
    new ChatAnthropic({
      anthropicApiUrl: config.baseURL,
      anthropicApiKey: apiKey,
      modelName: config.modelName,
    }),

  google: (config, apiKey) =>
    new ChatGoogle({
      apiKey,
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
 */
export function getModelChoices(): readonly ModelChoice[] {
  return Object.entries(MODEL_REGISTRY).map(([id, config]) => ({
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
 * @returns LangChain 兼容的 Chat Model
 * @throws {ConfigError} 缺少必需的 API Key 环境变量时抛出
 */
export function getModel(id: ModelId = "deepseek"): BaseChatModel {
  const config = MODEL_REGISTRY[id];
  const apiKey = config.apiKeyEnv
    ? process.env[config.apiKeyEnv]
    : undefined;

  if (config.apiKeyEnv && !apiKey) {
    throw new ConfigError(
      `Missing environment variable "${config.apiKeyEnv}" required by model "${id}"`
    );
  }

  const factory = CLIENT_FACTORY[config.protocol];
  return factory(config, apiKey);
}
