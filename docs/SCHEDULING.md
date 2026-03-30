# 定时运行配置指南

## 概述

Phase 1 支持通过 cron 定时触发 Agent，替代手动运行模式。

## 运行计划

### 预设方案

| 方案 | Cron 表达式 | 说明 |
|------|------------|------|
| 双周周四 | `0 21 * * 4/2` | 每两周周四晚上 9:00 |
| 每月 13 号 | `0 21 13 * *` | 每月 13 号晚上 9:00 |
| 每周日 | `0 22 * * 0` | 每周日晚上 10:00 |

### 自定义计划

通过环境变量 `FUND_AGENT_SCHEDULE` 指定：

```bash
export FUND_AGENT_SCHEDULE="0 21 * * 4/2"  # 每两周周四 9pm
```

## 部署方式

### 方式一：LangGraph Cloud（推荐）

LangGraph Cloud 原生支持 cron 定时触发。

1. 部署到 LangGraph Cloud：
   ```bash
   langgraph deploy
   ```

2. 在控制台配置 cron：
   - 进入 Deployments → Schedules
   - 添加新的 Schedule
   - 设置 cron 表达式：`0 21 * * 4/2`
   - 设置输入参数：`{"input": "分析我的持仓并给出调仓建议"}`

### 方式二：系统 Crontab（Linux/Mac）

1. 编辑 crontab：
   ```bash
   crontab -e
   ```

2. 添加定时任务：
   ```bash
   # 每两周周四晚上 9:00 运行
   0 21 * * 4 /path/to/run-fund-agent.sh
   ```

3. 创建运行脚本 `run-fund-agent.sh`：
   ```bash
   #!/bin/bash
   cd /path/to/g-fund-agent
   source .env
   pnpm up
   # 触发 Agent 运行
   curl -X POST http://localhost:2024/runs/stream \
     -H "Content-Type: application/json" \
     -d '{"input": "分析我的持仓并给出调仓建议"}'
   ```

### 方式三：Windows 任务计划程序

1. 打开"任务计划程序"
2. 创建基本任务：
   - 名称：基金持仓分析
   - 触发器：每两周周四 21:00
   - 操作：启动程序
   - 程序：`cmd.exe`
   - 参数：`/c cd D:\github\g-fund-agent && pnpm up && curl ...`

### 方式四：GitHub Actions

适合代码托管在 GitHub 的场景。

创建 `.github/workflows/fund-analysis.yml`：

```yaml
name: Fund Portfolio Analysis

on:
  schedule:
    # 每两周周四 UTC 13:00 (北京时间 21:00)
    - cron: '0 13 * * 4'
  workflow_dispatch: # 允许手动触发

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Run analysis
        env:
          OLLAMA_BASE_URL: ${{ secrets.OLLAMA_BASE_URL }}
          QIEMAN_API_KEY: ${{ secrets.QIEMAN_API_KEY }}
          LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}
        run: |
          pnpm up
          # 调用 Agent API
          curl -X POST http://localhost:2024/runs/stream \
            -H "Content-Type: application/json" \
            -d '{"input": "分析我的持仓并给出调仓建议"}'

      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: fund-reports
          path: docs/reports/
```

## 配置检查

### 验证 cron 表达式

使用 [crontab.guru](https://crontab.guru) 验证表达式：

- `0 21 * * 4` → 每周四 21:00
- `0 21 * * 4/2` → 每两周周四 21:00（从第一个周四开始）
- `0 21 13 * *` → 每月 13 号 21:00

### 测试运行

```bash
# 手动触发一次，验证流程
curl -X POST http://localhost:2024/runs/stream \
  -H "Content-Type: application/json" \
  -d '{"input": "分析我的持仓并给出调仓建议"}'

# 检查生成的报告
ls -lh docs/reports/weekly/
ls -lh docs/reports/analysis/
ls -lh docs/reports/suggestions/
```

## 通知配置

### 邮件通知

配置完成后可添加邮件通知：

1. 在 `src/agents/reporter.ts` 添加邮件发送工具
2. 使用 Nodemailer 发送报告摘要
3. 配置 SMTP 信息到 `.env`

### Webhook 通知

报告生成后推送到第三方服务：

```typescript
// 示例：推送到钉钉/企业微信
await fetch(process.env.WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    msgtype: 'markdown',
    markdown: {
      title: '基金持仓分析报告',
      text: reportMarkdown,
    },
  }),
});
```

## 故障排查

### 问题：定时任务未触发

**排查步骤**：
1. 检查 cron 表达式是否正确
2. 检查服务是否运行（`pnpm up`）
3. 查看系统日志：`journalctl -u cron`（Linux）

### 问题：环境变量未加载

**解决方案**：
- 在 cron 脚本中显式 `source .env`
- 或在 crontab 中设置完整环境变量

### 问题：网络连接失败

**排查步骤**：
1. 检查 MCP 服务是否可访问
2. 检查 Ollama 服务是否运行
3. 测试网络连通性：`curl $QIEMAN_MCP_URL`

## 最佳实践

1. **错误重试**：定时任务失败时自动重试 1-2 次
2. **日志轮转**：定期清理旧日志，避免磁盘占满
3. **监控告警**：连续失败时发送告警通知
4. **资源限制**：设置任务超时时间，避免长时间占用资源

## 下一步

Phase 2 将支持：
- 基于市场条件的动态调度（如市场大跌时加密运行）
- 多账户并行分析
- 实时监控模式（检测到重大市场变化时立即触发）
