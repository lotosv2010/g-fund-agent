---
name: code-review
description: 对当前变更执行结构化代码审查，覆盖架构合规、类型安全、错误处理、视觉一致性等维度。适用于提交前的质量把关。
argument-hint: "[文件路径或 git diff 范围，留空则审查所有未提交变更]"
disable-model-invocation: false
allowed-tools: Read Grep Glob Bash(git diff*) Bash(git status*) Bash(git log*)
---

# 代码审查

## 审查范围

```!
git diff --stat HEAD
```

```!
git status --short
```

**指定范围：** $ARGUMENTS

---

## 执行步骤

### 1. 加载审查规则

读取项目审查标准：

- `.claude/rules/review.md` — 审查 checklist
- `.claude/rules/architecture.md` — 架构红线
- `.claude/rules/coding.md` — 代码规范

### 2. 变更分析

读取所有变更文件的完整内容，理解变更意图：

- 逐文件阅读 diff，理解**做了什么**和**为什么**
- 识别变更类型：新增功能 / 重构 / 修复 / 配置变更
- 标注影响范围：仅限模块内 / 跨模块 / 跨层

### 3. 逐维度审查

按以下维度逐项检查，每个维度输出 PASS / WARN / FAIL：

#### 3.1 类型安全

- [ ] 无 `any` / `@ts-ignore` / `as unknown as`
- [ ] 函数参数和返回值有显式类型标注
- [ ] Tool I/O 使用 Zod Schema，类型通过 `z.infer<>` 导出
- [ ] 不存在手写的重复类型

#### 3.2 架构合规

- [ ] import 路径符合分层依赖规则
- [ ] 无循环依赖
- [ ] 新模块有 `index.ts` 唯一出口
- [ ] `domain/` 无外部依赖（Zod 除外）
- [ ] `process.env` 仅出现在 `domain/config.ts` 或入口层

#### 3.3 错误处理

- [ ] 无空 catch 块
- [ ] Agent Tool 内部有 try-catch 并返回结构化错误
- [ ] 业务错误使用 `domain/errors.ts` 中的自定义 Error 类

#### 3.4 安全

- [ ] 无硬编码密钥 / Token / API Key
- [ ] 用户输入有校验

#### 3.5 代码质量

- [ ] 无 `console.log`（CLI 入口文件例外）
- [ ] 不可变数据使用 `readonly`
- [ ] 无未使用的变量 / import
- [ ] 函数职责单一

#### 3.6 文档与注释

- [ ] 公开 API 有 JSDoc
- [ ] 注释使用中文
- [ ] 注释说明"为什么"，而非"做什么"

#### 3.7 视觉一致性（仅涉及 CLI 输出时）

- [ ] 颜色符合 `docs/DESIGN.md` 色彩系统
- [ ] 错误消息格式：`chalk.red("错误:") + 消息`
- [ ] 数值格式：金额 2 位小数，百分比 2 位小数带 `%`

### 4. 输出报告

```markdown
## 审查报告

**变更概述：** {一句话描述变更内容}
**文件数量：** {N} 个文件变更

### 审查结果

| 维度 | 结果 | 说明 |
|------|------|------|
| 类型安全 | PASS/WARN/FAIL | {简要说明} |
| 架构合规 | PASS/WARN/FAIL | {简要说明} |
| 错误处理 | PASS/WARN/FAIL | {简要说明} |
| 安全 | PASS/WARN/FAIL | {简要说明} |
| 代码质量 | PASS/WARN/FAIL | {简要说明} |
| 文档注释 | PASS/WARN/FAIL | {简要说明} |
| 视觉一致性 | PASS/WARN/FAIL/N/A | {简要说明} |

### 问题清单

按严重程度排序：

#### FAIL（必须修复）
- `文件:行号` — {问题描述} → {修复建议}

#### WARN（建议修复）
- `文件:行号` — {问题描述} → {修复建议}

### 总结

- **是否可提交：** 是 / 否（存在 FAIL 项时为否）
- **改进建议：** {整体性建议，如有}
```

> 注意：本 skill 仅做审查，不自动修改代码。如需修复，由用户确认后手动执行。
