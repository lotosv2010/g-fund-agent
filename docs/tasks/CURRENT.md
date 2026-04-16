# 任务跟踪

## 已完成

- [x] 项目初始化（工程配置 + 文档体系 + 目录结构）
- [x] 多模型 LLM 封装（注册表 + 工厂：DeepSeek / Gemini / Moonshot / MiniMax / Ollama）
- [x] MCP 模块封装（McpService 幂等初始化 + 优雅关闭）
- [x] Agent 模块封装（createFundAgent 工厂 + System Prompt）
- [x] 领域层（环境配置 + 错误体系）
- [x] CLI 交互模式（模型选择 → 对话循环）
- [x] LangSmith tracing 集成
- [x] 持仓分析需求分析 + 任务拆分
- [x] 持仓数据结构 + portfolio 模板
- [x] 持仓数据加载 + System Prompt 注入
- [x] CLI 功能菜单（查看持仓 / 分析持仓 / 自由对话）
- [x] 操作策略提取 + strategy.json + 策略上下文注入
- [x] Prompt 拆分（System Prompt 稳定层 + 场景指令变化层）
- [x] CLI 彩色输出（chalk）
- [x] 目标仓位支持（target + 完成度 + 每基金目标金额）

## v0.2 — 更新持仓 ✅

### T1: Portfolio 写入工具
- [x] `src/utils/portfolio-writer.ts` — 按交易日期写入 portfolio-YYYY-MM-DD.json

### T2: 持仓更新计算逻辑
- [x] `src/utils/portfolio-updater.ts` — 基于涨跌幅的核心计算
- [x] 自动更新：`newAmount = oldAmount × (1 + dailyReturn)`
- [x] 加仓：costBasis 加权平均（隐含 NAV = costBasis × (1 + returnRate)）
- [x] 减仓：costBasis 不变，减少金额

### T3: 涨跌数据获取（Agent 统一架构）
- [x] CLI 模式：Agent 调用 MCP → 返回 JSON → 程序解析
- [x] LangGraph 模式：Agent 调用 MCP → 调用 UpdatePortfolioFile 工具

### T4: 业务服务层
- [x] `src/services/portfolio-update.service.ts` — 解析、计算、持久化
- [x] `src/services/portfolio-update.tool.ts` — LangChain Tool（LangGraph 模式）
- [x] CLI 和 LangGraph 双模式共享业务逻辑

### T5: CLI 交互流程
- [x] 新增菜单项"更新持仓"
- [x] 自动查找最新持仓文件（portfolio-YYYY-MM-DD.json）
- [x] Agent 获取涨跌幅 + 交易日期
- [x] 交互收集加仓/减仓操作
- [x] 展示变更对比（涨跌幅、涨跌金额、操作、累计收益率）
- [x] 按交易日期保存（同日覆盖，历史不变）

## v0.3 — 扩展功能

- [ ] 定投模拟（基于 GetFundsBackTest）
- [ ] 市场情绪播报（GetLatestQuotations + SearchFinancialNews）

## v0.4 — 高级功能

- [ ] 会话记忆（持久化用户持仓，无需每次重复输入）
- [ ] 调仓建议（基于诊断结果 + 资产配置方案）
- [ ] 基金筛选器（自然语言条件 → SearchFunds + 筛选工具）
