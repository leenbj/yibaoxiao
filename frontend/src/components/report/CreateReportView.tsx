/**
 * 易报销系统 - 通用费用报销单创建页面
 * 简化版本，使用模块化 hooks 处理复杂业务逻辑
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, ChevronLeft, Download, Save, Upload, Plus, X, 
  Receipt, FileCheck, ScanLine, Edit2, Loader2, FileText, Image as ImageIcon,
  Briefcase
} from 'lucide-react';
import { Attachment, ExpenseItem } from '../../types';
import { fileToBase64Original, pdfToImage } from '../../utils/image';
import { useInvoiceAnalysis } from '../../hooks/useInvoiceAnalysis';
import { useInvoiceSelection } from '../../hooks/useInvoiceSelection';
import { GeneralReimbursementForm } from '../forms/GeneralReimbursementForm';
import { A4SingleAttachment } from '../shared/A4SingleAttachment';

import type { Report } from '../../types';

interface CreateReportViewProps {
  settings: any;
  expenses: any[];
  setExpenses: (expenses: any[]) => void;
  loans: any[];
  onAction: (report: Report, action: 'save' | 'print') => Promise<void>;
  onBack: () => void;
}

/**
 * 通用报销单创建主组件
 *
 * 工作流程：
 * Step 1: 文件上传 (发票、审批单、凭证)
 * Step 2: AI 识别 + 表单填充 + 预览编辑
 *
 * 关键特性：
 * - 并行 AI 识别发票和审批单
 * - 支持发票合并/分离模式
 * - 智能匹配借款和预算项目
 * - 实时预览和缩放
 */
