/**
 * MCP 模块公开 API。
 *
 * 封装 MCP 客户端生命周期，对外提供工具获取与连接管理能力。
 */
export { McpService } from "./mcp.service";
export { createMcpServers, type McpServerConfig } from "./mcp.config";
