import { MultiServerMCPClient } from "@langchain/mcp-adapters";

/** MCP 服务配置 */
export const mcpServers = {
  qieman: {
    transport: "http" as const,
    url: process.env.QIEMAN_MCP_URL || "https://stargate.yingmi.com/mcp/v2",
    headers: {
      "x-api-key": process.env.QIEMAN_API_KEY || "",
      Accept: "application/json, text/event-stream",
    },
  },
};

let client: MultiServerMCPClient | null = null;

export async function getMcpClient(): Promise<MultiServerMCPClient> {
  if (client) return client;

  client = new MultiServerMCPClient({
    onConnectionError: "throw",
    mcpServers,
  });

  return client;
}

/** 获取指定服务的 MCP 工具 */
export async function getMcpTools(serverName = "qieman") {
  const c = await getMcpClient();
  return c.getTools(serverName);
}

export async function closeMcpClient() {
  if (client) {
    await client.close();
    client = null;
  }
}
