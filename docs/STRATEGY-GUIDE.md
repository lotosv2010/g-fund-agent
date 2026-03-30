# 策略使用指南（Phase 2）

## 概述

Phase 2 引入了可插拔的策略框架，支持多策略并行运行和 LLM 信号增强。本文档介绍如何使用和自定义策略。

---

## 1. 启用策略引擎

### 1.1 引擎切换

项目支持两个分析引擎版本：

| 引擎 | 默认 | 特点 | 适用场景 |
|------|------|------|----------|
| **V1** | ✅ | 规则驱动，确定性，纯函数 | 追求稳定性和可审计性 |
| **V2** | ❌ | 策略驱动，可扩展，支持 LLM 增强 | 尝试多策略、信号合并 |

### 1.2 启用 V2 引擎

编辑 `.env` 文件：

```bash
# 启用策略驱动分析引擎
USE_STRATEGY_ENGINE=true

# 可选：启用 LLM 信号增强（需配合 V2 引擎）
ENABLE_LLM_SIGNAL=true
```

重启服务：

```bash
pnpm dev
```

控制台会显示：

```
[agent] ✅ 使用策略驱动的分析引擎（V2）
```

### 1.3 引擎对比

**V1 引擎（analysis-engine.ts）**：
- 直接调用 market-calculator、rule-matcher、portfolio-optimizer
- 固定流程，不支持策略扩展
- 适合稳定生产环境

**V2 引擎（analysis-engine-v2.ts）**：
- 通过策略注册表执行多策略
- 支持 LLM 信号增强（可选）
- 支持信号合并和策略统计
- 策略版本管理和溯源
- 适合尝试新策略和参数调优

### 1.4 回退到 V1

如果 V2 引擎出现问题，可随时回退：

```bash
# .env 文件
USE_STRATEGY_ENGINE=false
```

---

## 2. 内置策略

### 2.1 网格补仓策略（Grid Rebalance）

**策略名称**: `grid-rebalance`

**策略描述**: 将 Phase 0-1 的规则引擎封装为策略，按预设档位执行补仓和止盈操作。

**核心逻辑**:
- 根据资产类别设置不同的补仓/止盈档位
- 档位去重：已触发档位不重复触发
- 补仓金额 = 类别目标金额 × 档位百分比

**配置参数**:
```typescript
{
  // 参数从 rules-config.ts 读取
  // 未来可支持自定义参数覆盖
}
```

**风控约束**:
- 单只基金最大25%
- 类别最大为目标的1.5倍
- 最大回撤35%

**默认状态**: ✅ 启用，权重 1.0

---

### 2.2 LLM 信号增强策略（LLM Signal Enhancement）

**策略名称**: `llm-signal`

**策略描述**: 基于 LLM 分析市场环境，调整规则信号的强度和金额。

**核心逻辑**:
- 分析市场环境（宏观、情绪、行业）
- 提供信号强度调整建议
- 识别特殊市场情况（极端恐慌/贪婪）

**配置参数**:
```typescript
{
  minConfidence: 0.3,          // 最低置信度
  adjustmentMin: 0.5,          // 最小调整系数
  adjustmentMax: 2.0,          // 最大调整系数
  model: "qwen3:8b",           // LLM 模型
}
```

**约束**:
- 不能独立生成买卖信号（必须配合规则信号）
- 调整系数限制在 0.5-2.0 范围内
- 所有建议必须通过风控层

**默认状态**: ❌ 禁用（通过环境变量或运行时参数启用）

**启用方式**:
```bash
# 方式1：环境变量（永久启用）
export ENABLE_LLM_SIGNAL=true

# 方式2：运行时参数（单次启用）
# 在调用 analyze_portfolio_v2 工具时设置 enableLLM: true
```

---

## 3. 策略注册表

### 3.1 查看已注册策略

```typescript
import { strategyRegistry } from "./strategies";

// 获取所有已启用的策略
const enabled = strategyRegistry.getEnabledStrategies();
console.log(enabled.map(s => s.metadata.displayName));

// 获取策略统计信息
const stats = strategyRegistry.getStats();
console.log(stats);
```

输出示例:
```json
{
  "grid-rebalance": {
    "displayName": "网格补仓策略",
    "version": "1.0.0",
    "enabled": true,
    "weight": 1.0,
    "executionCount": 10,
    "successCount": 10,
    "failureCount": 0,
    "successRate": "100.0%",
    "activatedAt": "2026-03-30T00:00:00Z",
    "lastExecutedAt": "2026-03-30T12:00:00Z"
  }
}
```

### 3.2 注册自定义策略

