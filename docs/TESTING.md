# 联调测试指南

## 测试目标

验证完整的分析流程能够端到端运行，确保：
1. 数据获取正常（MCP 工具调用成功）
2. 规则引擎正确计算（高点、档位、建议）
3. 状态持久化正确（补仓点、高点、触发档位）
4. 报告生成和保存成功
5. portfolio.md 自动更新

## 前置条件

### 1. 环境配置

确保 `.env` 文件已正确配置：

```bash
# LangSmith 追踪（可选，用于调试）
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=<your_key>
LANGSMITH_PROJECT="g-fund-agent"

# Ollama LLM
OLLAMA_MODEL=qwen3:8b
OLLAMA_BASE_URL=http://localhost:11434

# qieman MCP（必需）
QIEMAN_MCP_URL=https://stargate.yingmi.com/mcp/v2
QIEMAN_API_KEY=<your_key>
```

### 2. 启动 Ollama

```bash
# 确保 Ollama 服务运行中
curl http://localhost:11434/api/tags

# 如果未安装模型，先拉取
ollama pull qwen3:8b
```

### 3. 构建项目

```bash
pnpm install
pnpm build
npx tsc --noEmit  # 验证类型
```

## 测试步骤

### 第一步：清空运行时状态（首次测试）

```bash
# 备份现有状态文件（如果有）
mkdir -p data/backup
mv data/*.json data/backup/ 2>/dev/null || true

# 或者创建测试用的初始状态
mkdir -p data
echo '[]' > data/buy-points.json
echo '{}' > data/high-points.json
echo '{}' > data/triggered-tiers.json
```

### 第二步：启动开发服务器

```bash
pnpm dev
```

服务启动后会显示：
```
✅ LangGraph API running on port 2024
🔗 Studio URL: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

### 第三步：在 LangSmith Studio 中测试

1. 打开 Studio URL（或访问 `http://localhost:2024` 如果有本地 UI）
2. 输入测试指令：
   ```
   分析我的持仓并给出调仓建议
   ```

### 第四步：观察执行流程

Agent 应该按以下顺序执行：

#### 1. 数据获取阶段
```
[agent] 调用 data_fetcher 子代理
[mcp] 调用 qieman MCP 工具查询基金净值
```

**预期输出**：12只基金的净值数据（JSON格式）

#### 2. 分析阶段
```
[agent] 调用 analyze_portfolio 工具
[market-calculator] 计算市场数据
  - 检查近期高点
  - 计算跌幅/涨幅
  - 加权平均补仓成本
[rule-matcher] 规则匹配
  - 检查补仓档位
  - 检查止盈档位
  - 档位去重验证
[portfolio-optimizer] 组合优化
  - 生成建议
  - 债券联动检查
```

**预期输出**：
- `marketData`: 每只基金的市场计算结果
- `ruleResults`: 触发的规则列表
- `suggestions`: 调仓建议列表

#### 3. 报告生成阶段
```
[agent] 调用 reporter 子代理
[reporter] 生成三份报告
  - docs/reports/weekly/YYYY-WW.md
  - docs/reports/analysis/YYYY-WW.md
  - docs/reports/suggestions/YYYY-WW.md
[reporter] 更新 docs/portfolio.md
```

### 第五步：验证输出

#### 1. 检查报告文件

```bash
# 查看本周报告（YYYY-WW格式，如 2026-13）
ls -lh docs/reports/weekly/
ls -lh docs/reports/analysis/
ls -lh docs/reports/suggestions/

# 查看报告内容
cat docs/reports/weekly/$(date +%Y-%W).md
```

#### 2. 检查 portfolio.md 更新

```bash
head -20 docs/portfolio.md
```

应显示：
- 最新的数据快照时间
- 每只基金的最新净值和持仓
- 各类别小计和总计

#### 3. 检查状态持久化

```bash
# 查看近期高点记录
cat data/high-points.json
```

预期格式：
```json
{
  "310318": { "value": 3.6584, "date": "2026-03-30T..." },
  "022445": { "value": 1.1663, "date": "2026-03-30T..." }
}
```

```bash
# 查看补仓点记录（如果有触发补仓）
cat data/buy-points.json
```

```bash
# 查看已触发档位（如果有触发规则）
cat data/triggered-tiers.json
```

预期格式：
```json
{
  "020256": { "buy": 1 },
  "006328": { "buy": 2 }
}
```

