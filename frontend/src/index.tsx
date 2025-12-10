/**
 * 易报销系统 - 新入口文件（模块化版本）
 * 整合所有模块化组件和状态管理
 * UI 样式与原版 index.tsx 保持一致
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home, Briefcase, Plus, FileText, Wallet, Plane,
  Clock, Settings, LogOut, ChevronLeft, ChevronRight, User
} from 'lucide-react';

// 导入类型
import type {
  AppUser, UserSettings, ExpenseItem, Report, LoanRecord, ViewType, ReportStatus
} from './types';
import { DEFAULT_USER_ID, INITIAL_SETTINGS } from './constants';
import { apiRequest } from './utils/api';
import { debounce } from './utils/debounce';
import { initPerformanceMonitoring, markPerformance, type PerformanceMetrics } from './utils/performance';

// 导入模块化组件
import { LoginView } from './components/auth/LoginView';
import { OverviewView } from './components/overview/OverviewView';
import { LedgerView } from './components/ledger/LedgerView';
import { RecordView } from './components/record/RecordView';
import { CreateReportView } from './components/report/CreateReportView';
import { CreateTravelReportView } from './components/report/CreateTravelReportView';
import { ReportDetailView } from './components/report/ReportDetailView';
import { LoanView } from './components/loan/LoanView';
import { LoanDetailView } from './components/loan/LoanDetailView';
import { HistoryView } from './components/history/HistoryView';
import { SettingsView } from './components/settings/SettingsView';
import { ProfileView } from './components/settings/ProfileView';
import { AppLogo } from './components/shared/AppLogo';

import './index.css';

// ============ 辅助函数 ============

/**
 * 判断记录是否为最近创建的本地记录(可能尚未同步到服务器)
 * @param record 报销单或借款单记录
 * @param maxAgeMs 最大年龄(毫秒),默认5分钟
 * @returns 是否为最近创建的记录
 */
const isRecentlyCreated = (record: Report | LoanRecord, maxAgeMs = 5 * 60 * 1000): boolean => {
  // Report使用createdDate, LoanRecord使用date
  const dateStr = 'createdDate' in record ? record.createdDate : record.date;
  const createdTime = new Date(dateStr).getTime();
  return Date.now() - createdTime < maxAgeMs;
};

const getUserId = (user: AppUser | null): string => {
  return user?.id || DEFAULT_USER_ID;
};

// ============ 侧边栏项组件（原版样式）============
const SidebarItem = ({ active, icon, label, onClick, collapsed }: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  collapsed: boolean;
}) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} ${collapsed ? 'px-3' : 'px-4'} py-3 rounded-xl transition-all duration-200 group font-medium text-sm ${active ? "bg-slate-100 text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
  >
    <span className={`${active ? "text-slate-700" : "text-slate-400 group-hover:text-slate-600"}`}>{icon}</span>
    {!collapsed && <span>{label}</span>}
  </button>
);

