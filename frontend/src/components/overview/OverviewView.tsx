/**
 * 易报销系统 - 概览视图
 * 首页仪表盘,显示关键指标和最新记录
 */

import { useState } from 'react';
import { FileText, Clock, Wallet, Coins, Briefcase } from 'lucide-react';
import type { OverviewViewProps } from '../../types';
import { formatDate, formatDateTime } from '../../utils/format';
import { LineChartComponent } from '../shared/LineChartComponent';

/**
 * 概览视图组件
 *
 * 功能:
 * - 3个关键指标卡片(待报销金额、借款金额、预计收款)
 * - 报销金额统计图表(3月/半年/全年切换)
 * - 记账本最新记录(最多4条)
 * - 报销历史最新记录(最多4条)
 */
export const OverviewView = ({ expenses, reports, loans, onNavigate }: OverviewViewProps) => {
    const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y'>('6m');

    // 1. Pending Reimbursement: Reports (Submitted) + Expenses (Pending)
    const submittedReportsAmount = reports.filter((r:any) => r.status === 'submitted').reduce((acc:number, cur:any) => acc + cur.payableAmount, 0);
    const pendingExpensesAmount = expenses.filter((e:any) => e.status === 'pending').reduce((acc:number, cur:any) => acc + cur.amount, 0);
    const totalPending = submittedReportsAmount + pendingExpensesAmount;

    // 2. Loan Amount: Loans (Draft + Submitted)
    const activeLoanAmount = loans.filter((l:any) => l.status !== 'paid').reduce((acc:number, cur:any) => acc + cur.amount, 0);

    // 3. Total Receivable
    const totalReceivable = totalPending - activeLoanAmount;

    // Chart Data based on real reports data
    const getChartData = () => {
        const now = new Date();
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

        // 确定时间范围
        let monthCount = 6;
        if (timeRange === '3m') monthCount = 3;
        if (timeRange === '1y') monthCount = 12;

        // 生成月份标签和数据
        const labels: string[] = [];
        const data: number[] = [];

        for (let i = monthCount - 1; i >= 0; i--) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const targetMonth = targetDate.getMonth();
            const targetYear = targetDate.getFullYear();

            labels.push(monthNames[targetMonth]);

            // 计算该月的报销金额
            const monthTotal = reports.filter((r: any) => {
                const reportDate = new Date(r.createdDate);
                return reportDate.getMonth() === targetMonth &&
                       reportDate.getFullYear() === targetYear &&
                       (r.status === 'submitted' || r.status === 'paid');
            }).reduce((sum: number, r: any) => sum + (r.totalAmount || 0), 0);

            data.push(monthTotal);
        }

        return { data, labels };
    };
    const chartData = getChartData();

    return (
        <div className="space-y-8">
            {/* 3 Main Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <FileText size={80} className="text-slate-700"/>
                    </div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">待报销金额</p>
                    <h3 className="text-3xl font-bold text-slate-700">¥{totalPending.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                        <span className="flex items-center text-orange-500"><Clock size={12} className="mr-1"/>包含未提交费用</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                     <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Wallet size={80} className="text-amber-500"/>
                    </div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">借款金额</p>
                    <h3 className="text-3xl font-bold text-amber-500">¥{activeLoanAmount.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                        <span className="flex items-center text-slate-500">审批中或未发放</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-lg shadow-emerald-100 relative overflow-hidden">
                     <div className="absolute right-0 top-0 p-4 opacity-10">
                        <Coins size={80} className="text-white"/>
                    </div>
                    <p className="text-emerald-100 text-sm font-bold uppercase tracking-wider mb-2">预计收款总额</p>
                    <h3 className="text-3xl font-bold">¥{totalReceivable.toLocaleString()}</h3>
                    <p className="text-xs text-emerald-100 mt-4 opacity-80">(待报销金额 - 借款金额)</p>
                </div>
            </div>

            {/* Annual Chart */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-slate-800 text-sm">报销金额统计</h3>
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        {['3m', '6m', '1y'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setTimeRange(t as any)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${timeRange === t ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {{'3m': '近3月', '6m': '近半年', '1y': '全年'}[t]}
                            </button>
                        ))}
                    </div>
                </div>
                <LineChartComponent data={chartData.data} labels={chartData.labels}/>
            </div>

            {/* 记账本和报销历史 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 记账本最新记录 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <Briefcase size={14} className="text-slate-600"/>
                            记账本
                        </h3>
                        <button
                            onClick={() => onNavigate('ledger')}
                            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            查看全部 →
                        </button>
                    </div>
                    <div className="space-y-2">
                        {expenses.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">暂无记录</p>
                        ) : (
                            expenses.slice(0, 4).map((e: any) => (
                                <div key={e.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{e.description}</p>
                                        <p className="text-[10px] text-slate-400">{formatDateTime(e.date)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                        <span className="text-xs font-semibold text-slate-700">¥{e.amount.toFixed(2)}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                            e.status === 'done' ? 'bg-green-100 text-green-600' :
                                            e.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>
                                            {e.status === 'done' ? '已报销' : e.status === 'processing' ? '报销中' : '未报销'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 报销历史最新记录 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <FileText size={14} className="text-slate-600"/>
                            报销历史
                        </h3>
                        <button
                            onClick={() => onNavigate('history')}
                            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            查看全部 →
                        </button>
                    </div>
                    <div className="space-y-2">
                        {reports.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">暂无报销记录</p>
                        ) : (
                            reports.slice(0, 4).map((r: any) => (
                                <div key={r.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{r.title || '费用报销'}</p>
                                        <p className="text-[10px] text-slate-400">{formatDate(r.createdDate)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                        <span className="text-xs font-semibold text-slate-700">¥{(r.totalAmount || 0).toFixed(2)}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                            r.status === 'paid' ? 'bg-green-100 text-green-600' :
                                            r.status === 'submitted' ? 'bg-blue-100 text-blue-600' :
                                            'bg-yellow-100 text-yellow-600'
                                        }`}>
                                            {r.status === 'paid' ? '已完成' : r.status === 'submitted' ? '报销中' : '未打印'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
