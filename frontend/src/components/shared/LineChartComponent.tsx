/**
 * 易报销系统 - 折线图组件
 * 美观的SVG折线图,带平滑曲线、数据点提示和动画效果
 */

import { useMemo } from 'react';

interface LineChartComponentProps {
  data: number[];
  labels: string[];
}

/**
 * 折线图组件
 *
 * 功能:
 * - SVG绘制平滑曲线
 * - 渐变填充区域
 * - 数据点悬停提示
 * - Y轴和X轴标签
 * - 网格线辅助
 * - 入场动画
 */
export const LineChartComponent = ({ data, labels }: LineChartComponentProps) => {
    const chartHeight = 120;
    const chartWidth = 100;
    const paddingTop = 10;
    const paddingBottom = 5;
    const effectiveHeight = chartHeight - paddingTop - paddingBottom;

    // 计算数据范围
    const { max, min, range, points, smoothPath, areaPath } = useMemo(() => {
        const maxVal = Math.max(...data, 1);
        const minVal = Math.min(...data, 0);
        const rangeVal = maxVal - minVal || 1;
        
        // 计算每个点的位置
        const pts = data.map((val, i) => {
            const x = data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2;
            const y = paddingTop + effectiveHeight - ((val - minVal) / rangeVal) * effectiveHeight;
            return { x, y, val };
        });

        // 生成平滑曲线路径 (使用贝塞尔曲线)
        const smoothPathStr = pts.length > 0 ? pts.reduce((acc, p, i, arr) => {
            if (i === 0) return `M ${p.x} ${p.y}`;
            
            const prev = arr[i - 1];
            const cpx1 = prev.x + (p.x - prev.x) / 3;
            const cpy1 = prev.y;
            const cpx2 = p.x - (p.x - prev.x) / 3;
            const cpy2 = p.y;
            
            return `${acc} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${p.x} ${p.y}`;
        }, '') : '';

        // 生成填充区域路径
        const areaPathStr = pts.length > 0 
            ? `${smoothPathStr} L ${pts[pts.length - 1]?.x || 0} ${chartHeight} L 0 ${chartHeight} Z`
            : '';

        return {
            max: maxVal,
            min: minVal,
            range: rangeVal,
            points: pts,
            smoothPath: smoothPathStr,
            areaPath: areaPathStr
        };
    }, [data, effectiveHeight]);

    // 生成Y轴刻度
    const yTicks = useMemo(() => {
        const ticks = [];
        const tickCount = 4;
        for (let i = 0; i <= tickCount; i++) {
            const value = min + (range / tickCount) * i;
            const y = paddingTop + effectiveHeight - (i / tickCount) * effectiveHeight;
            ticks.push({ value, y });
        }
        return ticks;
    }, [min, range, effectiveHeight]);

    // 判断是否有数据
    const hasData = data.some(d => d > 0);

    return (
        <div className="relative h-44">
            {/* Y 轴刻度 */}
            <div className="absolute left-0 top-0 bottom-5 w-14 flex flex-col justify-between text-[10px] text-slate-400 font-medium">
                {yTicks.reverse().map((tick, i) => (
                    <span key={i} className="text-right pr-2">
                        ¥{tick.value >= 10000 
                            ? `${(tick.value / 10000).toFixed(1)}万` 
                            : tick.value.toLocaleString()}
                    </span>
                ))}
            </div>

            {/* 图表区域 */}
            <div className="ml-14 h-36 relative">
                <svg 
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                    className="w-full h-full" 
                    preserveAspectRatio="none"
                >
                    {/* 渐变定义 */}
                    <defs>
                        <linearGradient id="chart-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4"/>
                            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.2"/>
                            <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0"/>
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>

                    {/* 水平网格线 */}
                    {yTicks.map((tick, i) => (
                        <line 
                            key={i}
                            x1="0" 
                            y1={tick.y} 
                            x2={chartWidth} 
                            y2={tick.y} 
                            stroke="#e2e8f0" 
                            strokeWidth="0.3"
                            strokeDasharray={i > 0 && i < yTicks.length - 1 ? "2,2" : "0"}
                        />
                    ))}

                    {/* 填充区域 - 带动画 */}
                    {hasData && (
                        <path 
                            d={areaPath} 
                            fill="url(#chart-gradient)"
                            className="animate-[fadeIn_0.5s_ease-out]"
                        />
                    )}

                    {/* 折线 - 细线条 */}
                    {hasData && (
                        <path 
                            d={smoothPath} 
                            fill="none" 
                            stroke="url(#line-gradient)" 
                            strokeWidth="0.8" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="animate-[drawLine_1s_ease-out]"
                        />
                    )}

                    {/* 线条渐变 */}
                    <defs>
                        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#818cf8"/>
                            <stop offset="50%" stopColor="#6366f1"/>
                            <stop offset="100%" stopColor="#4f46e5"/>
                        </linearGradient>
                    </defs>
                </svg>

                {/* 数据点 */}
                {hasData && points.map((p, i) => (
                    <div
                        key={i}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                        style={{
                            left: `${p.x}%`,
                            top: `${(p.y / chartHeight) * 100}%`
                        }}
                    >
                        {/* 外圈光晕 */}
                        <div className="w-4 h-4 bg-indigo-200 rounded-full opacity-0 group-hover:opacity-50 transition-opacity absolute -top-1 -left-1"/>
                        {/* 数据点 */}
                        <div className="w-2 h-2 bg-white border-2 border-indigo-500 rounded-full transition-all group-hover:scale-150 group-hover:border-indigo-600"/>
                        {/* 提示框 */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-20">
                            <div className="bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                                <div className="font-bold">¥{p.val.toLocaleString()}</div>
                                <div className="text-slate-400 text-[10px]">{labels[i]}</div>
                            </div>
                            {/* 小三角 */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"/>
                        </div>
                    </div>
                ))}

                {/* 无数据提示 */}
                {!hasData && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-slate-400 text-sm">暂无报销数据</div>
                    </div>
                )}
            </div>

            {/* X 轴标签 */}
            <div className="ml-14 flex justify-between text-[10px] text-slate-500 font-medium mt-1">
                {labels.map((label, i) => (
                    <span 
                        key={i} 
                        className="text-center transition-colors hover:text-slate-700" 
                        style={{ width: `${100 / labels.length}%` }}
                    >
                        {label}
                    </span>
                ))}
            </div>

            {/* 自定义动画样式 */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes drawLine {
                    from { 
                        stroke-dasharray: 1000;
                        stroke-dashoffset: 1000;
                    }
                    to { 
                        stroke-dasharray: 1000;
                        stroke-dashoffset: 0;
                    }
                }
            `}</style>
        </div>
    );
};
