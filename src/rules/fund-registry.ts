import type { AssetCategory } from "../state/types";

export interface FundMeta {
  code: string;
  name: string;
  shortName: string;
  category: AssetCategory;
}

/** 全部持仓基金注册表 */
export const FUND_REGISTRY: FundMeta[] = [
  // 宽基类
  { code: "310318", name: "申万菱信沪深300指数增强A", shortName: "沪深300增强", category: "broad_base" },
  { code: "022445", name: "景顺长城中证A500ETF联接C", shortName: "A500", category: "broad_base" },
  { code: "004744", name: "易方达创业板ETF联接C", shortName: "创业板", category: "broad_base" },

  // 科技主题类
  { code: "161631", name: "融通中证人工智能主题指数A", shortName: "人工智能", category: "tech" },
  { code: "014320", name: "德邦半导体产业混合C", shortName: "德邦半导体", category: "tech" },
  { code: "020256", name: "中欧中证机器人指数C", shortName: "机器人", category: "tech" },

  // 海外类
  { code: "096001", name: "大成标普500等权重指数A", shortName: "标普500", category: "overseas_sp500" },
  { code: "017093", name: "景顺长城纳斯达克科技ETF联接C", shortName: "纳斯达克科技", category: "overseas_nasdaq" },
  { code: "006328", name: "易方达中概互联网ETF联接", shortName: "中概互联", category: "overseas_china_internet" },

  // 债券
  { code: "000188", name: "华泰柏瑞丰盛纯债债券C", shortName: "华泰柏瑞纯债", category: "bond" },
  { code: "002351", name: "易方达裕祥回报债券A", shortName: "裕祥回报债券", category: "bond" },

  // 黄金
  { code: "000217", name: "华安黄金ETF联接C", shortName: "黄金", category: "gold" },
];