### 第六步：测试状态持久化

#### 模拟补仓记录

如果报告中有补仓建议，复制命令执行：

```bash
node -e "require('./dist/state/store').addBuyPoint({
  code: '020256',
  date: '2026-03-30',
  nav: 1.4286,
  amount: 3000
})"
```

再次查看：
```bash
cat data/buy-points.json
```

#### 再次运行 Agent

重新执行分析，验证：
1. 相同档位不会重复触发
2. 加权平均补仓成本正确计算
3. 高点滚动窗口逻辑正确

## 测试场景

### 场景 1：无触发规则

当前市场平稳，无补仓或止盈触发。

**预期**：
- `ruleResults` 为空数组
- `suggestions` 只包含债券占比检查（如果超标）
- 报告中显示"本周无需调仓"

### 场景 2：触发第1档补仓

某基金较高点下跌超过阈值（如宽基 -8%）。

**预期**：
- `ruleResults` 包含该基金的买入信号
- `suggestions` 包含具体买入建议和金额
- `triggered-tiers.json` 记录档位
- 报告中附带补仓点记录命令

### 场景 3：触发第3档补仓 + 债券联动

某基金深度下跌触发第3档。

**预期**：
- `suggestions` 包含基金补仓 + 债券减仓
- 债券减仓金额 = 债券总持仓 × 10%~20%
- 报告中同时显示两类建议

### 场景 4：高点过期重置

某基金60天未创新高。

**预期**：
- 日志显示"高点已过期，重置为当前净值"
- `high-points.json` 中该基金高点更新
- `triggered-tiers.json` 中该基金补仓记录清除

### 场景 5：重复运行

不改变市场数据，连续运行两次。

**预期**：
- 第二次运行不会重复触发相同档位
- 日志显示档位已触发，跳过
- `suggestions` 为空或只有更高档位

## 常见问题排查

### 问题1：MCP 工具调用失败

**现象**：
```
[mcp] ❌ 获取工具失败 (服务: qieman)
[mcp] ⚠️  将使用空工具列表继续运行（降级模式）
```

**排查**：
1. 检查 `QIEMAN_API_KEY` 是否正确
2. 测试 MCP 连接：
   ```bash
   curl -H "x-api-key: $QIEMAN_API_KEY" \
        $QIEMAN_MCP_URL/health
   ```
3. 检查网络连接和代理设置

### 问题2：Ollama 模型无响应

**现象**：Agent 卡在某个步骤，长时间无输出。

**排查**：
1. 检查 Ollama 服务状态
2. 查看 LangSmith 追踪日志
3. 尝试更换更小的模型：`OLLAMA_MODEL=qwen2.5:7b`

### 问题3：类型错误

**现象**：
```
TypeError: Cannot read property 'value' of undefined
```

**排查**：
1. 检查 `data/high-points.json` 格式是否正确
2. 删除旧格式文件，让系统自动迁移：
   ```bash
   rm data/high-points.json
   ```

### 问题4：报告未生成

**现象**：分析完成，但 `docs/reports/` 目录为空。

**排查**：
1. 检查 reporter 子代理是否被调用
2. 查看 LangSmith 追踪中的工具调用记录
3. 手动测试保存工具：
   ```bash
   node -e "require('./dist/agents/reporter').saveReportTool.invoke({
     subdir: 'weekly',
     content: '# Test'
   })"
   ```

## 测试清单

完成联调测试后，确认以下项目：

- [ ] MCP 工具成功调用，获取到12只基金数据
- [ ] 市场计算正确（高点、跌幅、涨幅）
- [ ] 规则匹配正确（档位判断、去重逻辑）
- [ ] 补仓金额计算正确（类别目标 × 档位百分比）
- [ ] 债券联动逻辑正确（第3档触发时）
- [ ] 生成三份报告（weekly/analysis/suggestions）
- [ ] portfolio.md 自动更新
- [ ] 状态文件持久化（buy-points/high-points/triggered-tiers）
- [ ] 高点滚动窗口逻辑（60天过期重置）
- [ ] 加权平均补仓成本计算
- [ ] 档位去重生效（相同档位不重复触发）

## 下一步

联调测试通过后：
- 将测试结果记录到 `docs/records/` 目录
- 标记 Phase 0 完成
- 规划 Phase 1 任务（数据丰富 + 风控层）