export const CreateReportView = ({
  settings,
  expenses,
  setExpenses,
  loans,
  onAction,
  onBack,
}: CreateReportViewProps) => {
  // ============ UI 状态 ============
  const [step, setStep] = useState(1);
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.8);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // ============ 文件上传状态 ============
  const [invoiceFiles, setInvoiceFiles] = useState<Attachment[]>([]);
  const [approvalFiles, setApprovalFiles] = useState<Attachment[]>([]);
  const [voucherFiles, setVoucherFiles] = useState<Attachment[]>([]);

  // ============ 表单数据状态 ============
  const [form, setForm] = useState({
    title: "",
    approvalNumber: "",
    budgetProjectId: settings.budgetProjects.find((p: any) => p.isDefault)?.id || "",
    paymentAccountId: settings.paymentAccounts.find((a: any) => a.isDefault)?.id || "",
    prepaidAmount: 0,
    manualItems: [] as ExpenseItem[]
  });

  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  // ============ 待报销记账本事项 ============
  const pendingExpenses = expenses.filter((e: any) => e.status === 'pending');

  // ============ AI 识别 Hook ============
  const {
    analyzing,
    aiInvoiceResult,
    aiApprovalResult,
    invoiceDetails: aiInvoiceDetails,
    matchedLoans,
    startAnalysis: startAIAnalysis,
  } = useInvoiceAnalysis({
    invoiceFiles,
    approvalFiles,
    loans,
    settings,
    pendingExpenses: expenses.filter((e: any) => e.status === 'pending'),
    form,
    mergeInvoices: true,
    userId: settings.currentUser?.id || '',
  });

  // ============ 发票选择 Hook ============
  const {
    invoiceDetails,
    mergeInvoices,
    selectedInvoices,
    totalAmount,
    toggleInvoiceSelection,
    setMergeInvoices,
    updateInvoiceDetails,
    buildUpdatedManualItems,
    buildUpdatedTitle,
  } = useInvoiceSelection({
    initialInvoices: aiInvoiceDetails,
    initialMerge: true,
    approvalData: aiApprovalResult,
    currentUserId: settings.currentUser?.id || 'user_default',
  });
  
  // 当 AI 识别完成后，更新发票详情列表
  useEffect(() => {
    if (aiInvoiceDetails && aiInvoiceDetails.length > 0) {
      updateInvoiceDetails(aiInvoiceDetails);
    }
  }, [aiInvoiceDetails, updateInvoiceDetails]);

  // ============ 动态缩放计算 ============
  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 32;
        const a4Width = 297 * 3.78;
        const maxScale = formCollapsed ? 0.85 : 0.75;
        const newScale = Math.min(containerWidth / a4Width, maxScale);
        setPreviewScale(Math.max(newScale, 0.4));
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [step, formCollapsed]);

  // ============ 文件处理 ============
  const handleUpload = async (e: any, type: 'invoice' | 'approval' | 'voucher') => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = await Promise.all(
        Array.from(e.target.files as FileList).map(async (f: File) => {
          let data = "";
          if (f.type === 'application/pdf') {
            // PDF 需要转换为图片
            data = await pdfToImage(f);
          } else {
            // 图片使用原始格式（不压缩），保证附件显示完整
            data = await fileToBase64Original(f);
          }
          return { data, type, name: f.name } as Attachment;
        })
      );

      if (type === 'invoice') setInvoiceFiles(prev => [...prev, ...newFiles]);
      if (type === 'approval') setApprovalFiles(prev => [...prev, ...newFiles]);
      if (type === 'voucher') setVoucherFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number, type: 'invoice' | 'approval' | 'voucher') => {
    if (type === 'invoice') setInvoiceFiles(prev => prev.filter((_, i) => i !== index));
    if (type === 'approval') setApprovalFiles(prev => prev.filter((_, i) => i !== index));
    if (type === 'voucher') setVoucherFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ============ Step 1: 开始分析 ============
  const handleStartAnalysis = async () => {
    const result = await startAIAnalysis();
    if (result.success) {
      setForm(prev => ({
        ...prev,
        title: result.reimbursementTitle,
        approvalNumber: result.approvalNumber || prev.approvalNumber,
        budgetProjectId: result.autoSelectedBudgetId,
        manualItems: result.manualItems,
      }));
      setSelectedExpenseIds(result.selectedExpenseIds);
      setStep(2);
    }
  };

  // ============ Step 2: 处理合并模式变更 ============
  const handleMergeChange = (merge: boolean) => {
    setMergeInvoices(merge);
    // 传递新的 merge 值，解决 React 状态异步更新问题
    const updatedItems = buildUpdatedManualItems(merge);
    setForm(prev => ({
      ...prev,
      title: buildUpdatedTitle(),
      manualItems: updatedItems,
    }));
  };

  // ============ 提交报销单 ============
  const handleSubmit = async (action: 'save' | 'print') => {
    if (form.manualItems.length === 0) {
      alert('请至少添加一条费用明细');
      return;
    }

    if (!form.title) {
      alert('请输入报销事由');
      return;
    }

    const paymentAmount = totalAmount - form.prepaidAmount;
    const updatedExpenses = expenses.map((e: any) =>
      selectedExpenseIds.includes(e.id) ? { ...e, status: 'processing' } : e
    );

    setExpenses(updatedExpenses);

    // 确保 userSnapshot 包含 email 字段
    const userSnapshot = {
      ...settings.currentUser,
      email: settings.currentUser?.email || `${settings.currentUser?.id || 'user'}@example.com`
    };

    const reportData: Report = {
      id: `report-${Date.now()}`,
      title: form.title,
      totalAmount: totalAmount,
      prepaidAmount: form.prepaidAmount,
      payableAmount: paymentAmount,
      approvalNumber: form.approvalNumber,
      budgetProject: settings.budgetProjects.find((p: any) => p.id === form.budgetProjectId),
      paymentAccount: settings.paymentAccounts.find((a: any) => a.id === form.paymentAccountId),
      items: form.manualItems,
      attachments: [...invoiceFiles, ...approvalFiles, ...voucherFiles],
      status: action === 'save' ? 'draft' : 'submitted',
      createdDate: new Date().toISOString(),
      userSnapshot: userSnapshot,
      isTravel: false, // 显式标记为非差旅报销
    };

    console.warn('[CreateReportView] 提交报销单, action:', action, 'userSnapshot:', JSON.stringify(userSnapshot));
    await onAction(reportData, action);
  };

  // ============ Step 1: 文件上传界面 ============
  if (step === 1) {
    return (
      <div className="mx-auto h-full flex flex-col max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <ChevronRight className="rotate-180" />
          </button>
          <h2 className="text-2xl font-bold text-slate-800">通用费用报销</h2>
        </div>

        {/* Upload Area */}
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Mandatory Invoice Upload */}
            <div className="col-span-2">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Receipt size={20} className="text-red-500" /> 电子发票{" "}
                <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  强制上传
                </span>
              </h3>
              <div className="bg-white rounded-2xl border-2 border-dashed border-red-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-red-50/20 transition-colors relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleUpload(e, 'invoice')}
                />
                {invoiceFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-4 justify-center w-full z-10 pointer-events-none">
                    {invoiceFiles.map((f, i) => (
                      <div key={i} className="relative group pointer-events-auto">
                        <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                          {f.type === 'other' ? (
                            <FileText className="text-slate-400" />
                          ) : (
                            <ImageIcon className="text-slate-400" />
                          )}
                        </div>
                        <div className="text-[10px] mt-1 truncate max-w-[80px] text-slate-500">
                          {f.name}
            </div>
                  <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i, 'invoice');
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 z-20"
                        >
                          <X size={10} />
                  </button>
                </div>
              ))}
                    <div className="flex items-center justify-center w-20 h-20 bg-slate-50 rounded-lg border border-slate-200 text-slate-400">
                      <Plus size={24} />
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 pointer-events-none">
                    <Upload size={32} className="mx-auto mb-2 text-red-300" />
                    <p className="font-bold text-sm text-slate-600">上传电子发票</p>
                    <p className="text-xs">支持 PDF / 图片</p>
                  </div>
                )}
              </div>
          </div>

            {/* Approval Form */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                <FileCheck size={20} className="text-slate-600" /> 审批单{" "}
                <span className="text-slate-400 text-xs font-normal">可选</span>
              </h3>
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-slate-100/10 transition-colors relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleUpload(e, 'approval')}
                />
                {approvalFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
              {approvalFiles.map((f, i) => (
                      <div key={i} className="relative group pointer-events-auto">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                          <FileText size={20} className="text-slate-400" />
                        </div>
                  <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i, 'approval');
                          }}
                          className="absolute -top-2 -right-2 bg-slate-500 text-white rounded-full p-1"
                        >
                          <X size={8} />
                  </button>
                </div>
              ))}
            </div>
                ) : (
                  <div className="text-center text-slate-400 pointer-events-none">
                    <Upload size={24} className="mx-auto mb-2 text-indigo-300" />
                    <p className="font-bold text-xs text-slate-600">上传审批单</p>
                  </div>
                )}
              </div>
          </div>

            {/* Shopping Voucher */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                <ScanLine size={20} className="text-emerald-500" /> 购物凭证{" "}
                <span className="text-slate-400 text-xs font-normal">可选</span>
              </h3>
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-emerald-50/10 transition-colors relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleUpload(e, 'voucher')}
                />
                {voucherFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
              {voucherFiles.map((f, i) => (
                      <div key={i} className="relative group pointer-events-auto">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                          <FileText size={20} className="text-slate-400" />
                        </div>
                  <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i, 'voucher');
                          }}
                          className="absolute -top-2 -right-2 bg-slate-500 text-white rounded-full p-1"
                        >
                          <X size={8} />
                  </button>
                </div>
              ))}
            </div>
                ) : (
                  <div className="text-center text-slate-400 pointer-events-none">
                    <Upload size={24} className="mx-auto mb-2 text-emerald-300" />
                    <p className="font-bold text-xs text-slate-600">上传购物凭证</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleStartAnalysis}
            disabled={invoiceFiles.length === 0 || analyzing}
            className={`w-full mt-8 py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-lg ${
              invoiceFiles.length > 0
                ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {analyzing ? (
              <>
                <Loader2 className="animate-spin" /> AI 正在分析单据...
              </>
            ) : (
              '开始识别与填单'
            )}
          </button>
        </div>
      </div>
    );
  }

  // ============ Step 2: 表单 + 预览界面 ============
  const allAttachments = [...invoiceFiles, ...approvalFiles, ...voucherFiles];

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-100 z-30">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex justify-between items-center shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setStep(1);
            setForm({
              title: "",
              approvalNumber: "",
              budgetProjectId: settings.budgetProjects.find((p: any) => p.isDefault)?.id || "",
              paymentAccountId: settings.paymentAccounts.find((a: any) => a.isDefault)?.id || "",
              prepaidAmount: 0,
              manualItems: []
            });
          }}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium text-sm"
          >
            <ChevronLeft size={16} /> 返回重传
          </button>
          <div className="h-4 w-px bg-slate-200"></div>
          <span className="text-sm font-medium text-slate-700">通用报销单预览 (A4横版)</span>
        </div>
        <div className="flex gap-2 items-center">
          {/* 金额审核状态提示 */}
          {invoiceDetails.length > 0 && (() => {
            const invoiceTotal = invoiceDetails.filter(inv => inv.selected).reduce((sum, inv) => sum + inv.amount, 0);
            const formTotal = form.manualItems.reduce((sum, item) => sum + item.amount, 0);
            const isMatch = Math.abs(invoiceTotal - formTotal) < 0.01;
            return !isMatch ? (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium">
                ⚠ 金额不匹配，差异 ¥{Math.abs(formTotal - invoiceTotal).toFixed(2)}
              </span>
            ) : (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full font-medium">
                ✓ 金额审核通过
              </span>
            );
          })()}
          <button
            onClick={() => handleSubmit('save')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Save size={14} /> 保存
          </button>
          {(() => {
            const invoiceTotal = invoiceDetails.filter(inv => inv.selected).reduce((sum, inv) => sum + inv.amount, 0);
            const formTotal = form.manualItems.reduce((sum, item) => sum + item.amount, 0);
            const isMatch = invoiceDetails.length === 0 || Math.abs(invoiceTotal - formTotal) < 0.01;
            return (
              <button
                onClick={() => {
                  if (!isMatch) {
                    alert('金额审核未通过！\n\n发票总金额与报销单录入金额不匹配，请调整后再提交。');
                    return;
                  }
                  handleSubmit('print');
                }}
                className={`px-3 py-1.5 rounded-lg font-medium text-sm shadow-sm flex items-center gap-1.5 ${
                  isMatch
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
                title={isMatch ? '打印/保存 PDF' : '金额审核未通过，无法打印'}
              >
                <Download size={14} /> 打印/保存 PDF
              </button>
            );
          })()}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden flex flex-row relative bg-slate-100">
        {/* 收缩/展开按钮 - 始终悬浮可见 */}
        <button
          onClick={() => setFormCollapsed(!formCollapsed)}
          className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all z-40 ${formCollapsed ? 'left-0' : 'left-[276px] xl:left-[316px]'}`}
          title={formCollapsed ? "展开表单" : "收起表单"}
        >
          {formCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* 左侧表单面板 */}
        <div className={`bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 transition-all duration-300 ${formCollapsed ? 'w-0 p-0 overflow-hidden' : 'w-[280px] xl:w-[320px] p-4'}`}>
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
            <Edit2 size={14} className="text-slate-600" /> 填写信息
          </h3>
          <div className="space-y-6">

              {/* 报销事由列表 - 多条时显示编号 */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                  报销事由 {form.manualItems.length > 1 && `(${form.manualItems.length}条)`}
                </label>
                {form.manualItems.length <= 1 ? (
                  // 单条时显示简单输入框
                  <>
                <input
                  value={form.title}
                      onChange={e => {
                        setForm({ ...form, title: e.target.value });
                        // 同时更新 manualItems 中的描述
                        if (form.manualItems.length === 1) {
                          const newItems = [...form.manualItems];
                          newItems[0].description = e.target.value;
                          setForm(prev => ({ ...prev, manualItems: newItems }));
                        }
                      }}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none"
                      placeholder="例如：采购办公用品"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">格式：发票内容（具体事项）</p>
                  </>
                ) : (
                  // 多条时显示带编号的列表
                  <div className="space-y-2">
                    {form.manualItems.map((item, idx) => (
                      <div key={item.id} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-7 flex items-center justify-center text-xs font-bold text-indigo-600 bg-indigo-50 rounded">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                        <input
                            value={item.description}
                            onChange={e => {
                              const newItems = [...form.manualItems];
                              newItems[idx].description = e.target.value;
                              setForm({ ...form, manualItems: newItems });
                            }}
                            className="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-indigo-500 outline-none"
                          />
                          <div className="flex justify-between mt-0.5">
                            <span className="text-[10px] text-slate-400">¥{item.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-400">点击编辑每条报销事由</p>
                  </div>
                )}
                </div>

              {/* 审批单编号 */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">审批单编号</label>
                <input
                  value={form.approvalNumber}
                  onChange={e => setForm({ ...form, approvalNumber: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none"
                  placeholder="钉钉/飞书审批单号"
                />
              </div>

              {/* 预算项目 */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">预算项目</label>
                <select
                  value={form.budgetProjectId}
                  onChange={e => setForm({ ...form, budgetProjectId: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none bg-white"
                >
                  {settings.budgetProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {/* 显示审批单中的预算信息 */}
                {aiApprovalResult?.budgetProject && (
                  <p className="text-[10px] text-green-600 mt-1">
                    ✓ 已从审批单识别：{aiApprovalResult.budgetProject}
                    {aiApprovalResult.budgetCode && ` (${aiApprovalResult.budgetCode})`}
                  </p>
                )}
              </div>

              {/* 收款账户 */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">收款账户</label>
                <select
                  value={form.paymentAccountId}
                  onChange={e => setForm({ ...form, paymentAccountId: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none bg-white"
                >
                  {settings.paymentAccounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.bankName || a.name} - {(a.accountNumber || '').slice(-4)}</option>
                  ))}
                </select>
              </div>

              {/* 多发票合并选项 - 只在有多张发票时显示 */}
              {invoiceDetails.length > 1 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <label className="text-xs font-bold text-indigo-700 uppercase block mb-2">发票报销方式</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMergeChange(true)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        mergeInvoices
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      合并报销
                    </button>
                    <button
                      onClick={() => handleMergeChange(false)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        !mergeInvoices
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      独立报销
                    </button>
                  </div>
                  <p className="text-[10px] text-indigo-600 mt-2">
                    {mergeInvoices
                      ? '✓ 所有发票金额合并为一笔报销'
                      : '✓ 每张发票独立一行录入'}
                  </p>

                  {/* 发票明细列表 */}
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500">识别到 {invoiceDetails.length} 张发票：</p>
                    {invoiceDetails.map((inv) => (
                      <label
                        key={inv.id}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${
                          inv.selected
                            ? 'bg-white border border-indigo-200'
                            : 'bg-slate-100 border border-transparent opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={inv.selected}
                            onChange={() => toggleInvoiceSelection(inv.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-[11px] text-slate-700 truncate">{inv.projectName}</span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-800 ml-2">¥{inv.amount.toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 预支/借款抵扣 - 智能匹配借款记录 */}
              {matchedLoans.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <label className="text-xs font-bold text-amber-700 uppercase block mb-2 flex items-center gap-2">
                    预支借款抵扣
                    <span className="text-[10px] font-normal text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                      智能匹配 {matchedLoans.length} 条
                    </span>
                  </label>
                  
                  {/* 匹配的借款记录列表 */}
                  <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                    {matchedLoans.slice(0, 5).map((loan: any) => (
                      <div
                        key={loan.id}
                        onClick={() => {
                          setSelectedLoanId(loan.id);
                          setForm(prev => ({ ...prev, prepaidAmount: loan.amount }));
                        }}
                        className={`p-2 rounded-lg cursor-pointer transition-all ${
                          selectedLoanId === loan.id
                            ? 'bg-amber-200 border-2 border-amber-400'
                            : 'bg-white border border-amber-100 hover:border-amber-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">
                              ¥{loan.amount.toFixed(2)}
                            </p>
                            <p className="text-xs text-slate-600 truncate">
                              {loan.reason || '未填写事由'}
                            </p>
                          </div>
                          <div className="text-right ml-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              loan.matchScore >= 80 ? 'bg-green-100 text-green-700' :
                              loan.matchScore >= 50 ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {loan.matchScore >= 80 ? '高度匹配' : loan.matchScore >= 50 ? '可能相关' : '参考'}
                            </span>
                          </div>
                        </div>
                        {/* 匹配原因 */}
                        {loan.matchReason && loan.matchReason.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {loan.matchReason.slice(0, 3).map((reason: string, idx: number) => (
                              <span key={idx} className="text-[9px] bg-amber-50 text-amber-600 px-1 rounded">
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* 取消选择按钮 */}
                  {selectedLoanId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLoanId('');
                        setForm(prev => ({ ...prev, prepaidAmount: 0 }));
                      }}
                      className="text-xs text-amber-600 hover:text-amber-800 mb-2"
                    >
                      × 取消关联借款
                    </button>
                  )}
                  
                  {selectedLoanId && (
                    <div className="p-2 bg-white rounded border border-amber-100">
                      <p className="text-xs text-amber-700">
                        预支金额：<span className="font-bold">¥{form.prepaidAmount.toFixed(2)}</span>
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        应领款金额 = ¥{totalAmount.toFixed(2)} - ¥{form.prepaidAmount.toFixed(2)} =
                        <span className="font-bold text-indigo-600"> ¥{(totalAmount - form.prepaidAmount).toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : loans.length > 0 ? (
                /* 有借款记录但未匹配到，提供手动选择 */
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-2">
                    预支借款抵扣
                    <span className="text-[10px] font-normal text-slate-400 ml-1">（手动选择）</span>
                  </label>
                  <p className="text-[10px] text-slate-400 mb-2">
                    未找到自动匹配的借款记录，您可以手动选择
                  </p>
                  <select
                    value={selectedLoanId}
                    onChange={(e) => {
                      setSelectedLoanId(e.target.value);
                      const loan = loans.find((l: any) => l.id === e.target.value);
                      if (loan) {
                        setForm(prev => ({ ...prev, prepaidAmount: loan.amount }));
                      } else {
                        setForm(prev => ({ ...prev, prepaidAmount: 0 }));
                      }
                    }}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-indigo-500 outline-none"
                  >
                    <option value="">选择借款记录...</option>
                    {loans.filter((l: any) => l.status !== 'paid').map((loan: any) => (
                      <option key={loan.id} value={loan.id}>
                        ¥{loan.amount.toFixed(2)} - {loan.reason?.slice(0, 25) || '未填写事由'}
                      </option>
                    ))}
                  </select>
                  {selectedLoanId && (
                    <div className="mt-2 p-2 bg-white rounded border border-slate-100">
                      <p className="text-xs text-slate-700">
                        预支金额：<span className="font-bold">¥{form.prepaidAmount.toFixed(2)}</span>
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        应领款金额 = ¥{totalAmount.toFixed(2)} - ¥{form.prepaidAmount.toFixed(2)} =
                        <span className="font-bold text-indigo-600"> ¥{(totalAmount - form.prepaidAmount).toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">预支/借款抵扣</label>
                  <p className="text-[10px] text-slate-400 mb-2">
                    暂无借款记录，可手动输入金额
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                <input
                  type="number"
                  value={form.prepaidAmount}
                      onChange={e => setForm({ ...form, prepaidAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-6 p-2 border border-slate-200 rounded-lg text-sm font-bold text-orange-600 focus:border-indigo-500 outline-none bg-white"
                      placeholder="手动输入借款金额"
                />
              </div>
                </div>
              )}

              {/* 金额审核模块 */}
              {invoiceDetails.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2">
                    <span>💰 金额审核</span>
                    {(() => {
                      const invoiceTotal = invoiceDetails.filter(inv => inv.selected).reduce((sum, inv) => sum + inv.amount, 0);
                      const formTotal = form.manualItems.reduce((sum, item) => sum + item.amount, 0);
                      const isMatch = Math.abs(invoiceTotal - formTotal) < 0.01;
                      return isMatch
                        ? <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">✓ 已通过</span>
                        : <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">⚠ 不匹配</span>;
                    })()}
                  </h4>

                  <div className="space-y-2 text-xs">
                    {/* 发票金额明细 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                      <p className="font-bold text-blue-700 mb-1">📄 电子发票金额</p>
                      {invoiceDetails.filter(inv => inv.selected).map((inv, idx) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span className="text-slate-600 truncate flex-1 mr-2">{inv.projectName}</span>
                          <span className="font-mono text-blue-700">¥{inv.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t border-blue-200 mt-1.5 pt-1.5 flex justify-between font-bold">
                        <span>发票合计</span>
                        <span className="font-mono text-blue-800">
                          ¥{invoiceDetails.filter(inv => inv.selected).reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* 报销单金额 */}
                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-2">
                      <p className="font-bold text-slate-700 mb-1">📝 报销单录入金额</p>
                      {form.manualItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span className="text-slate-600 truncate flex-1 mr-2">{item.description}</span>
                          <span className="font-mono text-slate-700">¥{item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                      <div className="border-t border-slate-200 mt-1.5 pt-1.5 flex justify-between font-bold">
                        <span>录入合计</span>
                        <span className="font-mono text-slate-800">
                          ¥{form.manualItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* 差异提示 */}
                    {(() => {
                      const invoiceTotal = invoiceDetails.filter(inv => inv.selected).reduce((sum, inv) => sum + inv.amount, 0);
                      const formTotal = form.manualItems.reduce((sum, item) => sum + item.amount, 0);
                      const diff = formTotal - invoiceTotal;
                      const isMatch = Math.abs(diff) < 0.01;

                      if (isMatch) {
                        return (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-green-700">
                            <p className="font-bold">✅ 金额审核通过</p>
                            <p className="text-[10px] mt-1">发票金额与报销单金额完全匹配，可以生成报销单</p>
                          </div>
                        );
                      } else {
                        return (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-red-700">
                            <p className="font-bold">❌ 金额审核未通过</p>
                            <p className="text-[10px] mt-1">
                              差异金额：<span className="font-bold font-mono">{diff > 0 ? '+' : ''}¥{diff.toFixed(2)}</span>
                            </p>
                            <p className="text-[10px] mt-1">请调整报销金额使其与发票金额一致后再生成报销单</p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* 费用明细 */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="font-bold text-sm text-slate-700 mb-2">费用明细</h4>
                
                {/* AI 识别项目 */}
                {form.manualItems.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-bold text-slate-700">
                      {mergeInvoices ? 'AI 识别项目（已合并）' : `AI 识别项目 (${form.manualItems.length}笔)`}
                    </p>
                    {form.manualItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-100 p-2 rounded text-xs border border-indigo-100">
                        <div className="truncate flex-1 mr-2">{item.description}</div>
                        <div className="font-bold w-16 text-right">
                          <input
                            className="w-full bg-transparent text-right outline-none"
                            value={item.amount}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const newItems = [...form.manualItems];
                              newItems[idx].amount = val;
                              setForm({ ...form, manualItems: newItems });
                            }}
                            type="number"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 关联记账本 */}
                {pendingExpenses.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Briefcase size={12} /> 关联记账本
                    </p>
                    <p className="text-[10px] text-slate-400 mb-2">
                      选中的事项将在报销完成后自动标记为"已报销"
                    </p>

                    {/* AI 推荐匹配的事项 */}
                    {selectedExpenseIds.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] text-green-600 font-medium mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          AI 自动匹配 ({selectedExpenseIds.length}项)
                        </p>
                        <div className="space-y-0.5 bg-green-50/50 rounded-lg p-1.5">
                          {pendingExpenses.filter((e: any) => selectedExpenseIds.includes(e.id)).map((e: any) => (
                            <label key={e.id} className="flex items-center justify-between p-1.5 hover:bg-green-100/50 rounded cursor-pointer">
                              <div className="flex items-center gap-1.5 truncate">
                                <input
                                  type="checkbox"
                                  checked={true}
                                  onChange={() => setSelectedExpenseIds(selectedExpenseIds.filter((id: string) => id !== e.id))}
                                  className="rounded text-green-600 focus:ring-green-500 w-3 h-3"
                                />
                                <span className="text-[11px] text-slate-700 truncate">{e.description}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-green-700">¥{e.amount.toFixed(2)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 手动选择区域 */}
                    {pendingExpenses.filter((e: any) => !selectedExpenseIds.includes(e.id)).length > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-400 mb-1">
                          手动选择 ({pendingExpenses.filter((e: any) => !selectedExpenseIds.includes(e.id)).length}项未报销)
                        </p>
                        <div className="space-y-0.5 max-h-24 overflow-y-auto border border-slate-100 rounded-lg p-1.5">
                          {pendingExpenses.filter((e: any) => !selectedExpenseIds.includes(e.id)).map((e: any) => (
                            <label key={e.id} className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                              <div className="flex items-center gap-1.5 truncate">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={() => setSelectedExpenseIds([...selectedExpenseIds, e.id])}
                                  className="rounded text-slate-600 focus:ring-slate-500 w-3 h-3"
                                />
                                <span className="text-[11px] text-slate-600 truncate">{e.description}</span>
                              </div>
                              <span className="text-[11px] font-medium text-slate-500">¥{e.amount.toFixed(2)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* 右侧预览区 */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8">
          <div ref={previewContainerRef} style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center' }} className="bg-white shadow-lg">
            <GeneralReimbursementForm
              data={{
                title: form.title,
                totalAmount: totalAmount,
                prepaidAmount: form.prepaidAmount,
                items: form.manualItems,
                approvalNumber: form.approvalNumber,
                userSnapshot: settings.currentUser,
                paymentAccount: settings.paymentAccounts?.find((a: any) => a.id === form.paymentAccountId) || settings.paymentAccounts?.[0],
                budgetProject: settings.budgetProjects?.find((p: any) => p.id === form.budgetProjectId),
                invoiceCount: invoiceFiles.length,
                attachments: allAttachments,
                createdDate: new Date().toISOString(),
              }}
            />
          </div>

          {/* 附件 */}
          {allAttachments.map((att, i) => (
            <div key={i} className="bg-white shadow-lg">
              <A4SingleAttachment attachment={att} title="附件" index={i} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