```typescript
import { strategyRegistry } from "./strategies";
import type { Strategy } from "./strategies/types";

const myStrategy: Strategy = {
  metadata: {
    name: "my-strategy",
    displayName: "我的策略",
    version: "1.0.0",
    description: "自定义策略描述",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  params: {
    // 自定义参数
  },
  riskConstraints: {
    maxSinglePosition: 20,
  },
  enabled: true,
  weight: 1.0,

  async generateSignals(context) {
    // 策略逻辑
    return [];
  },

  validate() {
    return { valid: true, errors: [] };
  },
};

// 注册策略
strategyRegistry.register(myStrategy);
```

### 3.3 注销策略

```typescript
strategyRegistry.unregister("my-strategy");
```

---

## 4. 信号合并机制

### 4.1 合并规则

Phase 2 采用"规则 + LLM 协同"的信号合并机制：

```
规则信号（grid-rebalance）：
  - 必要条件：只有规则触发时才执行
  - 置信度：100%（确定性）
  - 权重：70%

LLM 信号（llm-signal）：
  - 增强条件：调整金额和强度
  - 调整系数：0.5-2.0
  - 权重：30%

合并结果：
  - 最终金额 = 规则金额 × LLM调整系数
  - 最终置信度 = (规则置信度 × 70% + LLM置信度 × 30%)
  - 信号溯源：记录所有策略来源
```

### 4.2 合并示例

**场景**：沪深300从高点跌10%，触发第1档补仓

**规则信号**:
```json
{
  "code": "310318",
  "action": "buy",
  "tier": 1,
  "strength": "weak",
  "confidence": 1.0,
  "reason": "较近期高点下跌 10.2%，触发第 1 档补仓（阈值 -8%）",
  "amount": 3500
}
```

**LLM 信号**（市场环境：牛市）:
```json
{
  "code": "310318",
  "action": "hold",
  "strength": "medium",
  "confidence": 0.7,
  "reason": "市场环境：bullish，PMI强劲、北向资金大幅流入",
  "adjustmentFactor": 1.3
}
```

**合并结果**:
```json
{
  "code": "310318",
  "action": "buy",
  "tier": 1,
  "finalStrength": "weak",
  "finalConfidence": 0.91,  // 1.0 × 70% + 0.7 × 30%
  "reason": "较近期高点下跌 10.2%，触发第 1 档补仓（阈值 -8%）",
  "amount": 4550,  // 3500 × 1.3
  "sources": [
    { "strategyName": "grid-rebalance", "signal": {...} },
    { "strategyName": "llm-signal", "signal": {...} }
  ]
}
```

---

## 5. 策略版本管理

### 5.1 保存策略版本

```typescript
import { saveStrategyVersion } from "./strategies/version-manager";

await saveStrategyVersion(myStrategy, "调整补仓档位阈值");
```

版本文件保存在 `data/strategy-versions/` 目录。

### 5.2 查看版本历史

```typescript
import { loadStrategyVersions } from "./strategies/version-manager";

const versions = await loadStrategyVersions("grid-rebalance");
console.log(versions);
```

### 5.3 比较版本差异

```typescript
import { compareVersions } from "./strategies/version-manager";

const diff = compareVersions(version1, version2);
console.log("新增参数:", diff.added);
console.log("删除参数:", diff.removed);
console.log("修改参数:", diff.changed);
```

---

## 6. 使用分析引擎 V2

**推荐方式：通过主编排器使用**

V2 引擎已集成到主编排器，推荐通过环境变量启用（见第 1 章），而不是直接调用工具。

**在 LangSmith Studio 中使用：**

1. 设置环境变量 `USE_STRATEGY_ENGINE=true`
2. 重启服务 `pnpm dev`
3. 在 Studio 中输入"分析我的持仓并给出调仓建议"
4. Agent 会自动使用 V2 引擎

**可选：启用 LLM 信号增强：**

设置 `ENABLE_LLM_SIGNAL=true` 后，V2 引擎会在规则信号基础上增加 LLM 信号。

---

**高级用法：直接调用工具**

如果需要在自定义脚本中直接调用 V2 引擎工具：

### 6.1 基本使用（仅规则信号）

```typescript
import { analyzePortfolioV2Tool } from "./agents/analysis-engine-v2";

const result = await analyzePortfolioV2Tool.invoke({
  funds: fundData,
  enableLLM: false,  // 不启用 LLM
});

console.log(result.message);
console.log(result.suggestions);
```

### 6.2 启用 LLM 信号增强

```typescript
const result = await analyzePortfolioV2Tool.invoke({
  funds: fundData,
  enableLLM: true,  // 启用 LLM
});

// 查看策略信号
console.log("规则信号:", result.strategySignals["grid-rebalance"]);
console.log("LLM信号:", result.strategySignals["llm-signal"]);

// 查看合并后的信号
console.log("合并信号:", result.mergedSignals);

// 查看策略统计
console.log("策略统计:", result.strategyStats);
```

### 6.3 输出结构

