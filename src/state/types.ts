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
