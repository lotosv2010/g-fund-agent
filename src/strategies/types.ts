import type { FundInfo, MarketData, ExtendedMarketContext, RuleResult } from "../state/types";

/**
 * 策略框架类型定义（Phase 2）
 */

/** 策略信号强度 */
export type SignalStrength = "strong" | "medium" | "weak" | "none";

/** 策略信号 */
export interface StrategySignal {
  code: string;                    // 基金代码
  action: "buy" | "sell" | "hold"; // 操作类型
  tier: number;                    // 档位（1/2/3）
  strength: SignalStrength;        // 信号强度
  confidence: number;              // 置信度（0-1）
  reason: string;                  // 触发原因
  amount?: number;                 // 建议金额（可选）
  adjustmentFactor?: number;       // 调整系数（0.5-2.0，用于调整基准金额）
}

/** 策略配置参数 */
export interface StrategyParams {
  [key: string]: number | string | boolean | object;
}

/** 策略元数据 */
export interface StrategyMetadata {
  name: string;                    // 策略名称（唯一标识）
  displayName: string;             // 显示名称（中文）
  version: string;                 // 版本号（语义化版本）
  description: string;             // 策略描述
  author?: string;                 // 作者
  createdAt: string;               // 创建时间（ISO 8601）
  updatedAt: string;               // 更新时间
  tags?: string[];                 // 标签（如：grid, trend, llm）
}

/** 策略风控约束 */
export interface StrategyRiskConstraints {
  maxSinglePosition?: number;      // 单只基金最大占比（%）
  maxCategoryWeight?: number;      // 单一类别最大占比（%）
  maxDrawdown?: number;            // 最大回撤限制（%）
  minLiquidity?: number;           // 最小流动性要求（元）
  allowedCategories?: string[];    // 允许的资产类别
}

/** 策略执行上下文 */
export interface StrategyContext {
  funds: FundInfo[];               // 基金数据
  marketData: MarketData[];        // 市场计算结果
  marketContext: ExtendedMarketContext; // 扩展市场上下文
  timestamp: string;               // 执行时间戳
}

/** 策略接口 */
export interface Strategy {
  /** 策略元数据 */
  metadata: StrategyMetadata;

  /** 策略参数 */
  params: StrategyParams;

  /** 风控约束 */
  riskConstraints: StrategyRiskConstraints;

  /** 是否启用 */
  enabled: boolean;

  /** 权重（多策略合并时使用，默认1.0） */
  weight: number;

  /**
   * 生成策略信号
   * @param context - 策略执行上下文
   * @returns 策略信号数组
   */
  generateSignals(context: StrategyContext): Promise<StrategySignal[]> | StrategySignal[];

  /**
   * 验证策略配置
   * @returns 验证结果
   */
  validate(): { valid: boolean; errors: string[] };
}

/** 策略注册项 */
export interface StrategyRegistryEntry {
  strategy: Strategy;
  activatedAt: string;             // 激活时间
  lastExecutedAt?: string;         // 最后执行时间
  executionCount: number;          // 执行次数
  successCount: number;            // 成功次数
  failureCount: number;            // 失败次数
}

/** 信号合并结果 */
export interface MergedSignal {
  code: string;
  action: "buy" | "sell" | "hold";
  tier: number;
  finalStrength: SignalStrength;
  finalConfidence: number;
  reason: string;
  amount?: number;
  sources: {                       // 信号来源
    strategyName: string;
    signal: StrategySignal;
  }[];
}
