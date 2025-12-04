/**
 * 易报销系统 - 历史记录视图
 * 显示报销单和借款单的历史记录列表
 */

import { useState } from 'react';
import { Eye, CheckCircle, Trash2 } from 'lucide-react';
import type { HistoryViewProps } from '../../types';
import { formatDate } from '../../utils/format';
import { StatusBadge } from '../shared/StatusBadge';

/**
 * 历史记录视图组件
 *
 * 功能:
 * - 双标签页切换(报销单/借款单)
 * - 列表展示历史记录
 * - 查看/编辑、完成、删除操作
 * - 空状态提示
 */
export const HistoryView = ({ reports, loans, onDelete, onComplete, onSelect }: HistoryViewProps) => {
    const [tab, setTab] = useState<'report'|'loan'>('report');
    const items = tab === 'report' ? reports : loans;

    return (
        <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">历史记录</h2>
            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button onClick={() => setTab('report')} className={`pb-2 px-4 font-bold ${tab === 'report' ? 'text-slate-700 border-b-2 border-indigo-600' : 'text-slate-400'}`}>报销单</button>
                <button onClick={() => setTab('loan')} className={`pb-2 px-4 font-bold ${tab === 'loan' ? 'text-slate-700 border-b-2 border-indigo-600' : 'text-slate-400'}`}>借款单</button>
            </div>
            <div className="space-y-4">
                {items.map((item: any) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={item.status} type={tab} />
                                <span className="font-bold text-slate-800">{item.title || item.reason || '无标题'}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">{formatDate(item.createdDate || item.date)} · ¥{item.totalAmount || item.amount}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => onSelect(item.id, tab)} className="p-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-indigo-100" title="查看/编辑"><Eye size={16}/></button>
                            {item.status !== 'paid' && <button onClick={() => onComplete(item.id, tab)} className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100" title="完成报销"><CheckCircle size={16}/></button>}
                            <button onClick={() => onDelete(item.id, tab)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100" title="删除"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
                {items.length === 0 && <div className="text-center text-slate-400 py-12">暂无记录</div>}
            </div>
        </div>
    );
};
