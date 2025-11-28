/**
 * 后端数据管理钩子
 * 用于替换 localStorage，实现数据的后端持久化
 */

import { useState, useEffect, useCallback } from 'react';

// API 基础路径
const API_BASE = '';

// 获取认证令牌
const getAuthHeaders = () => {
  const token = localStorage.getItem('reimb_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// 通用 API 请求函数
async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || data.error || '请求失败');
  }
  
  return data;
}

// ============= 费用记录 API =============
export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  status: 'pending' | 'processing' | 'done';
  createdAt: string;
  dueDate?: string;
  note?: string;
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载费用列表
  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ expenses: ExpenseItem[] }>('/api/expenses');
      setExpenses(data.expenses || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建费用
  const createExpense = useCallback(async (expense: Omit<ExpenseItem, 'id' | 'createdAt'>) => {
    const data = await apiRequest<{ expense: ExpenseItem }>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
    setExpenses(prev => [data.expense, ...prev]);
    return data.expense;
  }, []);

  // 更新费用
  const updateExpense = useCallback(async (id: string, updates: Partial<ExpenseItem>) => {
    const data = await apiRequest<{ expense: ExpenseItem }>(`/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setExpenses(prev => prev.map(e => e.id === id ? data.expense : e));
    return data.expense;
  }, []);

  // 删除费用
  const deleteExpense = useCallback(async (id: string) => {
    await apiRequest(`/api/expenses/${id}`, { method: 'DELETE' });
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, []);

  // 批量更新状态
  const updateExpensesStatus = useCallback(async (ids: string[], status: ExpenseItem['status']) => {
    // 并行更新所有费用
    await Promise.all(
      ids.map(id => apiRequest(`/api/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }))
    );
    setExpenses(prev => prev.map(e => ids.includes(e.id) ? { ...e, status } : e));
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  return {
    expenses,
    setExpenses,
    loading,
    error,
    loadExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    updateExpensesStatus,
  };
}

// ============= 报销单 API =============
export interface ReportItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  project?: string;
  note?: string;
}

