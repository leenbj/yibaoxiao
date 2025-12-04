/**
 * 易报销系统 - 应用Logo组件
 * SVG图标,带对勾的圆角矩形
 */

interface AppLogoProps {
  className?: string;
}

/**
 * 应用Logo组件
 *
 * 使用内联SVG渲染品牌logo,支持自定义尺寸
 */
export const AppLogo = ({ className = "w-8 h-8" }: AppLogoProps) => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="40" height="40" rx="12" className="fill-indigo-600" />
    <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
