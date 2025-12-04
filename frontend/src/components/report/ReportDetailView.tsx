/**
 * 易报销系统 - 报销单详情页面
 * 用于查看、编辑和导出报销单及其附件
 */

import React, { useState, useRef } from 'react';
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
export const ReportDetailView = ({ report, onUpdate, onBack }: ReportDetailViewProps) => {
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

    // 生成PDF - 直接截取预览页面内容
    const generatePDF = async () => {
        if (generating) return;
        setGenerating(true);

        try {
            const isTravel = editData.isTravel;
            const orientation = isTravel ? 'portrait' : 'landscape';
            const a4Width = isTravel ? 210 : 297;
            const a4Height = isTravel ? 297 : 210;

            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            // 1. 添加报销单页面
            if (reportRef.current) {
                const canvas = await html2canvas(reportRef.current, {
                    scale: 1.5,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.85);
                pdf.addImage(imgData, 'JPEG', 0, 0, a4Width, a4Height);
            }

            // 2. 如果是差旅报销且有打车明细,添加打车行程表
            if (editData.isTravel && editData.taxiDetails && editData.taxiDetails.length > 0 && taxiTableRef.current) {
                pdf.addPage('a4', 'portrait');

                const taxiCanvas = await html2canvas(taxiTableRef.current, {
                    scale: 1.5,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                });

                const taxiImgData = taxiCanvas.toDataURL('image/jpeg', 0.85);
                pdf.addImage(taxiImgData, 'JPEG', 0, 0, 210, 297);
            }

            // 3. 添加附件页面
            const allAttachments = editData.attachments || [];
            for (let i = 0; i < allAttachments.length; i++) {
                const attachment = allAttachments[i];
                pdf.addPage('a4', 'portrait');

                const portraitWidth = 210;
                const portraitHeight = 297;

                if (attachment.data) {
                    const img = new Image();
                    img.src = attachment.data;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });

                    const imgRatio = img.width / img.height;
                    const pageRatio = portraitWidth / portraitHeight;

                    let finalWidth, finalHeight, x, y;

                    if (imgRatio > pageRatio) {
                        finalWidth = portraitWidth - 10;
                        finalHeight = finalWidth / imgRatio;
                        x = 5;
                        y = (portraitHeight - finalHeight) / 2;
                    } else {
                        finalHeight = portraitHeight - 10;
                        finalWidth = finalHeight * imgRatio;
                        x = (portraitWidth - finalWidth) / 2;
                        y = 5;
                    }

                    pdf.addImage(attachment.data, 'JPEG', x, y, finalWidth, finalHeight);
                }
            }

            const fileName = `报销单_${editData.title || editData.id}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error('PDF 生成失败:', error);
            alert('PDF 生成失败，请重试');
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
                        <button onClick={handleSave} className="px-4 py-2 border border-slate-200 text-slate-600 rounded font-bold flex items-center gap-2 hover:bg-slate-50">
                            <Save size={16}/> 保存
                        </button>
                    )}
                    <button
                        onClick={generatePDF}
                        disabled={generating}
                        className="px-4 py-2 bg-indigo-600 text-white rounded font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Download size={16}/> {generating ? '生成中...' : '导出 PDF'}
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
                                                <label className="text-xs font-bold text-slate-500 block mb-1">打车明细</label>
                                                {editData.taxiDetails.map((taxi: any, idx: number) => (
                                                    <div key={idx} className="bg-slate-50 p-2 rounded mb-2 space-y-1">
                                                        <div className="flex gap-2 items-center">
                                                            <span className="text-xs text-slate-500">日期:</span>
                                                            <input 
                                                                value={taxi.date || ''} 
                                                                onChange={e => {
                                                                    const details = [...editData.taxiDetails];
                                                                    details[idx].date = e.target.value;
                                                                    setEditData({...editData, taxiDetails: details});
                                                                }}
                                                                className="flex-1 p-1 border rounded text-xs"
                                                            />
                                                            <span className="text-xs text-slate-500">金额:</span>
                                                            <input 
                                                                type="number"
                                                                value={taxi.amount || 0} 
                                                                onChange={e => {
                                                                    const details = [...editData.taxiDetails];
                                                                    details[idx].amount = parseFloat(e.target.value) || 0;
                                                                    setEditData({...editData, taxiDetails: details});
                                                                }}
                                                                className="w-20 p-1 border rounded text-xs"
                                                            />
                                                        </div>
                                                        <div className="flex gap-2 items-center">
                                                            <span className="text-xs text-slate-500">起终点:</span>
                                                            <input 
                                                                value={taxi.route || ''} 
                                                                onChange={e => {
                                                                    const details = [...editData.taxiDetails];
                                                                    details[idx].route = e.target.value;
                                                                    setEditData({...editData, taxiDetails: details});
                                                                }}
                                                                className="flex-1 p-1 border rounded text-xs"
                                                                placeholder="起点 → 终点"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                <p className="text-[10px] text-slate-500">
                                                    打车费总计: ¥{editData.taxiDetails.reduce((sum: number, t: any) => sum + (t.amount || 0), 0).toFixed(2)}
                                                </p>
                                            </div>
                                        )}
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
