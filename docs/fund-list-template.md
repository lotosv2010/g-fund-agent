# 基金列表模板

> 此文件为自定义基金列表的模板示例。如需使用，请设置环境变量：
> ```bash
> export FUND_LIST_PATH=/path/to/your-funds.md
> ```

## 使用说明

### 方式 1：默认使用 `portfolio.md`
系统会自动从 `docs/portfolio.md` 解析基金列表，无需额外配置。

### 方式 2：自定义基金列表
创建一个 Markdown 文件，按以下格式编写：

```markdown
# 宽基类
- 310318  申万菱信沪深300指数增强A
- 022445  景顺长城中证A500ETF联接C

# 科技主题类
- 161631  融通中证人工智能主题指数A
- 014320  德邦半导体产业混合C

# 海外类
- 096001  大成标普500等权重指数A
- 017093  景顺长城纳斯达克科技ETF联接C

# 债券
- 000188  华泰柏瑞丰盛纯债债券C

# 黄金
- 000217  华安黄金ETF联接C
```

## 资产类别关键词

系统会根据标题自动识别资产类别：

| 标题关键词 | 资产类别 |
|-----------|---------|
| 宽基、broad | 宽基类 |
| 科技、tech | 科技主题类 |
| 标普、sp500 | 海外-标普500 |
| 纳斯达克、nasdaq | 海外-纳斯达克 |
| 中概、china internet | 海外-中概互联网 |
| 债、bond | 债券 |
| 黄金、gold | 黄金 |

## 注意事项

1. **基金代码必须是 6 位数字**
2. **每行格式**：`- <代码>  <名称>`（代码和名称之间至少两个空格）
3. **标题必须包含资产类别关键词**，否则该分组下的基金会被忽略
4. **建议保持与 `portfolio.md` 同步**，避免数据不一致

## 示例场景

### 场景 1：临时分析一组基金
```bash
# 创建临时文件
cat > /tmp/my-test-funds.md << 'EOF'
# 宽基类
- 310318  申万菱信沪深300指数增强A
- 022445  景顺长城中证A500ETF联接C
EOF

# 指定路径运行
FUND_LIST_PATH=/tmp/my-test-funds.md pnpm dev
```

### 场景 2：分析不同投资组合
```bash
# 稳健型
FUND_LIST_PATH=./portfolios/conservative.md pnpm dev

# 激进型
FUND_LIST_PATH=./portfolios/aggressive.md pnpm dev
```

## 兜底机制

如果动态加载失败（文件不存在、解析错误等），系统会自动回退到 `src/rules/fund-registry.ts` 中硬编码的列表。
