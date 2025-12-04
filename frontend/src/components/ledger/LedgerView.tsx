/**
 * 易报销系统 - 账本视图
 * 费用记录的表格展示和管理
 */

import { useState } from 'react';
import { Briefcase, Trash2, ChevronRight } from 'lucide-react';
import type { LedgerViewProps, ExpenseStatus } from '../../types';
import { formatDateTime } from '../../utils/format';

/**
 * 账本视图组件
 *
 * 功能:
 * - 表格展示所有费用记录
 * - 多选删除
 * - 状态更新(未报销/报销中/已报销)
 * - 空状态提示
 */
export const LedgerView = ({ expenses, setExpenses }: LedgerViewProps) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const handleDelete = () => {
        if(confirm(`确定删除选中的 ${selectedIds.length} 条记录吗？`)) {
            setExpenses((prev: any[]) => prev.filter(e => !selectedIds.includes(e.id)));
            setSelectedIds([]);
        }
    }

    const updateStatus = (id: string, newStatus: ExpenseStatus) => {
        setExpenses((prev: any[]) => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    const getStatusStyle = (status: ExpenseStatus) => {
        switch(status) {
            case 'pending': return 'bg-slate-100 text-slate-500 border-slate-200';
            case 'processing': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'done': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            default: return 'bg-white text-slate-600 border-slate-200';
        }
    };

    return (
        <div className="space-y-3 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Briefcase size={18} className="text-slate-600"/> 记账本</h2>
                {selectedIds.length > 0 && (
                    <button onClick={handleDelete} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 hover:bg-red-100">
                        <Trash2 size={14}/> 删除 ({selectedIds.length})
                    </button>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-3 py-2.5 w-10 text-center">
                                    <input type="checkbox" className="w-3.5 h-3.5" onChange={(e) => setSelectedIds(e.target.checked ? expenses.map((e:any) => e.id) : [])} checked={selectedIds.length === expenses.length && expenses.length > 0} />
                                </th>
                                <th className="px-3 py-2.5 w-28">日期</th>
                                <th className="px-3 py-2.5">描述</th>
                                <th className="px-3 py-2.5 w-20">分类</th>
                                <th className="px-3 py-2.5 text-right w-24">金额</th>
                                <th className="px-3 py-2.5 text-center w-24">状态</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {expenses.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm">暂无记录</td></tr>
                            )}
                            {expenses.map((e: any) => (
                                <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-3 py-2 text-center">
                                        <input type="checkbox" className="w-3.5 h-3.5" checked={selectedIds.includes(e.id)} onChange={() => toggleSelect(e.id)} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{formatDateTime(e.date)}</td>
                                    <td className="px-3 py-2">
                                        <div className="text-sm font-medium text-slate-700 leading-tight">{e.description}</div>
                                        {e.remarks && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{e.remarks}</div>}
                                    </td>
                                    <td className="px-3 py-2"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-600">{e.category}</span></td>
                                    <td className="px-3 py-2 text-right text-sm font-semibold text-slate-800">¥{e.amount.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-center">
                                        <div className="relative inline-block">
                                            <select
                                                value={e.status}
                                                onChange={(ev) => updateStatus(e.id, ev.target.value as ExpenseStatus)}
                                                className={`appearance-none pl-2 pr-6 py-1 rounded-md text-xs font-medium border outline-none cursor-pointer transition-colors ${getStatusStyle(e.status)}`}
                                            >
                                                <option value="pending">未报销</option>
                                                <option value="processing">报销中</option>
                                                <option value="done">已报销</option>
                                            </select>
                                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                                <ChevronRight size={12} className="rotate-90" />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