// ============ 底部导航按钮组件（原版样式）============
const TabButton = ({ active, icon, label, onClick }: {
  active: boolean;
  icon: React.ReactElement;
  label: string;
  onClick: () => void;
}) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 w-16 py-1 ${active ? "text-slate-700" : "text-slate-400"}`}>
    {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 } as any)}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

// ============ 主应用组件（原版 UI 样式）============
const MainApp = ({ user, onLogout }: { user: AppUser; onLogout: () => void }) => {
  // 视图管理
  const [view, setView] = useState<ViewType>('dashboard');
  const [dataLoading, setDataLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(false); // 是否自动触发打印
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // 移动端快捷菜单

  // ============ 设置状态 ============
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('reimb_settings_v8');
    if (saved) {
      const parsed = JSON.parse(saved);
      const currentUser = {
        ...parsed.currentUser,
        ...user,
        role: user.role || parsed.currentUser?.role || 'admin',
        email: user.email || parsed.currentUser?.email || `${user.id}@example.com` // 确保 email 字段存在
      };
      return { ...parsed, currentUser };
    }
    const currentUser = {
      ...INITIAL_SETTINGS.currentUser,
      ...user,
      role: user.role || 'admin',
      email: user.email || `${user.id}@example.com` // 确保 email 字段存在
    };
    return { ...INITIAL_SETTINGS, currentUser, users: [currentUser] };
  });

  // ============ 数据状态 ============
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    const saved = localStorage.getItem('reimb_expenses_v1');
    return saved ? JSON.parse(saved) : [];
  });

  const [reports, setReports] = useState<Report[]>(() => {
    const saved = localStorage.getItem('reimb_reports_v1');
    return saved ? JSON.parse(saved) : [];
  });

  const [loans, setLoans] = useState<LoanRecord[]>(() => {
    const saved = localStorage.getItem('reimb_loans_v1');
    return saved ? JSON.parse(saved) : [];
  });

  // ============ 数据加载 ============
  useEffect(() => {
    const loadData = async () => {
      const userId = getUserId(user);
      console.log('[数据加载] 开始加载数据, userId:', userId);
      setDataLoading(true);
      try {
        // 并行加载所有数据
        const [expensesRes, reportsRes, loansRes, payeesRes, projectsRes] = await Promise.all([
          apiRequest(`/api/expenses?userId=${userId}`).catch((e) => {
            console.error('[数据加载] 加载费用失败:', e);
            return { expenses: null };
          }),
          apiRequest(`/api/reports?userId=${userId}`).catch((e) => {
            console.error('[数据加载] 加载报销单失败:', e);
            return { reports: null };
          }),
          apiRequest(`/api/loans?userId=${userId}`).catch((e) => {
            console.error('[数据加载] 加载借款单失败:', e);
            return { loans: null };
          }),
          apiRequest(`/api/settings/payees?userId=${userId}`).catch(() => ({ payees: [] })),
          apiRequest(`/api/settings/projects?userId=${userId}`).catch(() => ({ projects: [] })),
        ]);

        // API 返回的数据
        const apiExpenses = (expensesRes as any).expenses;
        const apiReports = (reportsRes as any).reports;
        const apiLoans = (loansRes as any).loans;
        
        console.log('[数据加载] API 返回: expenses=' + (apiExpenses?.length ?? 'null') + ', reports=' + (apiReports?.length ?? 'null') + ', loans=' + (apiLoans?.length ?? 'null'));

        // ============ 智能数据合并逻辑 ============
        // 策略: API成功时使用API数据,但保留本地新创建未同步的记录

        // Expenses: 简单策略(无创建时间,直接使用API数据)
        if (apiExpenses !== null) {
          setExpenses(apiExpenses);
        } else {
          console.warn('[数据加载] Expenses API失败,保留本地缓存');
        }

        // Reports: 智能合并策略
        if (apiReports !== null) {
          // 查找本地有但API没有的最近记录(可能尚未同步)
          const localOnlyReports = reports.filter(r =>
            !apiReports.some((ar: Report) => ar.id === r.id) &&
            isRecentlyCreated(r)
          );

          // 合并: API数据 + 本地待同步数据
          setReports([...apiReports, ...localOnlyReports]);

          if (localOnlyReports.length > 0) {
            console.warn('[数据加载] 发现', localOnlyReports.length, '条待同步报销单');
          }
        } else {
          console.warn('[数据加载] Reports API失败,保留本地缓存');
        }

        // Loans: 智能合并策略
        if (apiLoans !== null) {
          // 查找本地有但API没有的最近记录(可能尚未同步)
          const localOnlyLoans = loans.filter(l =>
            !apiLoans.some((al: LoanRecord) => al.id === l.id) &&
            isRecentlyCreated(l)
          );

          // 合并: API数据 + 本地待同步数据
          setLoans([...apiLoans, ...localOnlyLoans]);

          if (localOnlyLoans.length > 0) {
            console.warn('[数据加载] 发现', localOnlyLoans.length, '条待同步借款单');
          }
        } else {
          console.warn('[数据加载] Loans API失败,保留本地缓存');
        }

        setSettings(prev => ({
          ...prev,
          payees: (payeesRes as any).payees || prev.payees,
          projects: (projectsRes as any).projects || prev.projects,
        }));
      } catch (error) {
        console.error('[数据加载] 数据加载失败:', error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [user]);

  // ============ 性能监控初始化 ============
  useEffect(() => {
    // 初始化性能监控(仅执行一次)
    initPerformanceMonitoring((metrics: PerformanceMetrics) => {
      console.log('[性能监控] 性能指标汇总:', metrics);

      // TODO: 在生产环境中,将metrics上报到监控系统
      // 例如: sendToAnalytics('performance', metrics);

      // 临时存储到localStorage供开发调试
      if (process.env.NODE_ENV === 'development') {
        localStorage.setItem('perf_metrics', JSON.stringify({
          ...metrics,
          timestamp: Date.now(),
          url: window.location.pathname,
        }));
      }
    });

    // 标记应用启动时间
    markPerformance('app-start');
  }, []); // 空依赖数组,只执行一次

  // ============ 本地存储同步(防抖优化) ============
  // 创建防抖保存函数(500ms内多次变更只写一次,提升性能)
  const saveToLocalStorageDebounced = useCallback(
    debounce((key: string, data: any) => {
      localStorage.setItem(key, JSON.stringify(data));
    }, 500),
    []
  );

  // 使用防抖写入localStorage
  useEffect(() => {
    saveToLocalStorageDebounced('reimb_settings_v8', settings);
  }, [settings, saveToLocalStorageDebounced]);

  useEffect(() => {
    saveToLocalStorageDebounced('reimb_expenses_v1', expenses);
  }, [expenses, saveToLocalStorageDebounced]);

  useEffect(() => {
    saveToLocalStorageDebounced('reimb_reports_v1', reports);
  }, [reports, saveToLocalStorageDebounced]);

  useEffect(() => {
    saveToLocalStorageDebounced('reimb_loans_v1', loans);
  }, [loans, saveToLocalStorageDebounced]);

  // 页面卸载时强制写入,防止数据丢失
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.setItem('reimb_settings_v8', JSON.stringify(settings));
      localStorage.setItem('reimb_expenses_v1', JSON.stringify(expenses));
      localStorage.setItem('reimb_reports_v1', JSON.stringify(reports));
      localStorage.setItem('reimb_loans_v1', JSON.stringify(loans));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [settings, expenses, reports, loans]);

  // ============ 业务逻辑处理函数 ============

  const addExpense = async (expense: ExpenseItem) => {
    const userId = getUserId(user);
    try {
      const result = await apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({ ...expense, userId }),
      }) as { expense: ExpenseItem };
      setExpenses((prev) => [result.expense || { ...expense, userId: DEFAULT_USER_ID }, ...prev]);
    } catch (error) {
      console.error('创建费用失败:', error);
      setExpenses((prev) => [expense, ...prev]);
    }
    setView('ledger');
  };

  const updateExpensesStatus = async (ids: string[], status: 'pending' | 'processing' | 'done') => {
    setExpenses(prev => prev.map(e => ids.includes(e.id) ? { ...e, status } : e));

    try {
      const userId = getUserId(user);
      await Promise.all(ids.map(id =>
        apiRequest(`/api/expenses/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status, userId }),
        })
      ));
    } catch (error) {
      console.error('更新费用状态失败:', error);
    }
  };

  const handleReportAction = async (report: Report, action: 'save' | 'print') => {
    const userId = getUserId(user);
    const status: 'draft' | 'submitted' | 'paid' = action === 'print' ? 'submitted' : 'draft';
    const expenseStatus: 'pending' | 'processing' | 'done' = action === 'print' ? 'processing' : 'pending';

    const newReport = { ...report, status };
    let savedReport = newReport;

    console.warn('[保存报销单] 开始保存, action:', action, 'userId:', userId);
    console.warn('[保存报销单] userSnapshot:', JSON.stringify(newReport.userSnapshot));

    try {
      const requestBody = { ...newReport, userId };
      const bodySize = JSON.stringify(requestBody).length;
      console.warn('[保存报销单] 请求体大小:', bodySize, '字节', `(${(bodySize / 1024 / 1024).toFixed(2)} MB)`);

      // 检查请求体大小，超过 90MB 时警告
      if (bodySize > 90 * 1024 * 1024) {
        console.error('[保存报销单] 请求体过大，可能导致保存失败');
        alert(`报销单数据过大（${(bodySize / 1024 / 1024).toFixed(1)} MB），请减少附件数量或压缩图片后重试`);
        return;
      }

      const result = await apiRequest('/api/reports', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }) as { report: Report };

      console.warn('[保存报销单] 保存成功, id:', result.report?.id);
      savedReport = result.report || { ...newReport, userId: DEFAULT_USER_ID };
      setReports(prev => [savedReport, ...prev]);
    } catch (error: any) {
      console.error('[保存报销单] 创建失败:', error?.message || error);
      console.error('[保存报销单] 错误详情:', JSON.stringify(error));

      // 显示用户友好的错误提示
      const errorMsg = error?.message || '未知错误';
      if (errorMsg.includes('413') || errorMsg.includes('too large') || errorMsg.includes('payload')) {
        alert('报销单数据过大，请减少附件数量或压缩图片后重试');
      } else if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
        alert('保存超时，请检查网络后重试');
      } else {
        alert(`保存失败: ${errorMsg}\n\n请检查网络连接后重试`);
      }
      // 不再将失败的数据添加到本地列表，避免用户误以为保存成功
      return;
    }

    // 更新关联的费用项状态
    const linkedExpenseIds = (report as any).linkedExpenseIds || (report as any).aiRecognitionData?.linkedExpenseIds || [];
    if (linkedExpenseIds.length > 0) {
      updateExpensesStatus(linkedExpenseIds, expenseStatus);
    }

    if (action === 'print') {
      // 打印模式：跳转到报销单详情页面，自动触发打印
      setSelectedId(savedReport.id);
      setAutoPrint(true);
      setView('report-detail');
    } else {
      // 保存模式：跳转到历史记录
      setView('history');
    }
  };

  const handleLoanAction = async (loan: LoanRecord, action: 'save' | 'print') => {
    const userId = getUserId(user);
    const status: ReportStatus = action === 'print' ? 'submitted' : 'draft';

    const newLoan = { ...loan, status };
    let savedLoan = newLoan;

    console.warn('[保存借款单] 开始保存, action:', action, 'userId:', userId);
    console.warn('[保存借款单] userSnapshot:', JSON.stringify(newLoan.userSnapshot));

    try {
      const requestBody = { ...newLoan, userId };
      const bodySize = JSON.stringify(requestBody).length;
      console.warn('[保存借款单] 请求体大小:', bodySize, '字节', `(${(bodySize / 1024 / 1024).toFixed(2)} MB)`);

      // 检查请求体大小，如果过大提前警告
      if (bodySize > 90 * 1024 * 1024) {
        console.error('[保存借款单] 请求体过大，可能导致保存失败');
        alert(`借款单数据过大（${(bodySize / 1024 / 1024).toFixed(1)} MB），请减少附件数量或压缩图片后重试`);
        return;
      }

      const result = await apiRequest('/api/loans', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }) as { loan: LoanRecord };

      console.warn('[保存借款单] 保存成功, id:', result.loan?.id);
      savedLoan = result.loan || { ...newLoan, userId: DEFAULT_USER_ID };
      setLoans(prev => [savedLoan, ...prev]);
    } catch (error: any) {
      console.error('[保存借款单] 创建失败:', error?.message || error);
      // 保存失败时显示错误信息，不添加到本地状态
      const errorMsg = error?.message || '未知错误';
      if (errorMsg.includes('413') || errorMsg.includes('too large') || errorMsg.includes('payload')) {
        alert('借款单数据过大，请减少附件数量或压缩图片后重试');
      } else if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
        alert('保存超时，请检查网络后重试');
      } else {
        alert(`保存失败: ${errorMsg}\n\n请检查网络连接后重试`);
      }
      // 保存失败，不添加到本地状态，直接返回
      return;
    }

    if (action === 'print') {
      // 打印模式：跳转到借款单详情页面
      setSelectedId(savedLoan.id);
      setAutoPrint(true);
      setView('loan-detail');
    } else {
      // 保存模式：跳转到历史记录
      setView('history');
    }
  };

  const deleteRecord = async (id: string, type: 'report' | 'loan') => {
    const userId = getUserId(user);
    console.warn(`[删除记录] 开始删除, id: ${id}, type: ${type}, userId: ${userId}`);

    if (type === 'report') {
      // 先保存当前记录，以便删除失败时恢复
      const originalReports = [...reports];
      setReports(prev => prev.filter(r => r.id !== id));
      try {
        await apiRequest(`/api/reports/${id}?userId=${userId}`, { method: 'DELETE' });
        console.warn('[删除记录] 报销单删除成功');
      } catch (error) {
        console.error('[删除记录] 删除报销单失败:', error);
        // 删除失败时恢复本地状态
        setReports(originalReports);
        alert('删除失败，请重试');
        return;
      }
    } else {
      // 先保存当前记录，以便删除失败时恢复
      const originalLoans = [...loans];
      setLoans(prev => prev.filter(l => l.id !== id));
      try {
        await apiRequest(`/api/loans/${id}?userId=${userId}`, { method: 'DELETE' });
        console.warn('[删除记录] 借款单删除成功');
      } catch (error) {
        console.error('[删除记录] 删除借款失败:', error);
        // 删除失败时恢复本地状态
        setLoans(originalLoans);
        alert('删除失败，请重试');
        return;
      }
    }
    setView('history');
  };

  const completeReimbursement = async (id: string, type: 'report' | 'loan') => {
    const userId = getUserId(user);
    console.warn(`[完成报销] 开始更新, id: ${id}, type: ${type}, userId: ${userId}`);
    
    if (type === 'report') {
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'paid' } : r));
      const report = reports.find((r: any) => r.id === id);
      if (report) {
        // 优先使用 aiRecognitionData 中存储的关联记账本 ID
        const linkedExpenseIds = (report as any).aiRecognitionData?.linkedExpenseIds || [];
        if (linkedExpenseIds.length > 0) {
          updateExpensesStatus(linkedExpenseIds, 'done');
        }
      }
      try {
        const result = await apiRequest(`/api/reports/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ userId, status: 'paid' }),
        });
        console.warn('[完成报销] 报销单状态更新成功:', result);
      } catch (error) {
        console.error('[完成报销] 更新报销单状态失败:', error);
      }
    } else {
      setLoans(prev => prev.map(l => l.id === id ? { ...l, status: 'paid' } : l));
      try {
        const result = await apiRequest(`/api/loans/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ userId, status: 'paid' }),
        });
        console.warn('[完成报销] 借款状态更新成功:', result);
      } catch (error) {
        console.error('[完成报销] 更新借款状态失败:', error);
      }
    }
  };

  // ============ 渲染（原版 UI 布局）============
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex print:bg-white print:block">
      {/* Sidebar - 原版样式 */}
      <aside className={`hidden md:flex flex-col ${sidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-200 h-screen sticky top-0 z-40 print:hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 relative`}>
        {/* Collapse/Expand Toggle Button - 压在分割线上 */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-8 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors z-50"
          title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo */}
        <div className={`${sidebarCollapsed ? 'p-4' : 'p-8 pb-4'} flex items-center ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className={`flex items-center ${sidebarCollapsed ? '' : 'gap-3'}`}>
            <AppLogo className="w-9 h-9" />
            {!sidebarCollapsed && <span className="text-xl font-bold tracking-tight text-slate-900">易报销 Pro</span>}
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-4'} py-4 space-y-1`}>
          <SidebarItem collapsed={sidebarCollapsed} active={view === "dashboard"} icon={<Home size={18} />} label="概览" onClick={() => setView("dashboard")} />
          <SidebarItem collapsed={sidebarCollapsed} active={view === "ledger"} icon={<Briefcase size={18} />} label="记账本" onClick={() => setView("ledger")} />
          <SidebarItem collapsed={sidebarCollapsed} active={view === "record"} icon={<Plus size={18} />} label="快速记账" onClick={() => setView("record")} />

          {/* 业务申请分类 */}
          {!sidebarCollapsed && <div className="py-4 px-2"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">业务申请</p></div>}
          {sidebarCollapsed && <div className="py-2 border-t border-slate-100 my-2"></div>}
          <SidebarItem collapsed={sidebarCollapsed} active={view === "create"} icon={<FileText size={18} />} label="通用报销" onClick={() => setView("create")} />
          <SidebarItem collapsed={sidebarCollapsed} active={view === "loan"} icon={<Wallet size={18} />} label="借款申请" onClick={() => setView("loan")} />
          <SidebarItem collapsed={sidebarCollapsed} active={view === "create-travel"} icon={<Plane size={18} />} label="差旅报销" onClick={() => setView("create-travel")} />
          <SidebarItem collapsed={sidebarCollapsed} active={view === "history"} icon={<Clock size={18} />} label="历史记录" onClick={() => setView("history")} />

          {/* 管理分类 */}
          {!sidebarCollapsed && <div className="py-4 px-2"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">管理</p></div>}
          {sidebarCollapsed && <div className="py-2 border-t border-slate-100 my-2"></div>}
          <SidebarItem collapsed={sidebarCollapsed} active={view === "settings"} icon={<Settings size={18} />} label="系统设置" onClick={() => setView("settings")} />
        </nav>

        {/* User Info - 原版卡片样式 */}
        <div className={`${sidebarCollapsed ? 'p-2 m-2' : 'p-4 m-4'} bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 relative`}>
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                title={user.name}
              >
                {user.name.charAt(0)}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 hover:bg-white/50 rounded-lg p-1 -m-1 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold shadow-sm">
                {user.name.charAt(0)}
              </div>
              <div className="overflow-hidden flex-1 text-left">
                <p className="text-sm font-bold truncate text-slate-800">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.department}</p>
              </div>
              <ChevronRight size={16} className={`text-slate-400 transition-transform ${userMenuOpen ? 'rotate-90' : ''}`} />
            </button>
          )}

          {/* 用户菜单弹窗 - 原版样式 */}
          {userMenuOpen && (
            <div
              className="fixed inset-0 z-[100]"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setUserMenuOpen(false);
                }
              }}
            >
              <div
                className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[101] min-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-200"
                style={{
                  bottom: '100px',
                  left: sidebarCollapsed ? '80px' : '20px',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
                  <p className="text-sm font-bold text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => { setView("profile"); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <User size={16} className="text-slate-600" />
                    <span>个人信息管理</span>
                  </button>
                </div>
                <div className="p-1 border-t border-slate-100">
                  <button
                    onClick={() => { onLogout(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut size={16} />
                    <span>退出登录</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content - 原版样式 */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible relative">
        {/* Mobile Header - 原版样式 */}
        <header className="md:hidden bg-white/80 backdrop-blur-md sticky top-0 z-10 px-4 py-3 flex justify-between items-center border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2 font-bold text-lg text-slate-800">
            <AppLogo className="w-7 h-7" />
            <span>易报销</span>
          </div>
        </header>

        {/* 主内容区 - 移动端需要底部内边距避免被固定导航栏遮挡 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8 print:p-0">
          <div className="max-w-7xl mx-auto print:max-w-none print:mx-0">
            {dataLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-600">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                  <span>加载中...</span>
                </div>
              </div>
            ) : (
              <>
                {view === "dashboard" && <OverviewView expenses={expenses} reports={reports} loans={loans} onNavigate={setView} />}
                {view === "ledger" && <LedgerView expenses={expenses} setExpenses={setExpenses} />}
                {view === "record" && <RecordView onSave={addExpense} onBack={() => setView("dashboard")} />}
                {view === "create" && (
                  <CreateReportView
                    settings={settings}
                    expenses={expenses}
                    setExpenses={setExpenses}
                    loans={loans}
                    onAction={handleReportAction}
                    onBack={() => setView("dashboard")}
                  />
                )}
                {view === "create-travel" && (
                  <CreateTravelReportView
                    settings={settings}
                    loans={loans}
                    onAction={handleReportAction}
                    onBack={() => setView("dashboard")}
                  />
                )}
                {view === "loan" && (
                  <LoanView
                    settings={settings}
                    onAction={handleLoanAction}
                    onBack={() => setView("dashboard")}
                  />
                )}
                {view === "history" && (
                  <HistoryView
                    reports={reports}
                    loans={loans}
                    onDelete={deleteRecord}
                    onComplete={completeReimbursement}
                    onSelect={(id: string, type: string) => {
                      setSelectedId(id);
                      setView(type === 'report' ? 'report-detail' : 'loan-detail');
                    }}
                  />
                )}
                {view === "settings" && <SettingsView settings={settings} onUpdate={setSettings} onNavigate={setView} />}
                {view === "profile" && <ProfileView settings={settings} onSave={setSettings} />}
                {view === "report-detail" && selectedId && (
                  <ReportDetailView
                    report={reports.find((r) => r.id === selectedId)!}
                    onUpdate={(r: Report) => setReports(prev => prev.map(old => old.id === r.id ? r : old))}
                    onBack={() => setView("history")}
                    autoPrint={autoPrint}
                    onPrintDone={() => {
                      setAutoPrint(false);
                      setView("history"); // 打印完成后返回历史记录
                    }}
                  />
                )}
                {view === "loan-detail" && selectedId && (
                  <LoanDetailView
                    loan={loans.find((l) => l.id === selectedId)!}
                    onUpdate={(l: LoanRecord) => setLoans(prev => prev.map(old => old.id === l.id ? l : old))}
                    onBack={() => setView("history")}
                    autoPrint={autoPrint}
                    onPrintDone={() => {
                      setAutoPrint(false);
                      setView("history"); // 打印完成后返回历史记录
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Quick Menu Overlay - 点击空白关闭 */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/30 z-30 print:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Quick Menu - 更多快捷操作菜单 */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl p-4 z-40 print:hidden animate-[fadeInUp_0.2s_ease-out]">
          <div className="text-xs font-bold text-slate-500 text-center mb-3 uppercase tracking-wide">更多操作</div>
          <div className="grid grid-cols-2 gap-3 min-w-[220px]">
            <button
              onClick={() => { setView("record"); setMobileMenuOpen(false); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Plus size={24} />
              </div>
              <span className="text-xs font-medium text-slate-700">快速记账</span>
            </button>
            <button
              onClick={() => { setView("create"); setMobileMenuOpen(false); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <FileText size={24} />
              </div>
              <span className="text-xs font-medium text-slate-700">通用报销</span>
            </button>
            <button
              onClick={() => { setView("create-travel"); setMobileMenuOpen(false); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Plane size={24} />
              </div>
              <span className="text-xs font-medium text-slate-700">差旅报销</span>
            </button>
            <button
              onClick={() => { setView("loan"); setMobileMenuOpen(false); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Wallet size={24} />
              </div>
              <span className="text-xs font-medium text-slate-700">借款申请</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Tab Bar - 5个按钮：概览、账本、更多、历史、设置 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 pb-safe z-20 print:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <TabButton active={view === "dashboard"} icon={<Home />} label="概览" onClick={() => setView("dashboard")} />
        <TabButton active={view === "ledger"} icon={<Briefcase />} label="账本" onClick={() => setView("ledger")} />
        <div className="relative -top-6">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className={`w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg transition-all duration-200 ${mobileMenuOpen ? 'bg-slate-600 rotate-45 shadow-slate-200' : 'bg-indigo-600 shadow-indigo-200 hover:scale-105'}`}
          >
            <Plus size={28} />
          </button>
        </div>
        <TabButton active={view === "history"} icon={<Clock />} label="历史" onClick={() => setView("history")} />
        <TabButton active={view === "settings"} icon={<Settings />} label="设置" onClick={() => setView("settings")} />
      </div>
    </div>
  );
};

// ============ 根应用组件 ============
const App = () => {
  const [user, setUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('reimb_user_v1');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (newUser: AppUser) => {
    localStorage.setItem('reimb_user_v1', JSON.stringify(newUser));
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('reimb_user_v1');
    setUser(null);
  };

  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  return <MainApp user={user} onLogout={handleLogout} />;
};

// ============ 应用初始化 ============
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
