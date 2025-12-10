import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E测试配置
 * 用于验证性能优化和数据持久化修复
 */
export default defineConfig({
  testDir: './tests/e2e',

  // 超时配置
  timeout: 30 * 1000, // 单个测试30秒超时
  expect: {
    timeout: 5000, // expect断言5秒超时
  },

  // 失败重试
  retries: process.env.CI ? 2 : 0,

  // 并发配置
  workers: process.env.CI ? 1 : undefined,

  // 报告配置
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  // 全局配置
  use: {
    // 基础URL
    baseURL: 'http://localhost:5173',

    // 截图配置
    screenshot: 'only-on-failure',

    // 视频配置
    video: 'retain-on-failure',

    // 追踪配置
    trace: 'on-first-retry',

    // 浏览器配置
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // 导航超时
    navigationTimeout: 10000,
  },

  // 测试项目配置
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // 性能测试专用配置(模拟慢速网络)
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        // 模拟3G Fast网络
        launchOptions: {
          args: [
            '--enable-features=NetworkService',
            '--force-fieldtrials=NetworkService/Enabled',
          ],
        },
      },
      testMatch: '**/performance.spec.ts',
    },

    // 移动端测试(可选)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // 开发服务器配置
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2分钟启动超时
  },
});
