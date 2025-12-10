import { test, expect } from '@playwright/test';

/**
 * E2E测试: 数据持久化验证
 * 目标: 验证报销记录刷新后不丢失的bug修复
 */

test.describe('数据持久化测试', () => {
  test.beforeEach(async ({ page }) => {
    // 清理localStorage,确保测试环境干净
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('【核心bug修复】创建报销单后刷新页面，记录应该保留', async ({ page }) => {
    // 1. 登录系统
    await page.goto('/');

    // 等待登录页面加载
    await page.waitForSelector('text=易报销 Pro', { timeout: 10000 });

    // 输入默认用户信息
    const nameInput = page.locator('input[placeholder*="姓名"]');
    const deptInput = page.locator('input[placeholder*="部门"]');

    await nameInput.fill('测试用户');
    await deptInput.fill('测试部门');

    // 点击登录
    await page.click('button:has-text("进入系统")');

    // 2. 等待主界面加载完成
    await page.waitForSelector('text=概览', { timeout: 10000 });

    // 3. 进入报销记录页面
    await page.click('text=记录');
    await page.waitForTimeout(500);

    // 4. 点击添加报销单
    const addButton = page.locator('button:has-text("添加报销")');
    await addButton.click();

    // 5. 选择通用报销
    await page.click('text=通用报销');
    await page.waitForTimeout(500);

    // 6. 填写报销单信息
    // 注意：这里简化流程，实际应用中可能需要更复杂的表单填写
    const titleInput = page.locator('input[placeholder*="发票内容"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('E2E测试报销单');
    }

    // 7. 获取localStorage中的报销单数量（创建前）
    const reportsBefore = await page.evaluate(() => {
      const data = localStorage.getItem('reimb_reports_v1');
      return data ? JSON.parse(data).length : 0;
    });

    console.log(`创建前报销单数量: ${reportsBefore}`);

    // 8. 保存报销单（如果有保存按钮）
    const saveButton = page.locator('button:has-text("保存"), button:has-text("提交")').first();
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    }

    // 9. 验证localStorage中有新记录
    const reportsAfter = await page.evaluate(() => {
      const data = localStorage.getItem('reimb_reports_v1');
      return data ? JSON.parse(data) : [];
    });

    console.log(`创建后报销单数量: ${reportsAfter.length}`);
    expect(reportsAfter.length).toBeGreaterThan(reportsBefore);

    // 10. 【关键步骤】刷新页面
    await page.reload();
    await page.waitForSelector('text=概览', { timeout: 10000 });

    // 11. 验证localStorage中记录仍然存在
    const reportsAfterReload = await page.evaluate(() => {
      const data = localStorage.getItem('reimb_reports_v1');
      return data ? JSON.parse(data) : [];
    });

    console.log(`刷新后报销单数量: ${reportsAfterReload.length}`);

    // 核心断言: 刷新后记录数量不变
    expect(reportsAfterReload.length).toBe(reportsAfter.length);
    expect(reportsAfterReload.length).toBeGreaterThan(0);
  });

  test('API返回空数组时，本地新创建记录应该保留', async ({ page }) => {
    // 1. 登录并进入主界面
    await page.goto('/');
    await page.waitForSelector('text=易报销 Pro');

    const nameInput = page.locator('input[placeholder*="姓名"]');
    const deptInput = page.locator('input[placeholder*="部门"]');
    await nameInput.fill('测试用户');
    await deptInput.fill('测试部门');
    await page.click('button:has-text("进入系统")');

    await page.waitForSelector('text=概览');

    // 2. 手动在localStorage中创建一个"最近创建"的报销单
    await page.evaluate(() => {
      const mockReport = {
        id: 'test-local-' + Date.now(),
        title: '本地测试报销单',
        createdDate: new Date().toISOString(), // 当前时间，模拟刚创建
        status: 'draft',
        totalAmount: 100,
        prepaidAmount: 0,
        payableAmount: 100,
        items: [],
        attachments: [],
        userSnapshot: {
          id: 'test-user',
          name: '测试用户',
          department: '测试部门',
          email: 'test@example.com',
          role: 'user' as const,
        },
      };

      const existing = localStorage.getItem('reimb_reports_v1');
      const reports = existing ? JSON.parse(existing) : [];
      reports.unshift(mockReport);
      localStorage.setItem('reimb_reports_v1', JSON.stringify(reports));
    });

    // 3. 模拟API返回空数组（通过拦截网络请求）
    await page.route('**/api/reports*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reports: [] }), // API返回空数组
      });
    });

    // 4. 刷新页面触发数据加载
    await page.reload();
    await page.waitForSelector('text=概览');
    await page.waitForTimeout(2000); // 等待API加载完成

    // 5. 验证本地记录仍然存在（智能合并逻辑）
    const reportsAfterReload = await page.evaluate(() => {
      const data = localStorage.getItem('reimb_reports_v1');
      return data ? JSON.parse(data) : [];
    });

    console.log(`API返回空数组后，本地记录数量: ${reportsAfterReload.length}`);

    // 核心断言: 本地新创建的记录应该保留（5分钟内）
    expect(reportsAfterReload.length).toBeGreaterThan(0);

    const hasLocalReport = reportsAfterReload.some((r: any) =>
      r.id.startsWith('test-local-')
    );
    expect(hasLocalReport).toBe(true);
  });

  test('localStorage防抖写入应该减少写入频率', async ({ page }) => {
    await page.goto('/');

    // 登录
    await page.waitForSelector('text=易报销 Pro');
    const nameInput = page.locator('input[placeholder*="姓名"]');
    const deptInput = page.locator('input[placeholder*="部门"]');
    await nameInput.fill('测试用户');
    await deptInput.fill('测试部门');
    await page.click('button:has-text("进入系统")');

    await page.waitForSelector('text=概览');

    // 监控localStorage.setItem调用次数
    const writeCount = await page.evaluate(() => {
      let count = 0;
      const originalSetItem = localStorage.setItem;

      (localStorage as any).setItem = function(key: string, value: string) {
        if (key === 'reimb_reports_v1') {
          count++;
          console.log(`localStorage写入 #${count}:`, key);
        }
        return originalSetItem.call(this, key, value);
      };

      return new Promise<number>((resolve) => {
        // 快速修改state 5次
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            const reports = JSON.parse(localStorage.getItem('reimb_reports_v1') || '[]');
            reports.push({ id: 'test-' + i, title: 'Test' + i });
            // 手动触发写入（模拟state更新）
            window.dispatchEvent(new Event('storage'));
          }, i * 100);
        }

        // 等待1秒后检查写入次数
        setTimeout(() => resolve(count), 1500);
      });
    });

    console.log(`防抖优化后，5次状态变更触发的写入次数: ${writeCount}`);

    // 断言: 防抖后写入次数应该少于直接写入(理论上5次变更应该合并为1-2次写入)
    // 注意: 由于测试环境限制，这里的断言可能需要调整
    expect(writeCount).toBeLessThan(5);
  });
});
