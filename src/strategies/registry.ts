import type { Strategy, StrategyRegistryEntry, StrategyContext, StrategySignal, MergedSignal } from "./types";

/**
 * 策略注册表（Strategy Registry）
 *
 * 职责：
 * - 管理所有已注册策略
 * - 执行策略并收集信号
 * - 合并多个策略的信号
 * - 追踪策略执行统计
 */
export class StrategyRegistry {
  private strategies: Map<string, StrategyRegistryEntry> = new Map();

  /**
   * 注册策略
   */
  register(strategy: Strategy): void {
    const validation = strategy.validate();
    if (!validation.valid) {
      throw new Error(`策略验证失败: ${validation.errors.join(", ")}`);
    }

    this.strategies.set(strategy.metadata.name, {
      strategy,
      activatedAt: new Date().toISOString(),
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
    });

    console.log(`[registry] 策略已注册: ${strategy.metadata.displayName} (${strategy.metadata.name})`);
  }

  /**
   * 注销策略
   */
  unregister(name: string): boolean {
    const deleted = this.strategies.delete(name);
    if (deleted) {
      console.log(`[registry] 策略已注销: ${name}`);
    }
    return deleted;
  }

  /**
   * 获取策略
   */
  get(name: string): Strategy | undefined {
    return this.strategies.get(name)?.strategy;
  }

  /**
   * 获取所有已启用的策略
   */
  getEnabledStrategies(): Strategy[] {
    return Array.from(this.strategies.values())
      .map((entry) => entry.strategy)
      .filter((strategy) => strategy.enabled);
  }

  /**
   * 执行所有已启用的策略
   */
  async executeAll(context: StrategyContext): Promise<Map<string, StrategySignal[]>> {
    const results = new Map<string, StrategySignal[]>();
    const enabledStrategies = this.getEnabledStrategies();

    for (const strategy of enabledStrategies) {
      const entry = this.strategies.get(strategy.metadata.name);
      if (!entry) continue;

      try {
        entry.executionCount++;
        const signals = await strategy.generateSignals(context);
        results.set(strategy.metadata.name, signals);

        entry.successCount++;
        entry.lastExecutedAt = new Date().toISOString();

        console.log(
          `[registry] 策略执行成功: ${strategy.metadata.displayName}, 信号数: ${signals.length}`
        );
      } catch (error) {
        entry.failureCount++;
        console.error(
          `[registry] 策略执行失败: ${strategy.metadata.displayName}`,
          error instanceof Error ? error.message : String(error)
        );
        // 策略失败不影响其他策略，继续执行
        results.set(strategy.metadata.name, []);
      }
    }

    return results;
  }

  /**
   * 合并多个策略的信号
   *
   * 合并规则：
   * 1. 规则信号（grid-rebalance）= 必要条件
   * 2. LLM 信号（llm-signal）= 增强条件，调整金额
   * 3. 只有规则信号触发时，才考虑 LLM 调整
   * 4. 按策略权重加权平均置信度
   */
  mergeSignals(signalsByStrategy: Map<string, StrategySignal[]>): MergedSignal[] {
    const merged: MergedSignal[] = [];

    // 获取规则信号（必要条件）
    const ruleSignals = signalsByStrategy.get("grid-rebalance") || [];
    const llmSignals = signalsByStrategy.get("llm-signal") || [];

    // 为每个规则信号查找对应的 LLM 调整
    for (const ruleSignal of ruleSignals) {
      const llmAdjustment = llmSignals.find((s) => s.code === ruleSignal.code);

      let finalAmount = ruleSignal.amount;
      let finalConfidence = ruleSignal.confidence;
      const sources: MergedSignal["sources"] = [
        {
          strategyName: "grid-rebalance",
          signal: ruleSignal,
        },
      ];

      // 如果有 LLM 调整建议，应用调整系数
      if (llmAdjustment && llmAdjustment.adjustmentFactor) {
        const adjustmentFactor = Math.max(
          0.5,
          Math.min(2.0, llmAdjustment.adjustmentFactor)
        );

        if (finalAmount) {
          finalAmount *= adjustmentFactor;
        }

        // 加权平均置信度（规则70%，LLM 30%）
        const ruleStrategy = this.get("grid-rebalance");
        const llmStrategy = this.get("llm-signal");
        const ruleWeight = ruleStrategy?.weight || 1.0;
        const llmWeight = llmStrategy?.weight || 0.3;
        const totalWeight = ruleWeight + llmWeight;

        finalConfidence =
          (ruleSignal.confidence * ruleWeight + llmAdjustment.confidence * llmWeight) /
          totalWeight;

        sources.push({
          strategyName: "llm-signal",
          signal: llmAdjustment,
        });
      }

      merged.push({
        code: ruleSignal.code,
        action: ruleSignal.action,
        tier: ruleSignal.tier,
        finalStrength: ruleSignal.strength,
        finalConfidence,
        reason: ruleSignal.reason,
        amount: finalAmount,
        sources,
      });
    }

    return merged;
  }

  /**
   * 获取策略统计信息
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, entry] of this.strategies.entries()) {
      stats[name] = {
        displayName: entry.strategy.metadata.displayName,
        version: entry.strategy.metadata.version,
        enabled: entry.strategy.enabled,
        weight: entry.strategy.weight,
        executionCount: entry.executionCount,
        successCount: entry.successCount,
        failureCount: entry.failureCount,
        successRate:
          entry.executionCount > 0
            ? ((entry.successCount / entry.executionCount) * 100).toFixed(1) + "%"
            : "N/A",
        activatedAt: entry.activatedAt,
        lastExecutedAt: entry.lastExecutedAt || "从未执行",
      };
    }

    return stats;
  }

  /**
   * 清空所有策略
   */
  clear(): void {
    this.strategies.clear();
    console.log("[registry] 所有策略已清空");
  }
}

/**
 * 全局策略注册表实例
 */
export const strategyRegistry = new StrategyRegistry();
