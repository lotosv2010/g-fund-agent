/**
 * 业务服务层公开 API。
 *
 * 封装跨模式共享的业务逻辑，CLI 和 LangGraph 两种模式共用。
 * 领域类型（FundDailyReturn 等）从 domain 层 re-export，保持调用方简洁。
 */
export {
  parseAgentUpdateReply,
  computePortfolioUpdate,
  persistPortfolioUpdate,
  loadPortfolio,
  findLatestPortfolioFile,
  type UpdateResponse,
  type PortfolioUpdateResult,
  type PortfolioFileInfo,
  type FundDailyReturn,
  type TradeOperation,
  type HoldingDiff,
} from "./portfolio-update.service";

export { updatePortfolioTool } from "./portfolio-update.tool";
