/**
 * MCP 服务配置。
 *
 * 定义所有外部 MCP 数据源的连接信息，
 * 新增数据源只需在 MCP_SERVERS 中添加条目。
 */

/** 单个 MCP 服务的连接配置 */
interface McpServerConfig {
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * MCP 服务注册表 —— 所有 MCP 数据源的唯一配置。
 * 新增数据源时在此添加条目。
 */
export const MCP_SERVERS: Readonly<Record<string, McpServerConfig>> = {
  /** 且慢（Qieman）—— 基金数据源 */
  qieman: {
    url: process.env.QIEMAN_MCP_URL || "https://stargate.yingmi.com/mcp/v2",
    headers: {
      "x-api-key": process.env.QIEMAN_API_KEY || "",
    },
  },
};
