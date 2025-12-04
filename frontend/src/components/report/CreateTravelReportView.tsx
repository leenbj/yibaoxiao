/**
 * 易报销系统 - 差旅费报销单创建页面
 * 简化版本，使用模块化 hooks 处理复杂业务逻辑
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, ChevronLeft, Download, Save, Upload, Plus, X, 
  Plane, Home, Car, MapPin, Edit2, Loader2, FileText
} from 'lucide-react';
import { Attachment, TripLeg, Report } from '../../types';
import { fileToBase64, pdfToImage } from '../../utils/image';
import { useTravelAnalysis } from '../../hooks/useTravelAnalysis';
import { TravelReimbursementForm } from '../forms/TravelReimbursementForm';
import { TaxiExpenseTable } from '../forms/TaxiExpenseTable';
import { A4SingleAttachment } from '../shared/A4SingleAttachment';

interface CreateTravelReportViewProps {
  settings: any;
  loans: any[];
  onAction: (report: Report, action: 'save' | 'print') => Promise<void>;
  onBack: () => void;
}

/**
 * 差旅报销单创建主组件
 *
 * 工作流程：
 * Step 1: 文件上传 (火车票、住宿、打车、审批单)
 * Step 2: AI 识别 + 行程构建 + 表单编辑 + 预览
 *
 * 关键特性：
 * - 4 并行 AI 识别（票据、住宿、打车、审批单）
 * - 智能往返票配对
 * - 自动匹配住宿信息
 * - 打车费用智能分配
 * - 实时预览和缩放
 */
