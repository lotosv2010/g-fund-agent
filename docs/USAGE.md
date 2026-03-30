# 使用说明

## 1. 环境准备

### 1.1 前置条件

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | 20+ | 运行环境 |
| pnpm | 10+ | 包管理器 |
| Ollama | 最新 | 本地 LLM 服务 |

### 1.2 安装 Ollama 并拉取模型

```bash
# 安装 Ollama（参考 https://ollama.com）
# 拉取模型（根据 .env 中 OLLAMA_MODEL 配置）
ollama pull qwen3:8b
```

确认 Ollama 运行中：

```bash
ollama list
# 应看到 qwen3:8b 或你配置的模型
```

### 1.3 安装项目依赖

```bash
cd g-fund-agent
pnpm install
```

### 1.4 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入以下配置：

```bash
# LangSmith（可选，用于追踪调试）
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=<你的 LangSmith API Key>
LANGSMITH_PROJECT="g-fund-agent"

# Ollama LLM
OLLAMA_MODEL=qwen3:8b          # 你拉取的模型名
OLLAMA_BASE_URL=http://localhost:11434

# qieman MCP（且慢，用于获取基金数据）
QIEMAN_MCP_URL=https://stargate.yingmi.com/mcp/v2
QIEMAN_API_KEY=<你的且慢 API Key>

# 自定义基金列表（可选）
# FUND_LIST_PATH=/path/to/your-funds.md  # 不设置则默认从 docs/portfolio.md 读取
```

### 1.5 验证配置

```bash
# 类型检查，确认无报错
npx tsc --noEmit
```

## 2. 启动与使用

### 2.1 启动开发服务器

```bash
pnpm dev
```

启动成功后，控制台会输出 LangGraph Studio 的访问地址（通常是 `http://localhost:2024`）。

### 2.2 在 LangSmith Studio 中使用

打开 LangSmith Studio，选择 `fund_agent` 图，在对话框中输入：

**基础使用：**

```
分析我的持仓并给出调仓建议
```

**指定操作：**

```
获取所有基金的最新净值
```

```
检查是否有基金触发了补仓或止盈规则
```

```
生成本周的持仓分析报告
```

### 2.3 Agent 执行流程

输入后，Agent 会按以下流程自动执行：

```
1. [data_fetcher] 通过 MCP 逐一获取 12 只基金的最新净值
2. [主编排器]     根据规则判断是否触发补仓/止盈
3. [reporter]     格式化周报并保存到 docs/reports/
```

生成的报告保存位置：
- `docs/reports/weekly/YYYY-WXX.md` — 每周持仓快照
- `docs/reports/analysis/YYYY-WXX.md` — 仓位分析
- `docs/reports/suggestions/YYYY-WXX.md` — 调仓建议（仅触发规则时）

## 3. 每周操作步骤

### 周日晚 10 点执行

1. **确认 Ollama 运行中**：`ollama list`
2. **启动服务**：`pnpm dev`
3. **打开 Studio**，输入"分析我的持仓并给出调仓建议"
4. **查看输出**：
   - 净值检查表（必定输出）
   - 调仓建议（仅触发规则时）
   - 仓位偏离检查
5. **人工确认**：根据建议手动执行买入/卖出操作
6. **记录操作**：将实际操作记录到 `docs/records/YYYY-MM-DD.md`
7. **更新持仓**：将最新持仓数据更新到 `docs/portfolio.md`

## 4. 日常维护

### 4.1 新增/调整基金

**推荐方式：直接编辑 `docs/portfolio.md`**

系统会自动从 `portfolio.md` 的表格中解析基金列表，只需：

1. 在对应资产类别的表格中添加新行
2. 确保格式正确（见下方示例）
3. 下次启动时自动生效

```markdown
## 宽基类
| 名称 | 代码 | 净值 | 持仓金额 | 收益率 | 持仓成本 |
|------|------|------|----------|--------|----------|
| 新基金名称 | 000001 | 1.0000 | 0.00 | 0% | 1.0000 |
```

系统会根据标题（如"宽基类"、"科技主题类"）自动识别资产类别。

**方式二：使用自定义文件**

如需临时分析不同组合，参考 [fund-list-template.md](./fund-list-template.md) 创建自定义列表，然后：

```bash
FUND_LIST_PATH=/path/to/your-funds.md pnpm dev
```

**方式三：兜底使用硬编码（不推荐）**

如果以上两种方式都失败，系统会使用 `src/rules/fund-registry.ts` 中的默认列表。

### 4.2 调整规则阈值

编辑 `src/rules/rules-config.ts`，修改对应类别的 `buyTiers`（补仓）或 `sellTiers`（止盈）：

```typescript
broad_base: {
  buyTiers: [
    { dropPercent: 8, buyPercent: 5 },   // 跌 8% 买入目标仓位的 5%
    { dropPercent: 15, buyPercent: 10 },  // 跌 15% 再买入 10%
    { dropPercent: 25, buyPercent: 15 },  // 跌 25% 再买入 15%
  ],
  sellTiers: [
    { risePercent: 15, sellFraction: 1/3 },  // 涨 15% 卖 1/3
    { risePercent: 30, sellFraction: 1/3 },  // 涨 30% 再卖 1/3
    { risePercent: 50, sellFraction: 1/3 },  // 涨 50% 卖剩余
  ],
},
```

### 4.3 更新持仓数据

编辑 `docs/portfolio.md`，更新各基金的净值、持仓金额、收益率、汇总表。

## 5. 注意事项

### 5.1 安全相关

- **API Key 不入库**：`.env` 已在 `.gitignore` 中，切勿在代码中硬编码密钥
- **只读建议**：Agent 只输出调仓建议，不会自动执行交易，所有操作需人工确认
- **数据本地化**：持仓数据和补仓记录存储在本地，不上传第三方

### 5.2 模型相关

- Agent 需要模型具备 **tool calling** 能力，推荐使用 `qwen3:8b` 或更大参数的模型
- 如果 LLM 不调用工具直接回答，大概率是模型 tool calling 能力不足，尝试换更大的模型
- Ollama 必须在本地运行，确认 `http://localhost:11434` 可访问

### 5.3 MCP 相关

- qieman MCP 使用 Streamable HTTP 协议（`transport: "http"`）
- 如果连接失败（405 错误），确认 MCP URL 和 API Key 是否正确
- MCP 工具在 Agent 启动时加载，如果 MCP 服务不可用，Agent 无法启动

### 5.4 报告相关

- 报告自动保存到 `docs/reports/` 下对应目录
- 文件名格式为 `YYYY-WXX.md`（年份-第几周）
- 同一周重复运行会覆盖之前的报告

### 5.5 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `MCPClientError: SSE error: 405` | MCP 传输协议错误 | 确认 `client.ts` 中 `transport: "http"` |
| LLM 不调用工具直接回答 | 模型 tool calling 能力不足 | 换用更大的模型（如 qwen3:14b） |
| `Cannot find module` | 依赖未安装 | 运行 `pnpm install` |
| 启动时报环境变量错误 | `.env` 未配置 | 复制 `.env.example` 并填入 Key |
| 报告未生成 | reporter 子 Agent 未被调用 | 检查 system prompt 是否包含第三步 |
