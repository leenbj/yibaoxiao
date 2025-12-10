# 性能优化与数据持久化修复 - Development Plan

## Overview
解决易报销系统两大核心问题：服务器加载缓慢(5秒+)和报销记录刷新后丢失，通过前端构建优化、数据加载策略改进和API数据覆盖bug修复实现。

## Task Breakdown

### Task 1: 优化前端构建和代码分割
- **ID**: task-1-build-optimization
- **Description**: 优化Vite构建配置，针对性分割大型依赖库，减少首屏加载体积，目标将vendor chunks从当前300KB+优化至150KB以下
- **File Scope**:
  - `frontend/vite.config.ts` (修改manualChunks配置)
  - `frontend/package.json` (审查依赖版本和大小)
  - `frontend/src/index.tsx` (添加动态导入和懒加载)
  - 新增 `frontend/src/utils/lazy-loader.ts` (工具函数)
- **Dependencies**: None
- **Test Command**:
  ```bash
  cd frontend && \
  npm run build && \
  ls -lh dist/assets/*.js && \
  npm test -- --testPathPattern="build-optimization" --coverage --coveragePathIgnorePatterns="/node_modules/"
  ```
- **Test Focus**:
  - 验证vendor-genai.js < 200KB
  - 验证首屏chunk < 150KB (当前可能超过300KB)
  - 测试动态导入是否正确拆分PDF/AI库
  - E2E测试验证分割后功能完整性

### Task 2: 修复数据加载和持久化bug
- **ID**: task-2-data-persistence-fix
- **Description**: 解决核心bug - API返回空数组`[]`时不应覆盖localStorage数据，实现渐进式加载状态(优先展示缓存数据，后台同步API)，修复刷新后数据丢失问题
- **File Scope**:
  - `frontend/src/index.tsx` (修改useEffect数据加载逻辑 line 124-180)
  - `frontend/src/utils/api.ts` (可能需要调整错误处理)
  - 新增 `frontend/src/utils/data-sync.ts` (数据同步工具)
  - `steps/expenses/list.step.ts` (后端API响应格式验证)
  - `steps/reports/list.step.ts` (后端API响应格式验证)
- **Dependencies**: None
- **Test Command**:
  ```bash
  cd frontend && \
  npm test -- --testPathPattern="data-(loading|persistence)" --coverage --collectCoverageFrom="src/{index,utils/**}.{ts,tsx}"
  ```
- **Test Focus**:
  - 模拟API返回`{reports: []}`时保持localStorage数据
  - 模拟API失败返回`{reports: null}`时保持旧数据
  - 测试渐进式加载：先展示缓存→后台同步→增量更新UI
  - 测试localStorage防抖写入(避免频繁写入)
  - E2E测试：创建记录→刷新页面→验证数据仍存在

### Task 3: 添加性能监控和缓存策略
- **ID**: task-3-performance-monitoring
- **Description**: 实施localStorage防抖写入策略(减少同步写入频率)，添加首屏加载性能埋点(FCP/LCP监控)，实现智能缓存失效策略
- **File Scope**:
  - `frontend/src/index.tsx` (集成监控埋点和缓存策略 line 183-186)
  - 新增 `frontend/src/utils/cache.ts` (缓存管理工具类)
  - 新增 `frontend/src/utils/performance.ts` (性能监控埋点)
  - `frontend/src/utils/data-sync.ts` (集成防抖写入)
- **Dependencies**: task-2 (需要先修复数据加载逻辑)
- **Test Command**:
  ```bash
  cd frontend && \
  npm test -- --testPathPattern="(cache|performance)" --coverage --collectCoverageFrom="src/utils/{cache,performance,data-sync}.ts"
  ```
- **Test Focus**:
  - 单元测试localStorage防抖写入(500ms延迟合并)
  - 测试缓存TTL策略(默认5分钟过期)
  - 模拟高频state更新，验证只触发一次写入
  - 测试性能埋点数据采集正确性(FCP/LCP/TTI)
  - 验证缓存版本管理(schema变更时自动失效)

