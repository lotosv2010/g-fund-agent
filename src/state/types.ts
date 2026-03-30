/** 资产类别 */
export type AssetCategory =
  | "broad_base"    // 宽基类
  | "tech"          // 科技主题类
  | "overseas_sp500"
  | "overseas_nasdaq"
  | "overseas_china_internet"
  | "bond"          // 债券
  | "gold";         // 黄金

/** 单只基金信息 */
export interface FundInfo {
  name: string;
  code: string;
  category: AssetCategory;
  nav: number;           // 当前净值
  navLastWeek: number;   // 上周净值
  holdingAmount: number; // 持仓金额
  holdingCost: number;   // 持仓成本（净值）
  returnRate: number;    // 持仓收益率
}

/** 市场计算结果 */
export interface MarketData {
  code: string;
  recentHigh: number;          // 近期高点（60日）
  dropFromHigh: number;        // 较近期高点跌幅（负数）
  riseFromBuyPoint: number;    // 较补仓点涨幅（正数）
  buyPoints: BuyPoint[];       // 历史补仓点
}

/** 补仓点记录 */
export interface BuyPoint {
  code: string;
  date: string;         // ISO date
  nav: number;          // 补仓时净值
  amount: number;       // 补仓金额
}

/** 规则匹配结果 */
export interface RuleResult {
  code: string;
  name: string;
  action: "buy" | "sell" | "hold";
  tier: number;         // 档位 1/2/3
  triggerReason: string;
  amount: number;       // 建议操作金额
}

/** 调仓建议 */
export interface Suggestion {
  code: string;
  name: string;
  action: "buy" | "sell" | "transfer";
  amount: number;
  reason: string;
}

/** 近期高点记录（60日滚动窗口） */
export interface HighPoint {
  value: number;      // 高点净值
  date: string;       // 记录日期（ISO 8601）
}

/** 已触发档位记录（防止重复触发） */
export interface TriggeredTiers {
  buy?: number;       // 最后触发的补仓档位（1/2/3）
  sell?: number;      // 最后触发的止盈档位（1/2/3）
}

/** 宏观经济指标 */
export interface MacroIndicators {
  bondYield10Y?: number;        // 十年期国债收益率
  pmi?: number;                 // 制造业PMI
  socialFinancing?: number;     // 社融增速
  timestamp: string;            // 数据时间戳
}

/** 市场情绪指标 */
export interface SentimentIndicators {
  marginBalance?: number;       // 融资融券余额（亿元）
  northboundFlow?: number;      // 北向资金净流入（亿元）
  fundRedemption?: number;      // 基金申赎比
  timestamp: string;
}

/** 行业指数数据 */
export interface IndustryIndex {
  name: string;                 // 行业名称
  code: string;                 // 指数代码
  value: number;                // 当前点位
  change: number;               // 涨跌幅（%）
}

/** 扩展市场上下文（包含多源数据） */
export interface ExtendedMarketContext {
  funds: FundInfo[];            // 基金净值数据
  marketData: MarketData[];     // 市场计算结果
  macro?: MacroIndicators;      // 宏观指标（可选）
  sentiment?: SentimentIndicators; // 市场情绪（可选）
  industries?: IndustryIndex[]; // 行业指数（可选）
}

/** 风控检查结果 */
export interface RiskCheckResult {
  passed: boolean;              // 是否通过检查
  level: "info" | "warning" | "error"; // 风险等级
  message: string;              // 提示信息
  blockedSuggestions?: string[]; // 被阻止的建议（code列表）
}

/** 回撤数据 */
export interface DrawdownData {
  code: string;
  currentDrawdown: number;      // 当前回撤（%）
  maxDrawdown: number;          // 历史最大回撤（%）
  daysInDrawdown: number;       // 回撤持续天数
}