export const CreateTravelReportView = ({
  settings,
  loans,
  onAction,
  onBack,
}: CreateTravelReportViewProps) => {
  // ============ UI 状态 ============
  const [step, setStep] = useState(1);
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.8);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // ============ 文件上传状态 ============
  const [ticketFiles, setTicketFiles] = useState<Attachment[]>([]);
  const [hotelFiles, setHotelFiles] = useState<Attachment[]>([]);
  const [taxiInvoiceFiles, setTaxiInvoiceFiles] = useState<Attachment[]>([]);
  const [taxiTripFiles, setTaxiTripFiles] = useState<Attachment[]>([]);
  const [approvalFiles, setApprovalFiles] = useState<Attachment[]>([]);

  // ============ 表单数据状态 ============
  const [form, setForm] = useState({
    tripReason: "",
    approvalNumber: "",
    budgetProjectId: settings.budgetProjects.find((p: any) => p.isDefault)?.id || "",
    paymentAccountId: settings.paymentAccounts.find((a: any) => a.isDefault)?.id || "",
    prepaidAmount: 0,
    tripLegs: [] as TripLeg[],
    taxiDetails: [] as any[],
  });

  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  // ============ AI 识别 Hook ============
  const {
    analyzing,
    aiTicketResult,
    aiHotelResult,
    aiTaxiResult,
    aiApprovalResult,
    tripLegs: aiTripLegs,
    taxiDetails: aiTaxiDetails,
    matchedLoans,
    startAnalysis: startAIAnalysis,
  } = useTravelAnalysis({
    ticketFiles,
    hotelFiles,
    taxiInvoiceFiles,
    taxiTripFiles,
    approvalFiles,
    loans,
    settings,
    form,
  });

  // ============ 动态缩放计算 ============
  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 32;
        const a4Width = 210 * 3.78; // A4 竖版
        const maxScale = formCollapsed ? 0.9 : 0.8;
        const newScale = Math.min(containerWidth / a4Width, maxScale);
        setPreviewScale(Math.max(newScale, 0.4));
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [step, formCollapsed]);

  // ============ 文件处理 ============
  const handleUpload = async (
    e: any,
    type: 'ticket' | 'hotel' | 'taxi-invoice' | 'taxi-trip' | 'approval'
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = await Promise.all(
        Array.from(e.target.files as FileList).map(async (f: File) => {
          let data = "";
          if (f.type === 'application/pdf') {
            data = await pdfToImage(f);
          } else {
            data = await fileToBase64(f);
          }
          return { data, type, name: f.name } as Attachment;
        })
      );

      if (type === 'ticket') setTicketFiles(prev => [...prev, ...newFiles]);
      if (type === 'hotel') setHotelFiles(prev => [...prev, ...newFiles]);
      if (type === 'taxi-invoice') setTaxiInvoiceFiles(prev => [...prev, ...newFiles]);
      if (type === 'taxi-trip') setTaxiTripFiles(prev => [...prev, ...newFiles]);
      if (type === 'approval') setApprovalFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (
    index: number,
    type: 'ticket' | 'hotel' | 'taxi-invoice' | 'taxi-trip' | 'approval'
  ) => {
    if (type === 'ticket') setTicketFiles(prev => prev.filter((_, i) => i !== index));
    if (type === 'hotel') setHotelFiles(prev => prev.filter((_, i) => i !== index));
    if (type === 'taxi-invoice') setTaxiInvoiceFiles(prev => prev.filter((_, i) => i !== index));
    if (type === 'taxi-trip') setTaxiTripFiles(prev => prev.filter((_, i) => i !== index));
    if (type === 'approval') setApprovalFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ============ Step 1: 开始分析 ============
  const handleStartAnalysis = async () => {
    const result = await startAIAnalysis();
    if (result.success) {
      setForm(prev => ({
        ...prev,
        tripReason: result.tripReason,
        approvalNumber: result.approvalNumber || prev.approvalNumber,
        budgetProjectId: result.autoSelectedBudgetId,
        tripLegs: result.tripLegs,
        taxiDetails: result.taxiDetails,
      }));
      setStep(2);
    }
  };

  // ============ 计算总金额 ============
  const calculateTotal = (): number => {
    return form.tripLegs.reduce((acc, leg) => acc + (leg.subTotal || 0), 0);
  };

  const totalAmount = calculateTotal();

  // ============ 提交报销单 ============
  const handleSubmit = async (action: 'save' | 'print') => {
    if (form.tripLegs.length === 0) {
      alert('请至少添加一条出差行程');
      return;
    }

    if (!form.tripReason) {
      alert('请输入差旅事由');
      return;
    }

    const paymentAmount = totalAmount - form.prepaidAmount;
    const allAttachments = [
      ...ticketFiles,
      ...hotelFiles,
      ...taxiInvoiceFiles,
      ...taxiTripFiles,
      ...approvalFiles,
    ];

    const reportData: Report = {
      id: `travel-report-${Date.now()}`,
      title: form.tripReason,
      totalAmount: totalAmount,
      prepaidAmount: form.prepaidAmount,
      payableAmount: paymentAmount,
      approvalNumber: form.approvalNumber,
      budgetProject: settings.budgetProjects.find((p: any) => p.id === form.budgetProjectId),
      paymentAccount: settings.paymentAccounts.find((a: any) => a.id === form.paymentAccountId),
      items: [], // 差旅报销单没有普通费用项
      attachments: allAttachments,
      status: action === 'save' ? 'draft' : 'submitted',
      createdDate: new Date().toISOString(),
      userSnapshot: settings.currentUser,
      isTravel: true,
      tripReason: form.tripReason,
      tripLegs: form.tripLegs,
      taxiDetails: form.taxiDetails,
    };

    await onAction(reportData, action);
  };

  // ============ 金额审核 ============
  const validateAmounts = () => {
    const taxiTotal = form.taxiDetails.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    const cityTrafficTotal = form.tripLegs.reduce((sum: number, leg: TripLeg) => sum + (leg.cityTrafficFee || 0), 0);
    const isTaxiMatch = Math.abs(taxiTotal - cityTrafficTotal) < 0.01;
    
    return {
      isValid: isTaxiMatch,
      taxiTotal,
      cityTrafficTotal,
      diff: taxiTotal - cityTrafficTotal,
    };
  };

  const validation = validateAmounts();

  // ============ Step 1: 文件上传界面 ============
  if (step === 1) {
    return (
      <div className="mx-auto h-full flex flex-col max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <ChevronRight className="rotate-180" />
          </button>
          <h2 className="text-2xl font-bold text-slate-800">差旅费用报销</h2>
        </div>

        <div className="flex-1 overflow-y-auto pb-20">
          <div className="grid md:grid-cols-2 gap-6">
            {/* 火车票/机票 - 必须 */}
            <div className="col-span-2">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Plane size={20} className="text-red-500" /> 火车票/机票{" "}
                <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">强制上传</span>
              </h3>
              <div className="bg-white rounded-2xl border-2 border-dashed border-red-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-red-50/20 transition-colors relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleUpload(e, 'ticket')}
                />
                {ticketFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-4 justify-center w-full z-10 pointer-events-none">
                    {ticketFiles.map((f, i) => (
                      <div key={i} className="relative group pointer-events-auto">
                        <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                          <FileText className="text-slate-400" />
                        </div>
                        <div className="text-[10px] mt-1 truncate max-w-[80px] text-slate-500">{f.name}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i, 'ticket');
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
                    <p className="font-bold text-sm text-slate-600">上传火车票/机票</p>
                    <p className="text-xs">支持 PDF / 图片</p>
                  </div>
                )}
              </div>
            </div>

            {/* 住宿发票 */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Home size={20} className="text-blue-500" /> 住宿发票{" "}
                <span className="text-slate-400 text-xs font-normal">可选</span>
              </h3>
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-blue-50/10 transition-colors relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleUpload(e, 'hotel')}
                />
                {hotelFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
                    {hotelFiles.map((f, i) => (
                      <div key={i} className="relative group pointer-events-auto">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                          <FileText size={20} className="text-slate-400" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i, 'hotel');
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
                    <Upload size={24} className="mx-auto mb-2 text-blue-300" />
                    <p className="font-bold text-xs text-slate-600">上传住宿发票</p>
                  </div>
                )}
              </div>
            </div>

            {/* 打车发票 */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Car size={20} className="text-yellow-500" /> 打车发票{" "}
                <span className="text-slate-400 text-xs font-normal">可选</span>
              </h3>
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-yellow-50/10 transition-colors relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleUpload(e, 'taxi-invoice')}
                />
                {taxiInvoiceFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
                    {taxiInvoiceFiles.map((f, i) => (
                      <div key={i} className="relative group pointer-events-auto">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                          <FileText size={20} className="text-slate-400" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i, 'taxi-invoice');
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
                    <Upload size={24} className="mx-auto mb-2 text-yellow-300" />
                    <p className="font-bold text-xs text-slate-600">上传打车发票</p>
                  </div>
                )}
              </div>
            </div>

            {/* 打车行程单 */}
            <div className="col-span-2">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                <MapPin size={20} className="text-purple-500" /> 打车行程单{" "}
                <span className="text-slate-400 text-xs font-normal">可选 · 用于提取起终点</span>
              </h3>
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[120px] hover:bg-purple-50/10 transition-colors relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleUpload(e, 'taxi-trip')}
                />
                {taxiTripFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
                    {taxiTripFiles.map((f, i) => (
                      <div key={i} className="relative group pointer-events-auto">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                          <FileText size={20} className="text-slate-400" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i, 'taxi-trip');
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
                    <Upload size={24} className="mx-auto mb-2 text-purple-300" />
                    <p className="font-bold text-xs text-slate-600">上传打车行程单</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 开始识别按钮 */}
          <button
            onClick={handleStartAnalysis}
            disabled={ticketFiles.length === 0 || analyzing}
            className={`w-full mt-8 py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-lg ${
              ticketFiles.length > 0
                ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {analyzing ? (
              <>
                <Loader2 className="animate-spin" /> AI 正在分析票据...
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
  const allAttachments = [
    ...ticketFiles,
    ...hotelFiles,
    ...taxiInvoiceFiles,
    ...taxiTripFiles,
    ...approvalFiles,
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-100 z-30">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex justify-between items-center shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(1)}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium text-sm"
          >
            <ChevronLeft size={16} /> 返回重传
          </button>
          <div className="h-4 w-px bg-slate-200"></div>
          <span className="text-sm font-medium text-slate-700">差旅费报销单预览</span>
        </div>
        <div className="flex gap-2 items-center">
          {/* 金额审核状态 */}
          {validation.isValid ? (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full font-medium">
              ✓ 金额审核通过
            </span>
          ) : (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium">
              ⚠ 金额不匹配
            </span>
          )}
          <button
            onClick={() => handleSubmit('save')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Save size={14} /> 保存草稿
          </button>
          <button
            onClick={() => {
              if (!validation.isValid) {
                alert('金额审核未通过！\n\n打车发票金额与市内交通费不匹配，请调整后再提交。');
                return;
              }
              handleSubmit('print');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm shadow-sm flex items-center gap-1.5 ${
              validation.isValid
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Download size={14} /> 提交报销
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-row relative bg-slate-100">
        {/* 收缩/展开按钮 */}
        <button
          onClick={() => setFormCollapsed(!formCollapsed)}
          className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all z-40 ${formCollapsed ? 'left-0' : 'left-[276px] xl:left-[316px]'}`}
        >
          {formCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Left Panel: Form Controls */}
        <div className={`bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 transition-all duration-300 ${formCollapsed ? 'w-0 p-0 overflow-hidden' : 'w-[280px] xl:w-[320px] p-4'}`}>
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
            <Edit2 size={14} className="text-slate-600" /> 填写信息
          </h3>

          <div className="space-y-4">
            {/* 出差事由 */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">出差事由</label>
              <textarea
                value={form.tripReason}
                onChange={e => setForm({ ...form, tripReason: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none resize-none"
                rows={2}
                placeholder="请输入出差事由"
              />
              <p className="text-[10px] text-amber-600 mt-1">⚠ 请手动填写或确认出差事由</p>
            </div>

            {/* 审批单编号 */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">审批单编号</label>
              <input
                value={form.approvalNumber}
                onChange={e => setForm({ ...form, approvalNumber: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none"
                placeholder="审批单号"
              />
            </div>

            {/* 出差行程统计 */}
            {form.tripLegs.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <label className="text-xs font-bold text-indigo-700 uppercase block mb-2">出差行程 ({form.tripLegs.length}段)</label>
                <div className="space-y-2">
                  {form.tripLegs.map((leg, i) => (
                    <div key={i} className="bg-white p-2 rounded border border-indigo-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">{leg.route}</span>
                        <span className="text-xs font-bold text-indigo-600">¥{(leg.subTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{leg.dateRange}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
          </div>
        </div>

        {/* 右侧预览区 */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8">
          {/* 差旅报销单 */}
          <div ref={previewContainerRef} style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center' }} className="bg-white shadow-lg">
            <TravelReimbursementForm
              data={{
                tripReason: form.tripReason,
                tripLegs: form.tripLegs,
                totalAmount: totalAmount,
                approvalNumber: form.approvalNumber,
                userSnapshot: settings.currentUser,
                invoiceCount: ticketFiles.length + hotelFiles.length + taxiInvoiceFiles.length,
                attachments: allAttachments,
                createdDate: new Date().toISOString(),
              }}
            />
          </div>

          {/* 打车明细表 */}
          {form.taxiDetails && form.taxiDetails.length > 0 && (
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center' }} className="bg-white shadow-lg">
              <TaxiExpenseTable
                data={{
                  taxiDetails: form.taxiDetails,
                  tripReason: form.tripReason,
                  userSnapshot: settings.currentUser,
                  createdDate: new Date().toISOString(),
                }}
              />
            </div>
          )}

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