```typescript
{
  summary: {
    totalFunds: 12,
    activeStrategies: 2,        // 启用的策略数
    totalSignals: 3,            // 合并后的信号数
    totalSuggestions: 3,        // 最终建议数
    blockedSuggestions: 0,      // 风控阻止的建议数
    riskChecks: 5,              // 风控检查数
  },
  marketContext: {...},         // 市场上下文
  marketData: [...],            // 市场计算结果
  strategySignals: {            // 各策略的信号
    "grid-rebalance": [...],
    "llm-signal": [...],
  },
  mergedSignals: [...],         // 合并后的信号
  suggestions: [...],           // 最终建议（过滤后）
  riskResults: [...],           // 风控检查结果
  marketSummary: "...",         // 市场环境摘要
  riskSummary: "...",           // 风险提示摘要
  strategyStats: {...},         // 策略统计信息
  message: "...",               // 汇总消息
}
```

---

## 7. 自定义策略开发

### 7.1 策略模板

```typescript
import type { Strategy, StrategySignal, StrategyContext } from "./strategies/types";

export const myCustomStrategy: Strategy = {
  // 1. 元数据
  metadata: {
    name: "my-custom-strategy",        // 唯一标识
    displayName: "自定义策略",
    version: "1.0.0",
    description: "策略描述",
    author: "Your Name",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["custom"],
  },

  // 2. 参数
  params: {
    param1: 10,
    param2: "value",
  },

  // 3. 风控约束
  riskConstraints: {
    maxSinglePosition: 20,
    maxCategoryWeight: 1.5,
    maxDrawdown: 30,
  },

  // 4. 启用状态和权重
  enabled: true,
  weight: 1.0,

  // 5. 信号生成函数（核心逻辑）
  async generateSignals(context: StrategyContext): Promise<StrategySignal[]> {
    const signals: StrategySignal[] = [];

    for (const fund of context.funds) {
      const market = context.marketData.find(m => m.code === fund.code);
      if (!market) continue;

      // 你的策略逻辑
      if (/* 触发条件 */) {
        signals.push({
          code: fund.code,
          action: "buy",
          tier: 1,
          strength: "medium",
          confidence: 0.8,
          reason: "触发原因",
          amount: 5000,
        });
      }
    }

    return signals;
  },

  // 6. 验证函数
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.params.param1 <= 0) {
      errors.push("param1 必须大于0");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};
```

### 7.2 策略开发最佳实践

1. **明确策略意图**
   - 策略解决什么问题？
   - 适用于哪些市场环境？
   - 与现有策略的差异？

2. **参数设计**
   - 使用有意义的参数名
   - 提供合理的默认值
   - 添加参数验证逻辑

3. **信号生成**
   - 返回清晰的触发原因
   - 设置合适的信号强度（strong/medium/weak）
   - 提供合理的置信度（0-1）

4. **风控约束**
   - 设置保护性的风控限制
   - 不要突破系统风控阈值

5. **测试验证**
   - 使用历史数据验证策略有效性
   - 检查边界条件和异常情况
   - 确保策略不会造成过度交易

---

## 8. 常见问题

### Q1: V1 和 V2 分析引擎有什么区别？

**V1**（analysis-engine.ts）:
- Phase 0-1 的分析引擎
- 直接调用规则匹配和组合优化
- 固定流程，不支持策略扩展

**V2**（analysis-engine-v2.ts）:
- Phase 2 的策略驱动分析引擎
- 通过策略注册表执行多策略
- 支持 LLM 信号增强
- 支持信号合并
- 提供策略统计

**建议**：新项目使用 V2，V1 保留用于向后兼容。

### Q2: LLM 信号安全吗？

是的。LLM 信号有多重保护：

1. **不能独立触发操作** - 必须有规则信号才执行
2. **调整范围限制** - 调整系数限制在 0.5-2.0
3. **权重较低** - 仅占30%，规则信号占70%
4. **风控层检查** - 所有建议必须通过风控
5. **可选启用** - 默认禁用，需显式启用

### Q3: 如何调整策略权重？

```typescript
const strategy = strategyRegistry.get("grid-rebalance");
if (strategy) {
  strategy.weight = 1.5;  // 增加权重
}
```

权重影响信号合并时的置信度加权。

### Q4: Phase 2 MVP 有哪些限制？

1. **LLM 市场分析** - 当前基于简单规则判断，非真正的 LLM 推理
2. **策略创建 Agent** - 返回模板配置，需人工修改
3. **策略版本回滚** - 接口预留，完整实现待后续
4. **宏观/情绪数据** - 仍为模拟数据（Phase 1 遗留）

完整实现需要：
- 更强的 LLM 模型（如 GPT-4、Claude）
- 精细的提示工程
- 真实数据源接入
- 历史回测验证

---

## 9. 下一步

Phase 3 将引入：
- 历史数据存储（SQLite）
- 回测引擎
- 策略参数自动调优
- 策略评分看板

届时可以：
- 用历史数据验证策略有效性
- 自动寻找最优参数组合
- 对比不同策略的表现
- 预警策略衰减

敬请期待！
