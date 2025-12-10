/**
 * 性能监控工具 - Web Vitals 埋点
 * 监控FCP(首次内容绘制)、LCP(最大内容绘制)、TTI(可交互时间)
 */

export interface PerformanceMetrics {
  fcp?: number;  // First Contentful Paint (ms)
  lcp?: number;  // Largest Contentful Paint (ms)
  tti?: number;  // Time to Interactive (ms)
  cls?: number;  // Cumulative Layout Shift
  fid?: number;  // First Input Delay (ms)
}

/**
 * 性能数据上报回调
 */
export type PerformanceReporter = (metrics: PerformanceMetrics) => void;

/**
 * 获取FCP (First Contentful Paint)
 */
const getFCP = (): number | undefined => {
  if (!('PerformanceObserver' in window)) return undefined;

  try {
    const entries = performance.getEntriesByType('paint');
    const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
    return fcpEntry ? Math.round(fcpEntry.startTime) : undefined;
  } catch (error) {
    console.warn('[性能监控] FCP获取失败:', error);
    return undefined;
  }
};

/**
 * 获取LCP (Largest Contentful Paint)
 */
const getLCP = (callback: (value: number) => void): void => {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };

      // LCP时间取renderTime或loadTime
      const lcpTime = lastEntry.renderTime || lastEntry.loadTime || lastEntry.startTime;
      callback(Math.round(lcpTime));
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (error) {
    console.warn('[性能监控] LCP监控失败:', error);
  }
};

/**
 * 获取TTI (Time to Interactive) - 近似值
 * 使用domContentLoadedEventEnd作为TTI的近似值
 */
const getTTI = (): number | undefined => {
  try {
    const timing = performance.timing;
    if (!timing.domContentLoadedEventEnd || !timing.navigationStart) {
      return undefined;
    }

    return Math.round(timing.domContentLoadedEventEnd - timing.navigationStart);
  } catch (error) {
    console.warn('[性能监控] TTI获取失败:', error);
    return undefined;
  }
};

/**
 * 获取CLS (Cumulative Layout Shift)
 */
const getCLS = (callback: (value: number) => void): void => {
  if (!('PerformanceObserver' in window)) return;

  try {
    let clsValue = 0;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          callback(Number(clsValue.toFixed(4)));
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });
  } catch (error) {
    console.warn('[性能监控] CLS监控失败:', error);
  }
};

/**
 * 获取FID (First Input Delay)
 */
const getFID = (callback: (value: number) => void): void => {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstInput = entries[0] as PerformanceEntry & { processingStart?: number };

      if (firstInput && firstInput.processingStart) {
        const fid = Math.round(firstInput.processingStart - firstInput.startTime);
        callback(fid);
        observer.disconnect();
      }
    });

    observer.observe({ type: 'first-input', buffered: true });
  } catch (error) {
    console.warn('[性能监控] FID监控失败:', error);
  }
};

/**
 * 初始化性能监控
 * @param reporter 性能数据上报回调函数
 */
export const initPerformanceMonitoring = (reporter: PerformanceReporter): void => {
  const metrics: PerformanceMetrics = {};

  // 页面加载完成后采集FCP和TTI
  if (document.readyState === 'complete') {
    collectInitialMetrics();
  } else {
    window.addEventListener('load', collectInitialMetrics);
  }

  function collectInitialMetrics() {
    // 采集FCP
    const fcp = getFCP();
    if (fcp !== undefined) {
      metrics.fcp = fcp;
      console.log('[性能监控] FCP:', fcp, 'ms');
    }

    // 采集TTI
    const tti = getTTI();
    if (tti !== undefined) {
      metrics.tti = tti;
      console.log('[性能监控] TTI:', tti, 'ms');
    }

    // 延迟上报,等待LCP稳定
    setTimeout(() => {
      reporter(metrics);
    }, 1000);
  }

  // 监控LCP (持续更新)
  getLCP((lcp) => {
    metrics.lcp = lcp;
    console.log('[性能监控] LCP:', lcp, 'ms');
  });

  // 监控CLS
  getCLS((cls) => {
    metrics.cls = cls;
    console.log('[性能监控] CLS:', cls);
  });

  // 监控FID
  getFID((fid) => {
    metrics.fid = fid;
    console.log('[性能监控] FID:', fid, 'ms');
  });

  // 页面卸载时最终上报
  window.addEventListener('beforeunload', () => {
    reporter(metrics);
  });
};

/**
 * 记录自定义性能标记
 * @param name 标记名称
 */
export const markPerformance = (name: string): void => {
  try {
    performance.mark(name);
  } catch (error) {
    console.warn(`[性能监控] 标记失败 ${name}:`, error);
  }
};

/**
 * 测量两个标记之间的时间
 * @param name 测量名称
 * @param startMark 起始标记
 * @param endMark 结束标记
 * @returns 耗时(ms)
 */
export const measurePerformance = (name: string, startMark: string, endMark: string): number | undefined => {
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, 'measure');
    if (entries.length > 0) {
      return Math.round(entries[0].duration);
    }
  } catch (error) {
    console.warn(`[性能监控] 测量失败 ${name}:`, error);
  }
  return undefined;
};
