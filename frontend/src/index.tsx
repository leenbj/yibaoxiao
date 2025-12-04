/**
 * 易报销系统 - 新入口文件（模块化版本）
 * 整合所有模块化组件和状态管理
 * UI 样式与原版 index.tsx 保持一致
 */

import React, { useState, useEffect } from 'react';
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

// ============ 获取用户ID的辅助函数 ============
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // 移动端快捷菜单

  // ============ 设置状态 ============
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('reimb_settings_v8');
    if (saved) {
      const parsed = JSON.parse(saved);
      const currentUser = {
        ...parsed.currentUser,
        ...user,
        role: user.role || parsed.currentUser?.role || 'admin'
      };
      return { ...parsed, currentUser };
    }
    const currentUser = {
      ...INITIAL_SETTINGS.currentUser,
      ...user,
      role: user.role || 'admin'
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
      setDataLoading(true);
      try {
        // 并行加载所有数据
        const [expensesRes, reportsRes, loansRes, payeesRes, projectsRes] = await Promise.all([
          apiRequest(`/api/expenses?userId=${userId}`).catch(() => ({ expenses: [] })),
          apiRequest(`/api/reports?userId=${userId}`).catch(() => ({ reports: [] })),
          apiRequest(`/api/loans?userId=${userId}`).catch(() => ({ loans: [] })),
          apiRequest(`/api/settings/payees?userId=${userId}`).catch(() => ({ payees: [] })),
          apiRequest(`/api/settings/projects?userId=${userId}`).catch(() => ({ projects: [] })),
        ]);

        setExpenses((expensesRes as any).expenses || []);
        setReports((reportsRes as any).reports || []);
        setLoans((loansRes as any).loans || []);

        setSettings(prev => ({
          ...prev,
          payees: (payeesRes as any).payees || prev.payees,
          projects: (projectsRes as any).projects || prev.projects,
        }));
      } catch (error) {
        console.error('数据加载失败:', error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [user]);

  // ============ 本地存储同步 ============
  useEffect(() => localStorage.setItem('reimb_settings_v8', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('reimb_expenses_v1', JSON.stringify(expenses)), [expenses]);
  useEffect(() => localStorage.setItem('reimb_reports_v1', JSON.stringify(reports)), [reports]);
  useEffect(() => localStorage.setItem('reimb_loans_v1', JSON.stringify(loans)), [loans]);

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

    try {
      const result = await apiRequest('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ ...newReport, userId }),
      }) as { report: Report };
      setReports(prev => [result.report || { ...newReport, userId: DEFAULT_USER_ID }, ...prev]);
    } catch (error) {
      console.error('创建报销单失败:', error);
      setReports(prev => [newReport, ...prev]);
    }

    // 更新关联的费用项状态
    const linkedExpenseIds = (report as any).linkedExpenseIds || (report as any).aiRecognitionData?.linkedExpenseIds || [];
    if (linkedExpenseIds.length > 0) {
      updateExpensesStatus(linkedExpenseIds, expenseStatus);
    }

    setView('history');
  };

  const handleLoanAction = async (loan: LoanRecord, action: 'save' | 'print') => {
    const userId = getUserId(user);
    const status: ReportStatus = action === 'print' ? 'submitted' : 'draft';

    const newLoan = { ...loan, status };

    try {
      const result = await apiRequest('/api/loans', {
        method: 'POST',
        body: JSON.stringify({ ...newLoan, userId }),
      }) as { loan: LoanRecord };
      setLoans(prev => [result.loan || { ...newLoan, userId: DEFAULT_USER_ID }, ...prev]);
    } catch (error) {
      console.error('创建借款单失败:', error);
      setLoans(prev => [newLoan, ...prev]);
    }

    setView('history');
  };

  const deleteRecord = async (id: string, type: 'report' | 'loan') => {
    if (type === 'report') {
      setReports(prev => prev.filter(r => r.id !== id));
      try {
        await apiRequest(`/api/reports/${id}`, { method: 'DELETE' });
      } catch (error) {
        console.error('删除报销单失败:', error);
      }
    } else {
      setLoans(prev => prev.filter(l => l.id !== id));
      try {
        await apiRequest(`/api/loans/${id}`, { method: 'DELETE' });
      } catch (error) {
        console.error('删除借款失败:', error);
      }
    }
    setView('history');
  };

  const completeReimbursement = async (id: string, type: 'report' | 'loan') => {
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
        await apiRequest(`/api/reports/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'paid' }),
        });
      } catch (error) {
        console.error('更新报销单状态失败:', error);
      }
    } else {
      setLoans(prev => prev.map(l => l.id === id ? { ...l, status: 'paid' } : l));
      try {
        await apiRequest(`/api/loans/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'paid' }),
        });
      } catch (error) {
        console.error('更新借款状态失败:', error);
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
                  />
                )}
                {view === "loan-detail" && selectedId && (
                  <LoanDetailView
                    loan={loans.find((l) => l.id === selectedId)!}
                    onUpdate={(l: LoanRecord) => setLoans(prev => prev.map(old => old.id === l.id ? l : old))}
                    onBack={() => setView("history")}
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
