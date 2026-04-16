---
name: solution-design
description: 基于已拆解的任务清单，输出技术方案设计（模块划分、接口契约、数据流、文件清单）。适用于开发前的方案评审。
argument-hint: <任务描述或 CURRENT.md 中的版本号>
disable-model-invocation: false
allowed-tools: Read Grep Glob
---

# 方案设计

为以下任务设计技术实现方案：

**设计目标：** $ARGUMENTS

---

## 执行步骤

### 1. 上下文加载

读取项目文档和代码，建立技术认知：

- `docs/ARCHITECTURE.md` — 分层架构、依赖规则、模块设计、ADR
- `docs/SPEC.md` — 需求边界和验收标准
- `docs/DESIGN.md` — 视觉交互规范
- `docs/tasks/CURRENT.md` — 任务详情
- `.claude/rules/architecture.md` — 架构红线
- `.claude/rules/coding.md` — 代码规范

浏览相关源码，理解现有实现模式：

- `src/domain/` — 现有 Schema 和类型定义
- `src/modules/` — 现有模块结构和接口
- `src/services/` — 现有服务层模式
- `src/bootstrap.ts` — 初始化和组装流程

### 2. 架构决策

对每个需要决策的技术点，按 ADR 格式输出：

```markdown
#### ADR-XX: {决策标题}

- **背景：** {为什么需要这个决策}
- **选项：**
  - A: {方案 A 描述} — 优: ... / 劣: ...
  - B: {方案 B 描述} — 优: ... / 劣: ...
- **决策：** {选择哪个，为什么}
- **后果：** {对现有代码的影响}
```

### 3. 模块设计

对每个新增 / 修改的模块，输出：

```markdown
#### {模块名}（`src/modules/{name}/` 或 `src/services/{name}.ts`）

**职责：** {一句话说明}

**公开接口：**
- `functionName(params): ReturnType` — {说明}

**Zod Schema：**
- `XxxSchema` — {字段说明}

**依赖：**
- domain: `XxxSchema`, `YyyError`
- utils: `loadXxx()`

**不依赖：** {明确列出不应依赖的模块}
```

### 4. 数据流设计

用文本流程图描述核心数据流：

```
用户操作
  → {入口函数}
    → {中间处理}
      → {数据源/工具调用}
    ← {返回数据}
  ← {输出展示}
```

标注每个节点的文件位置和关键函数名。

### 5. 文件清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| 新增 | `src/modules/{name}/index.ts` | {说明} |
| 新增 | `src/modules/{name}/{name}.service.ts` | {说明} |
| 修改 | `src/bootstrap.ts` | {修改内容} |
| 修改 | `docs/ARCHITECTURE.md` | 更新分层架构图 |

### 6. 合规性检查

对照架构规则逐项验证方案：

- [ ] 分层依赖规则：新模块的 import 路径合规
- [ ] 模块结构：有 `index.ts` 唯一出口
- [ ] Tool I/O：使用 Zod Schema 定义
- [ ] 错误处理：使用自定义 Error 类
- [ ] 无循环依赖
- [ ] 无 `process.env` 直接访问（domain/config.ts 除外）
- [ ] CLI 输出符合 DESIGN.md 色彩系统

### 7. 输出产物

最终输出：

1. **架构决策**（ADR 格式）
2. **模块设计**（接口 + Schema + 依赖）
3. **数据流图**
4. **文件清单**（新增 / 修改）
5. **合规性检查结果**

> 注意：本 skill 仅做方案设计，不执行代码编写。方案确认后使用 `/zcf:feat` 或手动开发。
