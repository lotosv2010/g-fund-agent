import type { Strategy, StrategySignal, StrategyContext, SignalStrength } from "./types";
import { ChatOllama } from "@langchain/ollama";
import { summarizeMarketContext } from "../data/context";
import { interpretMacro } from "../data/providers/macro";
import { interpretSentiment } from "../data/providers/sentiment";

/**
 * LLM 信号增强策略（LLM Signal Enhancement）
 *
 * Phase 2 核心创新：LLM 辅助信号生成
 *
 * 职责：
 * - 分析市场环境（宏观、情绪、行业）
 * - 提供信号强度调整建议
 * - 识别特殊市场情况（如极端恐慌/贪婪）
 *
 * 约束：
 * - 不能独立生成买卖信号（必须配合规则信号）
 * - 调整系数限制在 0.5-2.0 范围内
 * - 所有建议必须通过风控层
 */
export class LLMSignalStrategy implements Strategy {
  private model: ChatOllama;

  metadata = {
    name: "llm-signal",
    displayName: "LLM 信号增强",
    version: "1.0.0",
    description: "基于 LLM 分析市场环境，调整规则信号的强度和金额",
    author: "G-Fund-Agent",
    createdAt: "2026-03-30T00:00:00Z",
    updatedAt: "2026-03-30T00:00:00Z",
    tags: ["llm", "enhancement", "market-analysis"],
  };

  params = {
    minConfidence: 0.3,          // 最低置信度
    adjustmentMin: 0.5,          // 最小调整系数
    adjustmentMax: 2.0,          // 最大调整系数
    model: process.env.OLLAMA_MODEL || "qwen3:8b",
  };

  riskConstraints = {
    // LLM 信号不能独立触发操作，因此风控约束宽松
    maxSinglePosition: 100,
    maxCategoryWeight: 10,
  };

  enabled: boolean;
  weight: number;

  constructor(enabled = true, weight = 0.3) {
    this.enabled = enabled;
    this.weight = weight;
    this.model = new ChatOllama({
      model: this.params.model as string,
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      temperature: 0.3, // 降低随机性，更稳定
    });
  }

  async generateSignals(context: StrategyContext): Promise<StrategySignal[]> {
    // Phase 2 MVP：返回空信号，预留接口
    // 完整实现需要：
    // 1. 分析市场上下文
    // 2. 调用 LLM 研判市场环境
    // 3. 为每只基金生成调整建议

    if (!this.enabled) {
      return [];
    }

    try {
      const marketAnalysis = await this.analyzeMarket(context);
      const signals = await this.generateAdjustmentSignals(context, marketAnalysis);
      return signals;
    } catch (error) {
      console.warn("[llm-signal] LLM 信号生成失败，降级为空信号:", error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * 分析市场环境
   */
  private async analyzeMarket(context: StrategyContext): Promise<{
    sentiment: "bullish" | "bearish" | "neutral";
    confidence: number;
    keyFactors: string[];
  }> {
    // Phase 2 MVP：简化版市场分析
    const { marketContext } = context;

    // 构建市场摘要
    const marketSummary = summarizeMarketContext(marketContext);
    let macroPart = "";
    let sentimentPart = "";

    if (marketContext.macro) {
      macroPart = interpretMacro(marketContext.macro);
    }

    if (marketContext.sentiment) {
      sentimentPart = interpretSentiment(marketContext.sentiment);
    }

    if (!macroPart && !sentimentPart) {
      // 无足够数据，返回中性
      return {
        sentiment: "neutral",
        confidence: 0.5,
        keyFactors: ["数据不足"],
      };
    }

    // TODO: Phase 2 完整版 - 调用 LLM 分析
    // const prompt = `分析当前市场环境：\n${marketSummary}\n宏观：${macroPart}\n情绪：${sentimentPart}`;
    // const response = await this.model.invoke(prompt);

    // Phase 2 MVP：基于规则的简单判断
    let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
    const keyFactors: string[] = [];

    if (marketContext.macro?.pmi !== undefined) {
      if (marketContext.macro.pmi > 52) {
        keyFactors.push("PMI强劲");
        sentiment = "bullish";
      } else if (marketContext.macro.pmi < 48) {
        keyFactors.push("PMI疲弱");
        sentiment = "bearish";
      }
    }

    if (marketContext.sentiment?.northboundFlow !== undefined) {
      if (marketContext.sentiment.northboundFlow > 100) {
        keyFactors.push("北向资金大幅流入");
        sentiment = sentiment === "bearish" ? "neutral" : "bullish";
      } else if (marketContext.sentiment.northboundFlow < -100) {
        keyFactors.push("北向资金大幅流出");
        sentiment = sentiment === "bullish" ? "neutral" : "bearish";
      }
    }

    return {
      sentiment,
      confidence: keyFactors.length > 0 ? 0.7 : 0.5,
      keyFactors: keyFactors.length > 0 ? keyFactors : ["市场中性"],
    };
  }

  /**
   * 生成调整信号
   */
  private async generateAdjustmentSignals(
    context: StrategyContext,
    marketAnalysis: { sentiment: string; confidence: number; keyFactors: string[] }
  ): Promise<StrategySignal[]> {
    const signals: StrategySignal[] = [];

    // LLM 信号不独立生成买卖，而是提供调整建议
    // 这些建议将在信号合并时与规则信号结合

    for (const fund of context.funds) {
      const market = context.marketData.find((m) => m.code === fund.code);
      if (!market) continue;

      // 根据市场环境调整信号强度
      let adjustmentFactor = 1.0;
      let strength: SignalStrength = "none";

      if (marketAnalysis.sentiment === "bullish") {
        // 牛市：增强买入信号，降低卖出信号
        if (market.dropFromHigh < -5) {
          adjustmentFactor = 1.3; // 加大补仓力度
          strength = "medium";
        }
      } else if (marketAnalysis.sentiment === "bearish") {
        // 熊市：降低买入信号，增强卖出信号
        if (market.dropFromHigh < -10) {
          adjustmentFactor = 0.7; // 减少补仓力度
          strength = "weak";
        }
        if (market.riseFromBuyPoint > 10) {
          adjustmentFactor = 1.2; // 加大止盈力度
          strength = "medium";
        }
      }

      if (strength !== "none") {
        signals.push({
          code: fund.code,
          action: "hold", // LLM 信号不直接决定买卖
          tier: 0,
          strength,
          confidence: marketAnalysis.confidence,
          reason: `市场环境：${marketAnalysis.sentiment}，${marketAnalysis.keyFactors.join("、")}`,
          adjustmentFactor,
        });
      }
    }

    return signals;
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.params.adjustmentMin >= this.params.adjustmentMax) {
      errors.push("adjustmentMin 必须小于 adjustmentMax");
    }

    if (this.params.minConfidence < 0 || this.params.minConfidence > 1) {
      errors.push("minConfidence 必须在 0-1 之间");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
