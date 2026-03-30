import type { FundInfo } from "../../state/types";

/**
 * 且慢 MCP 数据提供者（已通过 MCP 接入）
 * 此文件作为接口文档，实际调用通过 data-fetcher Agent 的 MCP 工具
 */

export interface QiemanProvider {
  /**
   * 获取基金净值数据
   * 实际调用：通过 data_fetcher Agent 的 MCP 工具
   */
  getFundData(codes: string[]): Promise<FundInfo[]>;
}

/**
 * 且慢数据说明
 *
 * 可用工具（通过 MCP，73个工具）：
 * - 基金净值查询
   * - 持仓数据查询
 * - 历史净值查询
 * - 基金详情查询
 *
 * 调用方式：
 * 1. 在 data_fetcher Agent 中通过 MCP 工具调用
 * 2. 工具由 getMcpTools("qieman") 自动注入
 * 3. 返回数据格式已在 data-fetcher.ts 中定义
 */
