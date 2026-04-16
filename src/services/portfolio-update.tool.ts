/**
 * 持仓更新 LangChain Tool。
 *
 * 供 LangGraph 模式下 Agent 直接调用，
 * 获取涨跌数据后通过此工具完成持仓文件更新。
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  computePortfolioUpdate,
  persistPortfolioUpdate,
  loadPortfolio,
  findLatestPortfolioFile,
} from "./portfolio-update.service";

/** 基金涨跌数据 Schema */
const FundDailyReturnSchema = z.object({
  fundCode: z.string().describe("基金代码"),
  dailyReturn: z.number().describe("日涨跌幅（小数形式，如 0.0123 表示 +1.23%）"),
  fundName: z.string().optional().describe("基金名称"),
});

/** 交易操作 Schema */
const TradeOperationSchema = z.object({
  fundCode: z.string().describe("基金代码"),
  amount: z.number().describe("操作金额（正数加仓，负数减仓）"),
});

/** UpdatePortfolioFile 工具输入 Schema */
const UpdatePortfolioInputSchema = z.object({
  tradeDate: z.string().describe("涨跌数据对应的交易日期（YYYY-MM-DD）"),
  funds: z.array(FundDailyReturnSchema).describe("各基金涨跌数据"),
  trades: z.array(TradeOperationSchema).optional().describe("用户交易操作（可选）"),
});

/**
 * 持仓更新工具。
 *
 * Agent 获取涨跌数据后调用此工具：
 * 1. 加载最新持仓文件
 * 2. 按涨跌幅 + 交易操作计算新持仓
 * 3. 保存为 data/portfolio-{tradeDate}.json
 * 4. 返回更新摘要
 */
export const updatePortfolioTool = tool(
  async (input) => {
    try {
      const sourceFile = findLatestPortfolioFile();
      const portfolio = loadPortfolio();
      const { updatedHoldings, diffs, missingFunds } = computePortfolioUpdate(
        portfolio,
        input.funds,
        input.trades ?? [],
      );

      const savedPath = persistPortfolioUpdate(portfolio, updatedHoldings, input.tradeDate);

      // 构建摘要
      let totalBefore = 0;
      let totalAfter = 0;
      let totalDailyChange = 0;
      for (const d of diffs) {
        totalBefore += d.before.amount;
        totalAfter += d.after.amount;
        totalDailyChange += d.dailyChange;
      }

      return JSON.stringify({
        success: true,
        sourceFile,
        savedPath,
        tradeDate: input.tradeDate,
        summary: {
          totalBefore: totalBefore.toFixed(2),
          totalAfter: totalAfter.toFixed(2),
          totalDailyChange: totalDailyChange.toFixed(2),
          fundCount: diffs.length,
          missingFunds,
        },
        diffs: diffs.map((d) => ({
          fundCode: d.fundCode,
          fundName: d.fundName,
          dailyReturn: `${(d.dailyReturn * 100).toFixed(2)}%`,
          before: d.before.amount.toFixed(2),
          after: d.after.amount.toFixed(2),
          change: d.dailyChange.toFixed(2),
          returnRate: `${(d.after.returnRate * 100).toFixed(2)}%`,
        })),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ success: false, error: msg });
    }
  },
  {
    name: "UpdatePortfolioFile",
    description:
      "更新持仓数据文件。传入交易日期、各基金涨跌幅数据和用户交易操作（可选），" +
      "自动加载最新持仓、计算新金额和收益率、保存到 data/portfolio-{tradeDate}.json。" +
      "返回更新摘要和变更对比。",
    schema: UpdatePortfolioInputSchema,
  },
);