### Task 4: 端到端测试和验证
- **ID**: task-4-e2e-validation
- **Description**: 创建完整的E2E测试套件，覆盖两个核心bug场景(加载慢、数据丢失)，建立性能基准测试(FCP < 2s, TTI < 3s)，验证所有修复有效性
- **File Scope**:
  - 新增 `tests/e2e/report-creation.spec.ts` (报销单创建和持久化测试)
  - 新增 `tests/e2e/data-persistence.spec.ts` (数据刷新持久化测试)
  - 新增 `tests/e2e/performance.spec.ts` (性能基准测试)
  - `frontend/playwright.config.ts` (E2E测试配置)
- **Dependencies**: task-1, task-2, task-3 (需要前三个任务完成)
- **Test Command**:
  ```bash
  npm run test:e2e && \
  npm run test:e2e:performance -- --reporter=json > performance-report.json
  ```
- **Test Focus**:
  - E2E场景1: 慢速网络下首屏加载FCP < 2s (模拟3G网络)
  - E2E场景2: 创建报销单→刷新→验证数据存在→API同步成功
  - E2E场景3: 离线创建数据→上线后自动同步
  - 性能基准: FCP < 2s, LCP < 2.5s, TTI < 3s
  - 可视化回归测试: 验证UI未因懒加载破坏

## Acceptance Criteria
- [ ] **性能优化**: 首屏加载FCP < 2s (当前5秒+), vendor chunks总大小 < 500KB
- [ ] **数据持久化**: API返回空数组时不覆盖localStorage，100%解决刷新丢失bug
- [ ] **渐进式加载**: 缓存数据立即展示 (< 200ms), 后台API同步无阻塞
- [ ] **缓存策略**: localStorage写入防抖减少90%写入次数
- [ ] **测试覆盖**: 单元测试覆盖率 ≥90%, E2E测试覆盖2个核心bug场景
- [ ] **性能监控**: 生产环境FCP/LCP/TTI埋点数据正常上报
- [ ] **向后兼容**: 支持旧版localStorage数据自动迁移

## Technical Notes

### 技术决策说明

**1. 代码分割策略 (Task 1)**
- **决策**: 采用基于路由的懒加载 + 手动chunk分割混合策略
- **理由**:
  - `@google/genai` (约180KB) 仅在AI功能使用时加载
  - `jspdf` + `html2canvas` (约200KB) 仅在导出PDF时加载
  - React核心保持在首屏chunk中 (约40KB gzipped)
- **实施**: 使用动态`import()`和React.lazy()延迟加载非首屏组件
- **权衡**: 可能增加首次点击AI/PDF功能的延迟(约200ms), 但换取首屏加载提升60%

**2. 数据加载优化 (Task 2)**
- **决策**: Stale-While-Revalidate (SWR) 缓存策略
- **理由**:
  - 立即展示缓存数据，用户感知加载时间 < 200ms
  - 后台异步同步API数据，无阻塞用户交互
  - 解决API返回空数组`[]`时的覆盖bug (核心修复)
- **实施**:
  ```typescript
  // 修复前 (Bug!)
  if (apiReports !== null) setReports(apiReports); // [] 会覆盖本地数据

  // 修复后
  if (apiReports !== null && apiReports.length > 0) {
    setReports(apiReports);
  } else if (apiReports === null) {
    // API失败，保持本地数据
  } else {
    // 空数组，可能是首次同步，保持本地数据并标记需同步
  }
  ```
- **权衡**: 需要处理缓存与API数据冲突(采用时间戳或版本号解决)

**3. localStorage性能优化 (Task 3)**
- **决策**: 防抖写入 + 批量更新 + IndexedDB迁移准备
- **理由**:
  - 当前每次state变更都写localStorage (line 183-186), 高频操作时阻塞主线程
  - 防抖500ms可减少90%写入次数
  - 为未来迁移至IndexedDB做准备 (数据量>5MB时)
- **实施**: 使用lodash.debounce或自定义防抖工具
- **权衡**: 500ms延迟可能导致极端情况下数据丢失(如浏览器崩溃), 通过visibilitychange API补偿

**4. 测试覆盖策略**
- **单元测试**: 覆盖数据加载、缓存管理、性能埋点核心逻辑
- **集成测试**: 模拟API成功/失败/空数组/网络超时等边界情况
- **E2E测试**:
  - Playwright模拟真实用户操作 (创建→刷新→验证)
  - 网络节流测试 (3G Fast/Slow模拟)
  - 性能基准自动化 (Lighthouse CI集成)

### 风险评估

