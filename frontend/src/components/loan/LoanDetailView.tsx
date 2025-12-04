/**
 * 易报销系统 - 借款单详情页面
 * 用于查看、编辑和导出借款单及其附件
 */

import React, { useState, useRef } from 'react';
import { Download, Save, ChevronRight, ChevronLeft, Edit2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { digitToChinese } from '../../utils/format';
import { LoanFormSheet } from './LoanFormSheet';
import { A4SingleAttachment } from '../shared/A4SingleAttachment';

interface LoanDetailViewProps {
    loan: any;
    onUpdate: (loan: any) => void;
    onBack: () => void;
}

/**
 * 借款单详情视图组件
 *
 * 功能:
 * - 左侧编辑面板: 编辑借款单信息 (金额、事由、审批编号、日期等)
 * - 右侧预览区: 显示双联借款单 (财务留存联+员工留存联) 和附件
 * - PDF导出: 生成A4横版PDF,包含两联和附件
 * - 伸缩编辑面板: 点击按钮折叠/展开左侧编辑区
 * - 实时预览: 编辑时左侧同步更新右侧预览
 */
export const LoanDetailView = ({ loan, onUpdate, onBack }: LoanDetailViewProps) => {
    const [generating, setGenerating] = useState(false);
    const [editData, setEditData] = useState({ ...loan });
    const canEdit = loan.status !== 'paid';
    const [editPanelCollapsed, setEditPanelCollapsed] = useState(false);
    const loanSheet1Ref = useRef<HTMLDivElement>(null);
    const loanSheet2Ref = useRef<HTMLDivElement>(null);

    const handleSave = () => {
        if (onUpdate) {
            onUpdate(editData);
            alert('保存成功！');
        }
    };

    // 生成PDF - 直接截取预览页面显示的内容
    const generatePDF = async () => {
        if (generating) return;
        setGenerating(true);

        try {
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            const a4Width = 297;
            const a4Height = 210;

            // 截图函数
            const captureElement = async (element: HTMLElement) => {
                const canvas = await html2canvas(element, {
                    scale: 1.5,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                });
                return canvas;
            };

            // 添加图片到PDF
            const addToPDF = (canvas: HTMLCanvasElement, isFirst: boolean) => {
                if (!isFirst) {
                    pdf.addPage('a4', 'landscape');
                }

                const imgData = canvas.toDataURL('image/jpeg', 0.85);
                pdf.addImage(imgData, 'JPEG', 0, 0, a4Width, a4Height);
            };

            // 1. 添加第一联：财务留存联
            if (loanSheet1Ref.current) {
                const canvas = await captureElement(loanSheet1Ref.current);
                addToPDF(canvas, true);
            }

            // 2. 添加第二联：员工留存联
            if (loanSheet2Ref.current) {
                const canvas = await captureElement(loanSheet2Ref.current);
                addToPDF(canvas, false);
            }

            // 3. 添加附件页面 - 每张附件单独一页
            const attachments = editData.attachments || [];
            for (let i = 0; i < attachments.length; i++) {
                const attachment = attachments[i];
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

            // 保存PDF
            const fileName = `借款单_${editData.reason || editData.id}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.pdf`;
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
                <button onClick={onBack} className="flex items-center gap-1 font-bold text-slate-500"><ChevronRight className="rotate-180"/> 返回</button>
                <div className="flex gap-2">
                    {canEdit && (
                        <button onClick={handleSave} className="px-4 py-2 border border-slate-200 text-slate-600 rounded font-bold flex items-center gap-2 hover:bg-slate-50">
                            <Save size={16}/> 保存
                        </button>
                    )}
                    <button
                        onClick={generatePDF}
                        disabled={generating}
                        className="px-4 py-2 bg-amber-500 text-white rounded font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        <Download size={16}/> {generating ? '生成中...' : '导出 PDF'}
                    </button>
                </div>
            </div>

            {/* 主内容区域 */}
            <div className="flex-1 overflow-hidden flex relative">
                {/* 伸缩按钮 - 始终可见，固定在左侧边线上 */}
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

                {/* 左侧编辑面板 - 仅在可编辑时显示，支持伸缩 */}
                {canEdit && (
                    <div className={`bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 transition-all duration-300 ${editPanelCollapsed ? 'w-0 overflow-hidden' : 'w-80'}`}>
                        {/* 编辑表单 - 收起时隐藏 */}
                        {!editPanelCollapsed && (
                            <div className="p-4 space-y-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
                                    <Edit2 size={14} className="text-amber-500"/> 编辑借款单
                                </h3>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">借款金额</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                                        <input
                                            type="number"
                                            value={editData.amount || 0}
                                            onChange={e => setEditData({...editData, amount: parseFloat(e.target.value) || 0})}
                                            className="w-full pl-7 p-2 border border-slate-200 rounded-lg text-sm font-bold text-amber-600"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">大写：{digitToChinese(editData.amount || 0)}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">借款事由</label>
                                    <textarea
                                        value={editData.reason || ''}
                                        onChange={e => setEditData({...editData, reason: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">审批单号</label>
                                    <input
                                        value={editData.approvalNumber || ''}
                                        onChange={e => setEditData({...editData, approvalNumber: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">申请日期</label>
                                    <input
                                        type="date"
                                        value={editData.date || ''}
                                        onChange={e => setEditData({...editData, date: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 右侧预览区域 */}
                <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8 print:p-0 print:overflow-visible">
                    {/* 第一联：财务留存联 */}
                    <div ref={loanSheet1Ref} className="bg-white shadow-lg print:shadow-none">
                        <LoanFormSheet
                            data={editData}
                            sheetNumber={1}
                            sheetName="第一联：财务留存联"
                            showNote={false}
                        />
                    </div>

                    {/* 第二联：员工留存联 */}
                    <div ref={loanSheet2Ref} className="bg-white shadow-lg print:shadow-none">
                        <LoanFormSheet
                            data={editData}
                            sheetNumber={2}
                            sheetName="第二联：员工留存联"
                            showNote={true}
                        />
                    </div>

                    {/* 附件预览 */}
                    {editData.attachments && editData.attachments.length > 0 && (
                        <>
                            <h3 className="text-lg font-bold text-slate-700">附件资料</h3>
                            {editData.attachments.map((attachment: any, index: number) => (
                                <div key={index} className="bg-white shadow-lg print:shadow-none">
                                    <A4SingleAttachment
                                        attachment={attachment}
                                        title="审批单"
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
