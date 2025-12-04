/**
 * 易报销系统 - 状态标签组件
 * 用于显示费用、报销单、借款单的状态
 */

interface StatusBadgeProps {
  status: string;
  type: 'expense' | 'report' | 'loan';
}

/**
 * 状态标签组件
 *
 * 根据类型和状态显示不同样式的标签:
 * - expense: 已报销(绿) | 报销中(蓝) | 未报销(灰)
 * - report/loan: 已报销(绿) | 报销中(蓝) | 未打印(黄)
 */
export const StatusBadge = ({ status, type }: StatusBadgeProps) => {
    if (type === 'expense') {
        if (status === 'done') return <span className="px-2 py-1 rounded text-xs font-bold bg-green-50 text-green-600">已报销</span>;
        if (status === 'processing') return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-600">报销中</span>;
        return <span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-400">未报销</span>;
    } else {
        if (status === 'paid') return <span className="px-2 py-1 rounded text-xs font-bold bg-green-50 text-green-600 border border-green-100">已报销</span>;
        if (status === 'submitted') return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">报销中</span>;
        return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-50 text-yellow-600 border border-yellow-100">未打印</span>;
    }
}
