import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";
import {
  LogIn,
  LogOut,
  Mail,
  Mic,
  Plus,
  Upload,
  FileText,
  Settings,
  Home,
  CheckCircle,
  Clock,
  Trash2,
  Printer,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Briefcase,
  Check,
  Wallet,
  CreditCard,
  AlertCircle,
  Save,
  Edit2,
  Calendar,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  X,
  FileCheck,
  Receipt,
  Image as ImageIcon,
  Landmark,
  Plane,
  Car,
  MapPin,
  Map,
  ScanLine,
  User,
  Users,
  Building,
  Lock,
  Star,
  MoreHorizontal,
  Activity,
  Info,
  Loader,
  PanelLeftClose,
  PanelLeft,
  AlertTriangle
} from "lucide-react";

// --- Types ---

type ExpenseStatus = "pending" | "processing" | "done"; // 未报销 | 报销中 | 已报销
type ReportStatus = "draft" | "submitted" | "paid"; // 未打印 | 报销中 | 已报销

interface BudgetProject {
  id: string;
  name: string;
  code: string;
  isDefault?: boolean;
}

interface PaymentAccount {
    id: string;
    bankName: string;
    bankBranch?: string;
    accountNumber: string;
    accountName: string; // Holder Name
    isDefault: boolean;
}

interface AppUser {
    id: string;
    name: string;
    department: string;
    email: string;
    role: 'admin' | 'user';
    isCurrent?: boolean;
}

interface UserSettings {
  currentUser: AppUser;
  users: AppUser[];
  budgetProjects: BudgetProject[];
  paymentAccounts: PaymentAccount[];
}

interface ExpenseItem {
  id: string;
  amount: number;
  description: string;
  date: string; // ISO String
  category: string;
  remarks?: string;
  status: ExpenseStatus;
}

interface Attachment {
  type: 'invoice' | 'approval' | 'voucher' | 'other';
  data: string; // base64 image
  name?: string;
}

interface TaxiDetail {
    date: string;
    reason: string;
    startPoint: string;
    endPoint: string;
    amount: number;
    employeeName: string;
}

interface TripLeg {
    dateRange: string; // e.g., 2023.7.29-8.1
    route: string; // e.g., 北京-成都
    
    // Transport
    transportFee: number;
    
    // Accommodation
    hotelLocation: string; // 地区
    hotelDays: number;    // 天数
    hotelFee: number;     // 金额
    
    // Others
    cityTrafficFee: number;
    mealFee: number;
    otherFee: number;
    
    subTotal: number;
}

interface Report {
  id: string;
  title: string; // "发票内容(事项)"
  createdDate: string;
  status: ReportStatus;
  totalAmount: number;
  prepaidAmount: number; // 预支借款抵扣
  payableAmount: number;
  items: ExpenseItem[]; // Keep for data linkage, though in the new flow we mostly rely on the extracted form data
  approvalNumber?: string;
  budgetProject?: BudgetProject;
  paymentAccount?: PaymentAccount;
  attachments: Attachment[]; 
  userSnapshot: AppUser;
  // Specific fields for the form
  invoiceCount?: number;
  // Travel Specific
  isTravel?: boolean;
  tripReason?: string;
  tripLegs?: TripLeg[];
  taxiDetails?: TaxiDetail[];
}

interface LoanRecord {
  id: string;
  amount: number;
  reason: string; // Max 20 chars
  date: string; // Application Date
  approvalNumber?: string;
  status: ReportStatus;
  budgetProject?: BudgetProject;
  attachments: Attachment[];
  paymentMethod: "transfer";
  payeeInfo: PaymentAccount;
  userSnapshot: AppUser;
}

// --- 超级管理员配置 ---
const SUPER_ADMIN_EMAIL = 'wangbo@knet.cn';
const DEFAULT_PASSWORD = '123456';

// --- Initial Data ---
const initialUsers: AppUser[] = [
    { id: "u1", name: "王波", department: "管理部", email: SUPER_ADMIN_EMAIL, role: 'admin', isCurrent: true }
];

const initialSettings: UserSettings = {
  currentUser: initialUsers[0],
  users: initialUsers,
  budgetProjects: [
      { id: "1", name: "嘉年华--人力部", code: "2024321", isDefault: true },
      { id: "2", name: "年度市场推广费", code: "MK-2024-001" },
      { id: "3", name: "海外业务拓展", code: "BD-UK-2025" }
  ],
  paymentAccounts: [
      {
          id: "1",
          bankName: "招商银行",
          bankBranch: "北京中关村支行",
          accountNumber: "6225 8888 8888 6666",
          accountName: "王波",
          isDefault: true
      }
  ]
};

// --- Helpers ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const pdfToImage = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            return canvas.toDataURL("image/jpeg", 0.8);
        }
        return "";
    } catch (e) {
        console.error("PDF Render Error", e);
        return "";
    }
};

const digitToChinese = (n: number) => {
    const fraction = ['角', '分'];
    const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']];
    const head = n < 0 ? '欠' : '';
    n = Math.abs(n);
    let s = '';
    for (let i = 0; i < fraction.length; i++) {
        s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
    }
    s = s || '整';
    n = Math.floor(n);
    for (let i = 0; i < unit[0].length && n > 0; i++) {
        let p = '';
        for (let j = 0; j < unit[1].length && n > 0; j++) {
            p = digit[n % 10] + unit[1][j] + p;
            n = Math.floor(n / 10);
        }
        s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
    }
    return head + s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整');
};

