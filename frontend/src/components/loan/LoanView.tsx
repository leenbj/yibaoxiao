/**
 * 易报销系统 - 借款申请视图
 * 二步流程: 上传审批单 -> 填写借款信息
 */

import { useState, useRef } from 'react';
import { ChevronRight, ChevronLeft, FileCheck, Upload, Plus, X, Loader2, Save, Download, Edit2 } from 'lucide-react';
import type { LoanViewProps, Attachment, LoanRecord } from '../../types';
import { apiRequest } from '../../utils/api';
import { fileToBase64, pdfToImage } from '../../utils/image';
import { digitToChinese } from '../../utils/format';
import { LoanFormSheet } from './LoanFormSheet';
import { A4SingleAttachment } from '../shared/A4SingleAttachment';

/**
 * 借款申请视图组件
 *
 * 功能:
 * - Step 1: 上传电子审批单 (PDF或图片)
 * - Step 2: AI识别审批单,自动填充金额、事由、编号
 * - 手动编辑和确认信息
 * - 双联借款单预览 (财务留存联 + 员工留存联)
 * - 保存草稿或提交借款
 */
export const LoanView = ({ settings, onAction, onBack }: LoanViewProps) => {
    const [step, setStep] = useState(1);
    const [analyzing, setAnalyzing] = useState(false);
    const [approvalFiles, setApprovalFiles] = useState<Attachment[]>([]);
    const [formCollapsed, setFormCollapsed] = useState(false);
    const [previewScale, setPreviewScale] = useState(0.6);
    const previewContainerRef = useRef<HTMLDivElement>(null);

    const [amount, setAmount] = useState<number>(0);
    const [reason, setReason] = useState("");
    const [approvalNumber, setApprovalNumber] = useState("");
    const [paymentAccountId, setPaymentAccountId] = useState(settings.paymentAccounts.find((a:any) => a.isDefault)?.id || "");
    const [budgetProjectId, setBudgetProjectId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleUpload = async (e: any) => {
        if(e.target.files && e.target.files.length > 0) {
            const newFiles = await Promise.all(Array.from(e.target.files as FileList).map(async (f: File) => {
                let data = "";
                if(f.type === 'application/pdf') {
                    data = await pdfToImage(f);
                } else {
                    data = await fileToBase64(f);
                }
                return { data, type: 'approval', name: f.name } as Attachment;
            }));
            setApprovalFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setApprovalFiles(prev => prev.filter((_, i) => i !== index));
    };

    const startAnalysis = async () => {
        if (approvalFiles.length === 0) {
            alert("请上传审批单");
            return;
        }
        setAnalyzing(true);
        try {
            const cleanB64 = (d: string) => d.split(',')[1];
            const images = approvalFiles.map(f => cleanB64(f.data));

            // 调用后端 AI 识别 API
            const response = await apiRequest('/api/ai/recognize', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'approval',
                    images: images,
                    mimeType: 'image/jpeg',
                }),
            }) as any;

            const data = response.result || {};
            console.log('[AI] 审批单识别结果:', data);

            // 提取借款事由 - 精简为一句话
            if(data.eventSummary) {
                setReason(data.eventSummary);
            } else if(data.eventDetail) {
                setReason(data.eventDetail.substring(0, 50));
            } else if(data.reason) {
                setReason(data.reason);
            }

            // 提取借款金额
            if(data.loanAmount) {
                setAmount(data.loanAmount);
            } else if(data.expenseAmount) {
                setAmount(data.expenseAmount);
            } else if(data.amount) {
                setAmount(data.amount);
            }

            // 提取审批编号
            if(data.approvalNumber) setApprovalNumber(data.approvalNumber);

            // 自动匹配预算项目
            if (data.budgetProject || data.budgetCode) {
                const matchedBudget = settings.budgetProjects.find((p: any) =>
                    p.name.includes(data.budgetProject) ||
                    p.code === data.budgetCode ||
                    data.budgetProject?.includes(p.name)
                );
                if (matchedBudget) {
                    setBudgetProjectId(matchedBudget.id);
                }
            }

            setStep(2);
        } catch (e) {
            console.error(e);
            alert("AI 识别失败，请检查网络或重试");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSubmit = (action: 'save' | 'print') => {
        if(!amount || !reason) return alert("请填写完整借款金额和事由");
        const loan: LoanRecord = {
            id: Date.now().toString(),
            amount: amount,
            reason,
            date,
            status: 'draft',
            paymentMethod: 'transfer',
            payeeInfo: settings.paymentAccounts.find((a:any) => a.id === paymentAccountId) || settings.paymentAccounts[0],
            userSnapshot: settings.currentUser,
            attachments: approvalFiles,
            approvalNumber,
            budgetProject: settings.budgetProjects.find((p:any) => p.id === budgetProjectId),
        };
        onAction(loan, action);
    };

    return (
        <div className={`mx-auto h-full flex flex-col ${step === 2 ? 'w-full max-w-none' : 'max-w-5xl'}`}>
            {/* Header */}
            {step === 1 && (
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight className="rotate-180"/></button>
                    <h2 className="text-2xl font-bold text-slate-800">借款申请</h2>
                </div>
            )}

            {/* Step 1: Upload */}
            {step === 1 && (
                <div className="flex-1 overflow-y-auto pb-20">
                    <div className="grid md:grid-cols-1 gap-6">
                        {/* 审批单上传 */}
                        <div className="col-span-1">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <FileCheck size={20} className="text-amber-500"/> 电子审批单 <span className="bg-amber-100 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-bold">强制上传</span>
                            </h3>
                            <div className="bg-white rounded-2xl border-2 border-dashed border-amber-200 p-6 flex flex-col items-center justify-center min-h-[200px] hover:bg-amber-50/20 transition-colors relative">
                                <input type="file" multiple accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleUpload} />
                                {approvalFiles.length > 0 ? (
                                    <div className="flex flex-wrap gap-4 justify-center w-full z-10 pointer-events-none">
                                        {approvalFiles.map((f, i) => (
                                            <div key={i} className="relative group pointer-events-auto">
                                                <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                                                    <FileCheck className="text-slate-400"/>
                                                </div>
                                                <div className="text-[10px] mt-1 truncate max-w-[80px] text-slate-500">{f.name}</div>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-100 transition-opacity z-20"><X size={10}/></button>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-center w-20 h-20 bg-slate-50 rounded-lg border border-slate-200 text-slate-400">
                                            <Plus size={24}/>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 pointer-events-none">
                                        <Upload size={32} className="mx-auto mb-2 text-amber-300"/>
                                        <p className="font-bold text-sm text-slate-600">上传电子审批单</p>
                                        <p className="text-xs">系统将自动提取金额、事由和审批编号</p>
                                        <p className="text-xs mt-1">支持 PDF / 图片</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={startAnalysis}
                            disabled={approvalFiles.length === 0 || analyzing}
                            className={`w-full mt-8 py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-lg ${approvalFiles.length > 0 ? 'bg-amber-500 text-white shadow-amber-200 hover:bg-amber-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                            {analyzing ? <><Loader2 className="animate-spin"/> AI 正在分析审批单...</> : "开始识别与填单"}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Form & Preview */}
            {step === 2 && (
                <div className="absolute inset-0 flex flex-col bg-slate-100 z-30">
                    {/* Toolbar */}
                    <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex justify-between items-center shadow-sm flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium text-sm">
                                <ChevronLeft size={16}/> 返回重传
                            </button>
                            <div className="h-4 w-px bg-slate-200"></div>
                            <span className="text-sm font-medium text-slate-700">借款单预览 (双联)</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleSubmit('save')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 flex items-center gap-1.5">
                                <Save size={14}/> 保存草稿
                            </button>
                            <button onClick={() => handleSubmit('print')} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium text-sm shadow-md shadow-amber-200 hover:bg-amber-600 flex items-center gap-1.5">
                                <Download size={14}/> 提交借款
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-row relative bg-slate-100">
                        {/* 收缩/展开按钮 */}
                        <button
                            onClick={() => setFormCollapsed(!formCollapsed)}
                            className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all z-40 ${formCollapsed ? 'left-0' : 'left-[276px] xl:left-[316px]'}`}
                        >
                            {formCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
                        </button>

                        {/* Left Panel: Form Controls */}
                        <div className={`bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 transition-all duration-300 ${formCollapsed ? 'w-0 p-0 overflow-hidden' : 'w-[280px] xl:w-[320px] p-4'}`}>
                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                                <Edit2 size={14} className="text-amber-500"/> 确认借款信息
                            </h3>

                            <div className="space-y-4">
                                {/* 借款金额 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">借款金额</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-7 p-2 border border-slate-200 rounded-lg font-bold text-lg text-amber-600 focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 bg-slate-50 p-1 rounded">大写：{digitToChinese(amount)}</p>
                                </div>

                                {/* 借款事由 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">借款事由</label>
                                    <textarea
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-amber-500 outline-none resize-none"
                                        rows={2}
                                        placeholder="AI已自动提取，可手动修改"
                                    />
                                </div>

                                {/* 审批单编号 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">审批单编号</label>
                                    <input
                                        value={approvalNumber}
                                        onChange={e => setApprovalNumber(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-amber-500 outline-none"
                                        placeholder="AI已自动提取"
                                    />
                                </div>

                                {/* 收款人账户 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">收款人账户</label>
                                    <select
                                        value={paymentAccountId}
                                        onChange={e => setPaymentAccountId(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-amber-500 outline-none bg-white"
                                    >
                                        {settings.paymentAccounts.map((a:any) => (
                                            <option key={a.id} value={a.id}>{a.accountName} - {a.bankName}</option>
                                        ))}
                                    </select>
                                    <div className="text-[10px] text-slate-400 mt-1 p-1.5 bg-slate-50 rounded">
                                        账号: {settings.paymentAccounts.find((a:any) => a.id === paymentAccountId)?.accountNumber}
                                    </div>
                                </div>

                                {/* 预算项目 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">预算项目</label>
                                    <select
                                        value={budgetProjectId}
                                        onChange={e => setBudgetProjectId(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-amber-500 outline-none bg-white"
                                    >
                                        <option value="">请选择预算项目</option>
                                        {settings.budgetProjects.map((p:any) => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 申请日期 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">申请日期</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Panel: Preview */}
                        <div ref={previewContainerRef} className="flex-1 bg-slate-100 overflow-auto p-2">
                            {/* 缩放控制 */}
                            <div className="sticky top-0 z-20 mb-2 flex justify-center">
                                <div className="bg-white rounded-full shadow-md px-3 py-1.5 flex items-center gap-2 text-xs">
                                    <button onClick={() => setPreviewScale(Math.max(0.3, previewScale - 0.05))} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">−</button>
                                    <span className="text-slate-600 min-w-[50px] text-center font-medium">{Math.round(previewScale * 100)}%</span>
                                    <button onClick={() => setPreviewScale(Math.min(1.2, previewScale + 0.05))} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">+</button>
                                </div>
                            </div>

                            {/* 借款单预览 */}
                            <div className="flex flex-col items-center">
                                {/* 第一联：财务留存联 */}
                                <div
                                    className="bg-white shadow-lg border border-slate-200 mb-8"
                                    style={{
                                        transform: `scale(${previewScale})`,
                                        transformOrigin: 'top center',
                                    }}
                                >
                                    <LoanFormSheet
                                        data={{
                                            amount,
                                            reason,
                                            date,
                                            approvalNumber,
                                            userSnapshot: settings.currentUser,
                                            payeeInfo: settings.paymentAccounts.find((a:any) => a.id === paymentAccountId),
                                            budgetProject: settings.budgetProjects.find((p:any) => p.id === budgetProjectId),
                                        }}
                                        sheetNumber={1}
                                        sheetName="第一联：财务留存联"
                                        showNote={false}
                                    />
                                </div>

                                {/* 第二联：员工留存联 */}
                                <div
                                    className="bg-white shadow-lg border border-slate-200 mb-8"
                                    style={{
                                        transform: `scale(${previewScale})`,
                                        transformOrigin: 'top center',
                                    }}
                                >
                                    <LoanFormSheet
                                        data={{
                                            amount,
                                            reason,
                                            date,
                                            approvalNumber,
                                            userSnapshot: settings.currentUser,
                                            payeeInfo: settings.paymentAccounts.find((a:any) => a.id === paymentAccountId),
                                            budgetProject: settings.budgetProjects.find((p:any) => p.id === budgetProjectId),
                                        }}
                                        sheetNumber={2}
                                        sheetName="第二联：员工留存联"
                                        showNote={true}
                                    />
                                </div>

                                {/* 附件展示 */}
                                {approvalFiles.map((attachment, idx) => (
                                    <div
                                        key={`approval-${idx}`}
                                        className="mb-8"
                                        style={{
                                            transform: `scale(${previewScale})`,
                                            transformOrigin: 'top center',
                                        }}
                                    >
                                        <A4SingleAttachment
                                            attachment={attachment}
                                            title="审批单"
                                            index={idx}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
