import { z } from "zod";
import { ConfigError } from "./errors";

/**
 * 应用环境变量 Schema。
 *
 * 启动时统一校验所有必需配置，fail-fast。
 * 可选变量使用 .optional() + .default()。
 */
const EnvSchema = z.object({
  // LangSmith
  LANGSMITH_TRACING: z.string().optional().default("true"),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_ENDPOINT: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional().default("g-fund-agent"),

  // MCP
  QIEMAN_MCP_URL: z.string().optional().default("https://stargate.yingmi.com/mcp/v2"),
  QIEMAN_API_KEY: z.string().optional().default(""),

  // LLM Provider
  LLM_PROVIDER: z.string().optional().default(""),

  // DeepSeek
  DEEPSEEK_BASE_URL: z.string().optional().default("https://api.deepseek.com"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().optional().default("deepseek-chat"),
  DEEPSEEK_REASONER_MODEL: z.string().optional().default("deepseek-reasoner"),

  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional().default("gemini-3-flash-preview"),

  // Moonshot
  MOONSHOT_BASE_URL: z.string().optional().default("https://api.moonshot.cn/v1"),
  MOONSHOT_API_KEY: z.string().optional(),
  MOONSHOT_MODEL: z.string().optional().default("kimi-k2.5"),

  // MiniMax
  MINIMAX_BASE_URL: z.string().optional().default("https://api.minimax.chat/v1"),
  MINIMAX_API_KEY: z.string().optional(),
  MINIMAX_MODEL: z.string().optional().default("MiniMax-M2.7"),

  // Ollama
  OLLAMA_BASE_URL: z.string().optional().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().optional().default("qwen3.5:cloud"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

/**
 * 校验并返回类型安全的环境变量。
 *
 * @throws {ConfigError} 环境变量校验失败时抛出
 */
export function validateEnv(): AppEnv {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Environment validation failed:\n${issues}`);
  }

  return result.data;
}