const formatDate = (isoDate: string) => {
    if(!isoDate) return '';
    const d = new Date(isoDate);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateTime = (isoDate: string) => {
    if(!isoDate) return '';
    const d = new Date(isoDate);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Components ---

const AppLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="40" height="40" rx="12" className="fill-indigo-600" />
    <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// --- API 请求工具 ---
const API_BASE_URL = 'http://localhost:3000'; // Motia 后端服务器

const apiRequest = async (path: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('reimb_token');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || '请求失败');
  return data;
};

// --- 登录组件 ---
const LoginView = ({ onLogin }: { onLogin: (user: AppUser, token: string) => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isRegister) {
        // 注册
        await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      
      // 登录
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      
      onLogin(result.user, result.token);
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 左侧 - 图片区域 (50%) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden">
        {/* 背景图片 */}
        <img 
          src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80" 
          alt="Finance Background"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        {/* 渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80" />
        
        {/* 左侧内容 */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <AppLogo className="w-10 h-10" />
            <span className="text-xl font-semibold tracking-tight">易报销 Pro</span>
          </div>
          
          {/* 中间文案 */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight mb-6">
              智能报销<br/>
              <span className="text-slate-400">化繁为简</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              AI 驱动的智能报销系统，自动识别发票、审批单，一键生成报销单据，让财务工作更轻松。
            </p>
          </div>
          
          {/* 底部信息 */}
          <div className="flex items-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>系统运行中</span>
            </div>
            <span>© 2025 易报销 Pro</span>
          </div>
        </div>
      </div>

      {/* 右侧 - 登录表单 (50%) */}
      <div className="flex-1 lg:w-1/2 lg:flex-none flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* 移动端 Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <AppLogo className="w-10 h-10" />
            <span className="text-xl font-semibold text-slate-800">易报销 Pro</span>
          </div>

          {/* 标题 */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">
              {isRegister ? '创建账户' : '欢迎回来'}
            </h2>
            <p className="text-slate-500 mt-2">
              {isRegister ? '填写以下信息开始使用' : '请登录您的账户继续'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">姓名</label>
                  <input
                    type="text"
                    placeholder="请输入姓名"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">部门</label>
                  <input
                    type="text"
                    placeholder="请输入部门"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">邮箱</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">密码</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : null}
              {loading ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>
          </form>

          {/* 分割线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-400">或</span>
            </div>
          </div>

          {/* 切换登录/注册 */}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="w-full py-3 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-all"
          >
            {isRegister ? '已有账户？立即登录' : '没有账户？立即注册'}
          </button>

          {/* 底部条款 */}
          <p className="mt-8 text-center text-xs text-slate-400">
            登录即表示您同意我们的<br/>
            <a href="#" className="text-slate-600 hover:underline">服务条款</a>
            {' '}和{' '}
            <a href="#" className="text-slate-600 hover:underline">隐私政策</a>
          </p>
        </div>
      </div>
    </div>
  );
};

// --- 主应用组件 ---
const MainApp = ({ user, onLogout }: { user: AppUser, onLogout: () => void }) => {
  const [view, setView] = useState<"dashboard" | "ledger" | "record" | "create" | "create-travel" | "loan" | "history" | "settings" | "report-detail" | "loan-detail" | "profile">("dashboard");
  const [dataLoading, setDataLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // 使用用户信息初始化设置
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem("reimb_settings_v8");
    if (saved) {
      const parsed = JSON.parse(saved);
      // 合并登录用户信息，确保保留用户的角色
      const currentUser = { 
        ...parsed.currentUser, 
        ...user,
        role: user.role || parsed.currentUser?.role || 'admin' // 优先使用登录用户的角色
      };
      return { ...parsed, currentUser };
    }
    // 新用户默认为管理员
    const currentUser = { 
      ...initialSettings.currentUser, 
      ...user,
      role: user.role || 'admin'
    };
    return { ...initialSettings, currentUser, users: [currentUser] };
  });
  
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 从后端加载数据
  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true);
      try {
        // 并行加载所有数据
        const [expensesRes, reportsRes, loansRes, payeesRes, projectsRes] = await Promise.all([
          apiRequest('/api/expenses').catch(() => ({ expenses: [] })),
          apiRequest('/api/reports').catch(() => ({ reports: [] })),
          apiRequest('/api/loans').catch(() => ({ loans: [] })),
          apiRequest('/api/settings/payees').catch(() => ({ payees: [] })),
          apiRequest('/api/settings/projects').catch(() => ({ projects: [] })),
        ]);
        
        setExpenses((expensesRes as any).expenses || []);
        setReports((reportsRes as any).reports || []);
        setLoans((loansRes as any).loans || []);
        
        // 更新设置中的收款人和项目
        setSettings(prev => ({
          ...prev,
          payees: (payeesRes as any).payees || prev.payees,
          projects: (projectsRes as any).projects || prev.projects,
        }));
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setDataLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // 保存设置到本地存储（收款人和项目通过 API 管理）
  useEffect(() => localStorage.setItem("reimb_settings_v8", JSON.stringify(settings)), [settings]);

  // --- Logic Hooks (with backend API sync) ---
  const addExpense = async (expense: ExpenseItem) => {
    try {
      // 调用后端 API 创建费用
      const result = await apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(expense),
      }) as { expense: ExpenseItem };
      setExpenses((prev) => [result.expense || expense, ...prev]);
    } catch (error) {
      console.error('创建费用失败:', error);
      // 即使 API 失败，也更新本地状态以保持用户体验
    setExpenses((prev) => [expense, ...prev]);
    }
    setView("ledger");
  };

  const updateExpensesStatus = async (ids: string[], status: ExpenseStatus) => {
    // 先更新本地状态
      setExpenses(prev => prev.map(e => ids.includes(e.id) ? { ...e, status } : e));
    
    // 异步同步到后端
    try {
      await Promise.all(ids.map(id => 
        apiRequest(`/api/expenses/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        })
      ));
    } catch (error) {
      console.error('更新费用状态失败:', error);
    }
  };

  const handleReportAction = async (report: Report, action: 'save' | 'print') => {
      const status: ReportStatus = action === 'print' ? 'submitted' : 'draft';
      const expenseStatus: ExpenseStatus = action === 'print' ? 'processing' : 'pending';
      
      const newReport = { ...report, status };
    
    try {
      // 调用后端 API 创建报销单
      const result = await apiRequest('/api/reports', {
        method: 'POST',
        body: JSON.stringify(newReport),
      }) as { report: Report };
      setReports(prev => [result.report || newReport, ...prev]);
    } catch (error) {
      console.error('创建报销单失败:', error);
      setReports(prev => [newReport, ...prev]);
    }
      
      // Update linked expense statuses (if matched from ledger)
      const linkedIds = report.items.map(i => i.id);
      if(linkedIds.length > 0) {
          updateExpensesStatus(linkedIds, expenseStatus);
      }

      if(action === 'print') {
          setTimeout(() => {
              setSelectedId(report.id);
              setView("report-detail");
              setTimeout(() => window.print(), 500);
          }, 100);
      } else {
          setView("history");
      }
  };

  const handleLoanAction = async (loan: LoanRecord, action: 'save' | 'print') => {
    const status: ReportStatus = action === 'print' ? 'submitted' : 'draft';
    const newLoan = { ...loan, status };
    
    try {
      // 调用后端 API 创建借款
      const result = await apiRequest('/api/loans', {
        method: 'POST',
        body: JSON.stringify(newLoan),
      }) as { loan: LoanRecord };
      setLoans(prev => [result.loan || newLoan, ...prev]);
    } catch (error) {
      console.error('创建借款失败:', error);
    setLoans(prev => [newLoan, ...prev]);
    }
    
    if(action === 'print') {
        setTimeout(() => {
            setSelectedId(loan.id);
            setView("loan-detail");
            setTimeout(() => window.print(), 500);
        }, 100);
    } else {
        setView("history");
    }
  };

  const deleteRecord = async (id: string, type: 'report' | 'loan') => {
      if(confirm("确定删除该记录吗？")) {
          if(type === 'report') {
              const report = reports.find(r => r.id === id);
              if(report) {
                  const linkedIds = report.items.map(i => i.id);
                  updateExpensesStatus(linkedIds, 'pending');
                  setReports(prev => prev.filter(r => r.id !== id));
                
                // 同步删除到后端
                try {
                  await apiRequest(`/api/reports/${id}`, { method: 'DELETE' });
                } catch (error) {
                  console.error('删除报销单失败:', error);
                }
              }
          } else {
              setLoans(prev => prev.filter(l => l.id !== id));
            
            // 同步删除到后端
            try {
              await apiRequest(`/api/loans/${id}`, { method: 'DELETE' });
            } catch (error) {
              console.error('删除借款失败:', error);
            }
          }
          setView("history");
      }
  };

  const completeReimbursement = async (id: string, type: 'report' | 'loan') => {
      if(type === 'report') {
          setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'paid' } : r));
          const report = reports.find(r => r.id === id);
          if(report) {
              updateExpensesStatus(report.items.map(i => i.id), 'done');
          }
        
        // 同步状态到后端
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
        
        // 同步状态到后端
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex print:bg-white print:block">
      {/* Sidebar */}
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
        
        <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-4'} py-4 space-y-1`}>
            <SidebarItem collapsed={sidebarCollapsed} active={view === "dashboard"} icon={<Home size={18}/>} label="概览" onClick={() => setView("dashboard")} />
            <SidebarItem collapsed={sidebarCollapsed} active={view === "ledger"} icon={<Briefcase size={18}/>} label="记账本" onClick={() => setView("ledger")} />
            <SidebarItem collapsed={sidebarCollapsed} active={view === "record"} icon={<Plus size={18}/>} label="快速记账" onClick={() => setView("record")} />
            
            {!sidebarCollapsed && <div className="py-4 px-2"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">业务申请</p></div>}
            {sidebarCollapsed && <div className="py-2 border-t border-slate-100 my-2"></div>}
            <SidebarItem collapsed={sidebarCollapsed} active={view === "create"} icon={<FileText size={18}/>} label="通用报销" onClick={() => setView("create")} />
            <SidebarItem collapsed={sidebarCollapsed} active={view === "create-travel"} icon={<Plane size={18}/>} label="差旅报销" onClick={() => setView("create-travel")} />
            <SidebarItem collapsed={sidebarCollapsed} active={view === "loan"} icon={<Wallet size={18}/>} label="借款申请" onClick={() => setView("loan")} />
            <SidebarItem collapsed={sidebarCollapsed} active={view === "history"} icon={<Clock size={18}/>} label="历史记录" onClick={() => setView("history")} />
            
            {!sidebarCollapsed && <div className="py-4 px-2"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">管理</p></div>}
            {sidebarCollapsed && <div className="py-2 border-t border-slate-100 my-2"></div>}
            <SidebarItem collapsed={sidebarCollapsed} active={view === "settings"} icon={<Settings size={18}/>} label="系统设置" onClick={() => setView("settings")} />
        </nav>
        
        {/* User Info */}
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
            
            {/* 用户菜单弹窗 */}
            {userMenuOpen && (
                <div 
                    className="fixed inset-0 z-[100]" 
                    onClick={(e) => {
                        // 只有点击遮罩层本身才关闭
                        if (e.target === e.currentTarget) {
                            setUserMenuOpen(false);
                        }
                    }}
                >
                    {/* 弹出菜单 - 使用 fixed 定位确保不被裁剪 */}
                    <div 
                        className={`fixed bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[101] min-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-200`}
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

      {/* Main */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-white/80 backdrop-blur-md sticky top-0 z-10 px-4 py-3 flex justify-between items-center border-b border-slate-100 print:hidden">
            <div className="flex items-center gap-2 font-bold text-lg text-slate-800">
                <AppLogo className="w-7 h-7" />
                <span>易报销</span>
            </div>
            <button onClick={() => setView("settings")} className="p-2 text-slate-600 bg-slate-50 rounded-full"><Settings size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0">
            <div className="max-w-7xl mx-auto print:max-w-none print:mx-0">
                {view === "dashboard" && <OverviewView expenses={expenses} reports={reports} loans={loans} onNavigate={setView} />}
                {view === "ledger" && <LedgerView expenses={expenses} setExpenses={setExpenses} />}
                {view === "record" && <RecordView onSave={addExpense} onBack={() => setView("dashboard")} />}
                {view === "create" && <CreateReportView settings={settings} expenses={expenses} loans={loans} onAction={handleReportAction} onBack={() => setView("dashboard")} />}
                {view === "create-travel" && <CreateTravelReportView settings={settings} loans={loans} onAction={handleReportAction} onBack={() => setView("dashboard")} />}
                {view === "loan" && <LoanView settings={settings} onAction={handleLoanAction} onBack={() => setView("dashboard")} />}
                {view === "history" && <HistoryView reports={reports} loans={loans} onDelete={deleteRecord} onComplete={completeReimbursement} onSelect={(id: string, type: string) => { setSelectedId(id); setView(type === 'report' ? "report-detail" : "loan-detail"); }} />}
                {view === "settings" && <SettingsView settings={settings} onSave={setSettings} />}
                {view === "profile" && <ProfileView settings={settings} onSave={setSettings} />}
                {view === "report-detail" && selectedId && <ReportDetailView report={reports.find((r) => r.id === selectedId)!} onUpdate={(r: Report) => setReports(prev => prev.map(old => old.id === r.id ? r : old))} onBack={() => setView("history")} />}
                {view === "loan-detail" && selectedId && <LoanDetailView loan={loans.find((l) => l.id === selectedId)!} onUpdate={(l: LoanRecord) => setLoans(prev => prev.map(old => old.id === l.id ? l : old))} onBack={() => setView("history")} />}
            </div>
        </div>
      </main>

       {/* Mobile Tab Bar */}
       <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 pb-safe z-20 print:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <TabButton active={view === "dashboard"} icon={<Home />} label="概览" onClick={() => setView("dashboard")} />
        <TabButton active={view === "ledger"} icon={<Briefcase />} label="账本" onClick={() => setView("ledger")} />
        <div className="relative -top-6">
            <button onClick={() => setView("record")} className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 hover:scale-105 transition-transform">
                <Plus size={28} />
            </button>
        </div>
        <TabButton active={view === "create"} icon={<FileText />} label="报销" onClick={() => setView("create")} />
        <TabButton active={view === "history"} icon={<Clock />} label="历史" onClick={() => setView("history")} />
      </div>
    </div>
  );
};

const SidebarItem = ({ active, icon, label, onClick, collapsed }: any) => (
    <button 
        onClick={onClick} 
        title={collapsed ? label : undefined}
        className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} ${collapsed ? 'px-3' : 'px-4'} py-3 rounded-xl transition-all duration-200 group font-medium text-sm ${active ? "bg-slate-100 text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
    >
        <span className={`${active ? "text-slate-700" : "text-slate-400 group-hover:text-slate-600"} ${collapsed ? '' : ''}`}>{icon}</span>
        {!collapsed && <span>{label}</span>}
    </button>
);

const TabButton = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 w-16 py-1 ${active ? "text-slate-700" : "text-slate-400"}`}>
    {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

// --- Visual Helpers for Charts ---
const BarChartComponent = ({ data, color, labels }: { data: number[], color: string, labels: string[] }) => {
    const max = Math.max(...data, 1);
    return (
        <div className="flex flex-col gap-2 h-full justify-end">
            <div className="flex items-end justify-between gap-2 h-40 pt-4">
                {data.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="w-full relative flex items-end justify-center h-full">
                            <div 
                                style={{ height: `${(val / max) * 100}%` }} 
                                className={`w-full max-w-[32px] ${color} rounded-t-sm opacity-80 group-hover:opacity-100 transition-all min-h-[4px]`}
                            ></div>
                             {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 bg-indigo-600 text-white text-xs px-2 py-1 rounded transition-opacity pointer-events-none whitespace-nowrap z-10">
                                ¥{val.toLocaleString()}
                            </div>
                        </div>
                        <span className="text-[10px] text-slate-400">{labels[i]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Views ---

const OverviewView = ({ expenses, reports, loans, onNavigate }: any) => {
    const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y'>('6m');

    // 1. Pending Reimbursement: Reports (Submitted) + Expenses (Pending)
    const submittedReportsAmount = reports.filter((r:any) => r.status === 'submitted').reduce((acc:number, cur:any) => acc + cur.payableAmount, 0);
    const pendingExpensesAmount = expenses.filter((e:any) => e.status === 'pending').reduce((acc:number, cur:any) => acc + cur.amount, 0);
    const totalPending = submittedReportsAmount + pendingExpensesAmount;

    // 2. Loan Amount: Loans (Draft + Submitted)
    const activeLoanAmount = loans.filter((l:any) => l.status !== 'paid').reduce((acc:number, cur:any) => acc + cur.amount, 0);

    // 3. Total Receivable
    const totalReceivable = totalPending - activeLoanAmount;

    // Chart Data Mocking based on timeRange
    const getChartData = () => {
        if (timeRange === '3m') return { 
            data: [2800, 4500, 3200], 
            labels: ['12月', '1月', '2月'] 
        };
        if (timeRange === '6m') return { 
            data: [1500, 2000, 450, 2800, 4500, 3200], 
            labels: ['9月', '10月', '11月', '12月', '1月', '2月'] 
        };
        return { 
            data: [1200, 2100, 800, 1600, 900, 3200, 1500, 2000, 450, 2800, 4500, 3200], 
            labels: ['3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月'] 
        };
    };
    const chartData = getChartData();

    return (
        <div className="space-y-8">
            {/* 3 Main Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <FileText size={80} className="text-slate-700"/>
                    </div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">待报销金额</p>
                    <h3 className="text-3xl font-bold text-slate-700">¥{totalPending.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                        <span className="flex items-center text-orange-500"><Clock size={12} className="mr-1"/>包含未提交费用</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                     <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Wallet size={80} className="text-amber-500"/>
                    </div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">借款金额</p>
                    <h3 className="text-3xl font-bold text-amber-500">¥{activeLoanAmount.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                        <span className="flex items-center text-slate-500">审批中或未发放</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-lg shadow-emerald-100 relative overflow-hidden">
                     <div className="absolute right-0 top-0 p-4 opacity-10">
                        <Coins size={80} className="text-white"/>
                    </div>
                    <p className="text-emerald-100 text-sm font-bold uppercase tracking-wider mb-2">预计收款总额</p>
                    <h3 className="text-3xl font-bold">¥{totalReceivable.toLocaleString()}</h3>
                    <p className="text-xs text-emerald-100 mt-4 opacity-80">(待报销金额 - 借款金额)</p>
                </div>
            </div>

            {/* Annual Chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800">报销金额统计</h3>
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        {['3m', '6m', '1y'].map((t) => (
                            <button 
                                key={t} 
                                onClick={() => setTimeRange(t as any)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeRange === t ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {{'3m': '近3月', '6m': '近半年', '1y': '全年'}[t]}
                            </button>
                        ))}
                    </div>
                </div>
                <BarChartComponent data={chartData.data} labels={chartData.labels} color="bg-slate-1000"/>
            </div>
        </div>
    );
};

const StatusBadge = ({ status, type }: { status: string, type: 'expense' | 'report' | 'loan' }) => {
    if (type === 'expense') {
        if (status === 'done') return <span className="px-2 py-1 rounded text-xs font-bold bg-green-50 text-green-600">已报销</span>;
        if (status === 'processing') return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-600">报销中</span>;
        return <span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-400">未报销</span>;
    } else {
        if (status === 'paid') return <span className="px-2 py-1 rounded text-xs font-bold bg-green-50 text-green-600 border border-green-100">已报销</span>;
        if (status === 'submitted') return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">报销中</span>;
        return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-50 text-yellow-600 border border-yellow-100">未打印</span>;
    }
}

const LedgerView = ({ expenses, setExpenses }: any) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    const handleDelete = () => {
        if(confirm(`确定删除选中的 ${selectedIds.length} 条记录吗？`)) {
            setExpenses((prev: any[]) => prev.filter(e => !selectedIds.includes(e.id)));
            setSelectedIds([]);
        }
    }

    const updateStatus = (id: string, newStatus: ExpenseStatus) => {
        setExpenses((prev: any[]) => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    const getStatusStyle = (status: ExpenseStatus) => {
        switch(status) {
            case 'pending': return 'bg-slate-100 text-slate-500 border-slate-200';
            case 'processing': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'done': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            default: return 'bg-white text-slate-600 border-slate-200';
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Briefcase className="text-slate-700"/> 记账本</h2>
                {selectedIds.length > 0 && (
                    <button onClick={handleDelete} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-red-100">
                        <Trash2 size={16}/> 删除 ({selectedIds.length})
                    </button>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? expenses.map((e:any) => e.id) : [])} checked={selectedIds.length === expenses.length && expenses.length > 0} />
                                </th>
                                <th className="p-4 w-32">日期</th>
                                <th className="p-4">描述</th>
                                <th className="p-4 w-24">分类</th>
                                <th className="p-4 text-right w-32">金额</th>
                                <th className="p-4 text-center w-32">状态</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {expenses.length === 0 && (
                                <tr><td colSpan={6} className="p-12 text-center text-slate-400">暂无记录</td></tr>
                            )}
                            {expenses.map((e: any) => (
                                <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4 text-center">
                                        <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggleSelect(e.id)} />
                                    </td>
                                    <td className="p-4 font-mono text-sm text-slate-500">{formatDateTime(e.date)}</td>
                                    <td className="p-4">
                                        <div className="text-lg font-bold text-slate-800">{e.description}</div>
                                        {e.remarks && <div className="text-sm text-slate-400 mt-1 truncate max-w-xs">{e.remarks}</div>}
                                    </td>
                                    <td className="p-4 text-sm"><span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">{e.category}</span></td>
                                    <td className="p-4 text-right text-base font-bold text-slate-800">¥{e.amount.toFixed(2)}</td>
                                    <td className="p-4 text-center">
                                        <div className="relative inline-block">
                                            <select 
                                                value={e.status} 
                                                onChange={(ev) => updateStatus(e.id, ev.target.value as ExpenseStatus)}
                                                className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-sm font-bold border outline-none cursor-pointer transition-colors ${getStatusStyle(e.status)}`}
                                            >
                                                <option value="pending">未报销</option>
                                                <option value="processing">报销中</option>
                                                <option value="done">已报销</option>
                                            </select>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                                <ChevronRight size={14} className="rotate-90" />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const RecordView = ({ onSave, onBack }: any) => {
    // Default manual mode, precise time
    const [date, setDate] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16); 
    });
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("餐饮");
    const [remarks, setRemarks] = useState("");
    
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const categories = ["餐饮", "交通", "住宿", "办公", "招待", "通讯", "其他"];

    const handleSave = () => {
        if (!description || !amount) return alert("请输入金额和事项");
        onSave({ id: Date.now().toString(), description, amount: parseFloat(amount), date, category, remarks, status: "pending" });
    };

    const toggleVoice = async () => {
        if(isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                chunksRef.current = [];
                mediaRecorderRef.current.ondataavailable = e => chunksRef.current.push(e.data);
                mediaRecorderRef.current.onstop = async () => {
                     setIsProcessing(true);
                     const blob = new Blob(chunksRef.current, {type: 'audio/webm'});
                     const reader = new FileReader();
                     reader.readAsDataURL(blob);
                     reader.onloadend = async () => {
                        try {
                            const b64 = (reader.result as string).split(',')[1];
                            const res = await ai.models.generateContent({
                                model: "gemini-2.5-flash",
                                contents: [{role: 'user', parts: [{inlineData: {mimeType: 'audio/webm', data: b64}}, {text: "Extract JSON: {description, amount, date (YYYY-MM-DD), category, remarks}"}]}],
                                config: {responseMimeType: "application/json"}
                            });
                            const data = JSON.parse(res.text || "{}");
                            if(data.description) setDescription(data.description);
                            if(data.amount) setAmount(data.amount);
                            if(data.category) setCategory(data.category);
                            if(data.remarks) setRemarks(data.remarks);
                        } catch(e) { alert("识别失败"); }
                        setIsProcessing(false);
                     };
                };
                mediaRecorderRef.current.start();
                setIsRecording(true);
            } catch { alert("无法访问麦克风"); }
        }
    };

    return (
        <div className="max-w-xl mx-auto pt-6">
             <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight className="rotate-180"/></button>
                <h2 className="text-2xl font-bold text-slate-800">快速记账</h2>
                 <div className="ml-auto">
                    <button onClick={toggleVoice} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isRecording ? "bg-red-50 text-red-600 animate-pulse" : isProcessing ? "bg-slate-100 text-slate-500" : "bg-slate-100 text-slate-700"}`}>
                        {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Mic size={14}/>}
                        {isRecording ? "停止录音" : isProcessing ? "分析中..." : "语音输入"}
                    </button>
                </div>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">金额</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                                <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl pl-8 pr-4 py-4 text-2xl font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300"/>
                            </div>
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">分类</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-[68px] bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none transition-all appearance-none text-center">
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">时间 (精确到分)</label>
                        <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none transition-all"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">事项描述</label>
                        <input type="text" placeholder="例如：招待客户李总晚餐" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none transition-all placeholder:text-slate-300"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">备注 (选填)</label>
                        <textarea rows={3} placeholder="添加更多细节..." value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none transition-all resize-none placeholder:text-slate-300"/>
                    </div>
                    <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 mt-4">
                        保存到账本
                    </button>
                </div>
            </div>
        </div>
    );
};

const CreateReportView = ({ settings, expenses, loans, onAction, onBack }: any) => {
    const [step, setStep] = useState(1);
    const [analyzing, setAnalyzing] = useState(false);
    const [previewScale, setPreviewScale] = useState(0.8);  // 默认80%缩放
    const [formCollapsed, setFormCollapsed] = useState(false);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    
    // 动态计算预览缩放比例
    useEffect(() => {
        const updateScale = () => {
            if (previewContainerRef.current) {
                const containerWidth = previewContainerRef.current.clientWidth - 32;
                const a4Width = 297 * 3.78;
                // 根据是否收缩调整默认缩放
                const maxScale = formCollapsed ? 0.85 : 0.75;
                const newScale = Math.min(containerWidth / a4Width, maxScale);
                setPreviewScale(Math.max(newScale, 0.4));
            }
        };
        
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [step, formCollapsed]);
    
    // Step 1: Files - Separated Categories
    const [invoiceFiles, setInvoiceFiles] = useState<Attachment[]>([]);
    const [approvalFiles, setApprovalFiles] = useState<Attachment[]>([]);
    const [voucherFiles, setVoucherFiles] = useState<Attachment[]>([]);
    
    // Step 2: Form Data
    const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
    const [form, setForm] = useState({
        title: "",
        approvalNumber: "",
        budgetProjectId: settings.budgetProjects.find((p:any) => p.isDefault)?.id || "",
        paymentAccountId: settings.paymentAccounts.find((a:any) => a.isDefault)?.id || "",
        prepaidAmount: 0,
        manualItems: [] as ExpenseItem[] // Extracted items
    });

    const pendingExpenses = expenses.filter((e: any) => e.status === 'pending');

    const handleUpload = async (e: any, type: 'invoice' | 'approval' | 'voucher') => {
        if(e.target.files && e.target.files.length > 0) {
            const newFiles = await Promise.all(Array.from(e.target.files as FileList).map(async (f: File) => {
                let data = "";
                if(f.type === 'application/pdf') {
                    data = await pdfToImage(f);
                } else {
                    data = await fileToBase64(f);
                }
                // 添加附件类型标记，便于后续分类展示
                return { data, type: type, name: f.name } as Attachment;
            }));
            
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

    // AI 识别结果状态
    const [aiInvoiceResult, setAiInvoiceResult] = useState<any>(null);
    const [aiApprovalResult, setAiApprovalResult] = useState<any>(null);
    const [matchedLoans, setMatchedLoans] = useState<any[]>([]);
    const [selectedLoanId, setSelectedLoanId] = useState<string>('');

    const startAnalysis = async () => {
        if (invoiceFiles.length === 0) {
            alert("请必须上传电子发票 (强制上传)");
            return;
        }

        setAnalyzing(true);
        try {
            const cleanB64 = (d: string) => d.split(',')[1];
            
            // 分别识别发票和审批单
            const invoiceImages = invoiceFiles.map(f => cleanB64(f.data));
            const approvalImages = approvalFiles.map(f => cleanB64(f.data));

            // 1. 识别电子发票
            console.log('[AI] 发送发票识别请求', { imageCount: invoiceImages.length });
            const invoiceResponse = await apiRequest('/api/ai/recognize', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'invoice',
                    images: invoiceImages,
                    mimeType: 'image/jpeg',
                }),
            }) as any;
            console.log('[AI] 发票识别响应', invoiceResponse);
            const invoiceData = invoiceResponse.result || {};
            setAiInvoiceResult(invoiceData);

            // 2. 如果有审批单，识别审批单
            let approvalData: any = {};
            if (approvalImages.length > 0) {
                const approvalResponse = await apiRequest('/api/ai/recognize', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'approval',
                        images: approvalImages,
                        mimeType: 'image/jpeg',
                    }),
                }) as any;
                approvalData = approvalResponse.result || {};
                setAiApprovalResult(approvalData);
            }

            // 3. 构建报销事由：发票项目名称（活动事项）
            let reimbursementTitle = invoiceData.projectName || invoiceData.title || '';
            if (approvalData.eventSummary) {
                reimbursementTitle = `${reimbursementTitle}（${approvalData.eventSummary}）`;
            }

            // 4. 获取发票金额
            const invoiceAmount = invoiceData.totalAmount || 
                (invoiceData.items || []).reduce((sum: number, i: any) => sum + (i.amount || 0), 0);

            // 5. 匹配借款记录
            const potentialLoans = loans.filter((loan: any) => {
                // 按审批单号匹配
                if (approvalData.approvalNumber && loan.approvalNumber === approvalData.approvalNumber) {
                    return true;
                }
                // 按金额范围匹配（允许10%误差）
                if (loan.status !== 'paid' && Math.abs(loan.amount - invoiceAmount) / invoiceAmount < 0.1) {
                    return true;
                }
                // 按事由关键词匹配
                if (loan.reason && reimbursementTitle && 
                    (loan.reason.includes(invoiceData.projectName) || 
                     loan.reason.includes(approvalData.eventSummary))) {
                    return true;
                }
                return false;
            });
            setMatchedLoans(potentialLoans);

            // 6. 自动选择预算项目（如果审批单中有）
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

            // 7. 自动填写表单
            console.log('[AI] 填充数据', { 
                title: reimbursementTitle, 
                amount: invoiceAmount,
                approvalNumber: approvalData.approvalNumber,
                projectName: invoiceData.projectName
            });
            
            setForm(prev => ({
                ...prev,
                title: reimbursementTitle,
                approvalNumber: approvalData.approvalNumber || invoiceData.approvalNumber || prev.approvalNumber,
                budgetProjectId: autoSelectedBudgetId,
                prepaidAmount: approvalData.loanAmount || 0,
                manualItems: [{
                    id: `extracted-${Date.now()}`,
                    date: invoiceData.invoiceDate || new Date().toISOString(),
                    description: reimbursementTitle,
                    amount: invoiceAmount,
                    category: invoiceData.projectName || "其他",
                    status: 'pending' as const
                }]
            }));

            setStep(2);

        } catch (e) {
            console.error(e);
            alert("AI 分析失败，请检查网络或重试");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSubmit = (action: 'save' | 'print') => {
        // Merge manual items and selected ledger items
        const ledgerItems = pendingExpenses.filter((e: any) => selectedExpenseIds.includes(e.id));
        const allItems = [...form.manualItems, ...ledgerItems];

        if (allItems.length === 0) return alert("请至少包含一笔费用");
        if (!form.title) return alert("请输入报销事由");

        const totalAmount = allItems.reduce((acc, cur) => acc + cur.amount, 0);
        const budgetProject = settings.budgetProjects.find((p:any) => p.id === form.budgetProjectId);
        const paymentAccount = settings.paymentAccounts.find((a:any) => a.id === form.paymentAccountId);

        // Combine attachments
        const allAttachments = [...invoiceFiles, ...approvalFiles, ...voucherFiles];

        // 如果选择了借款记录，记录关联
        const linkedLoanId = selectedLoanId || undefined;

        const report: Report = {
            id: Date.now().toString(),
            title: form.title,
            createdDate: new Date().toISOString(),
            status: 'draft',
            totalAmount,
            prepaidAmount: form.prepaidAmount,
            payableAmount: totalAmount - form.prepaidAmount,
            items: allItems,
            userSnapshot: settings.currentUser,
            attachments: allAttachments,
            approvalNumber: form.approvalNumber,
            budgetProject,
            paymentAccount,
            invoiceCount: allAttachments.length,
            // 存储 AI 识别的额外数据
            aiRecognitionData: {
                invoice: aiInvoiceResult,
                approval: aiApprovalResult,
                linkedLoanId
            }
        };
        onAction(report, action);
    };

    // Calculate dynamic total for preview
    const currentTotal = [...form.manualItems, ...pendingExpenses.filter((e:any) => selectedExpenseIds.includes(e.id))].reduce((s,i) => s+i.amount, 0);
    const allAttachments = [...invoiceFiles, ...approvalFiles, ...voucherFiles];

    return (
        <div className={`mx-auto h-full flex flex-col ${step === 2 ? 'w-full max-w-none' : 'max-w-5xl'}`}>
             {/* Header */}
             {step === 1 && (
                 <div className="flex items-center gap-4 mb-6">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight className="rotate-180"/></button>
                    <h2 className="text-2xl font-bold text-slate-800">通用费用报销</h2>
                </div>
             )}

             {/* Step 1: Upload */}
             {step === 1 && (
                 <div className="flex-1 overflow-y-auto pb-20">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Mandatory Invoice Upload */}
                        <div className="col-span-2">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Receipt size={20} className="text-red-500"/> 电子发票 <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">强制上传</span>
                            </h3>
                            <div className="bg-white rounded-2xl border-2 border-dashed border-red-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-red-50/20 transition-colors relative">
                                <input type="file" multiple accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleUpload(e, 'invoice')} />
                                {invoiceFiles.length > 0 ? (
                                    <div className="flex flex-wrap gap-4 justify-center w-full z-10 pointer-events-none">
                                        {invoiceFiles.map((f, i) => (
                                            <div key={i} className="relative group pointer-events-auto">
                                                <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                                                     {f.type === 'other' ? <FileText className="text-slate-400"/> : <ImageIcon className="text-slate-400"/>}
                                                </div>
                                                <div className="text-[10px] mt-1 truncate max-w-[80px] text-slate-500">{f.name}</div>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile(i, 'invoice'); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-100 transition-opacity z-20"><X size={10}/></button>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-center w-20 h-20 bg-slate-50 rounded-lg border border-slate-200 text-slate-400">
                                            <Plus size={24}/>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 pointer-events-none">
                                        <Upload size={32} className="mx-auto mb-2 text-red-300"/>
                                        <p className="font-bold text-sm text-slate-600">上传电子发票</p>
                                        <p className="text-xs">支持 PDF / 图片</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Approval Form */}
                        <div className="col-span-2 md:col-span-1">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <FileCheck size={20} className="text-slate-600"/> 审批单 <span className="text-slate-400 text-xs font-normal">可选</span>
                            </h3>
                            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-slate-100/10 transition-colors relative">
                                <input type="file" multiple accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleUpload(e, 'approval')} />
                                {approvalFiles.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
                                        {approvalFiles.map((f, i) => (
                                            <div key={i} className="relative group pointer-events-auto">
                                                 <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                                                     <FileText size={20} className="text-slate-400"/>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile(i, 'approval'); }} className="absolute -top-2 -right-2 bg-slate-500 text-white rounded-full p-1"><X size={8}/></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 pointer-events-none">
                                        <Upload size={24} className="mx-auto mb-2 text-indigo-300"/>
                                        <p className="font-bold text-xs text-slate-600">上传审批单</p>
                                    </div>
                                )}
                            </div>
                        </div>

                         {/* Shopping Voucher */}
                         <div className="col-span-2 md:col-span-1">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <ScanLine size={20} className="text-emerald-500"/> 购物凭证 <span className="text-slate-400 text-xs font-normal">可选</span>
                            </h3>
                            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-emerald-50/10 transition-colors relative">
                                <input type="file" multiple accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleUpload(e, 'voucher')} />
                                {voucherFiles.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
                                        {voucherFiles.map((f, i) => (
                                            <div key={i} className="relative group pointer-events-auto">
                                                 <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                                                     <FileText size={20} className="text-slate-400"/>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile(i, 'voucher'); }} className="absolute -top-2 -right-2 bg-slate-500 text-white rounded-full p-1"><X size={8}/></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 pointer-events-none">
                                        <Upload size={24} className="mx-auto mb-2 text-emerald-300"/>
                                        <p className="font-bold text-xs text-slate-600">上传购物凭证</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={startAnalysis} 
                        disabled={invoiceFiles.length === 0 || analyzing}
                        className={`w-full mt-8 py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-lg ${invoiceFiles.length > 0 ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        {analyzing ? <><Loader2 className="animate-spin"/> AI 正在分析单据...</> : "开始识别与填单"}
                    </button>
                 </div>
             )}

             {/* Step 2: Form & Preview - 绝对定位覆盖整个main区域 */}
             {step === 2 && (
                 <div className="absolute inset-0 flex flex-col bg-slate-100 z-30">
                     {/* Toolbar - 顶部工具栏 */}
                     <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex justify-between items-center shadow-sm flex-shrink-0">
                         <div className="flex items-center gap-3">
                             <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium text-sm">
                                <ChevronLeft size={16}/> 返回重传
                             </button>
                             <div className="h-4 w-px bg-slate-200"></div>
                             <span className="text-sm font-medium text-slate-700">通用报销单预览 (A4横版)</span>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => handleSubmit('save')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 flex items-center gap-1.5">
                                 <Save size={14}/> 保存草稿
                             </button>
                             <button onClick={() => handleSubmit('print')} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-sm shadow-sm hover:bg-indigo-700 flex items-center gap-1.5">
                                 <Printer size={14}/> 打印报销单
                             </button>
                         </div>
                     </div>

                     <div className="flex-1 overflow-hidden flex flex-row relative bg-slate-100">
                         {/* 收缩/展开按钮 - 始终悬浮可见 */}
                         <button
                             onClick={() => setFormCollapsed(!formCollapsed)}
                             className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all z-40 ${formCollapsed ? 'left-0' : 'left-[276px] xl:left-[316px]'}`}
                             title={formCollapsed ? "展开表单" : "收起表单"}
                         >
                             {formCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
                         </button>
                         
                         {/* Left Panel: Form Controls - 可收缩 */}
                         <div className={`bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 transition-all duration-300 ${formCollapsed ? 'w-0 p-0 overflow-hidden' : 'w-[280px] xl:w-[320px] p-4'}`}>
                             <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm"><Edit2 size={14} className="text-slate-600"/> 填写信息</h3>
                             
                             <div className="space-y-6">
                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">报销事由 (发票内容)</label>
                                     <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none" placeholder="例如：采购办公用品" />
                                     <p className="text-[10px] text-slate-400 mt-1">格式：发票内容（具体事项）</p>
                                 </div>

                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">审批单编号</label>
                                     <input value={form.approvalNumber} onChange={e => setForm({...form, approvalNumber: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none" placeholder="钉钉/飞书审批单号" />
                                 </div>

                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">预算项目</label>
                                     <select value={form.budgetProjectId} onChange={e => setForm({...form, budgetProjectId: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none bg-white">
                                         {settings.budgetProjects.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                     </select>
                                 </div>

                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">收款账户</label>
                                     <select value={form.paymentAccountId} onChange={e => setForm({...form, paymentAccountId: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none bg-white">
                                         {settings.paymentAccounts.map((a:any) => <option key={a.id} value={a.id}>{a.bankName} - {a.accountNumber.slice(-4)}</option>)}
                                     </select>
                                 </div>

                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">预支/借款抵扣</label>
                                     
                                     {/* 匹配的借款记录选择 */}
                                     {matchedLoans.length > 0 && (
                                        <div className="mb-2">
                                            <p className="text-xs text-amber-600 mb-1 font-bold">找到可能匹配的借款记录：</p>
                                            <select 
                                                value={selectedLoanId}
                                                onChange={(e) => {
                                                    setSelectedLoanId(e.target.value);
                                                    const loan = matchedLoans.find(l => l.id === e.target.value);
                                                    if (loan) {
                                                        setForm(prev => ({ ...prev, prepaidAmount: loan.amount }));
                                                    } else {
                                                        setForm(prev => ({ ...prev, prepaidAmount: 0 }));
                                                    }
                                                }}
                                                className="w-full p-2 border border-amber-300 rounded-lg text-sm bg-amber-50 focus:border-amber-500 outline-none"
                                            >
                                                <option value="">不使用借款抵扣</option>
                                                {matchedLoans.map((loan: any) => (
                                                    <option key={loan.id} value={loan.id}>
                                                        ¥{loan.amount.toFixed(2)} - {loan.reason?.slice(0, 20)}...
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                     )}
                                     
                                     <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                                        <input 
                                            type="number" 
                                            value={form.prepaidAmount} 
                                            onChange={e => setForm({...form, prepaidAmount: parseFloat(e.target.value) || 0})} 
                                            className="w-full pl-6 p-2 border border-slate-200 rounded-lg text-sm font-bold text-orange-600 focus:border-indigo-500 outline-none" 
                                            placeholder="手动输入借款金额"
                                        />
                                     </div>
                                     <p className="text-[10px] text-slate-400 mt-1">应领款金额 = 报销金额 - 借款金额</p>
                                 </div>

                                 <div className="border-t border-slate-100 pt-4">
                                     <h4 className="font-bold text-sm text-slate-700 mb-2">费用明细</h4>
                                     
                                     {/* Extracted Items */}
                                     {form.manualItems.length > 0 && (
                                         <div className="space-y-2 mb-4">
                                             <p className="text-xs font-bold text-slate-700">AI 识别项目 ({form.manualItems.length})</p>
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
                                                                setForm({...form, manualItems: newItems});
                                                            }}
                                                            type="number"
                                                         />
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     )}

                                     {/* Ledger Items Matching */}
                                     {pendingExpenses.length > 0 && (
                                         <div>
                                            <p className="text-xs font-bold text-slate-500 mb-2">从记账本添加 (未报销)</p>
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                {pendingExpenses.map((e:any) => (
                                                    <label key={e.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded cursor-pointer border border-transparent hover:border-slate-100">
                                                        <div className="flex items-center gap-2 truncate">
                                                            <input type="checkbox" checked={selectedExpenseIds.includes(e.id)} onChange={(ev) => {
                                                                if(ev.target.checked) setSelectedExpenseIds([...selectedExpenseIds, e.id]);
                                                                else setSelectedExpenseIds(selectedExpenseIds.filter(id => id !== e.id));
                                                            }} className="rounded text-slate-700 focus:ring-indigo-500"/>
                                                            <span className="text-xs text-slate-600 truncate">{e.description}</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-800">¥{e.amount}</span>
                                                    </label>
                                                ))}
                                            </div>
                                         </div>
                                     )}
                                 </div>
                             </div>
                         </div>

                         {/* Right Panel: Preview - 横版A4占据80%宽度 */}
                         <div ref={previewContainerRef} className="flex-1 bg-slate-100 overflow-auto p-2">
                              {/* 缩放控制栏 */}
                              <div className="sticky top-0 z-20 mb-2 flex justify-center">
                                  <div className="bg-white rounded-full shadow-md px-3 py-1.5 flex items-center gap-2 text-xs">
                                      <button 
                                          onClick={() => setPreviewScale(Math.max(0.3, previewScale - 0.05))}
                                          className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                                      >−</button>
                                      <span className="text-slate-600 min-w-[50px] text-center font-medium">{Math.round(previewScale * 100)}%</span>
                                      <button 
                                          onClick={() => setPreviewScale(Math.min(1.2, previewScale + 0.05))}
                                          className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                                      >+</button>
                                      <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                      <button 
                                          onClick={() => setPreviewScale(0.6)}
                                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                      >60%</button>
                                      <button 
                                          onClick={() => setPreviewScale(0.8)}
                                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                      >80%</button>
                                      <button 
                                          onClick={() => setPreviewScale(1)}
                                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                      >100%</button>
                                  </div>
                              </div>
                              
                              {/* 报销单容器 - 与附件预览位置一致，居中显示 */}
                              <div className="flex flex-col items-center max-w-4xl mx-auto">
                                  <div 
                                    className="bg-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-slate-200"
                                    style={{ 
                                        transform: `scale(${previewScale})`,
                                        transformOrigin: 'top center',
                                        marginBottom: `${(1 - previewScale) * -210 * 3.78}px`
                                    }}
                                  >
                                  <GeneralReimbursementForm 
                                    data={{
                                        title: form.title,
                                        createdDate: new Date().toISOString(),
                                        userSnapshot: settings.currentUser,
                                        items: [...form.manualItems, ...pendingExpenses.filter((e:any) => selectedExpenseIds.includes(e.id))],
                                        totalAmount: currentTotal,
                                        prepaidAmount: form.prepaidAmount,
                                        payableAmount: currentTotal - form.prepaidAmount,
                                        invoiceCount: allAttachments.length,
                                        approvalNumber: form.approvalNumber,
                                        budgetProject: settings.budgetProjects.find((p:any) => p.id === form.budgetProjectId),
                                        paymentAccount: settings.paymentAccounts.find((a:any) => a.id === form.paymentAccountId)
                                    }}
                                  />
                                  
                                  </div>
                              </div>
                              
                              {/* Attachments Preview - 单独显示在下方 */}
                              {allAttachments.length > 0 && (
                                  <div className="mt-6 bg-white rounded-lg shadow-lg p-4 max-w-4xl mx-auto">
                                      <p className="text-center text-slate-500 text-sm mb-4 font-medium">📎 附件预览 ({allAttachments.length}张，打印时在下一页)</p>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                          {allAttachments.map((f, i) => (
                                              <div key={i} className="aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                                  <img src={f.data} className="w-full h-full object-contain" />
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              )}
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

const LoanView = ({ settings, onAction, onBack }: any) => {
    const [step, setStep] = useState(1);
    const [analyzing, setAnalyzing] = useState(false);
    const [approvalFiles, setApprovalFiles] = useState<Attachment[]>([]);

    const [amount, setAmount] = useState<number>(0);
    const [reason, setReason] = useState("");
    const [approvalNumber, setApprovalNumber] = useState("");
    const [paymentAccountId, setPaymentAccountId] = useState(settings.paymentAccounts.find((a:any) => a.isDefault)?.id || "");
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
            
            // 使用新的识别结果字段
            if(data.eventDetail || data.eventSummary) {
                setReason(data.eventDetail || data.eventSummary || '');
            } else if(data.reason) {
                setReason(data.reason);
            }
            
            if(data.loanAmount) {
                setAmount(data.loanAmount);
            } else if(data.expenseAmount) {
                setAmount(data.expenseAmount);
            } else if(data.amount) {
                setAmount(data.amount);
            }
            
            if(data.approvalNumber) setApprovalNumber(data.approvalNumber);
            
            setStep(2);
        } catch (e) {
            console.error(e);
            alert("AI 识别失败，请检查网络或重试");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSubmit = (action: 'save' | 'print') => {
        if(!amount || !reason) return alert("请填写完整");
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
            approvalNumber
        };
        onAction(loan, action);
    };

    return (
        <div className={`mx-auto h-full flex flex-col ${step === 2 ? 'w-full max-w-none' : 'max-w-4xl'}`}>
             {step === 1 && (
                 <div className="flex-1 overflow-y-auto">
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight className="rotate-180"/></button>
                        <h2 className="text-2xl font-bold text-slate-800">借款申请</h2>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
                        <div className="mb-8">
                             <h3 className="text-lg font-bold text-slate-700 mb-2">上传电子审批单</h3>
                             <p className="text-slate-400 text-sm">系统将自动提取金额、事由和审批编号</p>
                        </div>
                        
                        <div className="max-w-md mx-auto mb-8">
                            <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-indigo-200 p-8 flex flex-col items-center justify-center min-h-[200px] hover:bg-slate-100/20 transition-colors relative">
                                <input type="file" multiple accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleUpload} />
                                {approvalFiles.length > 0 ? (
                                    <div className="flex flex-wrap gap-4 justify-center w-full z-10 pointer-events-none">
                                        {approvalFiles.map((f, i) => (
                                            <div key={i} className="relative group pointer-events-auto">
                                                <div className="w-24 h-32 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                                    <div className="flex-1 flex items-center justify-center bg-slate-100">
                                                        <FileText className="text-slate-400"/>
                                                    </div>
                                                    <div className="px-2 py-1 text-[10px] truncate text-slate-500">{f.name}</div>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"><X size={12}/></button>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-center w-24 h-32 bg-white rounded-lg border-2 border-dashed border-slate-300 text-slate-300">
                                            <Plus size={24}/>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 pointer-events-none">
                                        <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Upload size={32}/>
                                        </div>
                                        <p className="font-bold text-sm text-slate-600">点击上传文件</p>
                                        <p className="text-xs mt-1">支持 PDF / 图片</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button 
                            onClick={startAnalysis} 
                            disabled={approvalFiles.length === 0 || analyzing}
                            className={`w-full max-w-md mx-auto py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-lg ${approvalFiles.length > 0 ? 'bg-amber-500 text-white shadow-amber-200 hover:bg-amber-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                            {analyzing ? <><Loader2 className="animate-spin"/> 正在提取审批信息...</> : "开始识别与填单"}
                        </button>
                    </div>
                 </div>
             )}

             {step === 2 && (
                 <div className="flex flex-col h-full bg-slate-200 -m-4 md:-m-8">
                     {/* Toolbar */}
                     <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm z-10 sticky top-0">
                         <div className="flex items-center gap-4">
                             <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold text-sm">
                                <ChevronRight className="rotate-180" size={16}/> 返回重传
                             </button>
                             <div className="h-4 w-px bg-slate-300"></div>
                             <span className="text-sm font-bold text-slate-700">借款单预览 (A4横版)</span>
                         </div>
                         <div className="flex gap-3">
                             <button onClick={() => handleSubmit('save')} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 flex items-center gap-2">
                                 <Save size={16}/> 保存草稿
                             </button>
                             <button onClick={() => handleSubmit('print')} className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold text-sm shadow-md shadow-amber-200 hover:bg-amber-600 flex items-center gap-2">
                                 <Printer size={16}/> 打印借款单
                             </button>
                         </div>
                     </div>

                     <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                         {/* Left Panel: Form Controls */}
                         <div className="w-full md:w-[350px] bg-white border-r border-slate-200 overflow-y-auto p-6 flex-shrink-0 z-10">
                             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Edit2 size={16} className="text-amber-500"/> 确认借款信息</h3>
                             <div className="space-y-6">
                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">借款金额</label>
                                     <div className="relative">
                                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                                         <input 
                                            type="number" 
                                            value={amount} 
                                            onChange={e => setAmount(parseFloat(e.target.value) || 0)} 
                                            className="w-full pl-6 p-2 border border-slate-200 rounded-lg font-bold text-lg text-amber-600 focus:border-amber-500 outline-none" 
                                        />
                                     </div>
                                     <p className="text-xs text-slate-400 mt-1 bg-slate-50 p-1 rounded">大写：{digitToChinese(amount)}</p>
                                 </div>
                                 
                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">借款事由</label>
                                     <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-amber-500 outline-none" rows={3}/>
                                 </div>

                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">审批单编号</label>
                                     <input value={approvalNumber} onChange={e => setApprovalNumber(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-amber-500 outline-none"/>
                                 </div>

                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">收款人账户</label>
                                     <select value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-amber-500 outline-none bg-white">
                                         {settings.paymentAccounts.map((a:any) => <option key={a.id} value={a.id}>{a.accountName} - {a.bankName}</option>)}
                                     </select>
                                     <div className="text-[10px] text-slate-400 mt-2 p-2 bg-slate-50 rounded">
                                         账号: {settings.paymentAccounts.find((a:any) => a.id === paymentAccountId)?.accountNumber}
                                     </div>
                                 </div>

                                 <div>
                                     <label className="text-xs font-bold text-slate-500 uppercase block mb-1">申请日期</label>
                                     <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-amber-500 outline-none"/>
                                 </div>
                             </div>
                         </div>

                         {/* Right Panel: Preview */}
                         <div className="flex-1 bg-slate-200 overflow-y-auto p-8 flex justify-center items-start">
                              <div className="bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] transition-transform origin-top flex-shrink-0" style={{ width: '297mm', minHeight: '210mm', padding: '15mm' }}>
                                   <LoanForm 
                                        data={{
                                            amount,
                                            reason,
                                            date,
                                            approvalNumber,
                                            userSnapshot: settings.currentUser,
                                            payeeInfo: settings.paymentAccounts.find((a:any) => a.id === paymentAccountId)
                                        }}
                                   />
                                   
                                   {/* Attachments Preview Page */}
                                  <div className="border-t-4 border-slate-200 mt-12 pt-8 print:hidden">
                                      <p className="text-center text-slate-400 text-sm mb-4">- 附件/审批单预览 (打印时在下一页) -</p>
                                      <div className="flex flex-col gap-4 items-center">
                                          {approvalFiles.map((f, i) => (
                                              <img key={i} src={f.data} className="w-full border border-slate-100 object-contain" />
                                          ))}
                                      </div>
                                  </div>
                              </div>
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

const HistoryView = ({ reports, loans, onDelete, onComplete, onSelect }: any) => {
    const [tab, setTab] = useState<'report'|'loan'>('report');
    const items = tab === 'report' ? reports : loans;

    return (
        <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">历史记录</h2>
            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button onClick={() => setTab('report')} className={`pb-2 px-4 font-bold ${tab === 'report' ? 'text-slate-700 border-b-2 border-indigo-600' : 'text-slate-400'}`}>报销单</button>
                <button onClick={() => setTab('loan')} className={`pb-2 px-4 font-bold ${tab === 'loan' ? 'text-slate-700 border-b-2 border-indigo-600' : 'text-slate-400'}`}>借款单</button>
            </div>
            <div className="space-y-4">
                {items.map((item: any) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={item.status} type={tab} />
                                <span className="font-bold text-slate-800">{item.title || item.reason || '无标题'}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">{formatDate(item.createdDate || item.date)} · ¥{item.totalAmount || item.amount}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => onSelect(item.id, tab)} className="p-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-indigo-100"><Printer size={16}/></button>
                            {item.status !== 'paid' && <button onClick={() => onComplete(item.id, tab)} className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100"><CheckCircle size={16}/></button>}
                            <button onClick={() => onDelete(item.id, tab)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
                {items.length === 0 && <div className="text-center text-slate-400 py-12">暂无记录</div>}
            </div>
        </div>
    );
};

// 独立的个人信息管理页面
const ProfileView = ({ settings, onSave }: any) => {
    const [profile, setProfile] = useState(settings.currentUser);
    const [pass, setPass] = useState("");
    
    const handleSave = () => {
        onSave({ ...settings, currentUser: profile });
        alert("个人信息已更新");
        setPass("");
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-8">个人信息管理</h2>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center gap-6 mb-8 pb-8 border-b border-slate-100">
                    {/* 头像 */}
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-3xl font-bold shadow-lg">
                        {profile.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">{profile.name}</h3>
                        <p className="text-slate-500">{profile.department} · {profile.email}</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">姓名</label>
                        <input 
                            value={profile.name} 
                            onChange={e => setProfile({...profile, name: e.target.value})} 
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">部门</label>
                        <input 
                            value={profile.department} 
                            onChange={e => setProfile({...profile, department: e.target.value})} 
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">邮箱</label>
                        <input 
                            value={profile.email} 
                            onChange={e => setProfile({...profile, email: e.target.value})} 
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">修改密码</label>
                        <input 
                            type="password" 
                            placeholder="输入新密码（留空则不修改）" 
                            value={pass} 
                            onChange={e => setPass(e.target.value)} 
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                    </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={handleSave} 
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all flex items-center gap-2"
                    >
                        <Save size={18} />
                        保存修改
                    </button>
                </div>
            </div>
        </div>
    );
};

const SettingsView = ({ settings, onSave }: any) => {
    const [activeTab, setActiveTab] = useState<'users' | 'payment' | 'budget' | 'ai' | 'usage'>('payment');
    const isSuperAdmin = settings.currentUser?.email === SUPER_ADMIN_EMAIL;
    
    // 用户管理组件
    const UserManagementTab = () => {
        const [showAddForm, setShowAddForm] = useState(false);
        const [newUser, setNewUser] = useState({
            name: '',
            email: '',
            department: '',
            password: '',
            role: 'user' as 'user' | 'admin'
        });
        const [editingUser, setEditingUser] = useState<string | null>(null);

        const users = settings.users || [];

        const handleAddUser = async () => {
            if (!newUser.name || !newUser.email || !newUser.password) {
                alert('请填写完整的用户信息');
                return;
            }
            
            try {
                // 调用后端 API 注册用户
                await apiRequest('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify(newUser),
                });
                
                // 更新本地状态
                const user = {
                    id: `user_${Date.now()}`,
                    ...newUser,
                };
                delete (user as any).password;
                
                onSave({ 
                    ...settings, 
                    users: [...users, user] 
                });
                
                setNewUser({ name: '', email: '', department: '', password: '', role: 'user' });
                setShowAddForm(false);
                alert('用户添加成功');
            } catch (error: any) {
                alert(error.message || '添加用户失败');
            }
        };

        const handleDeleteUser = (userId: string) => {
            if (userId === settings.currentUser?.id) {
                alert('不能删除当前登录用户');
                return;
            }
            if (confirm('确定要删除该用户吗？此操作不可撤销。')) {
                onSave({
                    ...settings,
                    users: users.filter((u: any) => u.id !== userId)
                });
            }
        };

        const handleToggleRole = (userId: string) => {
            if (userId === settings.currentUser?.id) {
                alert('不能修改当前登录用户的权限');
                return;
            }
            onSave({
                ...settings,
                users: users.map((u: any) => 
                    u.id === userId 
                        ? { ...u, role: u.role === 'admin' ? 'user' : 'admin' }
                        : u
                )
            });
        };

        return (
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Users size={20} /> 用户管理
                    </h3>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={16} />
                        添加用户
                    </button>
                </div>

                {/* 添加用户表单 */}
                {showAddForm && (
                    <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-200">
                        <h4 className="font-bold text-sm text-slate-700 mb-4">添加新用户</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">姓名 *</label>
                                <input
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                    placeholder="请输入姓名"
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">邮箱 *</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    placeholder="请输入邮箱"
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">部门</label>
                                <input
                                    value={newUser.department}
                                    onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                                    placeholder="请输入部门"
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">初始密码 *</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="请输入初始密码"
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">角色</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value as 'user' | 'admin' })}
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                >
                                    <option value="user">普通用户</option>
                                    <option value="admin">管理员</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={handleAddUser}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                确认添加
                            </button>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}

                {/* 用户列表 */}
                <div className="space-y-3">
                    {users.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Users size={48} className="mx-auto mb-4 opacity-50" />
                            <p>暂无用户</p>
                        </div>
                    ) : (
                        users.map((user: any) => (
                            <div
                                key={user.id}
                                className={`flex items-center justify-between p-4 bg-white rounded-xl border ${
                                    user.id === settings.currentUser?.id 
                                        ? 'border-indigo-300 bg-slate-100/50' 
                                        : 'border-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                                        user.role === 'admin' ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                                    }`}>
                                        {user.name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{user.name}</span>
                                            {user.role === 'admin' && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-bold">
                                                    管理员
                                                </span>
                                            )}
                                            {user.id === settings.currentUser?.id && (
                                                <span className="px-2 py-0.5 bg-indigo-100 text-slate-800 text-xs rounded-full font-bold">
                                                    当前用户
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500">{user.email}</p>
                                        {user.department && (
                                            <p className="text-xs text-slate-400">{user.department}</p>
                                        )}
                                    </div>
                                </div>
                                
                                {user.id !== settings.currentUser?.id && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggleRole(user.id)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                user.role === 'admin'
                                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                            }`}
                                            title={user.role === 'admin' ? '取消管理员权限' : '设为管理员'}
                                        >
                                            {user.role === 'admin' ? '取消管理员' : '设为管理员'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                            title="删除用户"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* 权限说明 */}
                <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2">
                        <Info size={16} /> 权限说明
                    </h4>
                    <ul className="text-sm text-slate-600 space-y-1">
                        <li>• <strong>管理员</strong>：可以管理所有用户、查看所有数据、配置系统设置</li>
                        <li>• <strong>普通用户</strong>：只能管理自己的报销数据，无法访问用户管理</li>
                        <li>• 每个用户的数据相互隔离，互不影响</li>
                    </ul>
                </div>
            </div>
        );
    };
    
    // AI 配置组件
    const AISettings = () => {
        const [configs, setConfigs] = useState<any[]>([]);
        const [loading, setLoading] = useState(false);
        const [showForm, setShowForm] = useState(false);
        const [formData, setFormData] = useState({
            provider: 'gemini',
            name: '',
            apiKey: '',
            apiUrl: '', // 自定义代理地址
            model: '',
            endpointId: '', // 火山引擎 Endpoint ID
            isActive: false,
        });
        const [testing, setTesting] = useState(false);
        const [testResult, setTestResult] = useState<any>(null);

        // 各厂商支持的主流模型列表
        const providers: Record<string, { 
            name: string; 
            description: string; 
            models: { id: string; name: string; vision?: boolean }[];
            baseUrl?: string;
            needsEndpointId?: boolean; // 是否需要 Endpoint ID（火山引擎）
        }> = {
            gemini: { 
                name: 'Google Gemini', 
                description: 'Google 多模态 AI，支持图像识别（支持代理）',
                baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
                models: [
                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (推荐)', vision: true },
                    { id: 'gemini-2.5-pro-preview-03-25', name: 'Gemini 2.5 Pro Preview', vision: true },
                    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', vision: true },
                    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', vision: true },
                ]
            },
            deepseek: { 
                name: 'DeepSeek', 
                description: '高性价比国产模型',
                baseUrl: 'https://api.deepseek.com',
                models: [
                    { id: 'deepseek-chat', name: 'DeepSeek Chat (推荐)' },
                    { id: 'deepseek-coder', name: 'DeepSeek Coder' },
                    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
                ]
            },
            openai: { 
                name: 'OpenAI', 
                description: 'GPT 系列模型，支持图像识别',
                models: [
                    { id: 'gpt-4o', name: 'GPT-4o (推荐)', vision: true },
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', vision: true },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', vision: true },
                    { id: 'gpt-4-vision-preview', name: 'GPT-4 Vision Preview', vision: true },
                    { id: 'gpt-4', name: 'GPT-4' },
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
                ]
            },
            claude: { 
                name: 'Claude (Anthropic)', 
                description: 'Anthropic Claude，支持图像识别',
                models: [
                    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (推荐)', vision: true },
                    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', vision: true },
                    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', vision: true },
                    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', vision: true },
                    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', vision: true },
                ]
            },
            glm: { 
                name: '智谱 GLM', 
                description: '智谱清言多模态，支持图像识别',
                baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
                models: [
                    { id: 'glm-4v-plus', name: 'GLM-4V Plus (推荐)', vision: true },
                    { id: 'glm-4v', name: 'GLM-4V', vision: true },
                    { id: 'glm-4-plus', name: 'GLM-4 Plus' },
                    { id: 'glm-4', name: 'GLM-4' },
                    { id: 'glm-4-flash', name: 'GLM-4 Flash (免费)' },
                ]
            },
            qwen: { 
                name: '通义千问', 
                description: '阿里云千问，支持图像识别',
                baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                models: [
                    { id: 'qwen-vl-max', name: 'Qwen VL Max (推荐)', vision: true },
                    { id: 'qwen-vl-plus', name: 'Qwen VL Plus', vision: true },
                    { id: 'qwen-max', name: 'Qwen Max' },
                    { id: 'qwen-plus', name: 'Qwen Plus' },
                    { id: 'qwen-turbo', name: 'Qwen Turbo' },
                ]
            },
            minimax: { 
                name: 'MiniMax', 
                description: 'MiniMax AI 模型',
                baseUrl: 'https://api.minimax.chat/v1',
                models: [
                    { id: 'abab6.5s-chat', name: 'ABAB 6.5s Chat (推荐)' },
                    { id: 'abab6.5-chat', name: 'ABAB 6.5 Chat' },
                    { id: 'abab5.5-chat', name: 'ABAB 5.5 Chat' },
                ]
            },
            moonshot: { 
                name: 'Moonshot (月之暗面)', 
                description: 'Kimi AI 模型',
                baseUrl: 'https://api.moonshot.cn/v1',
                models: [
                    { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K (推荐)' },
                    { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K' },
                    { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K' },
                ]
            },
            doubao: { 
                name: '火山引擎 (豆包)', 
                description: '字节跳动豆包大模型，需填写 Endpoint ID',
                baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
                needsEndpointId: true, // 标记需要 Endpoint ID
                models: [
                    { id: 'doubao-seed-1.6-vision', name: 'Doubao Seed 1.6 Vision (推荐)', vision: true },
                    { id: 'doubao-1.5-vision-pro-250328', name: 'Doubao 1.5 Vision Pro', vision: true },
                    { id: 'doubao-1-5-thinking-vision-pro-250428', name: 'Doubao 1.5 Thinking Vision Pro', vision: true },
                    { id: 'doubao-1.5-vision-lite-250315', name: 'Doubao 1.5 Vision Lite', vision: true },
                    { id: 'doubao-seed-1.6', name: 'Doubao Seed 1.6' },
                    { id: 'doubao-seed-1.6-lite', name: 'Doubao Seed 1.6 Lite' },
                ]
            },
        };
        
        // 获取当前厂商的默认模型
        const getDefaultModel = (provider: string) => {
            const p = providers[provider];
            return p?.models[0]?.id || '';
        };

        const loadConfigs = async () => {
            setLoading(true);
            try {
                const data = await apiRequest(`/api/settings/ai-config?userId=${settings.currentUser?.id || 'default'}`);
                setConfigs(data?.configs || []);
            } catch (e) {
                console.error('加载配置失败', e);
                setConfigs([]);
            }
            setLoading(false);
        };

        useEffect(() => {
            loadConfigs();
        }, []);

        const handleSave = async () => {
            if (!formData.apiKey) return alert('请输入 API Key');
            // 火山引擎需要 Endpoint ID
            const providerInfo = providers[formData.provider];
            if (providerInfo?.needsEndpointId && !formData.endpointId) {
                return alert('请输入 Endpoint ID');
            }
            try {
                // 火山引擎使用 endpointId 作为实际调用的 model
                const selectedModel = providerInfo?.needsEndpointId 
                    ? formData.endpointId 
                    : (formData.model || getDefaultModel(formData.provider));
                await apiRequest('/api/settings/ai-config', {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: settings.currentUser?.id || 'default',
                        ...formData,
                        model: selectedModel,
                        displayModel: formData.model,
                        name: formData.name || providerInfo?.name || formData.provider,
                        apiUrl: formData.apiUrl || providerInfo?.baseUrl || '',
                    }),
                });
                await loadConfigs();
                setShowForm(false);
                setFormData({ provider: 'gemini', name: '', apiKey: '', apiUrl: '', model: '', isActive: false });
                alert('配置已保存');
            } catch (e) {
                alert('保存失败');
            }
        };

        const handleTest = async () => {
            if (!formData.apiKey) return alert('请输入 API Key');
            const providerInfo = providers[formData.provider];
            // 火山引擎需要 Endpoint ID
            if (providerInfo?.needsEndpointId && !formData.endpointId) {
                return alert('请输入 Endpoint ID');
            }
            setTesting(true);
            setTestResult(null);
            try {
                // 火山引擎使用 endpointId 作为 model
                const selectedModel = providerInfo?.needsEndpointId 
                    ? formData.endpointId 
                    : (formData.model || getDefaultModel(formData.provider));
                const data = await apiRequest('/api/settings/ai-config/test', {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: settings.currentUser?.id || 'default',
                        provider: formData.provider,
                        apiKey: formData.apiKey,
                        model: selectedModel,
                        baseUrl: providerInfo?.baseUrl || '',
                    }),
                });
                setTestResult(data);
            } catch (e: any) {
                setTestResult({ success: false, message: e.message });
            } finally {
                setTesting(false);
            }
        };

        const handleDelete = async (id: string) => {
            if (!confirm('确定删除该配置？')) return;
            try {
                await fetch(`/api/settings/ai-config/${id}?userId=${settings.currentUser.id}`, { method: 'DELETE' });
                await loadConfigs();
            } catch (e) {
                alert('删除失败');
            }
        };

        const handleSetActive = async (config: any) => {
            try {
                await fetch('/api/settings/ai-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...config,
                        userId: settings.currentUser.id,
                        isActive: true,
                    }),
                });
                await loadConfigs();
            } catch (e) {
                alert('设置失败');
            }
        };

        return (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Settings size={20}/> AI 模型配置
                    </h3>
                    <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-indigo-700">
                        <Plus size={16}/> 添加配置
                    </button>
                </div>

                {/* 添加表单 */}
                {showForm && (
                    <div className="bg-slate-50 border border-indigo-200 p-6 rounded-xl mb-6">
                        <h4 className="font-bold text-indigo-800 mb-4">新增 AI 配置</h4>
                        
                        {/* 提供商选择 */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 mb-2">选择 AI 模型</label>
                            <div className="grid grid-cols-4 gap-2">
                                {Object.entries(providers).map(([key, info]) => (
                                    <button
                                        key={key}
                                        onClick={() => setFormData({ ...formData, provider: key })}
                                        className={`p-3 rounded-lg border-2 text-left transition-all text-sm ${formData.provider === key ? 'border-indigo-500 bg-slate-100' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="font-bold text-slate-800">{info.name}</div>
                                        <div className="text-xs text-slate-400">{info.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">配置名称</label>
                                <input
                                    placeholder={providers[formData.provider]?.name || '配置名称'}
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-2 rounded border border-slate-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">选择模型</label>
                                <select
                                    value={formData.model || getDefaultModel(formData.provider)}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    className="w-full p-2 rounded border border-slate-200 text-sm bg-white"
                                >
                                    {providers[formData.provider]?.models.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} {m.vision ? '📷' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">📷 表示支持图像识别</p>
                            </div>
                        </div>

                        {/* 自定义 API 地址 */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 mb-1">自定义 API 地址 (可选)</label>
                            <input
                                type="text"
                                placeholder={providers[formData.provider]?.baseUrl || '使用默认地址'}
                                value={formData.apiUrl}
                                onChange={e => setFormData({ ...formData, apiUrl: e.target.value })}
                                className="w-full p-2 rounded border border-slate-200 text-sm font-mono"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                {formData.provider === 'gemini' && '推荐代理：https://lobegoogle.vercel.app/api/proxy/google'}
                                {formData.provider === 'openai' && '可使用 OpenAI 兼容的第三方 API'}
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 mb-1">API Key *</label>
                            <input
                                type="password"
                                placeholder="请输入 API Key"
                                value={formData.apiKey}
                                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                className="w-full p-2 rounded border border-slate-200 text-sm font-mono"
                            />
                        </div>

                        {/* 火山引擎 Endpoint ID 配置 */}
                        {providers[formData.provider]?.needsEndpointId && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    Endpoint ID * 
                                    <span className="font-normal text-slate-400 ml-1">(必填)</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="ep-20241128xxxxxx-xxxxx"
                                    value={formData.endpointId}
                                    onChange={e => setFormData({ ...formData, endpointId: e.target.value })}
                                    className="w-full p-2 rounded border border-slate-200 text-sm font-mono"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    在<a href="https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint" target="_blank" rel="noopener" className="text-slate-600 hover:underline">火山方舟控制台</a>创建推理接入点后获取
                                </p>
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                id="aiActiveCheck"
                            />
                            <label htmlFor="aiActiveCheck" className="text-sm text-slate-600">设为默认配置</label>
                        </div>

                        {testResult && (
                            <div className={`p-3 rounded-lg mb-4 ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {testResult.success ? '✅ 连接成功' : `❌ 连接失败: ${testResult.message || '请检查配置'}`}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button onClick={handleTest} disabled={testing} className="bg-slate-100 text-slate-600 px-4 py-2 rounded text-sm font-bold hover:bg-slate-200 disabled:opacity-50">
                                {testing ? '测试中...' : '测试连接'}
                            </button>
                            <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-indigo-700">
                                保存配置
                            </button>
                            <button onClick={() => { setShowForm(false); setTestResult(null); }} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded text-sm">
                                取消
                            </button>
                        </div>
                    </div>
                )}

                {/* 配置列表 */}
                {loading ? (
                    <div className="text-center py-8 text-slate-400">加载中...</div>
                ) : configs.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="text-4xl mb-3">🤖</div>
                        <p className="text-slate-600 font-bold mb-2">尚未配置 AI 模型</p>
                        <p className="text-slate-400 text-sm mb-4">配置后可使用 AI 智能识别发票和审批单</p>
                        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">
                            添加第一个配置
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {configs.map((config: any) => (
                            <div key={config.id} className={`p-4 rounded-xl border-2 ${config.isActive ? 'border-indigo-500 bg-slate-100/50' : 'border-slate-200 bg-white'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{config.name || providers[config.provider as keyof typeof providers]?.name}</span>
                                            {config.isActive && (
                                                <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-slate-800 rounded-full font-bold">默认</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            模型: {config.model} | API Key: {config.apiKey?.slice(0, 8)}****
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {!config.isActive && (
                                            <button onClick={() => handleSetActive(config)} className="text-xs text-slate-700 font-bold hover:underline">设为默认</button>
                                        )}
                                        <button onClick={() => handleDelete(config.id)} className="text-slate-400 hover:text-red-500">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 提示 */}
                <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <h4 className="font-bold text-amber-800 mb-2">💡 使用说明</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                        <li>• 配置 AI 模型后，上传发票/审批单时将自动识别信息</li>
                        <li>• 推荐使用 Google Gemini（免费额度）或 DeepSeek（性价比高）</li>
                        <li>• API Key 会安全存储，仅用于调用 AI 服务</li>
                    </ul>
                </div>
            </div>
        );
    };

    // -- Sub Components --

    const ProfileSettings = () => {
        const [profile, setProfile] = useState(settings.currentUser);
        const [pass, setPass] = useState("");
        
        const handleSave = () => {
            onSave({ ...settings, currentUser: profile });
            alert("个人信息已更新");
            setPass(""); // Clear password field
        };

        return (
            <div className="max-w-xl">
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><User size={20}/> 个人信息管理</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">姓名</label>
                        <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 transition-all"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">部门</label>
                        <input value={profile.department} onChange={e => setProfile({...profile, department: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 transition-all"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">邮箱</label>
                        <input value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 transition-all"/>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">修改密码</label>
                        <input type="password" placeholder="输入新密码" value={pass} onChange={e => setPass(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 transition-all"/>
                    </div>
                    <button onClick={handleSave} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all">
                        保存修改
                    </button>
                </div>
            </div>
        );
    };

    const UserManagement = () => {
        const [newUser, setNewUser] = useState({ name: '', department: '', email: '', role: 'user' as 'user'|'admin' });
        
        const addUser = () => {
            if(!newUser.name || !newUser.email) return alert("请填写完整");
            const user: AppUser = { ...newUser, id: `u-${Date.now()}` };
            onSave({ ...settings, users: [...settings.users, user] });
            setNewUser({ name: '', department: '', email: '', role: 'user' });
        };

        const deleteUser = (id: string) => {
            if(confirm("确定删除该用户吗？")) {
                onSave({ ...settings, users: settings.users.filter((u:any) => u.id !== id) });
            }
        };

        return (
            <div>
                 <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Users size={20}/> 用户管理 (管理员)</h3>
                 
                 {/* Add User */}
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8">
                     <h4 className="font-bold text-sm text-slate-600 mb-4">添加新用户</h4>
                     <div className="grid grid-cols-4 gap-4">
                         <input placeholder="姓名" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="p-2 rounded-lg border border-slate-200 text-sm"/>
                         <input placeholder="部门" value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})} className="p-2 rounded-lg border border-slate-200 text-sm"/>
                         <input placeholder="邮箱" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="p-2 rounded-lg border border-slate-200 text-sm"/>
                         <div className="flex gap-2">
                             <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="p-2 rounded-lg border border-slate-200 text-sm flex-1">
                                 <option value="user">普通用户</option>
                                 <option value="admin">管理员</option>
                             </select>
                             <button onClick={addUser} className="bg-indigo-600 text-white px-4 rounded-lg font-bold text-sm">添加</button>
                         </div>
                     </div>
                 </div>

                 {/* User List */}
                 <div className="border border-slate-200 rounded-xl overflow-hidden">
                     <table className="w-full text-left text-sm">
                         <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                             <tr>
                                 <th className="p-3">姓名</th>
                                 <th className="p-3">部门</th>
                                 <th className="p-3">邮箱</th>
                                 <th className="p-3">角色</th>
                                 <th className="p-3 text-right">操作</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {settings.users.map((u:AppUser) => (
                                 <tr key={u.id} className="hover:bg-slate-50">
                                     <td className="p-3 font-bold">{u.name}</td>
                                     <td className="p-3 text-slate-500">{u.department}</td>
                                     <td className="p-3 text-slate-500">{u.email}</td>
                                     <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>{u.role === 'admin' ? '管理员' : '用户'}</span></td>
                                     <td className="p-3 text-right">
                                         {u.id !== settings.currentUser.id && (
                                             <button onClick={() => deleteUser(u.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                         )}
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
            </div>
        )
    };

    const PaymentSettings = () => {
        const [isAdding, setIsAdding] = useState(false);
        const [newCard, setNewCard] = useState<PaymentAccount>({ id: '', bankName: '', bankBranch: '', accountNumber: '', accountName: '', isDefault: false });

        const handleAdd = () => {
            if(!newCard.accountNumber || !newCard.bankName || !newCard.accountName) return alert("信息不完整");
            const account = { ...newCard, id: `pay-${Date.now()}` };
            const updatedAccounts = settings.paymentAccounts.map((a:any) => account.isDefault ? { ...a, isDefault: false } : a);
            onSave({ ...settings, paymentAccounts: [...updatedAccounts, account] });
            setIsAdding(false);
            setNewCard({ id: '', bankName: '', bankBranch: '', accountNumber: '', accountName: '', isDefault: false });
        };

        const deleteAccount = (id: string) => {
             if(confirm("确定删除该收款账户吗？")) {
                 onSave({ ...settings, paymentAccounts: settings.paymentAccounts.filter((a:any) => a.id !== id) });
             }
        };

        const setDefault = (id: string) => {
            const updated = settings.paymentAccounts.map((a:any) => ({ ...a, isDefault: a.id === id }));
            onSave({ ...settings, paymentAccounts: updated });
        };

        return (
            <div>
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><CreditCard size={20}/> 收款信息管理</h3>
                    <button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-indigo-700"><Plus size={16}/> 添加银行卡</button>
                 </div>

                 {/* Add Modal/Form Inline */}
                 {isAdding && (
                     <div className="bg-slate-50 border border-indigo-200 p-4 rounded-xl mb-6 shadow-sm">
                         <h4 className="font-bold text-sm text-indigo-800 mb-3">新收款账户</h4>
                         <div className="grid grid-cols-2 gap-4 mb-4">
                             <input placeholder="开户行 (如：招商银行)" value={newCard.bankName} onChange={e => setNewCard({...newCard, bankName: e.target.value})} className="p-2 rounded border border-slate-200 text-sm"/>
                             <input placeholder="支行名称 (选填)" value={newCard.bankBranch} onChange={e => setNewCard({...newCard, bankBranch: e.target.value})} className="p-2 rounded border border-slate-200 text-sm"/>
                             <input placeholder="收款人姓名" value={newCard.accountName} onChange={e => setNewCard({...newCard, accountName: e.target.value})} className="p-2 rounded border border-slate-200 text-sm"/>
                             <input placeholder="银行卡号" value={newCard.accountNumber} onChange={e => setNewCard({...newCard, accountNumber: e.target.value})} className="p-2 rounded border border-slate-200 text-sm"/>
                         </div>
                         <div className="flex items-center gap-2 mb-4">
                             <input type="checkbox" checked={newCard.isDefault} onChange={e => setNewCard({...newCard, isDefault: e.target.checked})} id="defCheck"/>
                             <label htmlFor="defCheck" className="text-sm text-slate-600">设为默认收款账户</label>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm font-bold">确认添加</button>
                             <button onClick={() => setIsAdding(false)} className="bg-white border border-slate-300 text-slate-600 px-4 py-1.5 rounded text-sm">取消</button>
                         </div>
                     </div>
                 )}

                 <div className="grid md:grid-cols-2 gap-4">
                     {settings.paymentAccounts.map((acc: PaymentAccount) => (
                         <div key={acc.id} className={`relative p-6 rounded-2xl border-2 transition-all group ${acc.isDefault ? 'border-indigo-500 bg-slate-100/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                             {acc.isDefault && (
                                 <span className="absolute top-4 right-4 bg-indigo-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Check size={10}/> 默认</span>
                             )}
                             <div className="flex items-center gap-3 mb-4">
                                 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                     <Landmark size={20}/>
                                 </div>
                                 <div>
                                     <div className="font-bold text-slate-800">{acc.bankName}</div>
                                     <div className="text-xs text-slate-400">{acc.bankBranch || '总行'}</div>
                                 </div>
                             </div>
                             <div className="font-mono text-xl text-slate-700 tracking-wider mb-4">
                                 **** **** **** {acc.accountNumber.slice(-4)}
                             </div>
                             <div className="flex justify-between items-end">
                                 <div className="text-xs text-slate-400">持卡人：<span className="text-slate-600 font-bold">{acc.accountName}</span></div>
                                 <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     {!acc.isDefault && <button onClick={() => setDefault(acc.id)} className="text-xs text-slate-700 font-bold hover:underline">设为默认</button>}
                                     <button onClick={() => deleteAccount(acc.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
        )
    };

    const BudgetSettings = () => {
        const [newProj, setNewProj] = useState<BudgetProject>({ id: '', name: '', code: '' });

        const addProject = () => {
            if(!newProj.name || !newProj.code) return alert("请填写完整");
            const project = { ...newProj, id: `proj-${Date.now()}` };
             const updatedProjs = settings.budgetProjects.map((p:any) => newProj.isDefault ? { ...p, isDefault: false } : p);
            onSave({ ...settings, budgetProjects: [...updatedProjs, project] });
            setNewProj({ id: '', name: '', code: '' });
        };

        const deleteProject = (id: string) => {
             if(confirm("确定删除该预算项目吗？")) {
                 onSave({ ...settings, budgetProjects: settings.budgetProjects.filter((p:any) => p.id !== id) });
             }
        };

        const setDefault = (id: string) => {
             const updated = settings.budgetProjects.map((p:any) => ({ ...p, isDefault: p.id === id }));
             onSave({ ...settings, budgetProjects: updated });
        };

        return (
            <div>
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Briefcase size={20}/> 预算项目管理</h3>
                
                {/* Add Row */}
                <div className="flex gap-4 mb-6 items-end">
                     <div className="flex-1">
                         <label className="text-xs font-bold text-slate-500 mb-1 block">项目名称</label>
                         <input value={newProj.name} onChange={e => setNewProj({...newProj, name: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="例如：2024市场推广费"/>
                     </div>
                     <div className="w-32">
                         <label className="text-xs font-bold text-slate-500 mb-1 block">预算编码</label>
                         <input value={newProj.code} onChange={e => setNewProj({...newProj, code: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="MK-001"/>
                     </div>
                     <div className="flex items-center pb-3 gap-2">
                         <input type="checkbox" checked={newProj.isDefault} onChange={e => setNewProj({...newProj, isDefault: e.target.checked})} id="projDef"/>
                         <label htmlFor="projDef" className="text-xs text-slate-600 whitespace-nowrap">默认</label>
                     </div>
                     <button onClick={addProject} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm h-[38px]">添加</button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                         <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                             <tr>
                                 <th className="p-3">项目名称</th>
                                 <th className="p-3">编码</th>
                                 <th className="p-3 w-24 text-center">默认</th>
                                 <th className="p-3 w-24 text-right">操作</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {settings.budgetProjects.map((p: BudgetProject) => (
                                 <tr key={p.id} className="hover:bg-slate-50 group">
                                     <td className="p-3 font-medium">{p.name}</td>
                                     <td className="p-3 font-mono text-slate-500">{p.code}</td>
                                     <td className="p-3 text-center">
                                         {p.isDefault ? (
                                             <CheckCircle size={16} className="text-slate-700 mx-auto"/>
                                         ) : (
                                             <button onClick={() => setDefault(p.id)} className="text-xs text-slate-300 hover:text-slate-700 mx-auto opacity-0 group-hover:opacity-100 transition-opacity">设为默认</button>
                                         )}
                                     </td>
                                     <td className="p-3 text-right">
                                         <button onClick={() => deleteProject(p.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                    </table>
                </div>
            </div>
        )
    };

    return (
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8 items-start h-full">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 flex-shrink-0">
                 <h2 className="text-2xl font-bold text-slate-800 mb-6">系统设置</h2>
                 <div className="space-y-1 bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
                     {/* 仅超级管理员可见 */}
                     {isSuperAdmin && (
                         <button onClick={() => setActiveTab('users')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'users' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                             <Users size={18}/> 用户管理
                         </button>
                     )}
                     <button onClick={() => setActiveTab('payment')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'payment' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                         <CreditCard size={18}/> 收款信息
                     </button>
                     <button onClick={() => setActiveTab('budget')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'budget' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                         <Briefcase size={18}/> 预算项目
                     </button>
                     {/* 仅超级管理员可见 */}
                     {isSuperAdmin && (
                         <>
                             <div className="my-2 border-t border-slate-100"></div>
                             <button onClick={() => setActiveTab('ai')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'ai' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                                 <ScanLine size={18}/> AI 配置
                             </button>
                             <button onClick={() => setActiveTab('usage')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'usage' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                                 <Activity size={18}/> 消费统计
                             </button>
                         </>
                     )}
                 </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm min-h-[500px]">
                {activeTab === 'users' && isSuperAdmin && <UserManagementTab />}
                {activeTab === 'payment' && <PaymentSettings />}
                {activeTab === 'budget' && <BudgetSettings />}
                {activeTab === 'ai' && isSuperAdmin && <AISettings />}
                {activeTab === 'usage' && isSuperAdmin && <UsageStats settings={settings} />}
            </div>
        </div>
    )
};

// Token 消费统计组件
const UsageStats = ({ settings }: { settings: any }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');

    // 模型定价信息 (2025年11月最新)
    const MODEL_PRICING: Record<string, { name: string; inputPrice: number; outputPrice: number; isFree: boolean }> = {
        gemini: { name: 'Google Gemini', inputPrice: 0, outputPrice: 0, isFree: true },
        doubao: { name: '火山引擎 (豆包)', inputPrice: 0.8, outputPrice: 2, isFree: false },
        volcengine: { name: '火山引擎', inputPrice: 0.8, outputPrice: 2, isFree: false },
        deepseek: { name: 'DeepSeek', inputPrice: 2, outputPrice: 3, isFree: false },
        openai: { name: 'OpenAI', inputPrice: 36, outputPrice: 108, isFree: false },
        claude: { name: 'Anthropic Claude', inputPrice: 21.6, outputPrice: 108, isFree: false },
        glm: { name: '智谱 GLM', inputPrice: 10, outputPrice: 10, isFree: false },
        qwen: { name: '通义千问', inputPrice: 3, outputPrice: 9, isFree: false },
        minimax: { name: 'MiniMax', inputPrice: 1, outputPrice: 1, isFree: false },
        moonshot: { name: 'Moonshot', inputPrice: 60, outputPrice: 60, isFree: false },
    };

    const userId = settings?.currentUser?.id || 'default';

    useEffect(() => {
        fetchStats();
    }, [period, userId]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const data = await apiRequest(`/api/settings/token-stats?userId=${userId}&period=${period}`);
            console.log('Token 统计数据:', data);
            if (data && data.summary) {
                setStats(data);
            } else {
                setStats({ summary: { totalTokens: 0, totalCost: 0, usageCount: 0 }, byProvider: [], recentUsages: [] });
            }
        } catch (error) {
            console.error('获取统计数据失败:', error);
            setStats({ summary: { totalTokens: 0, totalCost: 0, usageCount: 0 }, byProvider: [], recentUsages: [] });
        } finally {
            setLoading(false);
        }
    };

    const formatTokens = (tokens: number) => {
        if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
        if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
        return tokens.toString();
    };

    const formatCurrency = (amount: number) => {
        if (amount === 0) return '¥0.00';
        if (amount < 0.01) return `¥${amount.toFixed(6)}`;
        if (amount < 1) return `¥${amount.toFixed(4)}`;
        return `¥${amount.toFixed(2)}`;
    };

    const periodLabels: Record<string, string> = {
        day: '今日',
        week: '本周',
        month: '本月',
        year: '今年',
        all: '全部',
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="text-slate-600" size={24} />
                    Token 消费统计
                </h3>
                <div className="flex gap-2">
                    {(['day', 'week', 'month', 'year', 'all'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                period === p 
                                    ? 'bg-slate-800 text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {periodLabels[p]}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader className="animate-spin text-slate-600" size={32} />
                </div>
            ) : !stats || stats.summary?.usageCount === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <Activity size={48} className="mx-auto mb-4 opacity-30" />
                    <p>暂无 {periodLabels[period]} 使用记录</p>
                    <p className="text-sm mt-2">开始使用 AI 识别功能后，这里会显示消费统计</p>
                </div>
            ) : (
                <>
                    {/* 概览卡片 */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
                            <div className="text-sm opacity-80">总消费</div>
                            <div className="text-2xl font-bold mt-1">
                                {formatCurrency(stats.summary?.totalCost || 0)}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                            <div className="text-sm opacity-80">总 Tokens</div>
                            <div className="text-2xl font-bold mt-1">
                                {formatTokens(stats.summary?.totalTokens || 0)}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
                            <div className="text-sm opacity-80">调用次数</div>
                            <div className="text-2xl font-bold mt-1">
                                {stats.summary?.usageCount || 0} 次
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                            <div className="text-sm opacity-80">平均成本</div>
                            <div className="text-2xl font-bold mt-1">
                                {formatCurrency((stats.summary?.totalCost || 0) / Math.max(stats.summary?.usageCount || 1, 1))}
                            </div>
                        </div>
                    </div>

                    {/* 按厂商统计 */}
                    {stats.byProvider && stats.byProvider.length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-6">
                            <h4 className="font-bold text-slate-700 mb-4">按模型厂商统计</h4>
                            <div className="space-y-3">
                                {stats.byProvider.map((item: any) => {
                                    const pricing = MODEL_PRICING[item.provider];
                                    const maxCost = Math.max(...stats.byProvider.map((p: any) => p.totalCost), 1);
                                    const barWidth = (item.totalCost / maxCost) * 100;
                                    
                                    return (
                                        <div key={item.provider} className="relative">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-medium text-slate-700 flex items-center gap-2">
                                                    {item.providerName || pricing?.name || item.provider}
                                                    {(pricing?.isFree || item.isFree) && (
                                                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">免费</span>
                                                    )}
                                                </span>
                                                <span className="text-sm text-slate-500">
                                                    {formatTokens(item.totalTokens)} tokens · {item.usageCount} 次
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all ${item.isFree || pricing?.isFree ? 'bg-emerald-500' : 'bg-slate-1000'}`}
                                                        style={{ width: `${Math.max(barWidth, 2)}%` }}
                                                    />
                                                </div>
                                                <span className="font-bold text-slate-800 min-w-[80px] text-right">
                                                    {formatCurrency(item.totalCost)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 定价参考 */}
                    <div className="bg-gradient-to-r from-slate-50 to-indigo-50 rounded-xl p-6">
                        <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Info size={18} className="text-slate-600" />
                            模型定价参考 (元/百万tokens)
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {Object.entries(MODEL_PRICING).map(([key, info]) => (
                                <div key={key} className={`p-3 rounded-lg border ${info.isFree ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                                    <div className="font-medium text-sm text-slate-700">{info.name}</div>
                                    {info.isFree ? (
                                        <div className="text-emerald-600 font-bold mt-1">免费</div>
                                    ) : (
                                        <div className="text-xs text-slate-500 mt-1">
                                            输入 ¥{info.inputPrice} / 输出 ¥{info.outputPrice}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 最近使用记录 */}
                    {stats.recentUsages && stats.recentUsages.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100">
                                <h4 className="font-bold text-slate-700">最近使用记录</h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">时间</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">模型</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">操作</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">Tokens</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">费用</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {stats.recentUsages.map((usage: any) => {
                                            const pricing = MODEL_PRICING[usage.provider];
                                            return (
                                                <tr key={usage.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-sm text-slate-600">
                                                        {new Date(usage.createdAt).toLocaleString('zh-CN', { 
                                                            month: '2-digit', 
                                                            day: '2-digit', 
                                                            hour: '2-digit', 
                                                            minute: '2-digit' 
                                                        })}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-sm font-medium text-slate-700">
                                                            {usage.providerName || pricing?.name || usage.provider}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-500">
                                                        {usage.operation || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                                                        {formatTokens(usage.totalTokens)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={`text-sm font-medium ${(pricing?.isFree || usage.totalCost === 0) ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                            {(pricing?.isFree || usage.totalCost === 0) ? '免费' : formatCurrency(usage.totalCost)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// 横版 A4 报销单组件 - 严格按照用户提供的 HTML 模板样式
// 缩放至 80% 并顶部对齐显示
const GeneralReimbursementForm = ({ data }: any) => {
    const payableAmount = (data.totalAmount || 0) - (data.prepaidAmount || 0);
    
    const getExpenseReason = () => {
        if (data.title) return data.title;
        if (data.items && data.items.length > 0) {
            return data.items.map((item: any) => item.description || item.name || '').filter(Boolean).join('、');
        }
        return '';
    };

    const currentDate = data.createdDate ? new Date(data.createdDate) : new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    
    // 外层容器样式 - 横版 A4 页面，用于打印时的页面尺寸
    const containerStyle: React.CSSProperties = {
        width: '297mm',  // A4 横版宽度
        height: '210mm', // A4 横版高度
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start', // 顶部对齐
        paddingTop: '10mm', // 顶部留白
        boxSizing: 'border-box',
    };
    
    // 样式定义 - 完全按照 HTML 模板，缩放至 80%
    const paperStyle: React.CSSProperties = {
        backgroundColor: 'white',
        width: 'calc(297mm * 0.8)',  // A4 横版宽度的 80%
        padding: '12mm 16mm', // 缩放后的内边距
        fontFamily: '"SimSun", "Songti SC", serif',
        fontSize: '11.2px', // 14px * 0.8
        lineHeight: '1.4',
        boxSizing: 'border-box',
        transform: 'scale(1)', // 保持清晰度，通过调整尺寸实现缩放
    };

    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid black',
        tableLayout: 'fixed',
    };

    const cellStyle: React.CSSProperties = {
        border: '1px solid black',
        padding: '8px 6px',
        verticalAlign: 'middle',
        fontSize: '14px',
        lineHeight: '1.4',
        overflow: 'hidden',
    };

    const titleStyle: React.CSSProperties = {
        fontFamily: '"SimSun", serif',
        fontSize: '19.2px', // 24px * 0.8
        textAlign: 'center',
        marginBottom: '4px',
    };

    const subtitleStyle: React.CSSProperties = {
        fontFamily: '"SimSun", serif',
        fontSize: '16px', // 20px * 0.8
        textAlign: 'center',
        marginBottom: '16px', // 20px * 0.8
        letterSpacing: '4px',
    };

    const headerRowStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '3px',
        fontSize: '12.8px', // 16px * 0.8
    };

    const underlineStyle: React.CSSProperties = {
        borderBottom: '1px solid black',
        padding: '0 10px',
        display: 'inline-block',
        minWidth: '50px',
        textAlign: 'center',
    };
    
    return (
        <div style={containerStyle} className="general-reimbursement-container">
            <div style={paperStyle}>
                {/* 标题区域 */}
                <div style={titleStyle}>北龙中网（北京）科技有限责任公司</div>
                <div style={subtitleStyle}>报销单</div>

                {/* 顶部元数据 */}
                <div style={headerRowStyle}>
                    <div>
                        报销日期：
                        <span style={{ borderBottom: '1px solid black', padding: '0 8px' }}>{year}</span> 年 
                        <span style={{ borderBottom: '1px solid black', padding: '0 8px' }}>{month}</span> 月 
                        <span style={{ borderBottom: '1px solid black', padding: '0 8px' }}>{day}</span> 日
                    </div>
                    <div>
                        附原始单据 <span style={{ display: 'inline-block', width: '32px', borderBottom: '1px solid black', textAlign: 'center' }}>{data.invoiceCount || data.attachments?.length || ''}</span> 张
                    </div>
                </div>

                {/* 主表格 */}
                <table style={tableStyle}>
                <colgroup>
                    <col style={{ width: '5%' }} />   {/* 序号 */}
                    <col style={{ width: '45%' }} />  {/* 报销事由 */}
                    <col style={{ width: '15%' }} />  {/* 报销金额 */}
                    <col style={{ width: '20%' }} />  {/* 预算项目 */}
                    <col style={{ width: '15%' }} />  {/* 预算编码 */}
                </colgroup>
                <tbody>
                    {/* 第1行：部门 + 报销人 */}
                    <tr>
                        <td colSpan={3} style={{ ...cellStyle, textAlign: 'left', borderRight: 'none' }}>
                            <span style={{ fontWeight: 'bold' }}>部门：</span>
                            <span style={{ marginLeft: '100px' }}>{data.userSnapshot?.department || ''}</span>
                        </td>
                        <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', borderLeft: 'none' }}>
                            <span style={{ fontWeight: 'bold' }}>报销人：</span> {data.userSnapshot?.name || ''}
                        </td>
                    </tr>

                    {/* 第2行：表头 */}
                    <tr style={{ textAlign: 'center' }}>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>序号</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>报销事由</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>报销金额</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>预算项目</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>预算编码</td>
                    </tr>

                    {/* 第3行：数据行 */}
                    <tr style={{ height: '40px' }}>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>1</td>
                        <td style={cellStyle}>{getExpenseReason()}</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>{(data.totalAmount || 0).toFixed(2)} 元</td>
                        <td style={cellStyle}>{data.budgetProject?.name || ''}</td>
                        <td style={cellStyle}>{data.budgetProject?.code || ''}</td>
                    </tr>

                    {/* 第4行：提请报销金额 + 预支借款金额 */}
                    <tr>
                        <td colSpan={2} style={cellStyle}>
                            <span style={{ fontWeight: 'bold' }}>提请报销金额：</span>
                            <span style={{ marginLeft: '5px', fontSize: '13px' }}>※{digitToChinese(data.totalAmount || 0)}</span>
                            <span style={{ float: 'right', marginRight: '5px', whiteSpace: 'nowrap' }}>￥ <span style={{ textDecoration: 'underline' }}>{(data.totalAmount || 0).toFixed(2)}</span> 元</span>
                        </td>
                        <td colSpan={3} style={cellStyle}>
                            <span style={{ fontWeight: 'bold' }}>预支借款金额：</span>
                            <span>{(data.prepaidAmount || 0).toFixed(2)}</span>
                            <span style={{ float: 'right', marginRight: '10px' }}>￥ <span style={{ textDecoration: 'underline' }}>{digitToChinese(data.prepaidAmount || 0)}</span></span>
                        </td>
                    </tr>

                    {/* 第5行：应领款金额 + 结算方式 */}
                    <tr>
                        <td colSpan={2} style={cellStyle}>
                            <span style={{ fontWeight: 'bold' }}>应领款金额：</span>
                            <span style={{ marginLeft: '5px', fontSize: '13px' }}>※{digitToChinese(Math.abs(payableAmount))}</span>
                            <span style={{ float: 'right', marginRight: '5px', whiteSpace: 'nowrap' }}>￥ <span style={{ textDecoration: 'underline' }}>{payableAmount.toFixed(2)}</span> 元</span>
                        </td>
                        <td colSpan={3} style={cellStyle}>
                            <span style={{ fontWeight: 'bold' }}>结算方式：</span>
                            <span style={{ marginLeft: '20px' }}>□现金</span>
                            <span style={{ marginLeft: '20px' }}>□支票</span>
                            <span style={{ marginLeft: '20px' }}>☑电汇</span>
                        </td>
                    </tr>

                    {/* 第6-8行：收款人信息 + 钉钉审批编号 */}
                    <tr>
                        <td rowSpan={3} style={{ ...cellStyle, textAlign: 'center', width: '80px' }}>
                            收款人
                        </td>
                        <td colSpan={2} style={cellStyle}>
                            单位名称（姓名）： {data.paymentAccount?.accountName || ''}
                        </td>
                        <td rowSpan={3} style={{ ...cellStyle, textAlign: 'center', verticalAlign: 'middle' }}>
                            钉钉审批编号
                        </td>
                        <td rowSpan={3} style={{ ...cellStyle, verticalAlign: 'middle', textAlign: 'center', fontSize: '12px' }}>
                            {data.approvalNumber || ''}
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2} style={cellStyle}>
                            开户行： {data.paymentAccount?.bankName || ''}
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2} style={cellStyle}>
                            单位账号（银行卡号）： {data.paymentAccount?.accountNumber || ''}
                        </td>
                    </tr>

                    {/* 第9行：签字栏 - 嵌套表格 */}
                    <tr>
                        <td colSpan={5} style={{ ...cellStyle, padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', height: '60px' }}>
                                <colgroup>
                                    <col style={{ width: '8%' }} />
                                    <col style={{ width: '8%' }} />
                                    <col style={{ width: '8%' }} />
                                    <col style={{ width: '8%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '8%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '8%' }} />
                                    <col style={{ width: '8%' }} />
                                    <col style={{ width: '8%' }} />
                                    <col style={{ width: '8%' }} />
                                    <col style={{ width: '8%' }} />
                                </colgroup>
                                <tbody>
                                    <tr style={{ height: '100%' }}>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: '4px', fontSize: '12px' }}>董事长<br/>签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: '4px', fontSize: '12px' }}>总 经理<br/>签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: '4px', fontSize: '12px' }}>常务副总/副总<br/>经理签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: '4px', fontSize: '12px' }}>总监/高级经<br/>理签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: '4px', fontSize: '12px' }}>项目负责<br/>人签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: '4px', fontSize: '12px' }}>领款人<br/>签字</td>
                                        <td style={{ border: 'none' }}></td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>

                    {/* 第10行：所属产品线 */}
                    <tr>
                        <td colSpan={5} style={cellStyle}>
                            所属产品线：
                        </td>
                    </tr>
                    </tbody>
                </table>

                {/* 底部页脚 */}
                <div style={{ ...headerRowStyle, marginTop: '4px', padding: '0 8px' }}>
                    <div style={{ width: '33%' }}>财务负责人：</div>
                    <div style={{ width: '33%', textAlign: 'center' }}>审核：</div>
                    <div style={{ width: '33%', textAlign: 'right', paddingRight: '40px' }}>出纳：</div>
                </div>
            </div>
        </div>
    )
};

const LoanForm = ({ data }: any) => {
    return (
        <div className="w-full h-full bg-white text-slate-900 font-serif p-8 relative">
            <h1 className="text-2xl font-bold text-center mb-8 border-b-2 border-slate-800 pb-2">借款申请单</h1>
            
            <div className="flex justify-between mb-4 text-sm">
                <div>申请人：{data.userSnapshot.name}</div>
                <div>部门：{data.userSnapshot.department}</div>
                <div>申请日期：{formatDate(data.date)}</div>
            </div>

            <div className="border border-slate-800 p-6 text-sm flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <span className="font-bold w-24">借款金额：</span>
                    <span className="text-xl font-bold border-b border-slate-800 flex-1">{data.amount.toFixed(2)}</span>
                    <span className="font-bold">人民币（大写）：</span>
                    <span className="text-xl font-bold border-b border-slate-800 flex-1">{digitToChinese(data.amount)}</span>
                </div>
                
                <div className="flex gap-4">
                     <span className="font-bold w-24">借款事由：</span>
                     <p className="flex-1 border border-slate-300 p-2 min-h-[80px]">{data.reason}</p>
                </div>

                <div className="flex gap-4">
                    <span className="font-bold w-24">收款账户：</span>
                    <div className="flex-1">
                        <p>{data.payeeInfo?.bankName}</p>
                        <p className="font-mono">{data.payeeInfo?.accountNumber}</p>
                        <p>{data.payeeInfo?.accountName}</p>
                    </div>
                </div>

                {data.approvalNumber && (
                    <div className="flex gap-4">
                        <span className="font-bold w-24">审批编号：</span>
                        <span>{data.approvalNumber}</span>
                    </div>
                )}
            </div>

            <div className="mt-12 flex justify-between text-sm px-4">
                <div>申请人签名：__________</div>
                <div>部门经理：__________</div>
                <div>财务审批：__________</div>
                <div>批准：__________</div>
            </div>
        </div>
    )
};

const TravelReimbursementForm = ({ data }: any) => {
    return (
        <div className="w-full h-full bg-white p-8 font-serif text-slate-900">
             <h1 className="text-2xl font-bold text-center mb-8 border-b-2 border-slate-900 pb-4">差旅费报销单</h1>
             <div className="flex justify-between mb-4 text-sm">
                <div>姓名：{data.userSnapshot.name}</div>
                <div>部门：{data.userSnapshot.department}</div>
                <div>出差事由：{data.tripReason}</div>
                <div>日期：{formatDate(data.createdDate)}</div>
            </div>
            
            {/* Trip Legs */}
             <table className="w-full border-collapse border border-slate-900 text-xs mb-6">
                <thead>
                    <tr className="bg-slate-50">
                        <th className="border border-slate-900 p-1">起止日期</th>
                        <th className="border border-slate-900 p-1">起讫地点</th>
                        <th className="border border-slate-900 p-1">交通费</th>
                        <th className="border border-slate-900 p-1">住宿费</th>
                        <th className="border border-slate-900 p-1">市内交通</th>
                        <th className="border border-slate-900 p-1">伙食补助</th>
                        <th className="border border-slate-900 p-1">杂费</th>
                        <th className="border border-slate-900 p-1">小计</th>
                    </tr>
                </thead>
                <tbody>
                    {data.tripLegs?.map((leg: any, i: number) => (
                        <tr key={i}>
                            <td className="border border-slate-900 p-1 text-center">{leg.dateRange}</td>
                            <td className="border border-slate-900 p-1 text-center">{leg.route}</td>
                            <td className="border border-slate-900 p-1 text-right">{leg.transportFee || '-'}</td>
                            <td className="border border-slate-900 p-1 text-right">{leg.hotelFee || '-'}</td>
                            <td className="border border-slate-900 p-1 text-right">{leg.cityTrafficFee || '-'}</td>
                            <td className="border border-slate-900 p-1 text-right">{leg.mealFee || '-'}</td>
                            <td className="border border-slate-900 p-1 text-right">{leg.otherFee || '-'}</td>
                            <td className="border border-slate-900 p-1 text-right font-bold">{leg.subTotal}</td>
                        </tr>
                    ))}
                    {/* Totals row */}
                     <tr className="bg-slate-50 font-bold">
                        <td colSpan={2} className="border border-slate-900 p-1 text-center">合计</td>
                        <td className="border border-slate-900 p-1 text-right">{data.tripLegs?.reduce((a:any,b:any)=>a+(b.transportFee||0),0)}</td>
                        <td className="border border-slate-900 p-1 text-right">{data.tripLegs?.reduce((a:any,b:any)=>a+(b.hotelFee||0),0)}</td>
                         <td className="border border-slate-900 p-1 text-right">{data.tripLegs?.reduce((a:any,b:any)=>a+(b.cityTrafficFee||0),0)}</td>
                        <td className="border border-slate-900 p-1 text-right">{data.tripLegs?.reduce((a:any,b:any)=>a+(b.mealFee||0),0)}</td>
                        <td className="border border-slate-900 p-1 text-right">{data.tripLegs?.reduce((a:any,b:any)=>a+(b.otherFee||0),0)}</td>
                        <td className="border border-slate-900 p-1 text-right">{data.totalAmount}</td>
                    </tr>
                </tbody>
             </table>

             {/* Bottom Info */}
             <div className="flex border border-slate-900 p-2 text-sm mb-8">
                 <div className="flex-1">
                     <div className="mb-1"><span className="font-bold">金额大写：</span> {digitToChinese(data.totalAmount)}</div>
                     {data.prepaidAmount > 0 && <div><span className="font-bold">预借金额：</span> ¥{data.prepaidAmount} (应补/退: ¥{data.payableAmount})</div>}
                 </div>
                 <div className="w-1/3 border-l border-slate-900 pl-4">
                     <div><span className="font-bold">预算项目：</span> {data.budgetProject?.name}</div>
                     <div><span className="font-bold">支付账户：</span> {data.paymentAccount?.bankName}</div>
                 </div>
             </div>

             <div className="flex justify-between text-sm mt-12 px-4">
                <div>报销人签名：__________</div>
                <div>部门经理：__________</div>
                <div>财务审核：__________</div>
                <div>批准：__________</div>
             </div>
        </div>
    );
};

// Add CreateTravelReportView
const CreateTravelReportView = ({ settings, loans, onAction, onBack }: any) => {
    // Similar state management to CreateReportView
    const [step, setStep] = useState(1);
    const [analyzing, setAnalyzing] = useState(false);
    const [files, setFiles] = useState<Attachment[]>([]);
    const [form, setForm] = useState({
        tripReason: "",
        approvalNumber: "",
        budgetProjectId: settings.budgetProjects.find((p:any) => p.isDefault)?.id || "",
        paymentAccountId: settings.paymentAccounts.find((a:any) => a.isDefault)?.id || "",
        prepaidAmount: 0,
        tripLegs: [] as TripLeg[]
    });

    const handleUpload = async (e: any) => {
        // ... (Similar upload logic)
        if(e.target.files && e.target.files.length > 0) {
            const newFiles = await Promise.all(Array.from(e.target.files as FileList).map(async (f: File) => {
                let data = "";
                if(f.type === 'application/pdf') {
                    data = await pdfToImage(f);
                } else {
                    data = await fileToBase64(f);
                }
                return { data, type: 'other', name: f.name } as Attachment;
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const startAnalysis = async () => {
         setAnalyzing(true);
         try {
             const cleanB64 = (d: string) => d.split(',')[1];
             const images = files.map(f => cleanB64(f.data));

             // 调用后端 AI 识别 API
             const response = await apiRequest('/api/ai/recognize', {
                 method: 'POST',
                 body: JSON.stringify({
                     type: 'travel',
                     images: images,
                     mimeType: 'image/jpeg',
                 }),
             }) as any;
             
             const data = response.result || {};
            
            // 使用新的识别结果字段
            const tripLegs = (data.tripLegs || []).map((leg: any) => ({
                ...leg,
                // 确保所有数字字段都有默认值
                transportFee: leg.transportFee || 0,
                hotelFee: leg.hotelFee || 0,
                hotelDays: leg.hotelDays || 0,
                cityTrafficFee: leg.cityTrafficFee || 0,
                mealFee: leg.mealFee || 0,
                otherFee: leg.otherFee || 0,
                subTotal: leg.subTotal || (
                    (leg.transportFee || 0) + 
                    (leg.hotelFee || 0) + 
                    (leg.cityTrafficFee || 0) + 
                    (leg.mealFee || 0) + 
                    (leg.otherFee || 0)
                ),
            }));
            
            setForm(prev => ({
                ...prev,
                tripReason: data.tripReason || "",
                approvalNumber: data.approvalNumber || "",
                tripLegs: tripLegs
            }));
            
            // Try to match loans
            if (data.approvalNumber) {
                const matchedLoan = loans.find((l:any) => l.approvalNumber === data.approvalNumber);
                if(matchedLoan) setForm(prev => ({ ...prev, prepaidAmount: matchedLoan.amount }));
            }
            setStep(2);
         } catch(e) {
             console.error(e);
             alert("AI 识别失败，请检查网络或重试");
         } finally {
             setAnalyzing(false);
         }
    };

    const handleSubmit = (action: 'save' | 'print') => {
        const totalAmount = form.tripLegs.reduce((acc, cur) => acc + (cur.subTotal || 0), 0);
        const report: Report = {
            id: Date.now().toString(),
            title: `差旅费-${form.tripReason}`,
            createdDate: new Date().toISOString(),
            status: 'draft',
            totalAmount,
            prepaidAmount: form.prepaidAmount,
            payableAmount: totalAmount - form.prepaidAmount,
            items: [], // trip legs are stored in tripLegs
            tripLegs: form.tripLegs,
            tripReason: form.tripReason,
            isTravel: true,
            userSnapshot: settings.currentUser,
            attachments: files,
            approvalNumber: form.approvalNumber,
            budgetProject: settings.budgetProjects.find((p:any) => p.id === form.budgetProjectId),
            paymentAccount: settings.paymentAccounts.find((a:any) => a.id === form.paymentAccountId),
            invoiceCount: files.length
        };
        onAction(report, action);
    }
    
    return (
        <div className="mx-auto h-full flex flex-col">
             {step === 1 && (
                 <div className="max-w-4xl mx-auto w-full">
                     <div className="flex items-center gap-4 mb-6">
                        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight className="rotate-180"/></button>
                        <h2 className="text-2xl font-bold text-slate-800">差旅报销</h2>
                    </div>
                     {/* Upload Area */}
                     <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 p-8 flex flex-col items-center justify-center min-h-[200px] mb-8">
                        <input type="file" multiple onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer"/>
                        <div className="text-center pointer-events-none">
                             <Upload size={40} className="text-indigo-400 mx-auto mb-2"/>
                             <p className="font-bold text-slate-600">上传差旅票据 (机票/酒店/打车)</p>
                        </div>
                     </div>
                     <div className="flex gap-2 flex-wrap mb-8">
                         {files.map((f, i) => <div key={i} className="text-xs bg-slate-100 px-2 py-1 rounded">{f.name}</div>)}
                     </div>
                     <button onClick={startAnalysis} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold">{analyzing ? 'Analyzing...' : '开始识别'}</button>
                 </div>
             )}
             {step === 2 && (
                 <div className="flex flex-col h-full bg-slate-200 -m-8">
                      {/* Toolbar */}
                      <div className="bg-white p-4 flex justify-between items-center shadow-sm z-10 sticky top-0">
                          <button onClick={() => setStep(1)} className="font-bold text-slate-500">Back</button>
                          <div className="flex gap-2">
                              <button onClick={() => handleSubmit('save')} className="px-4 py-2 border rounded font-bold">Save Draft</button>
                              <button onClick={() => handleSubmit('print')} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Print</button>
                          </div>
                      </div>
                      <div className="flex-1 flex overflow-hidden">
                          {/* Form Editor Side */}
                          <div className="w-1/3 bg-white border-r p-6 overflow-y-auto">
                              <h3 className="font-bold mb-4">Trip Details</h3>
                              <div className="space-y-4">
                                  <div>
                                      <label className="text-xs font-bold block">Trip Reason</label>
                                      <input value={form.tripReason} onChange={e => setForm({...form, tripReason: e.target.value})} className="w-full border p-2 rounded"/>
                                  </div>
                                   {/* Simplified Trip Leg Editor */}
                                  {form.tripLegs.map((leg, i) => (
                                      <div key={i} className="bg-slate-50 p-2 rounded border">
                                          <div className="flex justify-between text-xs font-bold mb-1">
                                              <span>Segment {i+1}</span>
                                          </div>
                                          <input value={leg.route} onChange={e => {
                                              const legs = [...form.tripLegs];
                                              legs[i].route = e.target.value;
                                              setForm({...form, tripLegs: legs});
                                          }} className="w-full border p-1 rounded text-xs mb-1" placeholder="Route"/>
                                          <input type="number" value={leg.subTotal} onChange={e => {
                                              const legs = [...form.tripLegs];
                                              legs[i].subTotal = parseFloat(e.target.value) || 0;
                                              setForm({...form, tripLegs: legs});
                                          }} className="w-full border p-1 rounded text-xs" placeholder="Amount"/>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          {/* Preview Side */}
                          <div className="flex-1 p-8 overflow-y-auto flex justify-center">
                              <div className="bg-white shadow-xl w-[297mm] min-h-[210mm] p-12 scale-75 origin-top">
                                  <TravelReimbursementForm 
                                    data={{
                                        userSnapshot: settings.currentUser,
                                        tripReason: form.tripReason,
                                        createdDate: new Date().toISOString(),
                                        tripLegs: form.tripLegs,
                                        totalAmount: form.tripLegs.reduce((a,b) => a + (b.subTotal || 0), 0),
                                        prepaidAmount: form.prepaidAmount,
                                        payableAmount: form.tripLegs.reduce((a,b) => a + (b.subTotal || 0), 0) - form.prepaidAmount,
                                        budgetProject: settings.budgetProjects.find((p:any) => p.id === form.budgetProjectId),
                                        paymentAccount: settings.paymentAccounts.find((a:any) => a.id === form.paymentAccountId)
                                    }}
                                  />
                              </div>
                          </div>
                      </div>
                 </div>
             )}
        </div>
    )
};

// Add ReportDetailView
// 横版 A4 附件展示页面组件
const A4AttachmentPage = ({ title, attachments, pageType }: { title: string; attachments: any[]; pageType: 'invoice' | 'approval' | 'voucher' }) => {
    const bgColors = {
        invoice: 'bg-red-50',
        approval: 'bg-blue-50',
        voucher: 'bg-green-50'
    };
    const headerColors = {
        invoice: 'border-red-300 text-red-700',
        approval: 'border-blue-300 text-blue-700',
        voucher: 'border-green-300 text-green-700'
    };

    return (
        <div className={`w-[297mm] h-[210mm] ${bgColors[pageType]} p-6 flex flex-col print:break-before-page`} style={{ fontFamily: 'SimSun, serif' }}>
            {/* 页面标题 */}
            <div className={`text-center mb-4 pb-2 border-b-2 ${headerColors[pageType]}`}>
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="text-xs text-slate-500">共 {attachments.length} 份</p>
            </div>
            
            {/* 附件展示区域 */}
            <div className="flex-1 flex flex-wrap gap-4 justify-center items-start overflow-hidden">
                {attachments.map((attachment, index) => (
                    <div key={index} className="bg-white shadow-md rounded-lg p-2 max-w-[45%] max-h-[85%] overflow-hidden">
                        <img 
                            src={attachment.data} 
                            alt={attachment.name || `附件 ${index + 1}`}
                            className="w-full h-auto object-contain max-h-[170mm]"
                        />
                        {attachment.name && (
                            <p className="text-[10px] text-center text-slate-500 mt-1 truncate">{attachment.name}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// 单个附件全页展示 - 使用竖版 A4 纸张
const A4SingleAttachment = ({ attachment, title, index }: { attachment: any; title: string; index: number }) => {
    return (
        <div className="w-[210mm] h-[297mm] bg-white p-4 flex flex-col print:break-before-page attachment-page" style={{ fontFamily: 'SimSun, serif' }}>
            {/* 页眉 */}
            <div className="text-center mb-2 pb-2 border-b border-slate-200">
                <p className="text-sm text-slate-600">{title} - 第 {index + 1} 页</p>
            </div>
            
            {/* 附件图片 */}
            <div className="flex-1 flex items-center justify-center overflow-hidden">
                <img 
                    src={attachment.data} 
                    alt={attachment.name || `附件`}
                    className="max-w-full max-h-full object-contain"
                />
            </div>
            
            {/* 页脚 */}
            {attachment.name && (
                <div className="text-center mt-2 pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-500">{attachment.name}</p>
                </div>
            )}
        </div>
    );
};

const ReportDetailView = ({ report, onUpdate, onBack }: any) => {
    const [previewMode, setPreviewMode] = useState<'all' | 'report' | 'invoices' | 'approvals' | 'vouchers'>('all');
    
    // 分类附件 - 优先使用 type 属性，其次使用文件名判断
    const invoiceAttachments = report.attachments?.filter((a: any) => 
        a.type === 'invoice' || a.name?.includes('发票') || a.name?.includes('invoice')
    ) || [];
    
    const approvalAttachments = report.attachments?.filter((a: any) => 
        a.type === 'approval' || a.name?.includes('审批') || a.name?.includes('approval')
    ) || [];
    
    const voucherAttachments = report.attachments?.filter((a: any) => 
        a.type === 'voucher' || a.name?.includes('凭证') || a.name?.includes('voucher')
    ) || [];
    
    // 未分类的附件（旧数据或其他来源）作为发票处理
    const classifiedIds = new Set([
        ...invoiceAttachments.map((a: any) => a.data),
        ...approvalAttachments.map((a: any) => a.data),
        ...voucherAttachments.map((a: any) => a.data)
    ]);
    const unclassifiedAttachments = report.attachments?.filter((a: any) => 
        !classifiedIds.has(a.data)
    ) || [];
    
    const allInvoices = [...invoiceAttachments, ...unclassifiedAttachments];

    return (
        <div className="h-full flex flex-col bg-slate-100 -m-8">
            {/* 工具栏 */}
            <div className="bg-white p-4 flex justify-between items-center shadow-sm print:hidden">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-1 font-bold text-slate-500 hover:text-slate-700">
                        <ChevronRight className="rotate-180"/> 返回
                    </button>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <span className="text-sm text-slate-600">预览模式：</span>
                    <div className="flex gap-1">
                        <button 
                            onClick={() => setPreviewMode('all')}
                            className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                        >全部</button>
                        <button 
                            onClick={() => setPreviewMode('report')}
                            className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'report' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                        >报销单</button>
                        <button 
                            onClick={() => setPreviewMode('invoices')}
                            className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'invoices' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                        >发票 ({allInvoices.length})</button>
                        {approvalAttachments.length > 0 && (
                            <button 
                                onClick={() => setPreviewMode('approvals')}
                                className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'approvals' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >审批单 ({approvalAttachments.length})</button>
                        )}
                        {voucherAttachments.length > 0 && (
                            <button 
                                onClick={() => setPreviewMode('vouchers')}
                                className={`px-3 py-1 rounded text-xs font-bold ${previewMode === 'vouchers' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >购物凭证 ({voucherAttachments.length})</button>
                        )}
                    </div>
                </div>
                <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold flex items-center gap-2 hover:bg-indigo-700">
                    <Printer size={16}/> 打印全部
                </button>
            </div>
            
            {/* 预览区域 */}
            <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8 print:p-0 print:overflow-visible print:gap-0">
                {/* 报销单 */}
                {(previewMode === 'all' || previewMode === 'report') && (
                    <div className="bg-white shadow-lg print:shadow-none">
                        {report.isTravel ? <TravelReimbursementForm data={report}/> : <GeneralReimbursementForm data={report}/>}
                    </div>
                )}
                
                {/* 发票附件 - 每张单独一页 */}
                {(previewMode === 'all' || previewMode === 'invoices') && allInvoices.length > 0 && (
                    <>
                        {allInvoices.map((attachment: any, index: number) => (
                            <div key={`invoice-${index}`} className="bg-white shadow-lg print:shadow-none">
                                <A4SingleAttachment 
                                    attachment={attachment} 
                                    title="电子发票" 
                                    index={index}
                                />
                            </div>
                        ))}
                    </>
                )}
                
                {/* 审批单附件 - 每张单独一页 */}
                {(previewMode === 'all' || previewMode === 'approvals') && approvalAttachments.length > 0 && (
                    <>
                        {approvalAttachments.map((attachment: any, index: number) => (
                            <div key={`approval-${index}`} className="bg-white shadow-lg print:shadow-none">
                                <A4SingleAttachment 
                                    attachment={attachment} 
                                    title="审批单据" 
                                    index={index}
                                />
                            </div>
                        ))}
                    </>
                )}
                
                {/* 购物凭证附件 - 每张单独一页 */}
                {(previewMode === 'all' || previewMode === 'vouchers') && voucherAttachments.length > 0 && (
                    <>
                        {voucherAttachments.map((attachment: any, index: number) => (
                            <div key={`voucher-${index}`} className="bg-white shadow-lg print:shadow-none">
                                <A4SingleAttachment 
                                    attachment={attachment} 
                                    title="购物凭证" 
                                    index={index}
                                />
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

// Add LoanDetailView
const LoanDetailView = ({ loan, onUpdate, onBack }: any) => {
     return (
        <div className="h-full flex flex-col bg-slate-100 -m-8">
            <div className="bg-white p-4 flex justify-between items-center shadow-sm print:hidden">
                <button onClick={onBack} className="flex items-center gap-1 font-bold text-slate-500"><ChevronRight className="rotate-180"/> Back</button>
                <button onClick={() => window.print()} className="px-4 py-2 bg-amber-500 text-white rounded font-bold flex items-center gap-2"><Printer size={16}/> Print</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 flex justify-center print:p-0 print:overflow-visible">
                <div className="bg-white shadow-lg w-[297mm] min-h-[210mm] p-[15mm] print:shadow-none print:w-full print:h-full">
                    <LoanForm data={loan}/>
                    <div className="break-before-page mt-8 pt-8 border-t">
                         <h2 className="text-center font-bold mb-4">附：审批单据</h2>
                         <div className="flex flex-col gap-4 items-center">
                            {loan.attachments.map((f:any, i:number) => (
                                <img key={i} src={f.data} className="w-full object-contain border"/>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 根应用组件（管理认证状态） ---
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    // 检查本地存储的 token
    const token = localStorage.getItem('reimb_token');
    const userStr = localStorage.getItem('reimb_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (e) {
        // Token 无效，清除
        localStorage.removeItem('reimb_token');
        localStorage.removeItem('reimb_user');
      }
    }
    setLoading(false);
  }, []);

  // 检查是否需要修改密码（超级管理员首次登录）
  const checkPasswordChange = (user: AppUser) => {
    const hasChangedPassword = localStorage.getItem(`password_changed_${user.id}`);
    if (user.email === SUPER_ADMIN_EMAIL && !hasChangedPassword) {
      setShowPasswordPrompt(true);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('密码至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次密码不一致');
      return;
    }
    // 标记密码已修改
    localStorage.setItem(`password_changed_${currentUser?.id}`, 'true');
    setShowPasswordPrompt(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    alert('密码修改成功！');
  };

  const handleLogin = (user: AppUser, token: string) => {
    // 检查是否为超级管理员
    const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
    const userWithRole = {
      ...user,
      role: isSuperAdmin ? 'admin' : (user.role || 'user')
    };
    localStorage.setItem('reimb_token', token);
    localStorage.setItem('reimb_user', JSON.stringify(userWithRole));
    setCurrentUser(userWithRole);
    setIsAuthenticated(true);
    // 检查是否需要修改密码
    checkPasswordChange(userWithRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('reimb_token');
    localStorage.removeItem('reimb_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <>
      <MainApp user={currentUser} onLogout={handleLogout} />
      
      {/* 密码修改弹窗 */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">安全提醒</h3>
              <p className="text-slate-500 mt-2 text-sm">检测到您使用默认密码登录，请修改密码以保障账户安全</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">新密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="请输入新密码（至少6位）"
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 transition-colors"
                />
              </div>
              {passwordError && (
                <p className="text-red-500 text-xs">{passwordError}</p>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPasswordPrompt(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                稍后修改
              </button>
              <button
                onClick={handlePasswordChange}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
