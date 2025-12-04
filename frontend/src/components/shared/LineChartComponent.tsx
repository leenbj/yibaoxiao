/**
 * 易报销系统 - 折线图组件
 * SVG折线图,带数据点提示和网格线
 */

interface LineChartComponentProps {
  data: number[];
  labels: string[];
}

/**
 * 折线图组件
 *
 * 功能:
 * - SVG绘制折线图
 * - 渐变填充区域
 * - 数据点悬停提示
 * - Y轴和X轴标签
 * - 网格线辅助
 */
export const LineChartComponent = ({ data, labels }: LineChartComponentProps) => {
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const chartHeight = 100;

    // 计算每个点的位置
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1 || 1)) * 100;
        const y = chartHeight - ((val - min) / range) * chartHeight;
        return { x, y, val };
    });

    // 生成 SVG 路径
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} ${chartHeight} L 0 ${chartHeight} Z`;

    return (
        <div className="relative h-32">
            {/* Y 轴刻度 */}
            <div className="absolute left-0 top-0 bottom-5 w-10 flex flex-col justify-between text-[9px] text-slate-400">
                <span>¥{max.toLocaleString()}</span>
                <span>¥{min.toLocaleString()}</span>
            </div>

            {/* 图表区域 */}
            <div className="ml-10 h-24 relative">
                <svg viewBox={`0 0 100 ${chartHeight}`} className="w-full h-full" preserveAspectRatio="none">
                    {/* 网格线 */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="#f1f5f9" strokeWidth="0.3"/>
                    <line x1="0" y1={chartHeight/2} x2="100" y2={chartHeight/2} stroke="#f1f5f9" strokeWidth="0.3" strokeDasharray="2,2"/>
                    <line x1="0" y1={chartHeight} x2="100" y2={chartHeight} stroke="#f1f5f9" strokeWidth="0.3"/>

                    {/* 填充区域 */}
                    <path d={areaPath} fill="url(#gradient-line)" opacity="0.15"/>

                    {/* 折线 - 细线 */}
                    <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>

                    {/* 渐变定义 */}
                    <defs>
                        <linearGradient id="gradient-line" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
                        </linearGradient>
                    </defs>
                </svg>

                {/* 数据点 - 小圆点 */}
                {points.map((p, i) => (
                    <div
                        key={i}
                        className="absolute w-1.5 h-1.5 bg-indigo-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer hover:scale-150 transition-transform"
                        style={{
                            left: `${p.x}%`,
                            top: `${(p.y / chartHeight) * 100}%`
                        }}
                    >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded transition-opacity pointer-events-none whitespace-nowrap z-10">
                            ¥{p.val.toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>

            {/* X 轴标签 */}
            <div className="ml-10 flex justify-between text-[9px] text-slate-400 mt-0.5">
                {labels.map((label, i) => (
                    <span key={i} className="text-center" style={{ width: `${100 / labels.length}%` }}>{label}</span>
                ))}
            </div>
        </div>
    );
};
