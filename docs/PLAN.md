# G-Fund-Agent 开发规划

## 项目状态

| 模块 | 状态 |
|------|------|
| MCP 数据层（qieman 73 个工具） | 已连通 |
| 规则引擎 + 基金注册表 | 已完成 |
| 状态存储（补仓点 / 近期高点） | 已完成 |
| 分析引擎（market-calculator → rule-matcher → portfolio-optimizer） | 已接入 |
| DeepAgent 编排（data_fetcher + analyze_portfolio + reporter） | 已接入 |
| 配置校验（启动时自动检查） | 已完成 |
| **端到端联调** | **进行中** |

## 待办

### 1. 规则逻辑修正

- [ ] **近期高点应为 60 日滚动窗口**
  - 现状：高点只涨不跌（全历史最高），长期横盘会导致补仓规则逐渐失效
  - 方案：通过 MCP 获取 60 个交易日历史净值，取最高值；若 MCP 无此接口，改为按固定衰减周期（如 90 天未创新高则重置）
  - 位置：`src/agents/market-calculator.ts`

- [ ] **止盈基准改为加权平均补仓成本**
  - 现状：只取最后一次补仓点 `buyPoints.at(-1)`，多次补仓时基准不准
  - 方案：用所有补仓点按金额加权平均作为止盈基准
  - 位置：`src/agents/market-calculator.ts`

- [ ] **补仓档位去重（同一档位不重复触发）**
  - 现状：每次运行都会对满足条件的基金生成建议，不管上次是否已触发
  - 方案：在 `buy-points.json` 中记录已触发的档位；该档位补仓执行后才清除；止盈后重置所有档位
  - 位置：`src/agents/rule-matcher.ts` + `src/state/store.ts`

### 2. 联调测试

- [ ] 完整流程测试：data_fetcher → analyze_portfolio → reporter
- [ ] 生成第一份真实周报并人工审核
- [ ] 根据实际运行情况调整 prompt

### 3. 体验优化

- [ ] **portfolio.md 自动更新**
  - 每次运行后用 MCP 获取的最新数据覆盖 portfolio.md，保持数据源新鲜
  - 避免手动维护持仓数据

- [ ] **SPEC 触发频率更新**
  - 当前 SPEC 写 "每周周日晚 10 点"，实际使用是 "每两周周四或每月 13 号"
  - 更新 SPEC 和周报命名逻辑以匹配实际节奏

## 架构

```
createDeepAgent (主编排器)
├── data_fetcher (子 Agent: LLM + qieman MCP 73 Tools)
├── analyze_portfolio (Tool: 确定性规则引擎)
│   ├── calculateMarket()    — 计算近期高点、跌幅、涨幅
│   ├── matchRules()         — 按规则判断补仓/止盈
│   └── optimizePortfolio()  — 生成建议 + 债券联动
└── reporter (子 Agent: LLM + save_report Tool)
```

## 关键设计决策

1. **纯规则驱动** — LLM 只做数据获取和报告格式化，所有买卖决策由确定性函数产出
2. **分析引擎作为 Tool** — 三个纯计算函数封装为一个 tool，保证执行顺序固定、不被 LLM 跳过
3. **补仓金额基于类别目标** — `类别目标金额 × 档位百分比`（如宽基第 1 档 = 200,000 × 35% × 5% = 3,500 元）
4. **补仓点驱动止盈** — 止盈基准依赖 `buy-points.json` 中的记录，用户实际操作后手动执行命令记录
