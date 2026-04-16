import { z } from "zod";

/** 基金代码：6 位数字 */
const FundCode = z.string().regex(/^\d{6}$/, "基金代码必须为 6 位数字");

/**
 * 单只基金持仓。
 *
 * 对齐且慢 MCP 工具输入格式（fundCode + amount），
 * 同时包含用户侧的成本和收益信息。
 */
export const HoldingItemSchema = z.object({
  /** 基金代码 */
  fundCode: FundCode,
  /** 基金名称（可选，可通过 MCP 查询补全） */
  fundName: z.string().optional(),
  /** 持仓金额（元） */
  amount: z.number().positive("持仓金额必须大于 0"),
  /** 持仓收益率（小数，如 0.2953 表示 29.53%） */
  returnRate: z.number().optional(),
  /** 成本净值 */
  costBasis: z.number().positive("成本净值必须大于 0").optional(),
});

export type HoldingItem = z.infer<typeof HoldingItemSchema>;

/**
 * 目标仓位项。
 *
 * 用于描述期望的资产配置比例。
 */
export const TargetAllocationItemSchema = z.object({
  /** 基金代码 */
  fundCode: FundCode,
  /** 基金名称（可选） */
  fundName: z.string().optional(),
  /** 目标权重（%，0-100） */
  targetWeight: z.number().min(0).max(100),
});

export type TargetAllocationItem = z.infer<typeof TargetAllocationItemSchema>;

/**
 * 持仓组合 — 持仓分析的核心输入。
 *
 * holdings 为当前实际持仓，targetAllocations 为期望配置（可选）。
 * 当两者都提供时，可进行偏离度分析。
 */
export const PortfolioSchema = z.object({
  /** 组合名称（可选） */
  name: z.string().optional(),
  /** 总目标仓位 */
  target: z.number().positive("总目标仓位必须大于 0").optional(),
  /** 当前持仓列表（至少 1 只基金） */
  holdings: z.array(HoldingItemSchema).min(1, "至少需要 1 只基金"),
  /** 目标仓位（可选，用于偏离度分析） */
  targetAllocations: z.array(TargetAllocationItemSchema).optional(),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
