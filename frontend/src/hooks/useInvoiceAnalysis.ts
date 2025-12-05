/**
 * 易报销系统 - 通用发票 AI 识别 Hook
 * 用于处理发票和审批单的 AI 识别、数据解析和表单自动填充
 */

import { useState } from 'react';
import { apiRequest } from '../utils/api';
import { Attachment, ExpenseItem } from '../types';
import { getRecommendedLoans, MatchedLoan } from '../utils/loanMatcher';

interface InvoiceDetailItem {
  id: string;
  projectName: string;
  amount: number;
  invoiceDate: string;
  invoiceNumber?: string;
  selected: boolean;
}

interface UseInvoiceAnalysisParams {
  invoiceFiles: Attachment[];
  approvalFiles: Attachment[];
  loans: any[];
  settings: any;
  pendingExpenses: any[];
  form: any;
  mergeInvoices: boolean;
}

interface UseInvoiceAnalysisReturn {
  analyzing: boolean;
  aiInvoiceResult: any;
  aiApprovalResult: any;
  invoiceDetails: InvoiceDetailItem[];
  matchedLoans: any[];
  manualItems: ExpenseItem[];
  startAnalysis: () => Promise<{
    success: boolean;
    invoiceDetails: InvoiceDetailItem[];
    manualItems: ExpenseItem[];
    matchedLoans: any[];
    reimbursementTitle: string;
    autoSelectedBudgetId: string;
    selectedExpenseIds: string[];
    approvalNumber?: string;
  }>;
}

/**
 * 通用发票 AI 识别和数据处理 Hook
 *
 * 功能：
 * - 并行识别发票和审批单
 * - 解析 3 种发票格式（数组、Items、单张）
 * - 自动匹配借款记录
 * - 自动选择预算项目
 * - 智能匹配记账本事项
 */
