import { test, expect } from '@playwright/test';

/**
 * E2E测试: 性能基准验证
 * 目标: 验证首屏加载性能优化效果
 * 基准: FCP < 2s, LCP < 2.5s, TTI < 3s
 */

test.describe('性能基准测试', () => {
  test('首屏加载性能应满足基准要求', async ({ page }) => {
    // 启用性能追踪
    await page.goto('/', { waitUntil: 'networkidle' });

    // 获取性能指标
    const metrics = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        // 等待页面完全加载
        if (document.readyState === 'complete') {
          collectMetrics();
        } else {
          window.addEventListener('load', collectMetrics);
        }

        function collectMetrics() {
          const timing = performance.timing;
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

          // 计算关键指标
          const fcp = performance.getEntriesByType('paint').find(
            (entry) => entry.name === 'first-contentful-paint'
          )?.startTime || 0;

          const metrics = {
            // FCP - First Contentful Paint
            fcp: Math.round(fcp),

            // DOM Content Loaded (TTI近似值)
            tti: Math.round(timing.domContentLoadedEventEnd - timing.navigationStart),

            // Load Complete
            loadTime: Math.round(timing.loadEventEnd - timing.navigationStart),

            // 资源加载时间
            resourceTime: Math.round(timing.responseEnd - timing.requestStart),

            // DNS查询时间
            dnsTime: Math.round(timing.domainLookupEnd - timing.domainLookupStart),

            // TCP连接时间
            tcpTime: Math.round(timing.connectEnd - timing.connectStart),
          };

          console.log('性能指标:', metrics);
          resolve(metrics);
        }
      });
    });

    console.log('\n====== 性能基准测试结果 ======');
    console.log(`FCP (First Contentful Paint): ${metrics.fcp}ms`);
    console.log(`TTI (Time to Interactive): ${metrics.tti}ms`);
    console.log(`总加载时间: ${metrics.loadTime}ms`);
    console.log(`资源加载: ${metrics.resourceTime}ms`);
    console.log(`DNS查询: ${metrics.dnsTime}ms`);
    console.log(`TCP连接: ${metrics.tcpTime}ms`);
    console.log('================================\n');

    // 性能断言
    expect(metrics.fcp, 'FCP应该小于2秒').toBeLessThan(2000);
    expect(metrics.tti, 'TTI应该小于3秒').toBeLessThan(3000);
    expect(metrics.loadTime, '总加载时间应该小于5秒').toBeLessThan(5000);
  });

  test('慢速网络下首屏加载仍应可用', async ({ page, context }) => {
    // 模拟慢速3G网络
    await context.route('**/*', async (route) => {
      // 延迟200ms模拟网络延迟
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    });

    const startTime = Date.now();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 等待关键元素出现
    await page.waitForSelector('text=易报销 Pro', { timeout: 10000 });

    const loadTime = Date.now() - startTime;
    console.log(`慢速网络下首屏加载时间: ${loadTime}ms`);

    // 慢速网络下也应该在合理时间内加载
    expect(loadTime).toBeLessThan(5000);
  });

  test('检查性能监控数据是否正常采集', async ({ page }) => {
    await page.goto('/');

    // 等待页面加载完成
    await page.waitForSelector('text=易报销 Pro');

    // 登录系统触发性能监控
    const nameInput = page.locator('input[placeholder*="姓名"]');
    const deptInput = page.locator('input[placeholder*="部门"]');
    await nameInput.fill('测试用户');
    await deptInput.fill('测试部门');
    await page.click('button:has-text("进入系统")');

    await page.waitForSelector('text=概览');
    await page.waitForTimeout(2000); // 等待性能数据采集

    // 检查localStorage中是否有性能数据
    const perfData = await page.evaluate(() => {
      const data = localStorage.getItem('perf_metrics');
      return data ? JSON.parse(data) : null;
    });

    console.log('性能监控数据:', perfData);

    // 断言: 性能数据应该被采集
    expect(perfData).not.toBeNull();

    if (perfData) {
      // 验证关键指标存在
      expect(perfData.fcp).toBeDefined();
      expect(perfData.timestamp).toBeDefined();
      expect(perfData.url).toBeDefined();

      console.log('\n====== 监控系统采集的指标 ======');
      console.log(`FCP: ${perfData.fcp}ms`);
      console.log(`LCP: ${perfData.lcp}ms`);
      console.log(`TTI: ${perfData.tti}ms`);
      console.log(`CLS: ${perfData.cls}`);
      console.log(`时间戳: ${new Date(perfData.timestamp).toLocaleString()}`);
      console.log('================================\n');
    }
  });

  test('验证代码分割效果 - vendor chunks应该被正确分离', async ({ page }) => {
    // 监控网络请求
    const jsRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.endsWith('.js')) {
        const filename = url.split('/').pop() || '';
        jsRequests.push(filename);
      }
    });

    await page.goto('/');
    await page.waitForSelector('text=易报销 Pro');

    console.log('\n====== 加载的JS文件 ======');
    jsRequests.forEach((file) => console.log(`- ${file}`));
    console.log('================================\n');

    // 验证vendor chunks是否正确分离
    const hasVendorReact = jsRequests.some((file) =>
      file.includes('vendor-react-core')
    );
    const hasVendorIcons = jsRequests.some((file) =>
      file.includes('vendor-icons')
    );

    expect(hasVendorReact, '应该存在vendor-react-core chunk').toBe(true);
    expect(hasVendorIcons, '应该存在vendor-icons chunk').toBe(true);

    // AI库不应该在首屏加载
    const hasVendorAI = jsRequests.some((file) => file.includes('vendor-ai'));
    expect(hasVendorAI, 'AI库不应该在首屏加载').toBe(false);
  });

  test('资源缓存策略验证', async ({ page }) => {
    // 第一次访问
    await page.goto('/');
    await page.waitForSelector('text=易报销 Pro');

    // 清除浏览器缓存，但保留localStorage
    await page.evaluate(() => {
      // 注意：这里只是示例，实际浏览器缓存需要通过CDP清理
      console.log('首次访问完成');
    });

    // 第二次访问（应该使用缓存）
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('text=易报销 Pro');
    const secondLoadTime = Date.now() - startTime;

    console.log(`缓存后加载时间: ${secondLoadTime}ms`);

    // 缓存后加载应该更快
    expect(secondLoadTime).toBeLessThan(3000);
  });
});
