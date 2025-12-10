# E2E测试文档

## 概述

本项目包含完整的E2E测试套件，用于验证性能优化和数据持久化bug修复的有效性。

## 测试覆盖范围

### 1. 数据持久化测试 (`tests/e2e/data-persistence.spec.ts`)

**核心bug修复验证:**
- ✅ 创建报销单后刷新页面，记录应该保留
- ✅ API返回空数组时，本地新创建记录应该保留
- ✅ localStorage防抖写入应该减少写入频率

**测试场景:**
- 测试1: 创建报销单 → 刷新页面 → 验证记录存在
- 测试2: 模拟API返回`[]` → 验证本地5分钟内记录保留
- 测试3: 监控localStorage写入次数 → 验证防抖优化

### 2. 性能基准测试 (`tests/e2e/performance.spec.ts`)

**性能目标:**
- FCP (First Contentful Paint) < 2s
- LCP (Largest Contentful Paint) < 2.5s
- TTI (Time to Interactive) < 3s

**测试场景:**
- 测试1: 首屏加载性能基准验证
- 测试2: 慢速网络(3G)下加载测试
- 测试3: 性能监控数据采集验证
- 测试4: 代码分割效果验证(vendor chunks)
- 测试5: 资源缓存策略验证

### 3. 报销单创建流程测试 (`tests/e2e/report-creation.spec.ts`)

**完整流程验证:**
- ✅ 创建通用报销单并验证保存成功
- ✅ 报销单列表显示验证
- ✅ 数据同步到localStorage验证
- ✅ 离线模式下创建报销单
- ✅ 多次快速创建不丢失数据

## 运行测试

### 前置要求

1. 安装依赖:
```bash
npm install
```

2. 安装Playwright浏览器:
```bash
npx playwright install
```

### 测试命令

**运行所有E2E测试:**
```bash
npm run test:e2e
```

**运行特定测试文件:**
```bash
npx playwright test data-persistence
npx playwright test performance
npx playwright test report-creation
```

**运行性能测试(慢速网络模拟):**
```bash
npm run test:e2e:performance
```

**UI模式运行(交互式调试):**
```bash
npm run test:e2e:ui
```

**查看测试报告:**
```bash
npm run test:e2e:report
```

**调试模式(单个测试):**
```bash
npx playwright test --debug
```

### 测试配置

测试配置文件: `playwright.config.ts`

**关键配置:**
- 基础URL: `http://localhost:5173`
- 超时: 30秒
- 失败重试: CI环境2次，本地0次
- 浏览器: Chromium (默认)
- 视频录制: 失败时保留
- 截图: 失败时保留

**性能测试专用配置:**
- 项目名: `performance`
- 网络模拟: 3G Fast (1.6Mbps下载, 750Kbps上传, 150ms延迟)

## 预期测试结果

### 成功标准

**数据持久化测试:**
- ✅ 所有测试通过
- ✅ 刷新后记录保留率 = 100%
- ✅ localStorage写入减少 > 80%

**性能测试:**
- ✅ FCP < 2000ms
- ✅ TTI < 3000ms
- ✅ 总加载时间 < 5000ms
- ✅ vendor-ai chunk不在首屏加载

**流程测试:**
- ✅ 报销单创建成功率 = 100%
- ✅ 离线模式数据保留 = 100%
- ✅ 快速创建无数据丢失

### 失败处理

如果测试失败:

1. **查看失败截图:**
   - 位置: `test-results/`
   - 文件名包含测试名称和时间戳

2. **查看失败视频:**
   - 位置: `test-results/`
   - 仅在失败时保留

3. **查看trace文件:**
   - 运行: `npx playwright show-trace test-results/.../trace.zip`

4. **查看HTML报告:**
   - 运行: `npm run test:e2e:report`

## 持续集成

### GitHub Actions配置示例

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

## 测试维护

### 更新测试

当UI变更时,需要更新测试中的选择器:
- 优先使用 `text=` 选择器(稳定性高)
- 使用 `placeholder*=` 模糊匹配
- 避免使用CSS class(易变)

### 添加新测试

1. 在 `tests/e2e/` 创建新的 `.spec.ts` 文件
2. 遵循现有测试结构
3. 添加清晰的测试描述
4. 包含日志输出便于调试

## 已知限制

1. **API模拟:** 某些测试使用route拦截,实际API可能行为不同
2. **时间依赖:** 防抖测试依赖时间,可能受CI环境影响
3. **环境差异:** 开发环境和生产环境性能差异较大

## 问题排查

### 常见问题

**问题1: 浏览器未安装**
```bash
npx playwright install chromium
```

**问题2: 端口5173被占用**
- 修改 `playwright.config.ts` 中的 `baseURL`
- 或停止占用5173端口的进程

**问题3: 测试超时**
- 检查开发服务器是否正常启动
- 增加 `timeout` 配置值

**问题4: 选择器找不到元素**
- 使用 `--debug` 模式逐步调试
- 检查UI是否有变更

## 参考文档

- [Playwright官方文档](https://playwright.dev/)
- [性能优化指南](https://web.dev/vitals/)
- [开发计划文档](../.claude/specs/performance-data-persistence-fix/dev-plan.md)
