/**
 * 策略模块导出（Phase 2）
 *
 * 使用方式：
 * ```typescript
 * import { strategyRegistry, gridRebalanceStrategy, LLMSignalStrategy } from "./strategies";
 *
 * // 注册策略
 * strategyRegistry.register(gridRebalanceStrategy);
 * strategyRegistry.register(new LLMSignalStrategy(true, 0.3));
 *
 * // 执行策略
 * const context = { funds, marketData, marketContext, timestamp };
 * const signalsByStrategy = await strategyRegistry.executeAll(context);
 *
 * // 合并信号
 * const mergedSignals = strategyRegistry.mergeSignals(signalsByStrategy);
 * ```
 */

export * from "./types";
export * from "./registry";
export * from "./grid-rebalance";
export * from "./llm-signal";

// 导出便捷函数
export { strategyRegistry } from "./registry";
export { gridRebalanceStrategy } from "./grid-rebalance";
export { LLMSignalStrategy } from "./llm-signal";
