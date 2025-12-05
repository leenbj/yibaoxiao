/**
 * 易报销系统 - 借款单详情页面
 * 用于查看、编辑和导出借款单及其附件
 */

import React, { useState, useRef, useEffect } from 'react';
import { Download, Save, ChevronRight, ChevronLeft, Edit2 } from 'lucide-react';
import { digitToChinese } from '../../utils/format';
import { LoanFormSheet } from './LoanFormSheet';
import { A4SingleAttachment } from '../shared/A4SingleAttachment';

interface LoanDetailViewProps {
    loan: any;
    onUpdate: (loan: any) => void;
    onBack: () => void;
    autoPrint?: boolean;
    onPrintDone?: () => void;
}

/**
 * 借款单详情视图组件
 *
 * 功能:
 * - 左侧编辑面板: 编辑借款单信息 (金额、事由、审批编号、日期等)
 * - 右侧预览区: 显示双联借款单 (财务留存联+员工留存联) 和附件
 * - PDF导出: 使用浏览器原生打印功能保存PDF
 * - 伸缩编辑面板: 点击按钮折叠/展开左侧编辑区
 * - 实时预览: 编辑时左侧同步更新右侧预览
 */
export const LoanDetailView = ({ loan, onUpdate, onBack, autoPrint = false, onPrintDone }: LoanDetailViewProps) => {
    const [editData, setEditData] = useState({ ...loan });
    const canEdit = loan.status !== 'paid';
    const [editPanelCollapsed, setEditPanelCollapsed] = useState(false);

    // 自动打印功能 - 使用浏览器原生打印
    useEffect(() => {
        if (autoPrint) {
            const timer = setTimeout(() => {
                handlePrint();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoPrint]);

    const handleSave = () => {
        if (onUpdate) {
            onUpdate(editData);
            alert('保存成功！');
        }
    };

    // 使用浏览器原生打印功能
    const handlePrint = () => {
        const printContent = document.getElementById('loan-print-content');
        if (!printContent) {
            console.error('打印内容元素未找到');
            if (onPrintDone) onPrintDone();
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('无法打开打印窗口，请允许弹窗');
            if (onPrintDone) onPrintDone();
            return;
        }

        // 获取所有样式
        const styleSheets = Array.from(document.styleSheets)
            .map(sheet => {
                try {
                    return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
                } catch {
                    return '';
                }
            })
            .join('\n');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>借款单打印</title>
                <style>
                    ${styleSheets}
                    
                    /* 打印样式 */
                    @media print {
                        @page landscape-page { size: A4 landscape; margin: 0; }
                        @page portrait-page { size: A4 portrait; margin: 0; }
                        
                        body { margin: 0; padding: 0; }
                        
                        .landscape-page { 
                            page: landscape-page; 
                            width: 297mm;
                            height: 210mm;
                            padding: 5mm;
                            box-sizing: border-box;
                        }
                        .portrait-page { 
                            page: portrait-page; 
                            width: 210mm;
                            height: 297mm;
                            padding: 10mm;
                            box-sizing: border-box;
                        }
                        
                        .print-page + .print-page {
                            page-break-before: always;
                        }
                        .print-page {
                            page-break-inside: avoid;
                        }
                    }
                    
                    /* 屏幕预览样式 */
                    @media screen {
                        body { background: #f1f5f9; padding: 20px; }
                        .print-page { 
                            background: white; 
                            margin-bottom: 20px; 
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        }
                        .landscape-page {
                            width: 297mm;
                            min-height: 210mm;
                            padding: 5mm;
                            box-sizing: border-box;
                        }
                        .portrait-page {
                            width: 210mm;
                            min-height: 297mm;
                            padding: 10mm;
                            box-sizing: border-box;
                        }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        
        // 等待内容加载后打印
        printWindow.onload = () => {
            printWindow.print();
        };
        
        // 使用 matchMedia 监听打印状态变化
        const mediaQueryList = printWindow.matchMedia('print');
        let isPrinting = false;
        
        const handlePrintChange = (mql: MediaQueryListEvent | MediaQueryList) => {
            if (mql.matches) {
                isPrinting = true;
            } else if (isPrinting) {
                // 打印对话框关闭
                printWindow.close();
                if (onPrintDone) onPrintDone();
            }
        };
        
        if (mediaQueryList.addEventListener) {
            mediaQueryList.addEventListener('change', handlePrintChange);
        }
        
        // 备用方案：监听 afterprint 事件
        printWindow.onafterprint = () => {
            printWindow.close();
            if (onPrintDone) onPrintDone();
        };
        
        // 最后的备用：定期检查窗口是否关闭
        const checkInterval = setInterval(() => {
            if (printWindow.closed) {
                clearInterval(checkInterval);
                if (onPrintDone) onPrintDone();
            }
        }, 200);
        
        // 超时保护：30秒后停止检查
        setTimeout(() => {
            clearInterval(checkInterval);
        }, 30000);
    };

    const attachments = editData.attachments || [];

    return (
        <div className="h-full flex flex-col bg-slate-100 -m-8">
            {/* 工具栏 */}
            <div className="bg-white p-4 flex justify-between items-center shadow-sm print:hidden">
                <button onClick={onBack} className="flex items-center gap-1 font-bold text-slate-500">
                    <ChevronRight className="rotate-180"/> 返回
                </button>
                <div className="flex gap-2">
                    {canEdit && (
                        <button onClick={handleSave} className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg font-medium text-sm flex items-center gap-1.5 hover:bg-slate-50">
                            <Save size={14}/> 保存
                        </button>
                    )}
                    <button
                        onClick={handlePrint}
                        className="px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 hover:bg-amber-600"
                    >
                        <Download size={14}/> 保存 PDF
                    </button>
                </div>
            </div>

            {/* 主内容区域 */}
            <div className="flex-1 overflow-hidden flex relative">
                {/* 伸缩按钮 */}
                {canEdit && (
                    <button
                        onClick={() => setEditPanelCollapsed(!editPanelCollapsed)}
                        className={`absolute top-8 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all z-50 ${editPanelCollapsed ? 'left-0 -translate-x-1/2' : 'left-80 -translate-x-1/2'}`}
                        style={{ transition: 'left 0.3s ease' }}
                        title={editPanelCollapsed ? "展开编辑面板" : "收起编辑面板"}
                    >
                        {editPanelCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                )}

                {/* 左侧编辑面板 */}
                {canEdit && (
                    <div className={`bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 transition-all duration-300 print:hidden ${editPanelCollapsed ? 'w-0 overflow-hidden' : 'w-80'}`}>
                        {!editPanelCollapsed && (
                            <div className="p-4 space-y-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Edit2 size={16} className="text-amber-500"/> 编辑借款信息
                                </h3>

                                {/* 借款金额 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">借款金额</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                                        <input
                                            type="number"
                                            value={editData.amount || 0}
                                            onChange={e => setEditData({...editData, amount: parseFloat(e.target.value) || 0})}
                                            className="w-full pl-7 p-2 border border-slate-200 rounded-lg font-bold text-lg text-amber-600"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 bg-slate-50 p-1 rounded">
                                        大写：{digitToChinese(editData.amount || 0)}
                                    </p>
                                </div>

                                {/* 借款事由 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">借款事由</label>
                                    <textarea
                                        value={editData.reason || ''}
                                        onChange={e => setEditData({...editData, reason: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm resize-none"
                                        rows={2}
                                    />
                                </div>

                                {/* 审批单编号 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">审批单编号</label>
                                    <input
                                        value={editData.approvalNumber || ''}
                                        onChange={e => setEditData({...editData, approvalNumber: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>

                                {/* 申请日期 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">申请日期</label>
                                    <input
                                        type="date"
                                        value={editData.date || new Date().toISOString().split('T')[0]}
                                        onChange={e => setEditData({...editData, date: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 右侧预览区 */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-100 print:hidden">
                    <div className="max-w-[310mm] mx-auto space-y-8">
                        {/* 第一联：财务留存联 */}
                        <div className="bg-white shadow-lg">
                            <LoanFormSheet data={editData} copyType="财务留存联" />
                        </div>

                        {/* 第二联：员工留存联 */}
                        <div className="bg-white shadow-lg">
                            <LoanFormSheet data={editData} copyType="员工留存联" />
                        </div>

                        {/* 附件预览 */}
                        {attachments.map((attachment: any, index: number) => (
                            <div key={index} className="bg-white shadow-lg">
                                <A4SingleAttachment attachment={attachment} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 打印专用内容 - 屏幕上隐藏 */}
            <div id="loan-print-content" className="hidden">
                {/* 第一联：财务留存联 - 横版A4 */}
                <div className="landscape-page print-page">
                    <LoanFormSheet data={editData} copyType="财务留存联" />
                </div>

                {/* 第二联：员工留存联 - 横版A4 */}
                <div className="landscape-page print-page">
                    <LoanFormSheet data={editData} copyType="员工留存联" />
                </div>

                {/* 附件 - 竖版A4 */}
                {attachments.map((attachment: any, index: number) => (
                    <div key={index} className="portrait-page print-page">
                        <A4SingleAttachment attachment={attachment} />
                    </div>
                ))}
            </div>
        </div>
    );
};