export interface Report {
  id: string;
  title: string;
  type: 'general' | 'travel';
  status: 'draft' | 'submitted' | 'paid';
  items: ReportItem[];
  attachments: Array<{ name: string; data: string; type: string }>;
  payee: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  project: { id: string; name: string; code: string };
  applicant: { name: string; department: string };
  createdAt: string;
  totalAmount: number;
  loanDeduction?: number;
}

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载报销单列表
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ reports: Report[] }>('/api/reports');
      setReports(data.reports || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建报销单
  const createReport = useCallback(async (report: Omit<Report, 'id' | 'createdAt'>) => {
    const data = await apiRequest<{ report: Report }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
    setReports(prev => [data.report, ...prev]);
    return data.report;
  }, []);

  // 更新报销单
  const updateReport = useCallback(async (id: string, updates: Partial<Report>) => {
    const data = await apiRequest<{ report: Report }>(`/api/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setReports(prev => prev.map(r => r.id === id ? data.report : r));
    return data.report;
  }, []);

  // 更新报销单状态
  const updateReportStatus = useCallback(async (id: string, status: Report['status']) => {
    const data = await apiRequest<{ report: Report }>(`/api/reports/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setReports(prev => prev.map(r => r.id === id ? data.report : r));
    return data.report;
  }, []);

  // 删除报销单
  const deleteReport = useCallback(async (id: string) => {
    await apiRequest(`/api/reports/${id}`, { method: 'DELETE' });
    setReports(prev => prev.filter(r => r.id !== id));
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return {
    reports,
    setReports,
    loading,
    error,
    loadReports,
    createReport,
    updateReport,
    updateReportStatus,
    deleteReport,
  };
}

// ============= 借款记录 API =============
export interface LoanRecord {
  id: string;
  title: string;
  status: 'draft' | 'submitted' | 'paid';
  amount: number;
  purpose: string;
  payee: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  project: { id: string; name: string; code: string };
  applicant: { name: string; department: string };
  attachments: Array<{ name: string; data: string; type: string }>;
  createdAt: string;
  repaidAmount?: number;
}

export function useLoans() {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载借款列表
  const loadLoans = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ loans: LoanRecord[] }>('/api/loans');
      setLoans(data.loans || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建借款
  const createLoan = useCallback(async (loan: Omit<LoanRecord, 'id' | 'createdAt'>) => {
    const data = await apiRequest<{ loan: LoanRecord }>('/api/loans', {
      method: 'POST',
      body: JSON.stringify(loan),
    });
    setLoans(prev => [data.loan, ...prev]);
    return data.loan;
  }, []);

  // 更新借款状态
  const updateLoanStatus = useCallback(async (id: string, status: LoanRecord['status']) => {
    const data = await apiRequest<{ loan: LoanRecord }>(`/api/loans/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setLoans(prev => prev.map(l => l.id === id ? data.loan : l));
    return data.loan;
  }, []);

  // 删除借款
  const deleteLoan = useCallback(async (id: string) => {
    await apiRequest(`/api/loans/${id}`, { method: 'DELETE' });
    setLoans(prev => prev.filter(l => l.id !== id));
  }, []);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  return {
    loans,
    setLoans,
    loading,
    error,
    loadLoans,
    createLoan,
    updateLoanStatus,
    deleteLoan,
  };
}

// ============= 设置 API =============
export interface PaymentAccount {
  id: string;
  bankName: string;
  bankBranch?: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

export interface BudgetProject {
  id: string;
  name: string;
  code: string;
  isDefault?: boolean;
}

export function useSettings() {
  const [payees, setPayees] = useState<PaymentAccount[]>([]);
  const [projects, setProjects] = useState<BudgetProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载收款人列表
  const loadPayees = useCallback(async () => {
    try {
      const data = await apiRequest<{ payees: PaymentAccount[] }>('/api/settings/payees');
      setPayees(data.payees || []);
    } catch (err: any) {
      console.error('加载收款人失败:', err);
    }
  }, []);

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const data = await apiRequest<{ projects: BudgetProject[] }>('/api/settings/projects');
      setProjects(data.projects || []);
    } catch (err: any) {
      console.error('加载项目失败:', err);
    }
  }, []);

  // 加载所有设置
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadPayees(), loadProjects()]);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loadPayees, loadProjects]);

  // 创建收款人
  const createPayee = useCallback(async (payee: Omit<PaymentAccount, 'id'>) => {
    const data = await apiRequest<{ payee: PaymentAccount }>('/api/settings/payees', {
      method: 'POST',
      body: JSON.stringify(payee),
    });
    setPayees(prev => [...prev, data.payee]);
    return data.payee;
  }, []);

  // 更新收款人
  const updatePayee = useCallback(async (id: string, updates: Partial<PaymentAccount>) => {
    const data = await apiRequest<{ payee: PaymentAccount }>(`/api/settings/payees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setPayees(prev => prev.map(p => p.id === id ? data.payee : p));
    return data.payee;
  }, []);

  // 删除收款人
  const deletePayee = useCallback(async (id: string) => {
    await apiRequest(`/api/settings/payees/${id}`, { method: 'DELETE' });
    setPayees(prev => prev.filter(p => p.id !== id));
  }, []);

  // 创建项目
  const createProject = useCallback(async (project: Omit<BudgetProject, 'id'>) => {
    const data = await apiRequest<{ project: BudgetProject }>('/api/settings/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
    setProjects(prev => [...prev, data.project]);
    return data.project;
  }, []);

  // 更新项目
  const updateProject = useCallback(async (id: string, updates: Partial<BudgetProject>) => {
    const data = await apiRequest<{ project: BudgetProject }>(`/api/settings/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setProjects(prev => prev.map(p => p.id === id ? data.project : p));
    return data.project;
  }, []);

  // 删除项目
  const deleteProject = useCallback(async (id: string) => {
    await apiRequest(`/api/settings/projects/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    payees,
    projects,
    loading,
    error,
    loadSettings,
    loadPayees,
    loadProjects,
    createPayee,
    updatePayee,
    deletePayee,
    createProject,
    updateProject,
    deleteProject,
  };
}

// ============= AI 识别 API =============
export interface RecognitionResult {
  success: boolean;
  type: 'invoice' | 'approval' | 'voice' | 'travel';
  data: {
    // 发票信息
    invoiceNumber?: string;
    invoiceDate?: string;
    totalAmount?: number;
    sellerName?: string;
    buyerName?: string;
    items?: Array<{ name: string; amount: number; quantity?: number }>;
    // 审批单信息
    approvalNumber?: string;
    approvalDate?: string;
    applicant?: string;
    department?: string;
    reason?: string;
    // 语音转文字
    text?: string;
    // 差旅信息
    trips?: Array<{
      date: string;
      from: string;
      to: string;
      type: string;
      amount: number;
    }>;
  };
}

export async function recognizeDocument(file: File | Blob, type: 'invoice' | 'approval' | 'voice' | 'travel'): Promise<RecognitionResult> {
  // 将文件转为 base64
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // 移除 data:xxx;base64, 前缀
    };
    reader.readAsDataURL(file);
  });

  const data = await apiRequest<RecognitionResult>('/api/ai/recognize', {
    method: 'POST',
    body: JSON.stringify({
      type,
      data: base64,
      mimeType: file.type,
    }),
  });

  return data;
}

// ============= 统计 API =============
export interface Statistics {
  totalPending: number;
  totalProcessing: number;
  totalPaid: number;
  activeLoanAmount: number;
  monthlyData: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
}

export async function getStatistics(): Promise<Statistics> {
  return apiRequest<Statistics>('/api/statistics/overview');
}
