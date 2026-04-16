/**
 * 领域层公开 API。
 *
 * Zod 作为类型基础设施是唯一允许的外部依赖。
 */
export { validateEnv, type AppEnv } from "./config";
export { AppError, ConfigError, McpConnectionError } from "./errors";
export {
  HoldingItemSchema,
  TargetAllocationItemSchema,
  PortfolioSchema,
  type HoldingItem,
  type TargetAllocationItem,
  type Portfolio,
} from "./schemas/portfolio.schema";
export {
  FundDailyReturnSchema,
  TradeOperationSchema,
  AgentUpdateResponseSchema,
  type FundDailyReturn,
  type TradeOperation,
  type AgentUpdateResponse,
} from "./schemas/trade.schema";
export {
  StrategySchema,
  type Strategy,
} from "./schemas/strategy.schema";
