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
   * 解析单张发票数据
   */
  const parseSingleInvoice = (inv: any, idx: number): InvoiceDetailItem | null => {
    // 跳过空对象
    if (!inv || typeof inv !== 'object' || Object.keys(inv).length === 0) {
      return null;
    }

    // 尝试从多个可能的字段名获取金额
    let amount = getAmount(inv.totalAmount) || 
      getAmount(inv.amount) || 
      getAmount(inv.total) ||
      getAmount(inv.price) ||
      getAmount(inv.amountWithoutTax);
    
    // 如果有 items，计算明细总和作为备选
    if (inv.items && Array.isArray(inv.items) && inv.items.length > 0) {
      const itemsSum = inv.items.reduce((sum: number, i: any) => sum + getAmount(i.amount), 0);
      if (!amount && itemsSum > 0) {
        amount = itemsSum;
      }
    }

    // 获取项目名称
    const projectName = inv.projectName || inv.title || 
      (inv.items && inv.items[0]?.name) || `发票${idx + 1}`;

    return {
      id: `invoice-${Date.now()}-${idx}`,
      projectName,
      amount,
      invoiceDate: formatDate(inv.invoiceDate),
      invoiceNumber: inv.invoiceNumber || inv.number,
      selected: true
    };
  };

  /**
   * 解析发票数据，支持多种格式：
   * 1. 数组格式：[{发票1}, {发票2}, ...]
   * 2. invoices 属性：{ invoices: [{发票1}, {发票2}] }
   * 3. details 属性：{ details: [{发票1}, {发票2}] }
   * 4. 单张发票对象：{ projectName, totalAmount, ... }
   */
  const parseInvoiceData = (invoiceData: any): InvoiceDetailItem[] => {
    const invoiceList: InvoiceDetailItem[] = [];

    console.log('[AI] 发票识别数据类型', { 
      isArray: Array.isArray(invoiceData), 
      dataType: typeof invoiceData,
      keys: invoiceData ? Object.keys(invoiceData) : []
    });
    console.log('[AI] 发票识别原始数据（详细）', JSON.stringify(invoiceData, null, 2));

    // 格式 1：直接是数组格式 [{发票1}, {发票2}, ...]
    if (Array.isArray(invoiceData)) {
      console.log('[AI] 检测到发票数组格式，发票数量:', invoiceData.length);
      invoiceData.forEach((inv: any, idx: number) => {
        const parsed = parseSingleInvoice(inv, idx);
        if (parsed) {
          invoiceList.push(parsed);
        }
      });
    }
    // 格式 2：包含 invoices 数组
    else if (invoiceData?.invoices && Array.isArray(invoiceData.invoices)) {
      console.log('[AI] 检测到 invoices 属性，发票数量:', invoiceData.invoices.length);
      invoiceData.invoices.forEach((inv: any, idx: number) => {
        const parsed = parseSingleInvoice(inv, idx);
        if (parsed) {
          invoiceList.push(parsed);
        }
      });
    }
    // 格式 3：包含 details 数组（某些 AI 模型可能返回这种格式）
    else if (invoiceData?.details && Array.isArray(invoiceData.details)) {
      console.log('[AI] 检测到 details 属性，发票数量:', invoiceData.details.length);
      invoiceData.details.forEach((inv: any, idx: number) => {
        const parsed = parseSingleInvoice(inv, idx);
        if (parsed) {
          invoiceList.push(parsed);
        }
      });
    }
    // 格式 4：单张发票对象
    else if (invoiceData && typeof invoiceData === 'object') {
      console.log('[AI] 检测到单张发票对象格式');
      const parsed = parseSingleInvoice(invoiceData, 0);
      if (parsed) {
        invoiceList.push(parsed);
      }
    }

    // 过滤掉金额为 0 的无效发票
    const validInvoices = invoiceList.filter(inv => inv.amount > 0);
    
    console.log('[AI] 解析发票数据完成', {
      totalParsed: invoiceList.length,
      validCount: validInvoices.length,
      invoices: validInvoices.map(inv => ({
        projectName: inv.projectName,
        amount: inv.amount,
        invoiceDate: inv.invoiceDate
      }))
    });

    return validInvoices.length > 0 ? validInvoices : invoiceList;
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

      console.log('[AI] 开始识别发票和审批单，发票数量:', invoiceImages.length);
      const startTime = Date.now();

      // ========== 关键修改：每张发票单独识别 ==========
      // 原因：多张图片一起发送时，AI 可能只返回第一张的结果
      // 修改：每张发票单独发送识别请求，然后合并结果
      const invoicePromises = invoiceImages.map((image, idx) => {
        console.log(`[AI] 发送第 ${idx + 1} 张发票识别请求`);
        return apiRequest('/api/ai/recognize', {
          method: 'POST',
          body: JSON.stringify({
            type: 'invoice',
            images: [image],  // 单张发票
            mimeType: 'image/jpeg',
          }),
        }).then(response => {
          console.log(`[AI] 第 ${idx + 1} 张发票识别完成:`, JSON.stringify(response, null, 2).substring(0, 500));
          return response;
        }).catch(err => {
          console.error(`[AI] 第 ${idx + 1} 张发票识别失败:`, err);
          return { result: {} };
        });
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

      // 并行执行所有识别请求
      const [approvalResponse, ...invoiceResponses] = await Promise.all([
        approvalPromise,
        ...invoicePromises
      ]) as any[];

      console.log(`[AI] 并行识别完成，耗时: ${Date.now() - startTime}ms`);
      console.log(`[AI] 收到 ${invoiceResponses.length} 个发票识别结果`);

      // 合并所有发票识别结果
      const allInvoiceData: any[] = [];
      invoiceResponses.forEach((response: any, idx: number) => {
        const result = response?.result || {};
        console.log(`[AI] 第 ${idx + 1} 张发票识别结果:`, JSON.stringify(result, null, 2).substring(0, 500));
        
        // 将每个识别结果添加到数组中
        if (Array.isArray(result)) {
          allInvoiceData.push(...result);
        } else if (result.invoices && Array.isArray(result.invoices)) {
          allInvoiceData.push(...result.invoices);
        } else if (result.details && Array.isArray(result.details)) {
          allInvoiceData.push(...result.details);
        } else if (result && Object.keys(result).length > 0 && !result._tokenUsage) {
          // 单个发票对象（排除只有 _tokenUsage 的空结果）
          const hasValidData = result.projectName || result.totalAmount || result.invoiceNumber || result.invoiceDate;
          if (hasValidData) {
            allInvoiceData.push(result);
          }
        }
      });

      console.log('[AI] 合并后的发票数据数量:', allInvoiceData.length);
      console.log('[AI] 合并后的发票数据:', JSON.stringify(allInvoiceData, null, 2));

      // 构造统一的发票数据格式
      const invoiceData = allInvoiceData.length > 0 
        ? { invoices: allInvoiceData } 
        : {};
      const approvalData = approvalResponse.result || {};
      
      console.log('[AI] 最终发票数据结构:', {
        invoicesCount: invoiceData.invoices?.length || 0,
        keys: Object.keys(invoiceData),
      });

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