export const useInvoiceAnalysis = ({
  invoiceFiles,
  approvalFiles,
  loans,
  settings,
  pendingExpenses,
  form,
  mergeInvoices,
}: UseInvoiceAnalysisParams): UseInvoiceAnalysisReturn => {
  const [analyzing, setAnalyzing] = useState(false);
  const [aiInvoiceResult, setAiInvoiceResult] = useState<any>(null);
  const [aiApprovalResult, setAiApprovalResult] = useState<any>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetailItem[]>([]);
  const [matchedLoans, setMatchedLoans] = useState<any[]>([]);
  const [manualItems, setManualItems] = useState<ExpenseItem[]>([]);

  // 辅助函数：保留完整的 data URL（包括 mimeType）
  // 后端需要完整的 data URL 来正确识别图片格式
  const cleanB64 = (data: string) => data;  // 不再去掉前缀，保留完整的 data URL

  // 辅助函数：格式化日期
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  // 辅助函数：获取金额（支持多种格式）
  const getAmount = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[,，]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  /**
   * 解析发票数据，支持 3 种格式
   */
  const parseInvoiceData = (invoiceData: any): InvoiceDetailItem[] => {
    const invoiceList: InvoiceDetailItem[] = [];
    const isArray = Array.isArray(invoiceData);

    console.log('[AI] 发票识别数据类型', { isArray, dataType: typeof invoiceData });
    console.log('[AI] 发票识别原始数据（详细）', JSON.stringify(invoiceData, null, 2));

    // 标准化数据格式
    let normalizedData = invoiceData;
    if (isArray) {
      console.log('[AI] 检测到多张发票数组格式，发票数量:', invoiceData.length);
      normalizedData = { invoices: invoiceData };
    }

    console.log('[AI] 发票识别数据', {
      hasInvoices: !!normalizedData.invoices,
      invoicesCount: normalizedData.invoices?.length,
      projectName: normalizedData.projectName,
      title: normalizedData.title,
      totalAmount: normalizedData.totalAmount,
      amount: normalizedData.amount,
      items: normalizedData.items,
      invoiceDate: normalizedData.invoiceDate
    });

    // 格式 1：多张发票数组
    if (normalizedData.invoices && Array.isArray(normalizedData.invoices)) {
      normalizedData.invoices.forEach((inv: any, idx: number) => {
        invoiceList.push({
          id: `invoice-${Date.now()}-${idx}`,
          projectName: inv.projectName || inv.title || `发票${idx + 1}`,
          amount: getAmount(inv.totalAmount) || getAmount(inv.amount),
          invoiceDate: formatDate(inv.invoiceDate),
          invoiceNumber: inv.invoiceNumber || inv.number,
          selected: true
        });
      });
    }
    // 格式 2：含 items 明细的发票
    else if (normalizedData.items && Array.isArray(normalizedData.items) && normalizedData.items.length > 0) {
      const itemsSum = normalizedData.items.reduce((sum: number, i: any) => sum + getAmount(i.amount), 0);
      const singleAmount = getAmount(normalizedData.totalAmount) || itemsSum;
      
      console.log('[AI] 含items明细发票金额解析', {
        totalAmount: normalizedData.totalAmount,
        totalAmountParsed: getAmount(normalizedData.totalAmount),
        itemsSum,
        finalAmount: singleAmount
      });
      
      invoiceList.push({
        id: `invoice-${Date.now()}-0`,
        projectName: normalizedData.projectName || normalizedData.title || normalizedData.items[0]?.name || '发票',
        amount: singleAmount,
        invoiceDate: formatDate(normalizedData.invoiceDate),
        invoiceNumber: normalizedData.invoiceNumber,
        selected: true
      });
    }
    // 格式 3：单张发票基本格式
    else {
      // 尝试从多个可能的字段名获取金额
      const singleAmount = getAmount(normalizedData.totalAmount) || 
        getAmount(normalizedData.amount) || 
        getAmount(normalizedData.total) ||
        getAmount(normalizedData.price) ||
        getAmount(normalizedData.amountWithoutTax);
      
      console.log('[AI] 单张发票金额解析', {
        totalAmount: normalizedData.totalAmount,
        amount: normalizedData.amount,
        total: normalizedData.total,
        price: normalizedData.price,
        amountWithoutTax: normalizedData.amountWithoutTax,
        parsedAmount: singleAmount
      });
      
      invoiceList.push({
        id: `invoice-${Date.now()}-0`,
        projectName: normalizedData.projectName || normalizedData.title || '发票',
        amount: singleAmount,
        invoiceDate: formatDate(normalizedData.invoiceDate),
        invoiceNumber: normalizedData.invoiceNumber,
        selected: true
      });
    }

    console.log('[AI] 解析发票数据', {
      rawInvoiceData: normalizedData,
      parsedInvoiceList: invoiceList,
      firstInvoiceAmount: invoiceList[0]?.amount,
      firstInvoiceProjectName: invoiceList[0]?.projectName
    });

    return invoiceList;
  };

  /**
   * 构建报销事由
   */
  const buildReimbursementTitle = (invoiceList: InvoiceDetailItem[], approvalData: any): string => {
    let title = '';
    if (invoiceList.length === 1) {
      title = invoiceList[0].projectName;
    } else {
      const uniqueNames = [...new Set(invoiceList.map(i => i.projectName))];
      title = uniqueNames.slice(0, 3).join('、');
      if (uniqueNames.length > 3) title += '等';
    }

    if (approvalData.eventSummary) {
      title = `${title}（${approvalData.eventSummary}）`;
    }

    return title;
  };

  /**
   * 构建费用明细项
   */
  const buildManualItems = (
    invoiceList: InvoiceDetailItem[],
    totalAmount: number,
    reimbursementTitle: string,
    approvalData: any,
    merge: boolean
  ): ExpenseItem[] => {
    const eventSuffix = approvalData.eventSummary ? `（${approvalData.eventSummary}）` : '';
    const userId = settings.currentUser?.id || 'user_default';

    return (invoiceList.length === 1 || merge)
      ? [{
        id: `extracted-${Date.now()}`,
        userId: userId, // 添加 userId 字段
        date: invoiceList[0]?.invoiceDate || new Date().toISOString(),
        description: reimbursementTitle || invoiceList[0]?.projectName || '费用报销',
        amount: totalAmount,
        category: invoiceList[0]?.projectName || "其他",
        status: 'pending' as const
      }]
      : invoiceList.map((inv, idx) => ({
        id: `extracted-${Date.now()}-${idx}`,
        userId: userId, // 添加 userId 字段
        date: inv.invoiceDate,
        description: `${inv.projectName}${eventSuffix}`,
        amount: inv.amount,
        category: inv.projectName || "其他",
        status: 'pending' as const
      }));
  };

  /**
   * 自动匹配记账本事项
   */
  const autoMatchExpenses = (
    finalTitle: string,
    invoiceList: InvoiceDetailItem[],
    approvalData: any
  ): string[] => {
    const matchedExpenseIds: string[] = [];

    if (pendingExpenses.length === 0) return matchedExpenseIds;

    const searchTerms = [
      finalTitle,
      ...invoiceList.map((inv: any) => inv.projectName || ''),
      approvalData.eventSummary || '',
    ].filter(Boolean).map(t => t.toLowerCase());

    console.log('[AI] 记账本匹配关键词:', searchTerms);

    pendingExpenses.forEach((expense: any) => {
      const expDesc = (expense.description || '').toLowerCase();
      const expCategory = (expense.category || '').toLowerCase();

      const isMatch = searchTerms.some(term =>
        expDesc.includes(term) ||
        term.includes(expDesc) ||
        expCategory.includes(term) ||
        term.includes(expCategory)
      );

      if (isMatch) {
        matchedExpenseIds.push(expense.id);
        console.log('[AI] 匹配到记账本事项:', expense.description, expense.amount);
      }
    });

    if (matchedExpenseIds.length > 0) {
      console.log('[AI] 自动选中记账本事项数量:', matchedExpenseIds.length);
    }

    return matchedExpenseIds;
  };

  /**
   * 开始 AI 分析流程
   */
  const startAnalysis = async () => {
    if (invoiceFiles.length === 0) {
      alert("请必须上传电子发票 (强制上传)");
      return {
        success: false,
        invoiceDetails: [],
        manualItems: [],
        matchedLoans: [],
        reimbursementTitle: '',
        autoSelectedBudgetId: form.budgetProjectId,
        selectedExpenseIds: [],
      };
    }

    setAnalyzing(true);
    try {
      const invoiceImages = invoiceFiles.map(f => cleanB64(f.data));
      const approvalImages = approvalFiles.map(f => cleanB64(f.data));

      console.log('[AI] 开始并行识别发票和审批单');
      const startTime = Date.now();

      // 并行识别
      const invoicePromise = apiRequest('/api/ai/recognize', {
        method: 'POST',
        body: JSON.stringify({
          type: 'invoice',
          images: invoiceImages,
          mimeType: 'image/jpeg',
        }),
      });

      const approvalPromise = approvalImages.length > 0
        ? apiRequest('/api/ai/recognize', {
          method: 'POST',
          body: JSON.stringify({
            type: 'approval',
            images: approvalImages,
            mimeType: 'image/jpeg',
          }),
        })
        : Promise.resolve({ result: {} });

      const [invoiceResponse, approvalResponse] = await Promise.all([
        invoicePromise,
        approvalPromise
      ]) as any[];

      console.log(`[AI] 并行识别完成，耗时: ${Date.now() - startTime}ms`);

      const invoiceData = invoiceResponse.result || {};
      const approvalData = approvalResponse.result || {};

      // 解析发票数据
      const parsedInvoiceDetails = parseInvoiceData(invoiceData);
      setAiInvoiceResult(invoiceData);
      setInvoiceDetails(parsedInvoiceDetails);

      // 保存审批结果
      if (approvalImages.length > 0) {
        setAiApprovalResult(approvalData);
      }

      // 计算总金额
      const totalInvoiceAmount = parsedInvoiceDetails.reduce((sum, inv) => sum + inv.amount, 0);

      // 构建报销事由
      const reimbursementTitle = buildReimbursementTitle(parsedInvoiceDetails, approvalData);

      // 智能匹配借款记录（多维度匹配：审批单号、金额、关键词）
      const invoiceContent = parsedInvoiceDetails.map(inv => inv.projectName).join(' ');
      const potentialLoans = getRecommendedLoans(
        loans,
        approvalData,
        totalInvoiceAmount,
        invoiceContent
      );
      setMatchedLoans(potentialLoans);
      
      console.log('[AI] 智能借款匹配结果', {
        totalLoans: loans.length,
        matchedCount: potentialLoans.length,
        topMatch: potentialLoans[0] ? {
          amount: potentialLoans[0].amount,
          score: (potentialLoans[0] as MatchedLoan).matchScore,
          reasons: (potentialLoans[0] as MatchedLoan).matchReason
        } : null
      });

      // 自动选择预算项目
      let autoSelectedBudgetId = form.budgetProjectId;
      if (approvalData.budgetProject) {
        const matchedBudget = settings.budgetProjects.find((p: any) =>
          p.name.includes(approvalData.budgetProject) ||
          p.code === approvalData.budgetCode
        );
        if (matchedBudget) {
          autoSelectedBudgetId = matchedBudget.id;
        }
      }

      // 构建费用明细项
      const manualItemsData = buildManualItems(
        parsedInvoiceDetails,
        totalInvoiceAmount,
        reimbursementTitle,
        approvalData,
        mergeInvoices
      );
      setManualItems(manualItemsData);

      // 自动匹配记账本事项
      const finalTitle = reimbursementTitle || parsedInvoiceDetails[0]?.projectName || '费用报销';
      const selectedExpenseIds = autoMatchExpenses(finalTitle, parsedInvoiceDetails, approvalData);

      console.log('[AI] 表单填充完成', {
        finalTitle,
        manualItemsCount: manualItemsData.length,
        matchedLoansCount: potentialLoans.length,
        selectedExpensesCount: selectedExpenseIds.length
      });

      return {
        success: true,
        invoiceDetails: parsedInvoiceDetails,
        manualItems: manualItemsData,
        matchedLoans: potentialLoans,
        reimbursementTitle: finalTitle,
        autoSelectedBudgetId,
        selectedExpenseIds,
        approvalNumber: approvalData?.approvalNumber || '',
      };

    } catch (e) {
      console.error('[AI] 识别失败:', e);
      alert("AI 分析失败，请检查网络或重试");
      return {
        success: false,
        invoiceDetails: [],
        manualItems: [],
        matchedLoans: [],
        reimbursementTitle: '',
        autoSelectedBudgetId: form.budgetProjectId,
        selectedExpenseIds: [],
      };
    } finally {
      setAnalyzing(false);
    }
  };

  return {
    analyzing,
    aiInvoiceResult,
    aiApprovalResult,
    invoiceDetails,
    matchedLoans,
    manualItems,
    startAnalysis,
  };
};
