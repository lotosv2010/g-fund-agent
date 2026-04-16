/**
 * MCP 服务配置。
 *
 * 定义所有外部 MCP 数据源的连接信息，
 * 新增数据源只需在 createMcpServers 中添加条目。
 */
import type { AppEnv } from "../../domain";

/** 单个 MCP 服务的连接配置 */
export interface McpServerConfig {
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * 根据已校验的环境变量构建 MCP 服务注册表。
 *
 * 不直接读取 process.env（遵循架构红线）。
 *
 * @param env - 已校验的环境变量（来自 domain/config.ts）
 */
export function createMcpServers(
  env: AppEnv,
): Readonly<Record<string, McpServerConfig>> {
  return {
    /** 且慢（Qieman）—— 基金数据源 */
    qieman: {
      url: env.QIEMAN_MCP_URL,
      headers: {
        "x-api-key": env.QIEMAN_API_KEY,
      },
    },
  };
}
