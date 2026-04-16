import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { McpConnectionError } from "../../domain";
import { MCP_SERVERS } from "./mcp.config";

/**
 * MCP 客户端服务 —— 封装 MCP 连接生命周期。
 *
 * 职责：
 * - 创建并管理 MultiServerMCPClient 实例（幂等）
 * - 提供统一的工具获取接口
 * - 支持优雅关闭连接
 */
export class McpService {
  private client: MultiServerMCPClient | null = null;

  /**
   * 初始化 MCP 客户端并返回所有可用工具。
   * 幂等：重复调用返回已有客户端的工具，不会创建新连接。
   *
   * @throws {McpConnectionError} 连接失败时抛出
   */
  async getTools(): Promise<StructuredToolInterface[]> {
    if (this.client) {
      return this.client.getTools();
    }

    try {
      this.client = new MultiServerMCPClient({
        onConnectionError: "throw",
        mcpServers: MCP_SERVERS,
      });
      return await this.client.getTools();
    } catch (error) {
      this.client = null;
      const message = error instanceof Error ? error.message : String(error);
      throw new McpConnectionError(`Failed to connect MCP servers: ${message}`);
    }
  }

  /** 关闭所有 MCP 连接，释放资源 */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