**高风险 (需重点监控)**
1. **向后兼容性风险** (风险等级: 🔴 高)
   - **问题**: 修改localStorage数据结构可能导致旧用户数据丢失
   - **缓解措施**:
     - 实施版本号管理 (`reimb_v2`)
     - 自动迁移脚本检测旧数据并转换
     - 回滚方案: 保留7天内旧数据副本
   - **验证**: E2E测试覆盖旧数据格式读取

2. **API空数组语义歧义** (风险等级: 🔴 高)
   - **问题**: 后端返回`[]`可能表示"无数据"或"查询失败"
   - **缓解措施**:
     - 与后端对齐API contract (返回`{reports: [], _meta: {total: 0}}`)
     - 前端区分"空结果"和"失败"场景
   - **验证**: 集成测试覆盖后端API规范

**中风险**
3. **动态导入错误处理** (风险等级: 🟡 中)
   - **问题**: 网络错误导致chunk加载失败
   - **缓解措施**: 实施重试机制 + 降级方案
   - **验证**: 网络故障模拟测试

4. **性能监控数据量** (风险等级: 🟡 中)
   - **问题**: 性能埋点可能产生大量数据
   - **缓解措施**: 采样率10% + 数据压缩上报
   - **验证**: 监控上报数据量和服务器负载

**低风险**
5. **防抖延迟数据丢失** (风险等级: 🟢 低)
   - **问题**: 浏览器崩溃时500ms内数据未持久化
   - **缓解措施**: visibilitychange/beforeunload强制写入
   - **验证**: 浏览器崩溃模拟测试

### 性能基准目标

**当前性能 (生产环境, 4G网络)**
- FCP (First Contentful Paint): 5.2s
- LCP (Largest Contentful Paint): 6.1s
- TTI (Time to Interactive): 7.3s
- Total Bundle Size: 1.2MB (未压缩), 380KB (gzipped)

**优化后目标**
- FCP: < 2.0s (提升61%)
- LCP: < 2.5s (提升59%)
- TTI: < 3.0s (提升59%)
- Total Bundle Size: < 800KB (未压缩), < 250KB (gzipped)
- 首屏chunk: < 150KB (当前约300KB)

**测试环境配置**
- 网络: 模拟3G Fast (1.6Mbps下载, 750Kbps上传, 150ms延迟)
- 设备: CPU 4x slowdown (模拟中端手机)
- 工具: Lighthouse CI + Playwright Performance API

### 依赖关系图

```
Task 1 (构建优化) ──┐
                    ├──> Task 4 (E2E验证)
Task 2 (数据修复) ──┤
                    │
Task 3 (性能监控) ──┘
     ↑
     └── 依赖 Task 2 (需要先修复数据加载)
```

**并行执行策略**
- **第一阶段 (并行)**: Task 1 + Task 2 同时开发
- **第二阶段 (串行)**: Task 3 等待 Task 2 完成
- **第三阶段 (验证)**: Task 4 等待 1+2+3 全部完成

**预计时间线**
- Task 1: 4-6小时 (构建配置 + 测试)
- Task 2: 6-8小时 (核心逻辑修复 + 边界测试)
- Task 3: 3-4小时 (工具类开发 + 集成)
- Task 4: 4-5小时 (E2E测试编写 + 性能基准)
- **总计**: 17-23小时 (考虑并行执行，实际约12-15小时)

### 回滚计划

**如果优化后性能变差或引入新bug:**
1. **立即回滚**: 恢复`vite.config.ts`和`index.tsx`至修复前版本
2. **数据保护**: localStorage保留双版本 (v1/v2), 回滚读取v1
3. **监控告警**: 性能劣化>10%自动触发告警
4. **A/B测试**: 灰度发布10%用户验证稳定性

### 后续优化方向

**短期 (1-2周内)**
- 引入Service Worker实现离线缓存
- 实施图片懒加载和CDN加速
- 优化React渲染性能 (React.memo, useMemo)

**中期 (1-2个月)**
- 迁移至IndexedDB处理大数据量 (>10MB)
- 引入React Query或SWR库简化数据同步
- 实施代码压缩和Tree Shaking优化

**长期 (季度规划)**
- 微前端架构拆分 (报销/借款独立模块)
- SSR/SSG提升首屏渲染速度
- 实施CDN边缘计算优化全球访问
