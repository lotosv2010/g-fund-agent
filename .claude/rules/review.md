# 审查规则

> 本文件由 Claude Code 自动加载，指导代码审查和质量把关。
> 每次代码变更（新增、修改、重构）必须逐项检查。

## 必查项

### 1. 类型安全

- [ ] 无 `any` / `@ts-ignore` / `as unknown as`
- [ ] 函数参数和返回值有显式类型标注
- [ ] Tool I/O 使用 Zod Schema 定义，类型通过 `z.infer<>` 导出
- [ ] 不存在手写的重复类型（应从 Schema 推导）

### 2. 架构合规

- [ ] import 路径符合分层依赖规则（见 `architecture.md`）
- [ ] 无循环依赖
- [ ] 新模块有 `index.ts` 唯一出口
- [ ] `domain/` 无外部依赖（Zod 除外）
- [ ] `process.env` 仅出现在 `domain/config.ts` 或入口层

### 3. 错误处理

- [ ] 无空 catch 块
- [ ] Agent Tool 内部有 try-catch 并返回结构化错误
- [ ] 业务错误使用 `domain/errors.ts` 中的自定义 Error 类
- [ ] 异步函数的错误有合理传播路径

### 4. 安全

- [ ] 无硬编码密钥 / Token / API Key
- [ ] `.env` 相关文件不会被提交（已在 `.gitignore`）
- [ ] 用户输入有校验（Zod 或手动检查）

### 5. 代码质量

- [ ] 无 `console.log`（CLI 入口文件例外）
- [ ] 不可变数据使用 `readonly` 修饰
- [ ] 优先 `const`，避免 `let`
- [ ] 无未使用的变量 / import / 函数
- [ ] 函数职责单一，不超过 50 行（建议）

### 6. 文档与注释

- [ ] 公开 API 有 JSDoc
- [ ] 注释使用中文
- [ ] 注释说明"为什么"，而非"做什么"
- [ ] 新增模块 / 服务已更新 `docs/ARCHITECTURE.md` 分层架构图

### 7. 视觉一致性

- [ ] CLI 输出颜色符合 `docs/DESIGN.md` 色彩系统
- [ ] 错误消息格式：`chalk.red("错误:") + 消息`
- [ ] 用户文案使用中文，中文标点
- [ ] 数值格式：金额 2 位小数，百分比 2 位小数带 `%`

## 常见问题速查

| 问题 | 修复方式 |
|------|----------|
| module A 直接 import module B | 提取共享类型到 `domain/`，通过 bootstrap 组装 |
| service 依赖 module | 将需要的功能下沉到 utils 或通过参数注入 |
| Schema 和手写 type 并存 | 删除手写 type，改用 `z.infer<typeof XxxSchema>` |
| Tool 无 Zod Schema | 在对应 `*.tool.ts` 中定义输入/输出 Schema |
| 新文件未从 index.ts 导出 | 在模块 `index.ts` 中添加 re-export |
