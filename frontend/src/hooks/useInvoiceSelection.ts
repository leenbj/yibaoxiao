/**
 * 易报销系统 - 发票选择管理 Hook
 * 用于管理发票的选中状态、合并/分离切换、费用明细重新计算
 */

import { useState } from 'react';
import { ExpenseItem } from '../types';

interface InvoiceDetail {
  id: string;
  projectName: string;
  amount: number;
  invoiceDate: string;
  invoiceNumber?: string;
  selected: boolean;
}

interface UseInvoiceSelectionParams {
  initialInvoices: InvoiceDetail[];
  initialMerge: boolean;
  approvalData: any;
}

interface UseInvoiceSelectionReturn {
  invoiceDetails: InvoiceDetail[];
  mergeInvoices: boolean;
  selectedInvoices: InvoiceDetail[];
  totalAmount: number;
  toggleInvoiceSelection: (invoiceId: string) => void;
  setMergeInvoices: (merge: boolean) => void;
  updateInvoiceDetails: (invoices: InvoiceDetail[]) => void;
  buildUpdatedManualItems: () => ExpenseItem[];
  buildUpdatedTitle: () => string;
}

/**
 * 发票选择和合并管理 Hook
 *
 * 功能：
 * - 管理发票的选中/取消选中状态
 * - 支持合并/分离模式切换
 * - 计算选中发票的总金额
 * - 动态构建标题（单张或多张）
 * - 重新计算费用明细项
 */
export const useInvoiceSelection = ({
  initialInvoices,
  initialMerge,
  approvalData,
}: UseInvoiceSelectionParams): UseInvoiceSelectionReturn => {
  const [invoiceDetails, setInvoiceDetailsState] = useState<InvoiceDetail[]>(initialInvoices);
  const [mergeInvoices, setMergeInvoicesState] = useState(initialMerge);

  // 计算选中的发票
  const selectedInvoices = invoiceDetails.filter(inv => inv.selected);

  // 计算选中发票的总金额
  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  /**
   * 切换单个发票的选中状态
   */
  const toggleInvoiceSelection = (invoiceId: string) => {
    setInvoiceDetailsState(prev =>
      prev.map(inv =>
        inv.id === invoiceId
          ? { ...inv, selected: !inv.selected }
          : inv
      )
    );
  };

  /**
   * 更新合并模式
   */
  const setMergeInvoices = (merge: boolean) => {
    setMergeInvoicesState(merge);
  };

  /**
   * 更新发票详情列表
   */
  const updateInvoiceDetails = (invoices: InvoiceDetail[]) => {
    setInvoiceDetailsState(invoices);
  };

  /**
   * 构建报销事由标题
   */
  const buildUpdatedTitle = (): string => {
    if (selectedInvoices.length === 0) return '';

    let title = '';
    if (selectedInvoices.length === 1) {
      title = selectedInvoices[0].projectName;
    } else {
      const uniqueNames = [...new Set(selectedInvoices.map(i => i.projectName))];
      title = uniqueNames.slice(0, 3).join('、');
      if (uniqueNames.length > 3) title += '等';
    }

    // 添加审批单事项内容作为后缀
    if (approvalData?.eventSummary) {
      title = `${title}（${approvalData.eventSummary}）`;
    }

    return title;
  };

  /**
   * 构建更新后的费用明细项
   */
  const buildUpdatedManualItems = (): ExpenseItem[] => {
    if (selectedInvoices.length === 0) return [];

    const eventSuffix = approvalData?.eventSummary ? `（${approvalData.eventSummary}）` : '';

    // 合并模式：所有选中发票合并为一条
    if (mergeInvoices) {
      const title = buildUpdatedTitle();
      return [{
        id: `extracted-${Date.now()}`,
        date: selectedInvoices[0]?.invoiceDate || new Date().toISOString(),
        description: title || selectedInvoices[0]?.projectName || '费用报销',
        amount: totalAmount,
        category: selectedInvoices[0]?.projectName || "其他",
        status: 'pending' as const
      }];
    }

    // 分离模式：每个发票一条明细
    return selectedInvoices.map((inv, idx) => ({
      id: `extracted-${Date.now()}-${idx}`,
      date: inv.invoiceDate,
      description: `${inv.projectName}${eventSuffix}`,
      amount: inv.amount,
      category: inv.projectName || "其他",
      status: 'pending' as const
    }));
  };

  return {
    invoiceDetails,
    mergeInvoices,
    selectedInvoices,
    totalAmount,
    toggleInvoiceSelection,
    setMergeInvoices,
    updateInvoiceDetails,
    buildUpdatedManualItems,
    buildUpdatedTitle,
  };
};
