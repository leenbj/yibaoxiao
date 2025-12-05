/**
 * 易报销系统 - 报销单详情页面
 * 用于查看、编辑和导出报销单及其附件
 */

import React, { useState, useRef, useEffect } from 'react';
import { Download, Save, ChevronRight, ChevronLeft, Edit2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { GeneralReimbursementForm } from '../forms/GeneralReimbursementForm';
import { TravelReimbursementForm } from '../forms/TravelReimbursementForm';
import { TaxiExpenseTable } from '../forms/TaxiExpenseTable';
import { A4SingleAttachment } from '../shared/A4SingleAttachment';

interface ReportDetailViewProps {
    report: any;
    onUpdate: (report: any) => void;
    onBack: () => void;
    autoPrint?: boolean;
    onPrintDone?: () => void;
}

/**
 * 报销单详情视图组件
 *
 * 功能:
 * - 左侧编辑面板: 编辑报销单基本信息 (标题、金额、预支、审批编号等)
 * - 右侧预览区: 显示报销单完整内容和所有附件
 * - 多标签预览: 全部 | 报销单 | 发票 | 审批单 | 购物凭证
 * - PDF导出: 生成A4格式PDF,包含报销单、打车明细表、附件
 * - 伸缩编辑面板: 点击按钮折叠/展开左侧编辑区
 */
export const ReportDetailView = ({ report, onUpdate, onBack, autoPrint, onPrintDone }: ReportDetailViewProps) => {
    const [previewMode, setPreviewMode] = useState<'all' | 'report' | 'invoices' | 'approvals' | 'vouchers'>('all');
    const [generating, setGenerating] = useState(false);
    const [editData, setEditData] = useState({
        ...report,
        taxiDetails: report.taxiDetails || []
    });
    const canEdit = report.status !== 'paid';
    const [editPanelCollapsed, setEditPanelCollapsed] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const taxiTableRef = useRef<HTMLDivElement>(null);
    
    // 自动打印功能：当 autoPrint 为 true 时，自动触发打印
    useEffect(() => {
        if (autoPrint && reportRef.current) {
            // 等待 DOM 渲染完成后触发打印
            const timer = setTimeout(() => {
                handlePrint();
                onPrintDone?.();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoPrint]);

    // 分类附件
    const invoiceAttachments = editData.attachments?.filter((a: any) =>
        a.type === 'invoice' || a.name?.includes('发票')
    ) || [];

    const approvalAttachments = editData.attachments?.filter((a: any) =>
        a.type === 'approval' || a.name?.includes('审批')
    ) || [];

    const voucherAttachments = editData.attachments?.filter((a: any) =>
        a.type === 'voucher' || a.name?.includes('凭证')
    ) || [];

    const classifiedIds = new Set([
        ...invoiceAttachments.map((a: any) => a.data),
        ...approvalAttachments.map((a: any) => a.data),
        ...voucherAttachments.map((a: any) => a.data)
    ]);
    const unclassifiedAttachments = editData.attachments?.filter((a: any) =>
        !classifiedIds.has(a.data)
    ) || [];

    const allInvoices = [...invoiceAttachments, ...unclassifiedAttachments];

    const handleSave = () => {
        if (onUpdate) {
            onUpdate(editData);
            alert('保存成功！');
        }
    };

    /**
     * 使用浏览器原生打印功能导出 PDF
     * 
     * 优点：
     * 1. 100% 保持预览效果，不会出现字体压线等问题
     * 2. 报销单和所有附件合并到一个 PDF 文件
     * 3. 使用系统原生渲染，兼容性最好
     * 
     * 使用方法：
     * 用户在打印对话框中选择 "另存为 PDF" 即可
     */
    const handlePrint = () => {
        if (generating) return;
        setGenerating(true);

        try {
            const isTravel = editData.isTravel;
            const orientation = isTravel ? 'portrait' : 'landscape';
            
            // 创建打印窗口
            const printWindow = window.open('', '_blank', 'width=900,height=700');
            if (!printWindow) {
                alert('无法打开打印窗口，请检查浏览器是否阻止了弹窗');
                setGenerating(false);
                return;
            }

            // 构建打印内容的 HTML
            const allAttachments = editData.attachments || [];
            
            // 打印样式 - 支持横版报销单和竖版附件混合
            const printStyles = `
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    
                    /* 定义横版页面（用于通用报销单） */
                    @page landscape-page {
                        size: A4 landscape;
                        margin: 0;
                    }
                    
                    /* 定义竖版页面（用于差旅报销单、打车明细、附件） */
                    @page portrait-page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    
                    @media print {
                        html, body { 
                            margin: 0 !important; 
                            padding: 0 !important;
                            -webkit-print-color-adjust: exact; 
                            print-color-adjust: exact; 
                        }
                        
                        /* 使用 page-break-before 而不是 after，避免最后出现空白页 */
                        .print-page { 
                            page-break-inside: avoid;
                        }
                        .print-page + .print-page {
                            page-break-before: always;
                        }
                        
                        /* 横版页面 */
                        .landscape-page { page: landscape-page; }
                        
                        /* 竖版页面 */
                        .portrait-page { page: portrait-page; }
                    }
                    
                    body {
                        font-family: "SimSun", "Songti SC", serif;
                        background: white;
                    }
                    
                    /* 横版报销单页面 */
                    .print-page.landscape-page {
                        width: 297mm;
                        height: 210mm;
                        background: white;
                        margin: 0 auto;
                        padding: 0;
                        overflow: hidden;
                    }
                    
                    /* 竖版页面（差旅报销单、打车明细、附件） */
                    .print-page.portrait-page {
                        width: 210mm;
                        height: 297mm;
                        background: white;
                        margin: 0 auto;
                        padding: 0;
                        overflow: hidden;
                    }
                    
                    .attachment-page {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 5mm;
                    }
                    
                    .attachment-page img {
                        max-width: 200mm;
                        max-height: 287mm;
                        object-fit: contain;
                    }
                    
                    /* 表格样式 */
                    table { border-collapse: collapse; width: 100%; }
                    td, th { border: 1px solid black; padding: 4px 3px; vertical-align: middle; font-size: 12px; line-height: 1.4; text-align: center; }
                    
                    @media screen {
                        body { background: #f0f0f0; padding: 20px; }
                        .print-page { box-shadow: 0 0 10px rgba(0,0,0,0.2); margin-bottom: 20px; }
                    }
                </style>
            `;

            // 获取报销单 HTML
            const reportHtml = reportRef.current ? reportRef.current.outerHTML : '';
            
            // 获取打车明细表 HTML（如果有）
            const taxiHtml = (editData.isTravel && editData.taxiDetails?.length > 0 && taxiTableRef.current) 
                ? taxiTableRef.current.outerHTML 
                : '';

            // 构建附件页面（全部使用竖版）
            let attachmentsHtml = '';
            allAttachments.forEach((attachment: any, index: number) => {
                if (attachment.data) {
                    attachmentsHtml += `
                        <div class="print-page portrait-page attachment-page">
                            <img src="${attachment.data}" alt="附件 ${index + 1}" />
                        </div>
                    `;
                }
            });

            // 确定报销单页面方向
            // 通用报销单使用横版，差旅报销单使用竖版
            const reportPageClass = isTravel ? 'portrait-page' : 'landscape-page';
            
            // 完整的打印 HTML
            const printHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>报销单_${editData.title || editData.id}</title>
                    ${printStyles}
                </head>
                <body>
                    <div class="print-page ${reportPageClass}">${reportHtml}</div>
                    ${taxiHtml ? `<div class="print-page portrait-page">${taxiHtml}</div>` : ''}
                    ${attachmentsHtml}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                // 打印完成后（用户点击保存或取消）自动关闭窗口
                                window.close();
                            }, 500);
                        };
                        
                        // 备用方案：监听 afterprint 事件
                        window.onafterprint = function() {
                            window.close();
                        };
                    <\/script>
                </body>
                </html>
            `;

            printWindow.document.write(printHtml);
            printWindow.document.close();

        } catch (error) {
            console.error('打印失败:', error);
            alert('打印失败，请重试');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-100 -m-8">
            {/* 工具栏 */}
            <div className="bg-white p-4 flex justify-between items-center shadow-sm print:hidden">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-1 font-bold text-slate-500 hover:text-slate-700">
                        <ChevronRight className="rotate-180"/> 返回
                    </button>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <span className="text-sm text-slate-600">预览模式：</span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setPreviewMode('all')}
                            className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                        >全部</button>
                        <button
                            onClick={() => setPreviewMode('report')}
                            className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'report' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                        >报销单</button>
                        <button
                            onClick={() => setPreviewMode('invoices')}
                            className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'invoices' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                        >发票 ({allInvoices.length})</button>
                        {approvalAttachments.length > 0 && (
                            <button
                                onClick={() => setPreviewMode('approvals')}
                                className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'approvals' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >审批单 ({approvalAttachments.length})</button>
                        )}
                        {voucherAttachments.length > 0 && (
                            <button
                                onClick={() => setPreviewMode('vouchers')}
                                className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'vouchers' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >购物凭证 ({voucherAttachments.length})</button>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    {canEdit && (
                        <button onClick={handleSave} className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-md text-sm font-medium flex items-center gap-1.5 hover:bg-slate-50 transition-colors">
                            <Save size={14} strokeWidth={2}/> 保存
                        </button>
                    )}
                    <button
                        onClick={handlePrint}
                        disabled={generating}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium flex items-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        <Download size={14} strokeWidth={2}/> {generating ? '准备中...' : '保存PDF'}
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
                    <div className={`bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 transition-all duration-300 ${editPanelCollapsed ? 'w-0 overflow-hidden' : 'w-80'}`}>
                        {!editPanelCollapsed && (
                            <div className="p-4 space-y-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
                                    <Edit2 size={14} className="text-indigo-600"/> 编辑报销单
                                </h3>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">报销单标题</label>
                                    <input
                                        value={editData.title || ''}
                                        onChange={e => setEditData({...editData, title: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">报销金额</label>
                                    <input
                                        type="number"
                                        value={editData.totalAmount || 0}
                                        onChange={e => setEditData({...editData, totalAmount: parseFloat(e.target.value) || 0})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">预支金额</label>
                                    <input
                                        type="number"
                                        value={editData.prepaidAmount || 0}
                                        onChange={e => setEditData({...editData, prepaidAmount: parseFloat(e.target.value) || 0})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">审批编号</label>
                                    <input
                                        value={editData.approvalNumber || ''}
                                        onChange={e => setEditData({...editData, approvalNumber: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                
                                {/* 差旅报销特有字段 */}
                                {editData.isTravel && (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 block mb-1">出差事由</label>
                                            <textarea
                                                value={editData.tripReason || ''}
                                                onChange={e => setEditData({...editData, tripReason: e.target.value})}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                                rows={2}
                                            />
                                        </div>
                                        
                                        {/* 打车明细编辑 */}
                                        {editData.taxiDetails && editData.taxiDetails.length > 0 && (
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">打车明细 ({editData.taxiDetails.length}条)</label>
                                                <div className="max-h-64 overflow-y-auto space-y-2">
                                                    {editData.taxiDetails.map((taxi: any, idx: number) => (
                                                        <div key={idx} className="bg-slate-50 p-2 rounded space-y-1 border border-slate-200">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[10px] text-slate-400">第 {idx + 1} 条</span>
                                                                <span className="text-xs font-bold text-green-600">¥{(taxi.amount || 0).toFixed(2)}</span>
                                                            </div>
                                                            <input 
                                                                value={taxi.date || ''} 
                                                                onChange={e => {
                                                                    const details = [...editData.taxiDetails];
                                                                    details[idx].date = e.target.value;
                                                                    setEditData({...editData, taxiDetails: details});
                                                                }}
                                                                className="w-full p-1 border rounded text-xs"
                                                                placeholder="日期"
                                                            />
                                                            <input 
                                                                type="number"
                                                                value={taxi.amount || 0} 
                                                                onChange={e => {
                                                                    const details = [...editData.taxiDetails];
                                                                    details[idx].amount = parseFloat(e.target.value) || 0;
                                                                    setEditData({...editData, taxiDetails: details});
                                                                }}
                                                                className="w-full p-1 border rounded text-xs"
                                                                placeholder="金额"
                                                            />
                                                            <input 
                                                                value={taxi.reason || ''} 
                                                                onChange={e => {
                                                                    const details = [...editData.taxiDetails];
                                                                    details[idx].reason = e.target.value;
                                                                    setEditData({...editData, taxiDetails: details});
                                                                }}
                                                                className="w-full p-1 border rounded text-xs"
                                                                placeholder="外出事由"
                                                            />
                                                            <input 
                                                                value={taxi.startPoint || ''} 
                                                                onChange={e => {
                                                                    const details = [...editData.taxiDetails];
                                                                    details[idx].startPoint = e.target.value;
                                                                    details[idx].route = `${e.target.value}-${details[idx].endPoint || ''}`;
                                                                    setEditData({...editData, taxiDetails: details});
                                                                }}
                                                                className="w-full p-1 border rounded text-xs"
                                                                placeholder="起点"
                                                            />
                                                            <input 
                                                                value={taxi.endPoint || ''} 
                                                                onChange={e => {
                                                                    const details = [...editData.taxiDetails];
                                                                    details[idx].endPoint = e.target.value;
                                                                    details[idx].route = `${details[idx].startPoint || ''}-${e.target.value}`;
                                                                    setEditData({...editData, taxiDetails: details});
                                                                }}
                                                                className="w-full p-1 border rounded text-xs"
                                                                placeholder="终点"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 金额审核 */}
                                        {(() => {
                                            const taxiTotal = (editData.taxiDetails || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
                                            const tripCityTraffic = (editData.tripLegs || []).reduce((sum: number, leg: any) => sum + (leg.cityTrafficFee || 0), 0);
                                            const isMatch = Math.abs(taxiTotal - tripCityTraffic) < 0.01 || taxiTotal === 0 || tripCityTraffic === 0;
                                            return (
                                                <div className={`p-3 rounded-lg border ${isMatch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                                    <label className="text-xs font-bold block mb-2 flex items-center gap-1">
                                                        {isMatch ? (
                                                            <span className="text-green-700">✓ 金额审核通过</span>
                                                        ) : (
                                                            <span className="text-red-700">⚠ 金额审核未通过</span>
                                                        )}
                                                    </label>
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-600">打车发票总额:</span>
                                                            <span className="font-medium">¥{taxiTotal.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-600">市内交通费:</span>
                                                            <span className="font-medium">¥{tripCityTraffic.toFixed(2)}</span>
                                                        </div>
                                                        {!isMatch && taxiTotal > 0 && tripCityTraffic > 0 && (
                                                            <div className="flex justify-between text-red-600 font-medium pt-1 border-t border-red-200">
                                                                <span>差额:</span>
                                                                <span>¥{Math.abs(taxiTotal - tripCityTraffic).toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                                
                                <div className="pt-4 border-t border-slate-100">
                                    <p className="text-xs text-slate-400">应付金额: ¥{((editData.totalAmount || 0) - (editData.prepaidAmount || 0)).toFixed(2)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 右侧预览区域 */}
                <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8 print:p-0 print:overflow-visible print:gap-0">
                    {/* 报销单 - 使用完整的 A4 格式表单 */}
                    {(previewMode === 'all' || previewMode === 'report') && (
                        <div ref={reportRef} className="bg-white shadow-lg print:shadow-none">
                            {editData.isTravel ? (
                                <TravelReimbursementForm data={editData} />
                            ) : (
                                <GeneralReimbursementForm data={editData} />
                            )}
                        </div>
                    )}
                    
                    {/* 差旅报销的打车行程表 */}
                    {(previewMode === 'all' || previewMode === 'report') && editData.isTravel && editData.taxiDetails && editData.taxiDetails.length > 0 && (
                        <div ref={taxiTableRef} className="bg-white shadow-lg print:shadow-none">
                            <TaxiExpenseTable data={{
                                createdDate: editData.createdDate,
                                userSnapshot: editData.userSnapshot,
                                tripReason: editData.tripReason,
                                taxiDetails: editData.taxiDetails,
                            }} />
                        </div>
                    )}

                    {/* 发票附件 - 每张单独一页 */}
                    {(previewMode === 'all' || previewMode === 'invoices') && allInvoices.length > 0 && (
                        <>
                            {allInvoices.map((attachment: any, index: number) => (
                                <div key={`invoice-${index}`} className="bg-white shadow-lg print:shadow-none">
                                    <A4SingleAttachment
                                        attachment={attachment}
                                        title="电子发票"
                                        index={index}
                                    />
                                </div>
                            ))}
                        </>
                    )}

                    {/* 审批单附件 - 每张单独一页 */}
                    {(previewMode === 'all' || previewMode === 'approvals') && approvalAttachments.length > 0 && (
                        <>
                            {approvalAttachments.map((attachment: any, index: number) => (
                                <div key={`approval-${index}`} className="bg-white shadow-lg print:shadow-none">
                                    <A4SingleAttachment
                                        attachment={attachment}
                                        title="审批单据"
                                        index={index}
                                    />
                                </div>
                            ))}
                        </>
                    )}

                    {/* 购物凭证附件 - 每张单独一页 */}
                    {(previewMode === 'all' || previewMode === 'vouchers') && voucherAttachments.length > 0 && (
                        <>
                            {voucherAttachments.map((attachment: any, index: number) => (
                                <div key={`voucher-${index}`} className="bg-white shadow-lg print:shadow-none">
                                    <A4SingleAttachment
                                        attachment={attachment}
                                        title="购物凭证"
                                        index={index}
                                    />
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
