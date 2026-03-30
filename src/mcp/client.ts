import { MultiServerMCPClient } from "@langchain/mcp-adapters";

/** MCP 服务配置 */
export const mcpServers = {
  qieman: {
    url: process.env.QIEMAN_MCP_URL || "https://stargate.yingmi.com/mcp/v2",
    headers: {
      "x-api-key": process.env.QIEMAN_API_KEY || "",
    },
  },
};

let client: MultiServerMCPClient | null = null;

export async function getMcpClient(): Promise<MultiServerMCPClient> {
  if (client) return client;

  try {
    client = new MultiServerMCPClient({
      onConnectionError: "throw",
      mcpServers,
    });
    console.log("[mcp] ✅ MCP 客户端初始化成功");
    return client;
  } catch (error) {
    console.error("[mcp] ❌ MCP 客户端初始化失败:", error instanceof Error ? error.message : String(error));
    throw new Error(`MCP 客户端初始化失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** 获取指定服务的 MCP 工具 */
export async function getMcpTools(serverName = "qieman") {
  try {
    const c = await getMcpClient();
    const tools = await c.getTools(serverName);
    console.log(`[mcp] ✅ 成功获取 ${tools.length} 个工具从服务 "${serverName}"`);
    return tools;
  } catch (error) {
    console.error(`[mcp] ❌ 获取工具失败 (服务: ${serverName}):`, error instanceof Error ? error.message : String(error));
    console.warn(`[mcp] ⚠️  将使用空工具列表继续运行（降级模式）`);
    return [];
  }
}

export async function closeMcpClient() {
  if (client) {
    await client.close();
    client = null;
  }
}
