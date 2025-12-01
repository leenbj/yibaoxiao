import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
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
  Eye,
  Download,
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
  AlertTriangle,
  Search
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
// 生产环境使用相对路径（通过 Nginx 代理），开发环境使用本地后端
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

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

  const handleReportAction = async (report: Report, action: 'save' | 'pdf') => {
      const status: ReportStatus = action === 'pdf' ? 'submitted' : 'draft';
      const expenseStatus: ExpenseStatus = action === 'pdf' ? 'processing' : 'pending';
      
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
      // 优先使用 aiRecognitionData 中存储的关联记账本 ID
      const linkedExpenseIds = (report as any).aiRecognitionData?.linkedExpenseIds || [];
      if(linkedExpenseIds.length > 0) {
          updateExpensesStatus(linkedExpenseIds, expenseStatus);
      }

      // 跳转到详情页面（用户可在详情页生成 PDF）
      setTimeout(() => {
          setSelectedId(report.id);
          setView("report-detail");
      }, 100);
  };

  const handleLoanAction = async (loan: LoanRecord, action: 'save' | 'pdf') => {
    const status: ReportStatus = action === 'pdf' ? 'submitted' : 'draft';
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
    
    // 跳转到详情页面（用户可在详情页生成 PDF）
    setTimeout(() => {
        setSelectedId(loan.id);
        setView("loan-detail");
    }, 100);
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
          const report = reports.find((r: any) => r.id === id);
          if(report) {
              // 优先使用 aiRecognitionData 中存储的关联记账本 ID
              const linkedExpenseIds = (report as any).aiRecognitionData?.linkedExpenseIds || [];
              if (linkedExpenseIds.length > 0) {
                  // 更新关联的记账本事项为"已报销"
                  updateExpensesStatus(linkedExpenseIds, 'done');
              }
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
            <SidebarItem collapsed={sidebarCollapsed} active={view === "loan"} icon={<Wallet size={18}/>} label="借款申请" onClick={() => setView("loan")} />
            <SidebarItem collapsed={sidebarCollapsed} active={view === "create-travel"} icon={<Plane size={18}/>} label="差旅报销" onClick={() => setView("create-travel")} />
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
                {view === "create" && <CreateReportView settings={settings} expenses={expenses} setExpenses={setExpenses} loans={loans} onAction={handleReportAction} onBack={() => setView("dashboard")} />}
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
// 折线图组件 - 小细线版本
const LineChartComponent = ({ data, labels }: { data: number[], labels: string[] }) => {
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const chartHeight = 100;
    
    // 计算每个点的位置
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1 || 1)) * 100;
        const y = chartHeight - ((val - min) / range) * chartHeight;
        return { x, y, val };
    });
    
    // 生成 SVG 路径
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} ${chartHeight} L 0 ${chartHeight} Z`;
    
    return (
        <div className="relative h-32">
            {/* Y 轴刻度 */}
            <div className="absolute left-0 top-0 bottom-5 w-10 flex flex-col justify-between text-[9px] text-slate-400">
                <span>¥{max.toLocaleString()}</span>
                <span>¥{min.toLocaleString()}</span>
            </div>
            
            {/* 图表区域 */}
            <div className="ml-10 h-24 relative">
                <svg viewBox={`0 0 100 ${chartHeight}`} className="w-full h-full" preserveAspectRatio="none">
                    {/* 网格线 */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="#f1f5f9" strokeWidth="0.3"/>
                    <line x1="0" y1={chartHeight/2} x2="100" y2={chartHeight/2} stroke="#f1f5f9" strokeWidth="0.3" strokeDasharray="2,2"/>
                    <line x1="0" y1={chartHeight} x2="100" y2={chartHeight} stroke="#f1f5f9" strokeWidth="0.3"/>
                    
                    {/* 填充区域 */}
                    <path d={areaPath} fill="url(#gradient-line)" opacity="0.15"/>
                    
                    {/* 折线 - 细线 */}
                    <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                    
                    {/* 渐变定义 */}
                    <defs>
                        <linearGradient id="gradient-line" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
                        </linearGradient>
                    </defs>
                </svg>
                
                {/* 数据点 - 小圆点 */}
                {points.map((p, i) => (
                    <div 
                        key={i}
                        className="absolute w-1.5 h-1.5 bg-indigo-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer hover:scale-150 transition-transform"
                        style={{ 
                            left: `${p.x}%`, 
                            top: `${(p.y / chartHeight) * 100}%`
                        }}
                    >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded transition-opacity pointer-events-none whitespace-nowrap z-10">
                            ¥{p.val.toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* X 轴标签 */}
            <div className="ml-10 flex justify-between text-[9px] text-slate-400 mt-0.5">
                {labels.map((label, i) => (
                    <span key={i} className="text-center" style={{ width: `${100 / labels.length}%` }}>{label}</span>
                ))}
            </div>
        </div>
    );
};

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

    // Chart Data based on real reports data
    const getChartData = () => {
        const now = new Date();
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        
        // 确定时间范围
        let monthCount = 6;
        if (timeRange === '3m') monthCount = 3;
        if (timeRange === '1y') monthCount = 12;
        
        // 生成月份标签和数据
        const labels: string[] = [];
        const data: number[] = [];
        
        for (let i = monthCount - 1; i >= 0; i--) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const targetMonth = targetDate.getMonth();
            const targetYear = targetDate.getFullYear();
            
            labels.push(monthNames[targetMonth]);
            
            // 计算该月的报销金额
            const monthTotal = reports.filter((r: any) => {
                const reportDate = new Date(r.createdDate);
                return reportDate.getMonth() === targetMonth && 
                       reportDate.getFullYear() === targetYear &&
                       (r.status === 'submitted' || r.status === 'paid');
            }).reduce((sum: number, r: any) => sum + (r.totalAmount || 0), 0);
            
            data.push(monthTotal);
        }
        
        return { data, labels };
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
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-slate-800 text-sm">报销金额统计</h3>
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        {['3m', '6m', '1y'].map((t) => (
                            <button 
                                key={t} 
                                onClick={() => setTimeRange(t as any)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${timeRange === t ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {{'3m': '近3月', '6m': '近半年', '1y': '全年'}[t]}
                            </button>
                        ))}
                    </div>
                </div>
                <LineChartComponent data={chartData.data} labels={chartData.labels}/>
            </div>

            {/* 记账本和报销历史 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 记账本最新记录 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <Briefcase size={14} className="text-slate-600"/>
                            记账本
                        </h3>
                        <button 
                            onClick={() => onNavigate('ledger')}
                            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            查看全部 →
                        </button>
                    </div>
                    <div className="space-y-2">
                        {expenses.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">暂无记录</p>
                        ) : (
                            expenses.slice(0, 4).map((e: any) => (
                                <div key={e.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{e.description}</p>
                                        <p className="text-[10px] text-slate-400">{formatDateTime(e.date)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                        <span className="text-xs font-semibold text-slate-700">¥{e.amount.toFixed(2)}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                            e.status === 'done' ? 'bg-green-100 text-green-600' :
                                            e.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>
                                            {e.status === 'done' ? '已报销' : e.status === 'processing' ? '报销中' : '未报销'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 报销历史最新记录 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <FileText size={14} className="text-slate-600"/>
                            报销历史
                        </h3>
                        <button 
                            onClick={() => onNavigate('history')}
                            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            查看全部 →
                        </button>
                    </div>
                    <div className="space-y-2">
                        {reports.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">暂无报销记录</p>
                        ) : (
                            reports.slice(0, 4).map((r: any) => (
                                <div key={r.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{r.title || '费用报销'}</p>
                                        <p className="text-[10px] text-slate-400">{formatDate(r.createdDate)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                        <span className="text-xs font-semibold text-slate-700">¥{(r.totalAmount || 0).toFixed(2)}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                            r.status === 'paid' ? 'bg-green-100 text-green-600' :
                                            r.status === 'submitted' ? 'bg-blue-100 text-blue-600' :
                                            'bg-yellow-100 text-yellow-600'
                                        }`}>
                                            {r.status === 'paid' ? '已完成' : r.status === 'submitted' ? '报销中' : '未打印'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
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
        <div className="space-y-3 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Briefcase size={18} className="text-slate-600"/> 记账本</h2>
                {selectedIds.length > 0 && (
                    <button onClick={handleDelete} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 hover:bg-red-100">
                        <Trash2 size={14}/> 删除 ({selectedIds.length})
                    </button>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-3 py-2.5 w-10 text-center">
                                    <input type="checkbox" className="w-3.5 h-3.5" onChange={(e) => setSelectedIds(e.target.checked ? expenses.map((e:any) => e.id) : [])} checked={selectedIds.length === expenses.length && expenses.length > 0} />
                                </th>
                                <th className="px-3 py-2.5 w-28">日期</th>
                                <th className="px-3 py-2.5">描述</th>
                                <th className="px-3 py-2.5 w-20">分类</th>
                                <th className="px-3 py-2.5 text-right w-24">金额</th>
                                <th className="px-3 py-2.5 text-center w-24">状态</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {expenses.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm">暂无记录</td></tr>
                            )}
                            {expenses.map((e: any) => (
                                <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-3 py-2 text-center">
                                        <input type="checkbox" className="w-3.5 h-3.5" checked={selectedIds.includes(e.id)} onChange={() => toggleSelect(e.id)} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{formatDateTime(e.date)}</td>
                                    <td className="px-3 py-2">
                                        <div className="text-sm font-medium text-slate-700 leading-tight">{e.description}</div>
                                        {e.remarks && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{e.remarks}</div>}
                                    </td>
                                    <td className="px-3 py-2"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-600">{e.category}</span></td>
                                    <td className="px-3 py-2 text-right text-sm font-semibold text-slate-800">¥{e.amount.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-center">
                                        <div className="relative inline-block">
                                            <select 
                                                value={e.status} 
                                                onChange={(ev) => updateStatus(e.id, ev.target.value as ExpenseStatus)}
                                                className={`appearance-none pl-2 pr-6 py-1 rounded-md text-xs font-medium border outline-none cursor-pointer transition-colors ${getStatusStyle(e.status)}`}
                                            >
                                                <option value="pending">未报销</option>
                                                <option value="processing">报销中</option>
                                                <option value="done">已报销</option>
                                            </select>
                                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                                <ChevronRight size={12} className="rotate-90" />
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

const CreateReportView = ({ settings, expenses, setExpenses, loans, onAction, onBack }: any) => {
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

    // 多发票合并报销选项
    const [mergeInvoices, setMergeInvoices] = useState(true); // 默认合并
    const [invoiceDetails, setInvoiceDetails] = useState<Array<{
        id: string;
        projectName: string;
        amount: number;
        invoiceDate: string;
        invoiceNumber?: string;
        selected: boolean; // 是否选中参与报销
    }>>([]);

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

            // 并行识别发票和审批单，大幅提升速度
            console.log('[AI] 开始并行识别发票和审批单');
            const startTime = Date.now();
            
            // 创建并行请求
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
            
            // 等待所有请求完成
            const [invoiceResponse, approvalResponse] = await Promise.all([invoicePromise, approvalPromise]) as any[];
            
            console.log(`[AI] 并行识别完成，耗时: ${Date.now() - startTime}ms`);
            
            // 处理发票识别结果
            let invoiceData = invoiceResponse.result || {};
            const isArray = Array.isArray(invoiceData);
            console.log('[AI] 发票识别数据类型', { isArray, dataType: typeof invoiceData });
            
            if (isArray) {
                console.log('[AI] 检测到多张发票数组格式，发票数量:', invoiceData.length);
                invoiceData = { invoices: invoiceData };
            }
            
            console.log('[AI] 发票识别数据', {
                hasInvoices: !!invoiceData.invoices,
                invoicesCount: invoiceData.invoices?.length,
                projectName: invoiceData.projectName,
                title: invoiceData.title,
                totalAmount: invoiceData.totalAmount,
                items: invoiceData.items,
                invoiceDate: invoiceData.invoiceDate
            });
            setAiInvoiceResult(invoiceData);

            // 处理审批单识别结果
            const approvalData = approvalResponse.result || {};
            if (approvalImages.length > 0) {
                setAiApprovalResult(approvalData);
            }

            // 3. 处理发票的识别结果 - 每张上传的发票图片对应一条记录
            const invoiceList: Array<{
                id: string;
                projectName: string;
                amount: number;
                invoiceDate: string;
                invoiceNumber?: string;
                selected: boolean;
            }> = [];

            // 格式化日期函数
            const formatDate = (dateStr: string | undefined): string => {
                if (!dateStr) return new Date().toISOString().split('T')[0];
                // 如果已经是 ISO 格式，直接返回日期部分
                if (dateStr.includes('T')) return dateStr.split('T')[0];
                // 如果是 YYYY-MM-DD 格式，直接返回
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
                // 尝试解析其他格式
                try {
                    return new Date(dateStr).toISOString().split('T')[0];
                } catch {
                    return new Date().toISOString().split('T')[0];
                }
            };

            // 获取金额，确保是数字
            const getAmount = (val: any): number => {
                if (typeof val === 'number') return val;
                if (typeof val === 'string') {
                    const num = parseFloat(val.replace(/[,，]/g, ''));
                    return isNaN(num) ? 0 : num;
                }
                return 0;
            };

            // 检查是否有多张发票的结果（invoices 数组）- 这是 AI 返回多发票的情况
            if (invoiceData.invoices && Array.isArray(invoiceData.invoices)) {
                invoiceData.invoices.forEach((inv: any, idx: number) => {
                    invoiceList.push({
                        id: `invoice-${Date.now()}-${idx}`,
                        projectName: inv.projectName || inv.title || `发票${idx + 1}`,
                        amount: getAmount(inv.totalAmount) || getAmount(inv.amount),
                        invoiceDate: formatDate(inv.invoiceDate),
                        invoiceNumber: inv.invoiceNumber || inv.number,
                        selected: true
                    });
                });
            } else if (invoiceData.items && Array.isArray(invoiceData.items) && invoiceData.items.length > 0) {
                // 如果有 items 数组，每个 item 作为一条费用明细
                // 但对于发票来说，通常整张发票是一个整体
                const singleAmount = getAmount(invoiceData.totalAmount) || 
                    invoiceData.items.reduce((sum: number, i: any) => sum + getAmount(i.amount), 0);
                invoiceList.push({
                    id: `invoice-${Date.now()}-0`,
                    projectName: invoiceData.projectName || invoiceData.title || invoiceData.items[0]?.name || '发票',
                    amount: singleAmount,
                    invoiceDate: formatDate(invoiceData.invoiceDate),
                    invoiceNumber: invoiceData.invoiceNumber,
                    selected: true
                });
            } else {
                // 单张发票的基本格式
                const singleAmount = getAmount(invoiceData.totalAmount);
                invoiceList.push({
                    id: `invoice-${Date.now()}-0`,
                    projectName: invoiceData.projectName || invoiceData.title || '发票',
                    amount: singleAmount,
                    invoiceDate: formatDate(invoiceData.invoiceDate),
                    invoiceNumber: invoiceData.invoiceNumber,
                    selected: true
                });
            }
            
            console.log('[AI] 解析发票数据', { 
                rawInvoiceData: invoiceData, 
                parsedInvoiceList: invoiceList,
                firstInvoiceAmount: invoiceList[0]?.amount,
                firstInvoiceProjectName: invoiceList[0]?.projectName
            });
            
            setInvoiceDetails(invoiceList);

            // 4. 计算总金额
            const totalInvoiceAmount = invoiceList.reduce((sum, inv) => sum + inv.amount, 0);

            // 5. 构建报销事由
            let reimbursementTitle = '';
            if (invoiceList.length === 1) {
                reimbursementTitle = invoiceList[0].projectName;
            } else {
                // 多张发票时，合并项目名称
                const uniqueNames = [...new Set(invoiceList.map(i => i.projectName))];
                reimbursementTitle = uniqueNames.slice(0, 3).join('、');
                if (uniqueNames.length > 3) reimbursementTitle += '等';
            }
            if (approvalData.eventSummary) {
                reimbursementTitle = `${reimbursementTitle}（${approvalData.eventSummary}）`;
            }

            // 6. 匹配借款记录 - 只根据审批单号精确匹配
            const potentialLoans = loans.filter((loan: any) => {
                // 只有当审批单号存在且完全匹配时才显示
                if (approvalData.approvalNumber && loan.approvalNumber) {
                    return loan.approvalNumber === approvalData.approvalNumber;
                }
                return false;
            });
            setMatchedLoans(potentialLoans);

            // 7. 自动选择预算项目（如果审批单中有）
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

            // 8. 根据合并选项设置表单数据
            // 构建每条报销事由的格式：发票内容（审批单事项内容）
            const eventSuffix = approvalData.eventSummary ? `（${approvalData.eventSummary}）` : '';
            
            // 如果只有一张发票，直接使用该发票数据；如果有多张，根据合并选项处理
            const manualItems: ExpenseItem[] = (invoiceList.length === 1 || mergeInvoices)
                ? [{
                    id: `extracted-${Date.now()}`,
                    date: invoiceList[0]?.invoiceDate || new Date().toISOString(),
                    description: reimbursementTitle || invoiceList[0]?.projectName || '费用报销',
                    amount: totalInvoiceAmount,
                    category: invoiceList[0]?.projectName || "其他",
                    status: 'pending' as const
                }]
                : invoiceList.map((inv, idx) => ({
                    id: `extracted-${Date.now()}-${idx}`,
                    date: inv.invoiceDate,
                    // 每条报销事由格式：发票内容（审批单事项内容）
                    description: `${inv.projectName}${eventSuffix}`,
                    amount: inv.amount,
                    category: inv.projectName || "其他",
                    status: 'pending' as const
                }));

            // 9. 自动填写表单
            console.log('[AI] 填充数据', { 
                title: reimbursementTitle, 
                amount: totalInvoiceAmount,
                approvalNumber: approvalData.approvalNumber,
                invoiceCount: invoiceList.length,
                mergeInvoices,
                manualItems
            });
            
            // 确保标题有值
            const finalTitle = reimbursementTitle || invoiceList[0]?.projectName || '费用报销';
            
            setForm(prev => ({
                ...prev,
                title: finalTitle,
                approvalNumber: approvalData.approvalNumber || invoiceData.approvalNumber || prev.approvalNumber,
                budgetProjectId: autoSelectedBudgetId,
                prepaidAmount: 0, // 默认不使用借款抵扣
                manualItems
            }));
            
            console.log('[AI] 表单填充完成', { finalTitle, manualItemsCount: manualItems.length });

            // 10. AI 自动匹配记账本事项
            const matchedExpenseIds: string[] = [];
            if (pendingExpenses.length > 0) {
                // 根据报销事由/发票内容匹配记账本中的事项
                const searchTerms = [
                    finalTitle,
                    ...invoiceList.map((inv: any) => inv.projectName || ''),
                    approvalData.eventSummary || '',
                ].filter(Boolean).map(t => t.toLowerCase());
                
                console.log('[AI] 记账本匹配关键词:', searchTerms);
                
                pendingExpenses.forEach((expense: any) => {
                    const expDesc = (expense.description || '').toLowerCase();
                    const expCategory = (expense.category || '').toLowerCase();
                    
                    // 检查是否有匹配
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
                
                // 自动选中匹配的记账本事项
                if (matchedExpenseIds.length > 0) {
                    setSelectedExpenseIds(matchedExpenseIds);
                    console.log('[AI] 自动选中记账本事项数量:', matchedExpenseIds.length);
                }
            }

            setStep(2);

        } catch (e) {
            console.error(e);
            alert("AI 分析失败，请检查网络或重试");
        } finally {
            setAnalyzing(false);
        }
    };

    // 报销单生成中状态
    const [regenerating, setRegenerating] = useState(false);

    // 当合并选项改变时，重新计算费用明细
    const handleMergeChange = async (merge: boolean) => {
        setRegenerating(true);
        setMergeInvoices(merge);
        
        // 模拟短暂延迟，让用户看到"生成中"提示
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (invoiceDetails.length === 0) {
            setRegenerating(false);
            return;
        }

        const selectedInvoices = invoiceDetails.filter(inv => inv.selected);
        if (selectedInvoices.length === 0) {
            setRegenerating(false);
            return;
        }

        const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        
        // 构建报销事由
        let title = '';
        if (selectedInvoices.length === 1) {
            title = selectedInvoices[0].projectName;
        } else {
            const uniqueNames = [...new Set(selectedInvoices.map(i => i.projectName))];
            title = uniqueNames.slice(0, 3).join('、');
            if (uniqueNames.length > 3) title += '等';
        }

        // 获取审批单事项内容
        const eventSuffix = aiApprovalResult?.eventSummary ? `（${aiApprovalResult.eventSummary}）` : '';
        
        const manualItems: ExpenseItem[] = merge 
            ? [{
                id: `extracted-${Date.now()}`,
                date: selectedInvoices[0]?.invoiceDate || new Date().toISOString(),
                description: title + eventSuffix,
                amount: totalAmount,
                category: selectedInvoices[0]?.projectName || "其他",
                status: 'pending' as const
            }]
            : selectedInvoices.map((inv, idx) => ({
                id: `extracted-${Date.now()}-${idx}`,
                date: inv.invoiceDate,
                // 每条报销事由格式：发票内容（审批单事项内容）
                description: `${inv.projectName}${eventSuffix}`,
                amount: inv.amount,
                category: inv.projectName || "其他",
                status: 'pending' as const
            }));

        setForm(prev => ({
            ...prev,
            title: merge ? title : prev.title,
            manualItems
        }));
        
        setRegenerating(false);
    };

    // 切换单张发票的选中状态
    const toggleInvoiceSelection = (invoiceId: string) => {
        const newDetails = invoiceDetails.map(inv => 
            inv.id === invoiceId ? { ...inv, selected: !inv.selected } : inv
        );
        setInvoiceDetails(newDetails);
        
        // 重新计算费用明细
        const selectedInvoices = newDetails.filter(inv => inv.selected);
        if (selectedInvoices.length === 0) {
            setForm(prev => ({ ...prev, manualItems: [] }));
            return;
        }

        const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        
        let title = '';
        if (selectedInvoices.length === 1) {
            title = selectedInvoices[0].projectName;
        } else {
            const uniqueNames = [...new Set(selectedInvoices.map(i => i.projectName))];
            title = uniqueNames.slice(0, 3).join('、');
            if (uniqueNames.length > 3) title += '等';
        }

        const manualItems: ExpenseItem[] = mergeInvoices 
            ? [{
                id: `extracted-${Date.now()}`,
                date: selectedInvoices[0]?.invoiceDate || new Date().toISOString(),
                description: title,
                amount: totalAmount,
                category: selectedInvoices[0]?.projectName || "其他",
                status: 'pending' as const
            }]
            : selectedInvoices.map((inv, idx) => ({
                id: `extracted-${Date.now()}-${idx}`,
                date: inv.invoiceDate,
                description: inv.projectName,
                amount: inv.amount,
                category: inv.projectName || "其他",
                status: 'pending' as const
            }));

        setForm(prev => ({
            ...prev,
            title: mergeInvoices ? title : prev.title,
            manualItems
        }));
    };

    const handleSubmit = (action: 'save' | 'print') => {
        // 只使用发票识别的费用项目，不再将记账本事项作为报销项目
        const allItems = form.manualItems;

        if (allItems.length === 0) return alert("请至少包含一笔费用");
        if (!form.title) return alert("请输入报销事由");

        const totalAmount = allItems.reduce((acc, cur) => acc + cur.amount, 0);
        const budgetProject = settings.budgetProjects.find((p:any) => p.id === form.budgetProjectId);
        const paymentAccount = settings.paymentAccounts.find((a:any) => a.id === form.paymentAccountId);

        // Combine attachments
        const allAttachments = [...invoiceFiles, ...approvalFiles, ...voucherFiles];

        // 如果选择了借款记录，记录关联
        const linkedLoanId = selectedLoanId || undefined;

        // 更新选中的记账本事项状态为"报销中"
        if (selectedExpenseIds.length > 0) {
            setExpenses((prev: any[]) => prev.map(e => 
                selectedExpenseIds.includes(e.id) ? { ...e, status: 'processing' } : e
            ));
        }

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
                linkedLoanId,
                linkedExpenseIds: selectedExpenseIds // 记录关联的记账本事项 ID，用于状态联动
            }
        };
        onAction(report, action);
    };

    // Calculate dynamic total for preview
    // 只计算发票识别的费用项目总额，不包含记账本事项
    const currentTotal = form.manualItems.reduce((s,i) => s+i.amount, 0);
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
                            <button onClick={() => handleSubmit('save')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 flex items-center gap-1.5">
                                <Save size={14}/> 保存草稿
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
                                            handleSubmit('pdf');
                                        }} 
                                        className={`px-3 py-1.5 rounded-lg font-medium text-sm shadow-sm flex items-center gap-1.5 ${
                                            isMatch 
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                        }`}
                                        title={isMatch ? '提交报销单' : '金额审核未通过，无法提交'}
                                    >
                                        <Download size={14}/> 提交报销
                                    </button>
                                );
                            })()}
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
                                                    setForm({...form, title: e.target.value});
                                                    // 同时更新 manualItems 中的描述
                                                    if (form.manualItems.length === 1) {
                                                        const newItems = [...form.manualItems];
                                                        newItems[0].description = e.target.value;
                                                        setForm(prev => ({...prev, manualItems: newItems}));
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
                                                                setForm({...form, manualItems: newItems});
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

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">审批单编号</label>
                                    <input value={form.approvalNumber} onChange={e => setForm({...form, approvalNumber: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none" placeholder="钉钉/飞书审批单号" />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">预算项目</label>
                                    <select value={form.budgetProjectId} onChange={e => setForm({...form, budgetProjectId: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none bg-white">
                                        {settings.budgetProjects.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    {/* 显示审批单中的预算信息 */}
                                    {aiApprovalResult?.budgetProject && (
                                        <p className="text-[10px] text-green-600 mt-1">
                                            ✓ 已从审批单识别：{aiApprovalResult.budgetProject}
                                            {aiApprovalResult.budgetCode && ` (${aiApprovalResult.budgetCode})`}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">收款账户</label>
                                    <select value={form.paymentAccountId} onChange={e => setForm({...form, paymentAccountId: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none bg-white">
                                        {settings.paymentAccounts.map((a:any) => <option key={a.id} value={a.id}>{a.bankName} - {a.accountNumber.slice(-4)}</option>)}
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

                                 {/* 预支/借款抵扣 - 只在匹配到借款记录时显示 */}
                                 {matchedLoans.length > 0 ? (
                                     <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                         <label className="text-xs font-bold text-amber-700 uppercase block mb-2">
                                             预支借款抵扣 <span className="text-[10px] font-normal text-amber-600">（审批单号匹配成功）</span>
                                         </label>
                                         <p className="text-[10px] text-amber-600 mb-2">
                                             ✓ 找到与审批单号 <span className="font-bold">{form.approvalNumber}</span> 匹配的借款记录
                                         </p>
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
                                             className="w-full p-2 border border-amber-300 rounded-lg text-sm bg-white focus:border-amber-500 outline-none"
                                            >
                                                <option value="">不使用借款抵扣</option>
                                                {matchedLoans.map((loan: any) => (
                                                    <option key={loan.id} value={loan.id}>
                                                        ¥{loan.amount.toFixed(2)} - {loan.reason?.slice(0, 20)}...
                                                    </option>
                                                ))}
                                            </select>
                                         {selectedLoanId && (
                                             <div className="mt-2 p-2 bg-white rounded border border-amber-100">
                                                 <p className="text-xs text-amber-700">
                                                     预支金额：<span className="font-bold">¥{form.prepaidAmount.toFixed(2)}</span>
                                                 </p>
                                                 <p className="text-xs text-slate-600 mt-1">
                                                     应领款金额 = ¥{currentTotal.toFixed(2)} - ¥{form.prepaidAmount.toFixed(2)} = 
                                                     <span className="font-bold text-indigo-600"> ¥{(currentTotal - form.prepaidAmount).toFixed(2)}</span>
                                                 </p>
                                        </div>
                                     )}
                                     </div>
                                 ) : (
                                     <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                         <label className="text-xs font-bold text-slate-500 uppercase block mb-1">预支/借款抵扣</label>
                                         <p className="text-[10px] text-slate-400 mb-2">
                                             未找到匹配的借款记录（需要审批单号完全一致）
                                         </p>
                                     <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                                        <input 
                                            type="number" 
                                            value={form.prepaidAmount} 
                                            onChange={e => setForm({...form, prepaidAmount: parseFloat(e.target.value) || 0})} 
                                                className="w-full pl-6 p-2 border border-slate-200 rounded-lg text-sm font-bold text-orange-600 focus:border-indigo-500 outline-none bg-white" 
                                            placeholder="手动输入借款金额"
                                        />
                                     </div>
                                 </div>
                                 )}

                                 <div className="border-t border-slate-100 pt-4">
                                     <h4 className="font-bold text-sm text-slate-700 mb-2">费用明细</h4>
                                     
                                     {/* Extracted Items */}
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
                                                                setForm({...form, manualItems: newItems});
                                                            }}
                                                            type="number"
                                                         />
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     )}

                                    {/* Ledger Items Status Linking - 关联记账本状态 */}
                                    {pendingExpenses.length > 0 && (
                                        <div className="border-t border-slate-100 pt-3">
                                            <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                                                <Briefcase size={12}/> 关联记账本
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
                                                        {pendingExpenses.filter((e:any) => selectedExpenseIds.includes(e.id)).map((e:any) => (
                                                            <label key={e.id} className="flex items-center justify-between p-1.5 hover:bg-green-100/50 rounded cursor-pointer">
                                                                <div className="flex items-center gap-1.5 truncate">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={true} 
                                                                        onChange={() => setSelectedExpenseIds(selectedExpenseIds.filter(id => id !== e.id))} 
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
                                            {pendingExpenses.filter((e:any) => !selectedExpenseIds.includes(e.id)).length > 0 && (
                                                <div>
                                                    <p className="text-[10px] text-slate-400 mb-1">
                                                        手动选择 ({pendingExpenses.filter((e:any) => !selectedExpenseIds.includes(e.id)).length}项未报销)
                                                    </p>
                                                    <div className="space-y-0.5 max-h-24 overflow-y-auto border border-slate-100 rounded-lg p-1.5">
                                                        {pendingExpenses.filter((e:any) => !selectedExpenseIds.includes(e.id)).map((e:any) => (
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
                                                                <span className="text-[11px] font-medium text-slate-700">¥{e.amount.toFixed(2)}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* 选中汇总 */}
                                            {selectedExpenseIds.length > 0 && (
                                                <div className="mt-2 text-[10px] text-green-700 bg-green-50 rounded px-2 py-1">
                                                    已关联 {selectedExpenseIds.length} 项记账本事项，提交后将变为"报销中"
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 金额审核模块 */}
                                {invoiceDetails.length > 0 && (
                                    <div className={`border-t border-slate-100 pt-4 ${
                                        (() => {
                                            // 计算发票总金额
                                            const invoiceTotal = invoiceDetails.filter(inv => inv.selected).reduce((sum, inv) => sum + inv.amount, 0);
                                            // 计算报销单录入总金额
                                            const formTotal = form.manualItems.reduce((sum, item) => sum + item.amount, 0);
                                            // 判断是否匹配
                                            const isMatch = Math.abs(invoiceTotal - formTotal) < 0.01;
                                            return isMatch ? '' : '';
                                        })()
                                    }`}>
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
                                                    <div key={inv.id} className="flex justify-between text-blue-600 py-0.5">
                                                        <span className="truncate flex-1">{idx + 1}. {inv.projectName}</span>
                                                        <span className="font-mono ml-2">¥{inv.amount.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                <div className="border-t border-blue-200 mt-1 pt-1 flex justify-between font-bold text-blue-800">
                                                    <span>发票总计</span>
                                                    <span className="font-mono">¥{invoiceDetails.filter(inv => inv.selected).reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}</span>
                                                </div>
                                            </div>
                                            
                                            {/* 报销单金额明细 */}
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                                                <p className="font-bold text-purple-700 mb-1">📋 报销单录入金额</p>
                                                {form.manualItems.map((item, idx) => (
                                                    <div key={item.id} className="flex justify-between text-purple-600 py-0.5">
                                                        <span className="truncate flex-1">{idx + 1}. {item.description?.slice(0, 15)}...</span>
                                                        <span className="font-mono ml-2">¥{item.amount.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                <div className="border-t border-purple-200 mt-1 pt-1 flex justify-between font-bold text-purple-800">
                                                    <span>录入总计</span>
                                                    <span className="font-mono">¥{form.manualItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</span>
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
                              <div className="flex flex-col items-center max-w-4xl mx-auto relative">
                                  {/* 生成中提示 */}
                                  {regenerating && (
                                      <div className="absolute inset-0 bg-white/80 z-30 flex items-center justify-center rounded-lg">
                                          <div className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-lg">
                                              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                              </svg>
                                              <span className="font-medium">正在重新生成报销单...</span>
                                          </div>
                                      </div>
                                  )}
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
                                        items: form.manualItems, // 只使用发票识别的费用项目，不包含记账本事项
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
                // 如果只有详细说明，截取前50个字符作为事由
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
                        {/* 审批单上传 - 必须 */}
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
                                                    <FileText className="text-slate-400"/>
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
                    </div>
                    
                    <button 
                        onClick={startAnalysis} 
                        disabled={approvalFiles.length === 0 || analyzing}
                        className={`w-full mt-8 py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-lg ${approvalFiles.length > 0 ? 'bg-amber-500 text-white shadow-amber-200 hover:bg-amber-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        {analyzing ? <><Loader2 className="animate-spin"/> AI 正在分析审批单...</> : "开始识别与填单"}
                    </button>
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
                            <button onClick={() => handleSubmit('pdf')} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium text-sm shadow-md shadow-amber-200 hover:bg-amber-600 flex items-center gap-1.5">
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
                            
                            {/* 借款单预览 - 双联分开显示 */}
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
                                
                                {/* 附件展示 - 竖版 A4 */}
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
                            <button onClick={() => onSelect(item.id, tab)} className="p-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-indigo-100" title="查看/编辑"><Eye size={16}/></button>
                            {item.status !== 'paid' && <button onClick={() => onComplete(item.id, tab)} className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100" title="完成报销"><CheckCircle size={16}/></button>}
                            <button onClick={() => onDelete(item.id, tab)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100" title="删除"><Trash2 size={16}/></button>
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
    // 使用 role 字段判断是否为管理员
    const isSuperAdmin = settings.currentUser?.role === 'admin';
    
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
    
    // 缩放比例
    const scale = 1;
    
    // 外层容器样式 - 横版 A4 页面
    const containerStyle: React.CSSProperties = {
        width: '297mm',  // A4 横版宽度
        height: '210mm', // A4 横版高度
        backgroundColor: 'white',
        padding: '8mm 12mm',
        boxSizing: 'border-box',
        fontFamily: '"SimSun", "Songti SC", serif',
        fontSize: '12px',
        lineHeight: '1.4',
    };
    
    // 内容容器
    const paperStyle: React.CSSProperties = {
        width: '100%',
    };

    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid black',
        tableLayout: 'fixed',
    };

    const cellStyle: React.CSSProperties = {
        border: '1px solid black',
        padding: '4px 3px',
        verticalAlign: 'middle',
        fontSize: '12px',
        lineHeight: '1.3',
        overflow: 'hidden',
        textAlign: 'center',
    };

    const titleStyle: React.CSSProperties = {
        fontFamily: '"SimSun", serif',
        fontSize: '20px',
        textAlign: 'center',
        marginBottom: '3px',
        fontWeight: 'bold',
    };

    const subtitleStyle: React.CSSProperties = {
        fontFamily: '"SimSun", serif',
        fontSize: '18px',
        textAlign: 'center',
        marginBottom: '12px',
        letterSpacing: '4px',
    };

    const headerRowStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '3px',
        fontSize: '13px',
    };

    const underlineStyle: React.CSSProperties = {
        borderBottom: '1px solid black',
        padding: '0 6px',
        display: 'inline-block',
        minWidth: '30px',
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
                            <span style={{ marginLeft: `${80 * scale}px` }}>{data.userSnapshot?.department || ''}</span>
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

                    {/* 数据行 - 支持多行，每行都显示预算项目和编码 */}
                    {data.items && data.items.length > 0 ? (
                        data.items.map((item: any, index: number) => (
                            <tr key={index} style={{ height: `${32 * scale}px` }}>
                                <td style={{ ...cellStyle, textAlign: 'center' }}>{index + 1}</td>
                                <td style={cellStyle}>{item.description || item.name || ''}</td>
                                <td style={{ ...cellStyle, textAlign: 'center' }}>{(item.amount || 0).toFixed(2)} 元</td>
                                <td style={cellStyle}>{data.budgetProject?.name || ''}</td>
                                <td style={cellStyle}>{data.budgetProject?.code || ''}</td>
                            </tr>
                        ))
                    ) : (
                        <tr style={{ height: `${32 * scale}px` }}>
                            <td style={{ ...cellStyle, textAlign: 'center' }}>1</td>
                            <td style={cellStyle}>{getExpenseReason()}</td>
                            <td style={{ ...cellStyle, textAlign: 'center' }}>{(data.totalAmount || 0).toFixed(2)} 元</td>
                            <td style={cellStyle}>{data.budgetProject?.name || ''}</td>
                            <td style={cellStyle}>{data.budgetProject?.code || ''}</td>
                        </tr>
                    )}

                    {/* 第4行：提请报销金额 + 预支借款金额 */}
                    <tr>
                        <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                            <span style={{ fontWeight: 'bold' }}>提请报销金额：</span>
                            <span style={{ marginLeft: `${4 * scale}px`, fontSize: `${13 * scale}px` }}>※{digitToChinese(data.totalAmount || 0)}</span>
                            <span style={{ float: 'right', marginRight: `${4 * scale}px`, whiteSpace: 'nowrap' }}>￥ <span style={{ textDecoration: 'underline' }}>{(data.totalAmount || 0).toFixed(2)}</span> 元</span>
                        </td>
                        <td colSpan={3} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                            <span style={{ fontWeight: 'bold' }}>预支借款金额：</span>
                            <span>{(data.prepaidAmount || 0).toFixed(2)}</span>
                            <span style={{ float: 'right', marginRight: `${8 * scale}px` }}>￥ <span style={{ textDecoration: 'underline' }}>{digitToChinese(data.prepaidAmount || 0)}</span></span>
                        </td>
                    </tr>

                    {/* 第5行：应领款金额 + 结算方式 */}
                    <tr>
                        <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                            <span style={{ fontWeight: 'bold' }}>应领款金额：</span>
                            <span style={{ marginLeft: `${4 * scale}px`, fontSize: `${13 * scale}px` }}>※{digitToChinese(Math.abs(payableAmount))}</span>
                            <span style={{ float: 'right', marginRight: `${4 * scale}px`, whiteSpace: 'nowrap' }}>￥ <span style={{ textDecoration: 'underline' }}>{payableAmount.toFixed(2)}</span> 元</span>
                        </td>
                        <td colSpan={3} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                            <span style={{ fontWeight: 'bold' }}>结算方式：</span>
                            <span style={{ marginLeft: `${16 * scale}px` }}>□现金</span>
                            <span style={{ marginLeft: `${16 * scale}px` }}>□支票</span>
                            <span style={{ marginLeft: `${16 * scale}px` }}>☑电汇</span>
                        </td>
                    </tr>

                    {/* 第6-8行：收款人信息 + 钉钉审批编号 */}
                    <tr>
                        <td rowSpan={3} style={{ ...cellStyle, textAlign: 'center', width: `${64 * scale}px` }}>
                            收款人
                        </td>
                        <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                            单位名称（姓名）： {data.paymentAccount?.accountName || ''}
                        </td>
                        <td rowSpan={3} style={{ ...cellStyle, textAlign: 'center', verticalAlign: 'middle' }}>
                            钉钉审批编号
                        </td>
                        <td rowSpan={3} style={{ ...cellStyle, verticalAlign: 'middle', textAlign: 'center', fontSize: `${12 * scale}px` }}>
                            {data.approvalNumber || ''}
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                            开户行： {data.paymentAccount?.bankName || ''}
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                            单位账号（银行卡号）： {data.paymentAccount?.accountNumber || ''}
                        </td>
                    </tr>

                    {/* 第9行：签字栏 - 嵌套表格 */}
                    <tr>
                        <td colSpan={5} style={{ ...cellStyle, padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', height: `${48 * scale}px` }}>
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
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>董事长<br/>签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>总 经理<br/>签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>常务副总/副总<br/>经理签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>总监/高级经<br/>理签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>项目负责<br/>人签字</td>
                                        <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                                        <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>领款人<br/>签字</td>
                                        <td style={{ border: 'none' }}></td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>

                    {/* 第10行：所属产品线 */}
                    <tr>
                        <td colSpan={5} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                            所属产品线：
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* 底部页脚 */}
                <div style={{ ...headerRowStyle, marginTop: `${3 * scale}px`, padding: `0 ${6 * scale}px` }}>
                <div style={{ width: '33%' }}>财务负责人：</div>
                <div style={{ width: '33%', textAlign: 'center' }}>审核：</div>
                    <div style={{ width: '33%', textAlign: 'right', paddingRight: `${32 * scale}px` }}>出纳：</div>
                </div>
            </div>
        </div>
    )
};

// 借款单单联组件 - 用于独立显示每一联
const LoanFormSheet = ({ data, sheetNumber, sheetName, showNote }: { data: any, sheetNumber: number, sheetName: string, showNote: boolean }) => {
    const currentDate = data.date ? new Date(data.date) : new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    
    const amount = data.amount || 0;
    const amountChinese = digitToChinese(amount);
    
    // A4 横版样式 (297mm x 210mm)
    const sheetStyle: React.CSSProperties = {
        width: '297mm',
        height: '210mm',
        backgroundColor: 'white',
        padding: '15mm 20mm',
        boxSizing: 'border-box',
        fontFamily: '"SimSun", "Songti SC", serif',
        pageBreakAfter: sheetNumber === 1 ? 'always' : 'auto',
    };
    
    const underlineStyle: React.CSSProperties = {
        borderBottom: '1px solid black',
        padding: '0 10px',
        display: 'inline-block',
        textAlign: 'center',
        minWidth: '40px',
    };
    
    return (
        <div style={sheetStyle} className="loan-sheet">
            {/* 标题区 */}
            <div style={{ marginBottom: '8px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '8px' }}>
                        北龙中网（北京）科技有限责任公司
                    </h1>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '1em' }}>借款单</h2>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <span style={{ marginRight: '8px' }}>借款日期：</span>
                        <span style={{ ...underlineStyle, width: '64px' }}>{year}</span>
                        <span style={{ marginRight: '4px' }}>年</span>
                        <span style={{ ...underlineStyle, width: '40px' }}>{month}</span>
                        <span style={{ marginRight: '4px' }}>月</span>
                        <span style={{ ...underlineStyle, width: '40px' }}>{day}</span>
                        <span>日</span>
                    </div>
                    <div>{sheetName}</div>
                </div>
            </div>
            
            {/* 表格主体 */}
            <div style={{ border: '1px solid black', fontSize: '14px' }}>
                {/* 第1行：部门和借款人 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '60%', borderRight: '1px solid black', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>部门：</span> {data.userSnapshot?.department || ''}
                    </div>
                    <div style={{ width: '40%', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>借款人：</span> {data.userSnapshot?.name || ''}
                    </div>
                </div>
                
                {/* 第2行：借款事由 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center', height: '32px' }}>
                        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: '8px' }}>借款事由：</span>
                        <span style={{ flexGrow: 1, borderBottom: '1px solid black', lineHeight: '1.4' }}>{data.reason || ''}</span>
                    </div>
                </div>
                
                {/* 第3行：支付方式 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '24px' }}>借款支付方式：</span>
                        <div style={{ display: 'flex', gap: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', textAlign: 'center', lineHeight: '12px', fontSize: '12px' }}></span>现金
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', textAlign: 'center', lineHeight: '12px', fontSize: '12px' }}></span>支票
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', textAlign: 'center', lineHeight: '12px', fontSize: '12px' }}>✓</span>电汇
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* 第4行：借款金额 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px' }}>借款金额：</span>
                            <span style={{ marginRight: '8px', fontSize: '18px' }}>※</span>
                            <span style={{ flexGrow: 1, borderBottom: '1px solid black', textAlign: 'center', letterSpacing: '0.2em', fontWeight: 500, lineHeight: '1.4' }}>
                                {amountChinese}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '16px', width: '25%' }}>
                            <span style={{ marginRight: '8px', fontWeight: 'bold' }}>￥</span>
                            <span style={{ flexGrow: 1, borderBottom: '1px solid black', textAlign: 'right', paddingRight: '8px', lineHeight: '1.4' }}>
                                {amount.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* 第5行：收款人信息 + 审批编号 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black', height: '112px' }}>
                    {/* 收款人标签 */}
                    <div style={{ width: '64px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                        收<br/>款<br/>人
                    </div>
                    
                    {/* 收款人详细信息 */}
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid black' }}>
                        <div style={{ height: '33.33%', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap' }}>单位名称（姓名）：</span>
                            <span style={{ whiteSpace: 'nowrap' }}>{data.payeeInfo?.accountName || ''}</span>
                        </div>
                        <div style={{ height: '33.33%', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap' }}>开户行：</span>
                            <span style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>{data.payeeInfo?.bankName || ''}</span>
                        </div>
                        <div style={{ height: '33.33%', display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap' }}>单位账号（银行卡号）：</span>
                            <span style={{ whiteSpace: 'nowrap' }}>{data.payeeInfo?.accountNumber || ''}</span>
                        </div>
                    </div>
                    
                    {/* 钉钉审批编号 */}
                    <div style={{ width: '30%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flexGrow: 1, display: 'flex' }}>
                            <div style={{ width: '48px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', lineHeight: '1.4' }}>
                                钉钉<br/>审批<br/>编号
                            </div>
                            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', fontSize: '12px', wordBreak: 'break-all', textAlign: 'center' }}>
                                {data.approvalNumber || ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* 第6行：签字栏 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black', height: '48px', fontSize: '14px' }}>
                    {/* 董事长 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>董事长<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 总经理 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>总经理<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 常务副总 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '56px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0', lineHeight: '1.2', fontSize: '10px' }}>常务副总/<br/>副总经理<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 总监 */}
                    <div style={{ flex: 0.8, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>总监<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 项目负责人 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '48px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0', lineHeight: '1.2', fontSize: '12px' }}>项目负<br/>责人签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 领款人 */}
                    <div style={{ flex: 0.8, display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>领款人<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                </div>
                
                {/* 第7行：产品线/预算 */}
                <div style={{ display: 'flex', height: '32px', alignItems: 'center', padding: '0 8px', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '8px' }}>所属产品线：</span>
                        <span style={{ width: '48px' }}></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '8px' }}>预算项目：</span>
                        <span>{data.budgetProject?.name || ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                        <span style={{ marginRight: '4px' }}>预算编码：</span>
                        <span>{data.budgetProject?.code || ''}</span>
                    </div>
                </div>
            </div>
            
            {/* 底部签字行 */}
            <div style={{ display: 'flex', marginTop: '4px', justifyContent: 'space-between', padding: '0 8px', fontSize: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: '8px' }}>财务负责人：</span><span style={{ width: '96px' }}></span></div>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: '8px' }}>审核：</span><span style={{ width: '96px' }}></span></div>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: '8px' }}>出纳：</span><span style={{ width: '96px' }}></span></div>
            </div>
            
            {/* 备注行（仅第二联显示） */}
            {showNote && (
                <div style={{ marginTop: '8px', padding: '0 8px', fontSize: '14px' }}>
                    <span style={{ fontWeight: 'bold' }}>备注：</span>借款时员工保留此联，报销时需将此联退回财务
                </div>
            )}
        </div>
    );
};

// 借款单组件 - 双联格式（财务留存联 + 员工留存联）
const LoanForm = ({ data }: any) => {
    const currentDate = data.date ? new Date(data.date) : new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    
    const amount = data.amount || 0;
    const amountChinese = digitToChinese(amount);
    
    // 单联样式 - A4 横版 (297mm x 210mm)
    const sheetStyle: React.CSSProperties = {
        width: '297mm',
        height: '210mm',
        backgroundColor: 'white',
        padding: '15mm 20mm',
        boxSizing: 'border-box',
        fontFamily: '"SimSun", "Songti SC", serif',
        marginBottom: '20px',
        pageBreakAfter: 'always',
    };
    
    const cellStyle: React.CSSProperties = {
        border: '1px solid black',
        padding: '4px 8px',
    };
    
    const underlineStyle: React.CSSProperties = {
        borderBottom: '1px solid black',
        padding: '0 10px',
        display: 'inline-block',
        textAlign: 'center',
        minWidth: '40px',
    };
    
    // 渲染单联
    const renderSheet = (sheetNumber: number, sheetName: string, showNote: boolean) => (
        <div 
            style={{
                ...sheetStyle,
                marginBottom: sheetNumber === 2 ? 0 : '20px',
                pageBreakAfter: sheetNumber === 1 ? 'always' : 'auto',
            }} 
            className="loan-sheet"
        >
            {/* 标题区 */}
            <div style={{ marginBottom: '8px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '8px' }}>
                        北龙中网（北京）科技有限责任公司
                    </h1>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '1em' }}>借款单</h2>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <span style={{ marginRight: '8px' }}>借款日期：</span>
                        <span style={{ ...underlineStyle, width: '64px' }}>{year}</span>
                        <span style={{ marginRight: '4px' }}>年</span>
                        <span style={{ ...underlineStyle, width: '40px' }}>{month}</span>
                        <span style={{ marginRight: '4px' }}>月</span>
                        <span style={{ ...underlineStyle, width: '40px' }}>{day}</span>
                        <span>日</span>
                    </div>
                    <div>{sheetName}</div>
                </div>
            </div>
            
            {/* 表格主体 */}
            <div style={{ border: '1px solid black', fontSize: '14px' }}>
                {/* 第1行：部门和借款人 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '60%', borderRight: '1px solid black', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>部门：</span> {data.userSnapshot?.department || ''}
                    </div>
                    <div style={{ width: '40%', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>借款人：</span> {data.userSnapshot?.name || ''}
                    </div>
                </div>
                
                {/* 第2行：借款事由 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center', height: '32px' }}>
                        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: '8px' }}>借款事由：</span>
                        <span style={{ flexGrow: 1, borderBottom: '1px solid black', lineHeight: '1.4' }}>{data.reason || ''}</span>
                    </div>
                </div>
                
                {/* 第3行：支付方式 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '24px' }}>借款支付方式：</span>
                        <div style={{ display: 'flex', gap: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', textAlign: 'center', lineHeight: '12px', fontSize: '12px' }}></span>现金
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', textAlign: 'center', lineHeight: '12px', fontSize: '12px' }}></span>支票
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', textAlign: 'center', lineHeight: '12px', fontSize: '12px' }}>✓</span>电汇
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* 第4行：借款金额 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px' }}>借款金额：</span>
                            <span style={{ marginRight: '8px', fontSize: '18px' }}>※</span>
                            <span style={{ flexGrow: 1, borderBottom: '1px solid black', textAlign: 'center', letterSpacing: '0.2em', fontWeight: 500, lineHeight: '1.4' }}>
                                {amountChinese}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '16px', width: '25%' }}>
                            <span style={{ marginRight: '8px', fontWeight: 'bold' }}>￥</span>
                            <span style={{ flexGrow: 1, borderBottom: '1px solid black', textAlign: 'right', paddingRight: '8px', lineHeight: '1.4' }}>
                                {amount.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* 第5行：收款人信息 + 审批编号 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black', height: '112px' }}>
                    {/* 收款人标签 */}
                    <div style={{ width: '64px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                        收<br/>款<br/>人
                    </div>
                    
                    {/* 收款人详细信息 */}
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid black' }}>
                        <div style={{ height: '33.33%', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap' }}>单位名称（姓名）：</span>
                            <span style={{ whiteSpace: 'nowrap' }}>{data.payeeInfo?.accountName || ''}</span>
                        </div>
                        <div style={{ height: '33.33%', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap' }}>开户行：</span>
                            <span style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>{data.payeeInfo?.bankName || ''}</span>
                        </div>
                        <div style={{ height: '33.33%', display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap' }}>单位账号（银行卡号）：</span>
                            <span style={{ whiteSpace: 'nowrap' }}>{data.payeeInfo?.accountNumber || ''}</span>
                        </div>
                    </div>
                    
                    {/* 钉钉审批编号 */}
                    <div style={{ width: '30%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flexGrow: 1, display: 'flex' }}>
                            <div style={{ width: '48px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', lineHeight: '1.4' }}>
                                钉钉<br/>审批<br/>编号
                            </div>
                            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', fontSize: '12px', wordBreak: 'break-all', textAlign: 'center' }}>
                                {data.approvalNumber || ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* 第6行：签字栏 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black', height: '48px', fontSize: '14px' }}>
                    {/* 董事长 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>董事长<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 总经理 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>总经理<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 常务副总 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '56px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0', lineHeight: '1.2', fontSize: '10px' }}>常务副总/<br/>副总经理<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 总监 */}
                    <div style={{ flex: 0.8, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>总监<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 项目负责人 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '48px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0', lineHeight: '1.2', fontSize: '12px' }}>项目负<br/>责人签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 领款人 */}
                    <div style={{ flex: 0.8, display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>领款人<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                </div>
                
                {/* 第7行：产品线/预算 */}
                <div style={{ display: 'flex', height: '32px', alignItems: 'center', padding: '0 8px', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '8px' }}>所属产品线：</span>
                        <span style={{ width: '48px' }}></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '8px' }}>预算项目：</span>
                        <span>{data.budgetProject?.name || ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                        <span style={{ marginRight: '4px' }}>预算编码：</span>
                        <span>{data.budgetProject?.code || ''}</span>
                    </div>
                </div>
            </div>
            
            {/* 底部签字行 */}
            <div style={{ display: 'flex', marginTop: '4px', justifyContent: 'space-between', padding: '0 8px', fontSize: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: '8px' }}>财务负责人：</span><span style={{ width: '96px' }}></span></div>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: '8px' }}>审核：</span><span style={{ width: '96px' }}></span></div>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: '8px' }}>出纳：</span><span style={{ width: '96px' }}></span></div>
            </div>
            
            {/* 备注行（仅第二联显示） */}
            {showNote && (
                <div style={{ marginTop: '8px', padding: '0 8px', fontSize: '14px' }}>
                    <span style={{ fontWeight: 'bold' }}>备注：</span>借款时员工保留此联，报销时需将此联退回财务
                </div>
            )}
        </div>
    );
    
    return (
        <>
            {/* 第一联：财务留存联 */}
            {renderSheet(1, '第一联：财务留存联', false)}
            
            {/* 第二联：员工留存联 */}
            {renderSheet(2, '第二联：员工留存联', true)}
        </>
    );
};

// 出租车费明细表组件
const TaxiExpenseTable = ({ data }: any) => {
    const currentDate = data.createdDate ? new Date(data.createdDate) : new Date();
    const dateStr = `${currentDate.getFullYear()}.${currentDate.getMonth() + 1}.${currentDate.getDate()}`;
    
    // 计算出租车费总金额
    const taxiTotal = (data.taxiDetails || []).reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    
    const containerStyle: React.CSSProperties = {
        width: '210mm',
        minHeight: '297mm',
        backgroundColor: 'white',
        padding: '20mm 15mm',
        boxSizing: 'border-box',
        fontFamily: '"SimSun", "Songti SC", serif',
    };
    
    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
        marginBottom: '10px',
        tableLayout: 'fixed',
    };
    
    const cellStyle: React.CSSProperties = {
        border: '1px solid black',
        padding: '6px 4px',
        textAlign: 'center',
        verticalAlign: 'middle',
    };
    
    return (
        <div style={containerStyle} className="taxi-expense-table">
            <h1 style={{ 
                textAlign: 'center', 
                fontSize: '24px', 
                fontWeight: 'bold', 
                marginBottom: '30px',
                fontFamily: '"SimHei", "STHeiti", sans-serif'
            }}>
                北龙中网（北京）科技有限责任公司员工出租车费明细表
            </h1>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '16px' }}>
                <span style={{ marginLeft: '20px' }}>填制日期：{dateStr}</span>
                <span style={{ marginRight: '20px' }}>附发票 {data.taxiDetails?.length || 0} 张</span>
            </div>
            
            <table style={tableStyle}>
                <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '45%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={{ ...cellStyle, height: '35px' }}>发票日期</th>
                        <th style={{ ...cellStyle, height: '35px' }}>外出事由</th>
                        <th style={{ ...cellStyle, height: '35px' }}>起终点</th>
                        <th style={{ ...cellStyle, height: '35px' }}>金额</th>
                        <th style={{ ...cellStyle, height: '35px' }}>员工</th>
                    </tr>
                </thead>
                <tbody>
                    {(data.taxiDetails || []).map((item: any, idx: number) => (
                        <tr key={idx}>
                            <td style={cellStyle}>{item.date || ''}</td>
                            <td style={cellStyle}>{item.reason || data.tripReason || ''}</td>
                            <td style={cellStyle}>{item.route || ''}</td>
                            <td style={cellStyle}>{(item.amount || 0).toFixed(2)}</td>
                            <td style={cellStyle}>{data.userSnapshot?.name || ''}</td>
                        </tr>
                    ))}
                    {/* 总金额行 */}
                    <tr style={{ fontWeight: 'bold' }}>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>总金额</td>
                        <td colSpan={4} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '20px', letterSpacing: '1px' }}>
                            {digitToChinese(taxiTotal)} ¥ {taxiTotal.toFixed(2)}
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <div style={{ marginTop: '10px', fontSize: '16px', fontWeight: 'bold' }}>
                填表人（签字）：
            </div>
        </div>
    );
};

// 差旅费报销单组件 - 按照用户提供的模板
const TravelReimbursementForm = ({ data }: any) => {
    const currentDate = data.createdDate ? new Date(data.createdDate) : new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    
    // 计算各项合计
    const tripLegs = data.tripLegs || [];
    const totalTransport = tripLegs.reduce((sum: number, leg: any) => sum + (leg.transportFee || 0), 0);
    const totalHotel = tripLegs.reduce((sum: number, leg: any) => sum + (leg.hotelFee || 0), 0);
    const totalCityTraffic = tripLegs.reduce((sum: number, leg: any) => sum + (leg.cityTrafficFee || 0), 0);
    const totalMeal = tripLegs.reduce((sum: number, leg: any) => sum + (leg.mealFee || 0), 0);
    const totalOther = tripLegs.reduce((sum: number, leg: any) => sum + (leg.otherFee || 0), 0);
    const grandTotal = data.totalAmount || (totalTransport + totalHotel + totalCityTraffic + totalMeal + totalOther);
    
    // 外层容器 - A4 竖版页面
    const containerStyle: React.CSSProperties = {
        width: '210mm',
        height: '297mm',
        backgroundColor: 'white',
        padding: '15mm 12mm',
        boxSizing: 'border-box',
        fontFamily: '"SimSun", "Songti SC", serif',
        display: 'flex',
        flexDirection: 'column',
    };
    
    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
        marginBottom: '10px',
        tableLayout: 'fixed',
    };
    
    const cellStyle: React.CSSProperties = {
        border: '1px solid black',
        padding: '6px 4px',
        textAlign: 'center',
        verticalAlign: 'middle',
        wordBreak: 'break-all',
    };
    
    const inputLineStyle: React.CSSProperties = {
        display: 'inline-block',
        borderBottom: '1px solid black',
        minWidth: '30px',
        textAlign: 'center',
        padding: '0 4px',
    };
    
    return (
        <div style={containerStyle} className="travel-reimbursement-form">
            <h1 style={{ 
                textAlign: 'center', 
                fontSize: '24px', 
                fontWeight: 'bold', 
                marginBottom: '30px',
                fontFamily: '"SimHei", "STHeiti", sans-serif'
            }}>
                北龙中网（北京）科技有限责任公司差旅费报销单
            </h1>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '16px' }}>
                <span style={{ marginLeft: '20px' }}>
                    报销日期：<span style={inputLineStyle}>{year}</span> 年 <span style={inputLineStyle}>{month}</span> 月 <span style={inputLineStyle}>{day}</span> 日
                </span>
                <span style={{ marginRight: '20px' }}>附件 {data.invoiceCount || data.attachments?.length || '_____'} 张</span>
            </div>
            
            <table style={tableStyle}>
                <colgroup>
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '18%' }} />
                </colgroup>
                <tbody>
                    {/* 第一行：部门信息 */}
                    <tr>
                        <td style={{ ...cellStyle, padding: '4px 2px', height: '30px' }}>部门</td>
                        <td style={{ ...cellStyle, padding: '4px 2px' }}>{data.userSnapshot?.department || ''}</td>
                        <td style={{ ...cellStyle, padding: '4px 2px' }}>姓名</td>
                        <td colSpan={2} style={{ ...cellStyle, padding: '4px 2px' }}>{data.userSnapshot?.name || ''}</td>
                        <td style={{ ...cellStyle, padding: '4px 2px' }}>出差事由</td>
                        <td colSpan={4} style={{ ...cellStyle, padding: '4px 2px', textAlign: 'left', fontSize: '13px', lineHeight: '1.2', whiteSpace: 'normal' }}>
                            {data.tripReason || ''}
                        </td>
                    </tr>
                    
                    {/* 表头行 - 第一部分 */}
                    <tr>
                        <th rowSpan={2} style={cellStyle}>日期</th>
                        <th rowSpan={2} style={cellStyle}>起讫地点</th>
                        <th rowSpan={2} style={cellStyle}>车船机票</th>
                        <th colSpan={3} style={cellStyle}>住 宿</th>
                        <th rowSpan={2} style={cellStyle}>市内交通</th>
                        <th rowSpan={2} style={cellStyle}>餐费</th>
                        <th rowSpan={2} style={cellStyle}>其他</th>
                        <th rowSpan={2} style={cellStyle}>小计</th>
                    </tr>
                    <tr>
                        <th style={cellStyle}>地区</th>
                        <th style={cellStyle}>天数</th>
                        <th style={cellStyle}>金额</th>
                    </tr>
                    
                    {/* 数据行 */}
                    {tripLegs.map((leg: any, idx: number) => (
                        <tr key={idx}>
                            <td style={cellStyle}>{leg.dateRange || ''}</td>
                            <td style={cellStyle}>{leg.route || ''}</td>
                            <td style={cellStyle}>{leg.transportFee ? leg.transportFee.toFixed(2) : ''}</td>
                            <td style={cellStyle}>{leg.destination || ''}</td>
                            <td style={cellStyle}>{leg.hotelDays || ''}</td>
                            <td style={cellStyle}>{leg.hotelFee ? leg.hotelFee.toFixed(2) : ''}</td>
                            <td style={cellStyle}>{leg.cityTrafficFee ? leg.cityTrafficFee.toFixed(2) : ''}</td>
                            <td style={cellStyle}>{leg.mealFee ? leg.mealFee.toFixed(2) : ''}</td>
                            <td style={cellStyle}>{leg.otherFee ? leg.otherFee.toFixed(2) : ''}</td>
                            <td style={cellStyle}>¥{(leg.subTotal || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                    
                    {/* 空行填充 - 确保至少6行 */}
                    {Array.from({ length: Math.max(0, 6 - tripLegs.length) }).map((_, idx) => (
                        <tr key={`empty-${idx}`} style={{ height: '30px' }}>
                            <td style={cellStyle}></td>
                            <td style={cellStyle}></td>
                            <td style={cellStyle}></td>
                            <td style={cellStyle}></td>
                            <td style={cellStyle}></td>
                            <td style={cellStyle}></td>
                            <td style={cellStyle}></td>
                            <td style={cellStyle}></td>
                            <td style={cellStyle}></td>
                            <td style={cellStyle}></td>
                        </tr>
                    ))}
                    
                    {/* 合计行 */}
                    <tr>
                        <td colSpan={2} style={cellStyle}>合计</td>
                        <td style={cellStyle}>¥{totalTransport.toFixed(2)}</td>
                        <td colSpan={2} style={cellStyle}></td>
                        <td style={cellStyle}>¥{totalHotel.toFixed(2)}</td>
                        <td style={cellStyle}>¥{totalCityTraffic.toFixed(2)}</td>
                        <td style={cellStyle}>¥{totalMeal.toFixed(2)}</td>
                        <td style={cellStyle}>¥{totalOther.toFixed(2)}</td>
                        <td style={cellStyle}>¥{grandTotal.toFixed(2)}</td>
                    </tr>
                    
                    {/* 总计金额大写行 */}
                    <tr>
                        <td colSpan={2} style={cellStyle}>总计金额（大写）</td>
                        <td colSpan={8} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '20px' }}>
                            {digitToChinese(grandTotal)}
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', padding: '0 20px', fontSize: '16px' }}>
                <span>财务审核：</span>
                <span>报销人签字：</span>
            </div>
        </div>
    );
};

// Add CreateTravelReportView - 使用与通用报销相同的交互流程
const CreateTravelReportView = ({ settings, loans, onAction, onBack }: any) => {
    const [step, setStep] = useState(1);
    const [analyzing, setAnalyzing] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [formCollapsed, setFormCollapsed] = useState(false);
    const [previewScale, setPreviewScale] = useState(0.6);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    
    // 分类上传的文件
    const [ticketFiles, setTicketFiles] = useState<Attachment[]>([]); // 火车票/机票 (必须)
    const [hotelFiles, setHotelFiles] = useState<Attachment[]>([]); // 住宿发票
    const [taxiInvoiceFiles, setTaxiInvoiceFiles] = useState<Attachment[]>([]); // 打车发票
    const [taxiTripFiles, setTaxiTripFiles] = useState<Attachment[]>([]); // 打车行程单
    const [approvalFiles, setApprovalFiles] = useState<Attachment[]>([]); // 审批单
    
    // AI 识别结果
    const [aiTicketResult, setAiTicketResult] = useState<any>(null);
    const [aiHotelResult, setAiHotelResult] = useState<any>(null);
    const [aiTaxiResult, setAiTaxiResult] = useState<any>(null);
    const [aiApprovalResult, setAiApprovalResult] = useState<any>(null);
    
    // 表单数据
    const [form, setForm] = useState({
        tripReason: "",
        approvalNumber: "",
        budgetProjectId: settings.budgetProjects.find((p:any) => p.isDefault)?.id || "",
        paymentAccountId: settings.paymentAccounts.find((a:any) => a.isDefault)?.id || "",
        prepaidAmount: 0,
        tripLegs: [] as TripLeg[],
        taxiDetails: [] as any[], // 出租车费明细
    });
    
    // 匹配的借款记录
    const [matchedLoans, setMatchedLoans] = useState<any[]>([]);
    const [selectedLoanId, setSelectedLoanId] = useState<string>('');

    // 文件上传处理
    const handleFileUpload = async (e: any, type: 'ticket' | 'hotel' | 'taxiInvoice' | 'taxiTrip' | 'approval') => {
        if(e.target.files && e.target.files.length > 0) {
            const newFiles = await Promise.all(Array.from(e.target.files as FileList).map(async (f: File) => {
                let data = "";
                if(f.type === 'application/pdf') {
                    data = await pdfToImage(f);
                } else {
                    data = await fileToBase64(f);
                }
                return { data, type, name: f.name } as Attachment;
            }));
            
            switch(type) {
                case 'ticket': setTicketFiles(prev => [...prev, ...newFiles]); break;
                case 'hotel': setHotelFiles(prev => [...prev, ...newFiles]); break;
                case 'taxiInvoice': setTaxiInvoiceFiles(prev => [...prev, ...newFiles]); break;
                case 'taxiTrip': setTaxiTripFiles(prev => [...prev, ...newFiles]); break;
                case 'approval': setApprovalFiles(prev => [...prev, ...newFiles]); break;
            }
        }
    };
    
    // 删除文件
    const removeFile = (type: 'ticket' | 'hotel' | 'taxiInvoice' | 'taxiTrip' | 'approval', index: number) => {
        switch(type) {
            case 'ticket': setTicketFiles(prev => prev.filter((_, i) => i !== index)); break;
            case 'hotel': setHotelFiles(prev => prev.filter((_, i) => i !== index)); break;
            case 'taxiInvoice': setTaxiInvoiceFiles(prev => prev.filter((_, i) => i !== index)); break;
            case 'taxiTrip': setTaxiTripFiles(prev => prev.filter((_, i) => i !== index)); break;
            case 'approval': setApprovalFiles(prev => prev.filter((_, i) => i !== index)); break;
        }
    };

    // 开始 AI 识别
    const startAnalysis = async () => {
        // 检查必须上传的文件
        if (ticketFiles.length === 0) {
            alert('请上传火车票或机票！这是必须的票据。');
            return;
        }
        
        setAnalyzing(true);
        try {
            const cleanB64 = (d: string) => d.split(',')[1];
            
            // 并行识别所有票据，大幅提升速度
            console.log('[AI] 开始并行识别所有票据');
            const startTime = Date.now();
            
            // 准备所有图片
            const ticketImages = ticketFiles.map(f => cleanB64(f.data));
            const hotelImages = hotelFiles.map(f => cleanB64(f.data));
            const taxiImages = [...taxiInvoiceFiles, ...taxiTripFiles].map(f => cleanB64(f.data));
            const approvalImages = approvalFiles.map(f => cleanB64(f.data));
            
            // 创建并行请求
            const ticketPromise = apiRequest('/api/ai/recognize', {
                method: 'POST',
                body: JSON.stringify({ type: 'ticket', images: ticketImages, mimeType: 'image/jpeg' }),
            });
            
            const hotelPromise = hotelImages.length > 0 
                ? apiRequest('/api/ai/recognize', {
                    method: 'POST',
                    body: JSON.stringify({ type: 'hotel', images: hotelImages, mimeType: 'image/jpeg' }),
                })
                : Promise.resolve({ result: {} });
            
            const taxiPromise = taxiImages.length > 0 
                ? apiRequest('/api/ai/recognize', {
                    method: 'POST',
                    body: JSON.stringify({ type: 'taxi', images: taxiImages, mimeType: 'image/jpeg' }),
                })
                : Promise.resolve({ result: { details: [] } });
            
            const approvalPromise = approvalImages.length > 0 
                ? apiRequest('/api/ai/recognize', {
                    method: 'POST',
                    body: JSON.stringify({ type: 'approval', images: approvalImages, mimeType: 'image/jpeg' }),
                })
                : Promise.resolve({ result: {} });
            
            // 等待所有请求完成
            const [ticketResponse, hotelResponse, taxiResponse, approvalResponse] = await Promise.all([
                ticketPromise, hotelPromise, taxiPromise, approvalPromise
            ]) as any[];
            
            console.log(`[AI] 并行识别完成，耗时: ${Date.now() - startTime}ms`);
            
            // 处理火车票/机票识别结果
            const ticketData = ticketResponse.result || {};
            setAiTicketResult(ticketData);
            console.log('[AI] 火车票/机票识别结果', ticketData);
            
            // 处理住宿发票识别结果
            const hotelData = hotelResponse.result || {};
            if (hotelImages.length > 0) {
                setAiHotelResult(hotelData);
                console.log('[AI] 住宿发票识别结果', hotelData);
            }
            
            // 处理打车发票识别结果
            let taxiData: any = { details: [] };
            if (taxiImages.length > 0) {
                const rawTaxiData = taxiResponse.result || { details: [] };
                console.log('[AI] 打车发票原始识别结果', rawTaxiData);
                
                // 处理各种可能的返回格式
                if (Array.isArray(rawTaxiData)) {
                    taxiData = { details: rawTaxiData };
                } else if (rawTaxiData.details && Array.isArray(rawTaxiData.details)) {
                    taxiData = rawTaxiData;
                } else if (typeof rawTaxiData === 'object' && rawTaxiData.amount !== undefined) {
                    taxiData = { details: [rawTaxiData] };
                } else {
                    taxiData = { details: [] };
                }
                
                setAiTaxiResult(taxiData);
                console.log('[AI] 打车发票处理后结果', taxiData);
            }
            
            // 处理审批单识别结果
            const approvalData = approvalResponse.result || {};
            if (approvalImages.length > 0) {
                setAiApprovalResult(approvalData);
                console.log('[AI] 审批单识别结果', approvalData);
            }
            
            // 5. 构建差旅行程数据
            const tickets = Array.isArray(ticketData) ? ticketData : (ticketData.tickets || [ticketData]);
            const hotels = Array.isArray(hotelData) ? hotelData : (hotelData.hotels || [hotelData]);
            const taxiDetails = taxiData.details || [];
            
            // 将火车票/机票配对成往返程（一对往返票 = 一条出差记录）
            // 按照出发地和目的地进行配对
            const pairedTrips: { outbound: any; return: any | null }[] = [];
            const usedTickets = new Set<number>();
            
            tickets.forEach((ticket: any, idx: number) => {
                if (usedTickets.has(idx)) return;
                
                const departure = ticket.departure || ticket.fromStation || '';
                const destination = ticket.destination || ticket.toStation || '';
                const departureDate = ticket.departureDate || ticket.date || '';
                
                // 查找对应的返程票（出发地和目的地互换）
                const returnIdx = tickets.findIndex((t: any, i: number) => {
                    if (i === idx || usedTickets.has(i)) return false;
                    const tDeparture = t.departure || t.fromStation || '';
                    const tDestination = t.destination || t.toStation || '';
                    // 返程票：出发地=去程目的地，目的地=去程出发地
                    return tDeparture === destination && tDestination === departure;
                });
                
                usedTickets.add(idx);
                if (returnIdx !== -1) {
                    usedTickets.add(returnIdx);
                    pairedTrips.push({
                        outbound: ticket,
                        return: tickets[returnIdx],
                    });
                } else {
                    // 没有找到返程票，单独作为一条记录
                    pairedTrips.push({
                        outbound: ticket,
                        return: null,
                    });
                }
            });
            
            // 从配对的往返票据生成出差记录
            const tripLegs: TripLeg[] = pairedTrips.map((pair) => {
                const outbound = pair.outbound;
                const returnTicket = pair.return;
                
                const departure = outbound.departure || outbound.fromStation || '';
                const destination = outbound.destination || outbound.toStation || '';
                const outboundDate = outbound.departureDate || outbound.date || '';
                const returnDate = returnTicket?.departureDate || returnTicket?.date || outboundDate;
                
                // 计算往返车票费用总和
                const outboundFee = outbound.amount || outbound.price || 0;
                const returnFee = returnTicket?.amount || returnTicket?.price || 0;
                const totalTransportFee = outboundFee + returnFee;
                
                // 查找对应的住宿信息（按目的地匹配）
                const matchedHotel = hotels.find((h: any) => 
                    h.city === destination || 
                    h.location?.includes(destination) ||
                    destination.includes(h.city || '')
                );
                
                return {
                    dateRange: `${outboundDate}-${returnDate}`, // 出发日期-回程日期
                    route: `${departure}-${destination}`, // 起讫地点
                    destination: destination,
                    transportFee: totalTransportFee, // 往返车票费用之和
                    hotelDays: matchedHotel?.days || matchedHotel?.nights || 0,
                    hotelFee: matchedHotel?.amount || matchedHotel?.totalAmount || 0,
                    cityTrafficFee: 0, // 将在后面计算
                    mealFee: 0,
                    otherFee: 0,
                    subTotal: 0, // 将在后面计算
                };
            });
            
            // 计算市内交通费（从打车发票）
            const totalTaxiFee = taxiDetails.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
            if (tripLegs.length > 0 && totalTaxiFee > 0) {
                // 将打车费分配到第一个行程段
                tripLegs[0].cityTrafficFee = totalTaxiFee;
            }
            
            // 计算每个行程的小计
            tripLegs.forEach(leg => {
                leg.subTotal = (leg.transportFee || 0) + (leg.hotelFee || 0) + 
                              (leg.cityTrafficFee || 0) + (leg.mealFee || 0) + (leg.otherFee || 0);
            });
            
            // 6. 匹配借款记录
            const potentialLoans = loans.filter((loan: any) => {
                if (approvalData.approvalNumber && loan.approvalNumber) {
                    return loan.approvalNumber === approvalData.approvalNumber;
                }
                return false;
            });
            setMatchedLoans(potentialLoans);
            
            // 7. 自动选择预算项目
            let autoSelectedBudgetId = form.budgetProjectId;
            if (approvalData.budgetProject) {
                const matchedBudget = settings.budgetProjects.find((p: any) => 
                    p.name.includes(approvalData.budgetProject) || p.code === approvalData.budgetCode
                );
                if (matchedBudget) {
                    autoSelectedBudgetId = matchedBudget.id;
                }
            }
            
            // 8. 更新表单
            console.log('[AI] 打车明细数据:', taxiDetails);
            const processedTaxiDetails = taxiDetails.map((t: any, idx: number) => {
                // 尝试从多个可能的字段名获取金额
                const amount = parseFloat(t.amount) || parseFloat(t.price) || parseFloat(t.totalAmount) || parseFloat(t.fare) || 0;
                
                // 获取起终点信息（保留完整内容）
                const route = t.route || `${t.startPoint || ''}-${t.endPoint || ''}`;
                
                const processedItem = {
                    id: `taxi-${Date.now()}-${idx}`,
                    date: t.date || t.invoiceDate || '',
                    reason: approvalData.eventSummary || '', // 使用出差事由
                    route: route, // 保留完整起终点信息
                    amount: amount,
                };
                console.log(`[AI] 打车明细 ${idx + 1}:`, { 原始数据: t, 处理后: processedItem });
                return processedItem;
            });
            
            setForm(prev => ({
                ...prev,
                tripReason: approvalData.eventSummary || ticketData.tripReason || '',
                approvalNumber: approvalData.approvalNumber || '',
                budgetProjectId: autoSelectedBudgetId,
                tripLegs: tripLegs,
                taxiDetails: processedTaxiDetails,
            }));
            
            setStep(2);
        } catch(e: any) {
            console.error('[AI] 识别失败:', e);
            const errorMsg = e?.message || e?.toString() || '未知错误';
            alert(`AI 识别失败: ${errorMsg}\n\n请检查：\n1. 网络连接是否正常\n2. AI 配置是否正确\n3. 上传的图片是否清晰`);
        } finally {
            setAnalyzing(false);
        }
    };

    // 计算总金额
    const calculateTotal = () => {
        return form.tripLegs.reduce((acc, leg) => acc + (leg.subTotal || 0), 0);
    };
    
    // 金额审核
    const validateAmounts = () => {
        // 计算发票总金额
        const ticketTotal = form.tripLegs.reduce((sum, leg) => sum + (leg.transportFee || 0), 0);
        const hotelTotal = form.tripLegs.reduce((sum, leg) => sum + (leg.hotelFee || 0), 0);
        const taxiTotal = form.taxiDetails.reduce((sum, t) => sum + (t.amount || 0), 0);
        const cityTrafficTotal = form.tripLegs.reduce((sum, leg) => sum + (leg.cityTrafficFee || 0), 0);
        
        // 检查打车费是否匹配
        const isTaxiMatch = Math.abs(taxiTotal - cityTrafficTotal) < 0.01;
        
        return {
            isValid: isTaxiMatch,
            ticketTotal,
            hotelTotal,
            taxiTotal,
            cityTrafficTotal,
            diff: taxiTotal - cityTrafficTotal,
        };
    };

    const handleSubmit = (action: 'save' | 'print') => {
        const validation = validateAmounts();
        if (action === 'print' && !validation.isValid) {
            alert('金额审核未通过！\n\n打车发票金额与市内交通费不匹配，请调整后再打印。');
            return;
        }
        
        const totalAmount = calculateTotal();
        const allAttachments = [...ticketFiles, ...hotelFiles, ...taxiInvoiceFiles, ...taxiTripFiles, ...approvalFiles];
        
        const report: Report = {
            id: Date.now().toString(),
            title: `差旅费-${form.tripReason}`,
            createdDate: new Date().toISOString(),
            status: 'draft',
            totalAmount,
            prepaidAmount: form.prepaidAmount,
            payableAmount: totalAmount - form.prepaidAmount,
            items: [],
            tripLegs: form.tripLegs,
            tripReason: form.tripReason,
            taxiDetails: form.taxiDetails,
            isTravel: true,
            userSnapshot: settings.currentUser,
            attachments: allAttachments,
            approvalNumber: form.approvalNumber,
            budgetProject: settings.budgetProjects.find((p:any) => p.id === form.budgetProjectId),
            paymentAccount: settings.paymentAccounts.find((a:any) => a.id === form.paymentAccountId),
            invoiceCount: allAttachments.length
        };
        onAction(report, action);
    };
    
    const allAttachments = [...ticketFiles, ...hotelFiles, ...taxiInvoiceFiles, ...taxiTripFiles, ...approvalFiles];
    const currentTotal = calculateTotal();
    const validation = validateAmounts();
    
    return (
        <div className={`mx-auto h-full flex flex-col ${step === 2 ? 'w-full max-w-none' : 'max-w-5xl'}`}>
            {/* Header */}
            {step === 1 && (
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight className="rotate-180"/></button>
                    <h2 className="text-2xl font-bold text-slate-800">差旅费用报销</h2>
                </div>
            )}

            {/* Step 1: Upload */}
            {step === 1 && (
                <div className="flex-1 overflow-y-auto pb-20">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* 火车票/机票 - 必须 */}
                        <div className="col-span-2">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Plane size={20} className="text-red-500"/> 火车票/机票 <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">强制上传</span>
                            </h3>
                            <div className="bg-white rounded-2xl border-2 border-dashed border-red-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-red-50/20 transition-colors relative">
                                <input type="file" multiple accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'ticket')} />
                                {ticketFiles.length > 0 ? (
                                    <div className="flex flex-wrap gap-4 justify-center w-full z-10 pointer-events-none">
                                        {ticketFiles.map((f, i) => (
                                            <div key={i} className="relative group pointer-events-auto">
                                                <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                                                    <FileText className="text-slate-400"/>
                                                </div>
                                                <div className="text-[10px] mt-1 truncate max-w-[80px] text-slate-500">{f.name}</div>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile('ticket', i); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-100 transition-opacity z-20"><X size={10}/></button>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-center w-20 h-20 bg-slate-50 rounded-lg border border-slate-200 text-slate-400">
                                            <Plus size={24}/>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 pointer-events-none">
                                        <Upload size={32} className="mx-auto mb-2 text-red-300"/>
                                        <p className="font-bold text-sm text-slate-600">上传火车票/机票</p>
                                        <p className="text-xs">支持 PDF / 图片</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 住宿发票 */}
                        <div className="col-span-2 md:col-span-1">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Home size={20} className="text-blue-500"/> 住宿发票 <span className="text-slate-400 text-xs font-normal">可选</span>
                            </h3>
                            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-blue-50/10 transition-colors relative">
                                <input type="file" multiple accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'hotel')} />
                                {hotelFiles.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
                                        {hotelFiles.map((f, i) => (
                                            <div key={i} className="relative group pointer-events-auto">
                                                <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                                                    <FileText size={20} className="text-slate-400"/>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile('hotel', i); }} className="absolute -top-2 -right-2 bg-slate-500 text-white rounded-full p-1"><X size={8}/></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 pointer-events-none">
                                        <Upload size={24} className="mx-auto mb-2 text-blue-300"/>
                                        <p className="font-bold text-xs text-slate-600">上传住宿发票</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 打车发票 */}
                        <div className="col-span-2 md:col-span-1">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Car size={20} className="text-yellow-500"/> 打车发票 <span className="text-slate-400 text-xs font-normal">可选</span>
                            </h3>
                            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[160px] hover:bg-yellow-50/10 transition-colors relative">
                                <input type="file" multiple accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'taxiInvoice')} />
                                {taxiInvoiceFiles.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
                                        {taxiInvoiceFiles.map((f, i) => (
                                            <div key={i} className="relative group pointer-events-auto">
                                                <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                                                    <FileText size={20} className="text-slate-400"/>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile('taxiInvoice', i); }} className="absolute -top-2 -right-2 bg-slate-500 text-white rounded-full p-1"><X size={8}/></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 pointer-events-none">
                                        <Upload size={24} className="mx-auto mb-2 text-yellow-300"/>
                                        <p className="font-bold text-xs text-slate-600">上传打车发票</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 打车行程单 */}
                        <div className="col-span-2">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <MapPin size={20} className="text-purple-500"/> 打车行程单 <span className="text-slate-400 text-xs font-normal">可选 · 用于提取起终点</span>
                            </h3>
                            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center min-h-[120px] hover:bg-purple-50/10 transition-colors relative">
                                <input type="file" multiple accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'taxiTrip')} />
                                {taxiTripFiles.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 justify-center w-full z-10 pointer-events-none">
                                        {taxiTripFiles.map((f, i) => (
                                            <div key={i} className="relative group pointer-events-auto">
                                                <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                                                    <FileText size={20} className="text-slate-400"/>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile('taxiTrip', i); }} className="absolute -top-2 -right-2 bg-slate-500 text-white rounded-full p-1"><X size={8}/></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 pointer-events-none">
                                        <Upload size={24} className="mx-auto mb-2 text-purple-300"/>
                                        <p className="font-bold text-xs text-slate-600">上传打车行程单</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* 开始识别按钮 */}
                    <button 
                        onClick={startAnalysis} 
                        disabled={ticketFiles.length === 0 || analyzing}
                        className={`w-full mt-8 py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-lg ${ticketFiles.length > 0 ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        {analyzing ? <><Loader2 className="animate-spin"/> AI 正在分析票据...</> : "开始识别与填单"}
                    </button>
                </div>
            )}
            
            {/* Step 2: 编辑和预览 */}
            {step === 2 && (
                <div className="absolute inset-0 flex flex-col bg-slate-100 z-30">
                    {/* Toolbar */}
                    <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex justify-between items-center shadow-sm flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium text-sm">
                                <ChevronLeft size={16}/> 返回重传
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
                            <button onClick={() => handleSubmit('save')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 flex items-center gap-1.5">
                                <Save size={14}/> 保存草稿
                            </button>
                            <button 
                                onClick={() => handleSubmit('pdf')} 
                                className={`px-3 py-1.5 rounded-lg font-medium text-sm shadow-sm flex items-center gap-1.5 ${
                                    validation.isValid 
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                }`}
                            >
                                <Download size={14}/> 提交报销
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
                                <Edit2 size={14} className="text-slate-600"/> 填写信息
                            </h3>
                            
                            <div className="space-y-4">
                                {/* 出差事由 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">出差事由</label>
                                    <textarea 
                                        value={form.tripReason} 
                                        onChange={e => setForm({...form, tripReason: e.target.value})} 
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
                                        onChange={e => setForm({...form, approvalNumber: e.target.value})} 
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none" 
                                        placeholder="审批单号"
                                    />
                                </div>
                                
                                {/* 预算项目 */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">预算项目</label>
                                    <select 
                                        value={form.budgetProjectId} 
                                        onChange={e => setForm({...form, budgetProjectId: e.target.value})} 
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none bg-white"
                                    >
                                        {settings.budgetProjects.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                
                                {/* 行程明细 */}
                                <div className="border-t border-slate-100 pt-4">
                                    <h4 className="font-bold text-sm text-slate-700 mb-2">🚄 行程明细</h4>
                                    {form.tripLegs.map((leg, idx) => (
                                        <div key={idx} className="bg-slate-50 rounded-lg p-3 mb-2 border border-slate-200">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-indigo-600">行程 {idx + 1}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <label className="text-slate-500">日期</label>
                                                    <input 
                                                        value={leg.dateRange || ''} 
                                                        onChange={e => {
                                                            const legs = [...form.tripLegs];
                                                            legs[idx].dateRange = e.target.value;
                                                            setForm({...form, tripLegs: legs});
                                                        }}
                                                        className="w-full p-1 border rounded text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-slate-500">路线</label>
                                                    <input 
                                                        value={leg.route || ''} 
                                                        onChange={e => {
                                                            const legs = [...form.tripLegs];
                                                            legs[idx].route = e.target.value;
                                                            setForm({...form, tripLegs: legs});
                                                        }}
                                                        className="w-full p-1 border rounded text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-slate-500">交通费</label>
                                                    <input 
                                                        type="number"
                                                        value={leg.transportFee || 0} 
                                                        onChange={e => {
                                                            const legs = [...form.tripLegs];
                                                            legs[idx].transportFee = parseFloat(e.target.value) || 0;
                                                            legs[idx].subTotal = (legs[idx].transportFee || 0) + (legs[idx].hotelFee || 0) + 
                                                                                (legs[idx].cityTrafficFee || 0) + (legs[idx].mealFee || 0) + (legs[idx].otherFee || 0);
                                                            setForm({...form, tripLegs: legs});
                                                        }}
                                                        className="w-full p-1 border rounded text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-slate-500">住宿费</label>
                                                    <input 
                                                        type="number"
                                                        value={leg.hotelFee || 0} 
                                                        onChange={e => {
                                                            const legs = [...form.tripLegs];
                                                            legs[idx].hotelFee = parseFloat(e.target.value) || 0;
                                                            legs[idx].subTotal = (legs[idx].transportFee || 0) + (legs[idx].hotelFee || 0) + 
                                                                                (legs[idx].cityTrafficFee || 0) + (legs[idx].mealFee || 0) + (legs[idx].otherFee || 0);
                                                            setForm({...form, tripLegs: legs});
                                                        }}
                                                        className="w-full p-1 border rounded text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-slate-500">住宿天数</label>
                                                    <input 
                                                        type="number"
                                                        value={leg.hotelDays || 0} 
                                                        onChange={e => {
                                                            const legs = [...form.tripLegs];
                                                            legs[idx].hotelDays = parseInt(e.target.value) || 0;
                                                            setForm({...form, tripLegs: legs});
                                                        }}
                                                        className="w-full p-1 border rounded text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-slate-500">市内交通</label>
                                                    <input 
                                                        type="number"
                                                        value={leg.cityTrafficFee || 0} 
                                                        onChange={e => {
                                                            const legs = [...form.tripLegs];
                                                            legs[idx].cityTrafficFee = parseFloat(e.target.value) || 0;
                                                            legs[idx].subTotal = (legs[idx].transportFee || 0) + (legs[idx].hotelFee || 0) + 
                                                                                (legs[idx].cityTrafficFee || 0) + (legs[idx].mealFee || 0) + (legs[idx].otherFee || 0);
                                                            setForm({...form, tripLegs: legs});
                                                        }}
                                                        className="w-full p-1 border rounded text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-2 text-right text-xs font-bold text-indigo-600">
                                                小计: ¥{(leg.subTotal || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* 添加行程按钮 */}
                                    <button 
                                        onClick={() => {
                                            setForm({
                                                ...form, 
                                                tripLegs: [...form.tripLegs, {
                                                    dateRange: '',
                                                    route: '',
                                                    destination: '',
                                                    transportFee: 0,
                                                    hotelDays: 0,
                                                    hotelFee: 0,
                                                    cityTrafficFee: 0,
                                                    mealFee: 0,
                                                    otherFee: 0,
                                                    subTotal: 0,
                                                }]
                                            });
                                        }}
                                        className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                                    >
                                        + 添加行程
                                    </button>
                                </div>
                                
                                {/* 出租车费明细 */}
                                {form.taxiDetails.length > 0 && (
                                    <div className="border-t border-slate-100 pt-4">
                                        <h4 className="font-bold text-sm text-slate-700 mb-2">🚕 出租车费明细</h4>
                                        {form.taxiDetails.map((taxi, idx) => (
                                            <div key={idx} className="bg-yellow-50 rounded-lg p-2 mb-2 border border-yellow-200 text-xs">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-slate-500">日期</label>
                                                        <input 
                                                            value={taxi.date || ''} 
                                                            onChange={e => {
                                                                const details = [...form.taxiDetails];
                                                                details[idx].date = e.target.value;
                                                                setForm({...form, taxiDetails: details});
                                                            }}
                                                            className="w-full p-1 border rounded text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-slate-500">金额</label>
                                                        <input 
                                                            type="number"
                                                            value={taxi.amount || 0} 
                                                            onChange={e => {
                                                                const details = [...form.taxiDetails];
                                                                details[idx].amount = parseFloat(e.target.value) || 0;
                                                                setForm({...form, taxiDetails: details});
                                                            }}
                                                            className="w-full p-1 border rounded text-xs"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-1">
                                                    <label className="text-slate-500">起终点</label>
                                                    <input 
                                                        value={taxi.route || ''} 
                                                        onChange={e => {
                                                            const details = [...form.taxiDetails];
                                                            details[idx].route = e.target.value;
                                                            setForm({...form, taxiDetails: details});
                                                        }}
                                                        className="w-full p-1 border rounded text-xs"
                                                        placeholder="起点-终点"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        <p className="text-[10px] text-slate-500">
                                            出租车费总计: ¥{form.taxiDetails.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2)}
                                        </p>
                                    </div>
                                )}
                                
                                {/* 金额审核 */}
                                <div className="border-t border-slate-100 pt-4">
                                    <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2">
                                        💰 金额审核
                                        {validation.isValid 
                                            ? <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">✓ 已通过</span>
                                            : <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">⚠ 不匹配</span>
                                        }
                                    </h4>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">交通费合计</span>
                                            <span className="font-mono">¥{validation.ticketTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">住宿费合计</span>
                                            <span className="font-mono">¥{validation.hotelTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">打车发票金额</span>
                                            <span className="font-mono">¥{validation.taxiTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">市内交通录入</span>
                                            <span className="font-mono">¥{validation.cityTrafficTotal.toFixed(2)}</span>
                                        </div>
                                        {!validation.isValid && (
                                            <div className="bg-red-50 border border-red-200 rounded p-2 text-red-600">
                                                差异: ¥{Math.abs(validation.diff).toFixed(2)}
                                            </div>
                                        )}
                                        <div className="border-t pt-2 flex justify-between font-bold">
                                            <span>总计</span>
                                            <span className="text-indigo-600">¥{currentTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
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
                            
                            {/* 报销单预览 */}
                            <div className="flex flex-col items-center max-w-4xl mx-auto">
                                {/* 出租车费明细表 */}
                                {form.taxiDetails.length > 0 && (
                                    <div 
                                        className="bg-white shadow-lg border border-slate-200 mb-4"
                                        style={{ 
                                            transform: `scale(${previewScale})`,
                                            transformOrigin: 'top center',
                                        }}
                                    >
                                        <TaxiExpenseTable 
                                            data={{
                                                createdDate: new Date().toISOString(),
                                                userSnapshot: settings.currentUser,
                                                tripReason: form.tripReason,
                                                taxiDetails: form.taxiDetails,
                                            }}
                                        />
                                    </div>
                                )}
                                
                                {/* 差旅费报销单 */}
                                <div 
                                    className="bg-white shadow-lg border border-slate-200 mb-4"
                                    style={{ 
                                        transform: `scale(${previewScale})`,
                                        transformOrigin: 'top center',
                                    }}
                                >
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
                                        paymentAccount: settings.paymentAccounts.find((a:any) => a.id === form.paymentAccountId),
                                        invoiceCount: ticketFiles.length + hotelFiles.length + taxiInvoiceFiles.length + taxiTripFiles.length
                                    }}
                                  />
                              </div>
                              
                              {/* 附件展示 - 竖版 A4 */}
                              {/* 火车票/机票附件 */}
                              {ticketFiles.map((attachment, idx) => (
                                  <div 
                                      key={`ticket-${idx}`}
                                      className="mb-4"
                                      style={{ 
                                          transform: `scale(${previewScale})`,
                                          transformOrigin: 'top center',
                                      }}
                                  >
                                      <A4SingleAttachment 
                                          attachment={attachment}
                                          title="火车票/机票"
                                          index={idx}
                                      />
                                  </div>
                              ))}
                              
                              {/* 住宿发票附件 */}
                              {hotelFiles.map((attachment, idx) => (
                                  <div 
                                      key={`hotel-${idx}`}
                                      className="mb-4"
                                      style={{ 
                                          transform: `scale(${previewScale})`,
                                          transformOrigin: 'top center',
                                      }}
                                  >
                                      <A4SingleAttachment 
                                          attachment={attachment}
                                          title="住宿发票"
                                          index={idx}
                                      />
                                  </div>
                              ))}
                              
                              {/* 打车发票附件 */}
                              {taxiInvoiceFiles.map((attachment, idx) => (
                                  <div 
                                      key={`taxiInvoice-${idx}`}
                                      className="mb-4"
                                      style={{ 
                                          transform: `scale(${previewScale})`,
                                          transformOrigin: 'top center',
                                      }}
                                  >
                                      <A4SingleAttachment 
                                          attachment={attachment}
                                          title="打车发票"
                                          index={idx}
                                      />
                                  </div>
                              ))}
                              
                              {/* 打车行程单附件 */}
                              {taxiTripFiles.map((attachment, idx) => (
                                  <div 
                                      key={`taxiTrip-${idx}`}
                                      className="mb-4"
                                      style={{ 
                                          transform: `scale(${previewScale})`,
                                          transformOrigin: 'top center',
                                      }}
                                  >
                                      <A4SingleAttachment 
                                          attachment={attachment}
                                          title="打车行程单"
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
    const [generating, setGenerating] = useState(false);
    // 确保 taxiDetails 正确初始化
    const [editData, setEditData] = useState({ 
        ...report,
        taxiDetails: report.taxiDetails || [] // 确保 taxiDetails 存在
    });
    const canEdit = report.status !== 'paid'; // 未完成报销时可编辑
    const [editPanelCollapsed, setEditPanelCollapsed] = useState(false); // 编辑面板伸缩状态
    const reportRef = useRef<HTMLDivElement>(null);
    const taxiTableRef = useRef<HTMLDivElement>(null); // 打车行程表引用
    
    // 分类附件 - 优先使用 type 属性，其次使用文件名判断
    const invoiceAttachments = editData.attachments?.filter((a: any) => 
        a.type === 'invoice' || a.name?.includes('发票') || a.name?.includes('invoice')
    ) || [];
    
    const approvalAttachments = editData.attachments?.filter((a: any) => 
        a.type === 'approval' || a.name?.includes('审批') || a.name?.includes('approval')
    ) || [];
    
    const voucherAttachments = editData.attachments?.filter((a: any) => 
        a.type === 'voucher' || a.name?.includes('凭证') || a.name?.includes('voucher')
    ) || [];
    
    // 未分类的附件（旧数据或其他来源）作为发票处理
    const classifiedIds = new Set([
        ...invoiceAttachments.map((a: any) => a.data),
        ...approvalAttachments.map((a: any) => a.data),
        ...voucherAttachments.map((a: any) => a.data)
    ]);
    const unclassifiedAttachments = editData.attachments?.filter((a: any) => 
        !classifiedIds.has(a.data)
    ) || [];
    
    const allInvoices = [...invoiceAttachments, ...unclassifiedAttachments];
    
    // 保存编辑
    const handleSave = () => {
        if (onUpdate) {
            onUpdate(editData);
            alert('保存成功！');
        }
    };

    // 生成 PDF - 直接截取预览页面显示的内容（所见即所得）
    const generatePDF = async () => {
        if (generating) return;
        setGenerating(true);
        
        try {
            // 根据报销单类型选择方向
            const isTravel = editData.isTravel;
            const orientation = isTravel ? 'portrait' : 'landscape';
            const a4Width = isTravel ? 210 : 297;
            const a4Height = isTravel ? 297 : 210;
            
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: 'a4',
                compress: true // 启用压缩
            });
            
            // 1. 添加报销单页面 - 直接截取预览中显示的元素
            if (reportRef.current) {
                const element = reportRef.current;
                
                // 使用 html2canvas 截图，优化参数
                const canvas = await html2canvas(element, {
                    scale: 1.5, // 降低分辨率以减小文件大小，同时保持清晰
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    // 不指定 width/height，让 html2canvas 自动获取完整尺寸
                });
                
                // 使用 JPEG 格式并压缩以减小文件大小
                const imgData = canvas.toDataURL('image/jpeg', 0.85);
                
                // 直接填满整个 A4 页面
                pdf.addImage(imgData, 'JPEG', 0, 0, a4Width, a4Height);
            }
            
            // 2. 如果是差旅报销且有打车明细，添加打车行程表
            if (editData.isTravel && editData.taxiDetails && editData.taxiDetails.length > 0 && taxiTableRef.current) {
                pdf.addPage('a4', 'portrait'); // 打车行程表用竖版
                
                const taxiCanvas = await html2canvas(taxiTableRef.current, {
                    scale: 1.5,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                });
                
                const taxiImgData = taxiCanvas.toDataURL('image/jpeg', 0.85);
                pdf.addImage(taxiImgData, 'JPEG', 0, 0, 210, 297);
            }
            
            // 3. 添加附件页面 - 每张附件单独一页
            const allAttachments = editData.attachments || [];
            for (let i = 0; i < allAttachments.length; i++) {
                const attachment = allAttachments[i];
                pdf.addPage('a4', 'portrait');
                
                const portraitWidth = 210;
                const portraitHeight = 297;
                
                if (attachment.data) {
                    const img = new Image();
                    img.src = attachment.data;
                    await new Promise((resolve, reject) => { 
                        img.onload = resolve; 
                        img.onerror = reject;
                    });
                    
                    const imgRatio = img.width / img.height;
                    const pageRatio = portraitWidth / portraitHeight;
                    
                    let finalWidth, finalHeight, x, y;
                    
                    if (imgRatio > pageRatio) {
                        finalWidth = portraitWidth - 10;
                        finalHeight = finalWidth / imgRatio;
                        x = 5;
                        y = (portraitHeight - finalHeight) / 2;
                    } else {
                        finalHeight = portraitHeight - 10;
                        finalWidth = finalHeight * imgRatio;
                        x = (portraitWidth - finalWidth) / 2;
                        y = 5;
                    }
                    
                    pdf.addImage(attachment.data, 'JPEG', x, y, finalWidth, finalHeight);
                }
            }
            
            // 保存 PDF
            const fileName = `报销单_${editData.title || editData.id}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.pdf`;
            pdf.save(fileName);
            
        } catch (error) {
            console.error('PDF 生成失败:', error);
            alert('PDF 生成失败，请重试');
        } finally {
            setGenerating(false);
        }
    };

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
                <div className="flex gap-2">
                    {canEdit && (
                        <button onClick={handleSave} className="px-4 py-2 border border-slate-200 text-slate-600 rounded font-bold flex items-center gap-2 hover:bg-slate-50">
                            <Save size={16}/> 保存
                        </button>
                    )}
                    <button 
                        onClick={generatePDF} 
                        disabled={generating}
                        className="px-4 py-2 bg-indigo-600 text-white rounded font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Download size={16}/> {generating ? '生成中...' : '导出 PDF'}
                    </button>
                </div>
            </div>
            
            {/* 主内容区域 */}
            <div className="flex-1 overflow-hidden flex relative">
                {/* 伸缩按钮 - 始终可见，固定在左侧边线上 */}
                {canEdit && (
                    <button 
                        onClick={() => setEditPanelCollapsed(!editPanelCollapsed)}
                        className={`absolute top-8 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all z-50 ${editPanelCollapsed ? 'left-0 -translate-x-1/2' : 'left-80 -translate-x-1/2'}`}
                        style={{ transition: 'left 0.3s ease' }}
                        title={editPanelCollapsed ? "展开编辑面板" : "收起编辑面板"}
                    >
                        {editPanelCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                )}
                
                {/* 左侧编辑面板 - 仅在可编辑时显示，支持伸缩 */}
                {canEdit && (
                    <div className={`bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 transition-all duration-300 ${editPanelCollapsed ? 'w-0 overflow-hidden' : 'w-80'}`}>
                        {/* 编辑表单 - 收起时隐藏 */}
                        {!editPanelCollapsed && (
                            <div className="p-4 space-y-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
                                    <Edit2 size={14} className="text-indigo-600"/> 编辑报销单
                                </h3>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">报销单标题</label>
                                    <input 
                                        value={editData.title || ''} 
                                        onChange={e => setEditData({...editData, title: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">报销金额</label>
                                    <input 
                                        type="number"
                                        value={editData.totalAmount || 0} 
                                        onChange={e => setEditData({...editData, totalAmount: parseFloat(e.target.value) || 0})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">预支金额</label>
                                    <input 
                                        type="number"
                                        value={editData.prepaidAmount || 0} 
                                        onChange={e => setEditData({...editData, prepaidAmount: parseFloat(e.target.value) || 0})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">审批单号</label>
                                    <input 
                                        value={editData.approvalNumber || ''} 
                                        onChange={e => setEditData({...editData, approvalNumber: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                {editData.isTravel && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">出差事由</label>
                                        <textarea 
                                            value={editData.tripReason || ''} 
                                            onChange={e => setEditData({...editData, tripReason: e.target.value})}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                            rows={2}
                                        />
                                    </div>
                                )}
                                {/* 打车明细编辑 - 差旅报销时显示 */}
                                {editData.isTravel && (
                                    <div className="border-t border-slate-100 pt-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-slate-500">🚕 打车明细</label>
                                            <button
                                                onClick={() => {
                                                    const newDetail = { date: '', amount: 0, route: '', reason: editData.tripReason || '' };
                                                    setEditData({
                                                        ...editData, 
                                                        taxiDetails: [...(editData.taxiDetails || []), newDetail]
                                                    });
                                                }}
                                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                            >
                                                <Plus size={12}/> 添加
                                            </button>
                                        </div>
                                        {(editData.taxiDetails || []).length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-2">暂无打车明细，点击"添加"按钮添加</p>
                                        ) : (
                                            <>
                                                {editData.taxiDetails.map((taxi: any, idx: number) => (
                                                    <div key={idx} className="bg-yellow-50 rounded-lg p-2 mb-2 border border-yellow-200 relative">
                                                        <button
                                                            onClick={() => {
                                                                const details = editData.taxiDetails.filter((_: any, i: number) => i !== idx);
                                                                setEditData({...editData, taxiDetails: details});
                                                            }}
                                                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                                                        >
                                                            ×
                                                        </button>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <label className="text-slate-500">日期</label>
                                                                <input 
                                                                    type="date"
                                                                    value={taxi.date || ''} 
                                                                    onChange={e => {
                                                                        const details = [...editData.taxiDetails];
                                                                        details[idx].date = e.target.value;
                                                                        setEditData({...editData, taxiDetails: details});
                                                                    }}
                                                                    className="w-full p-1 border rounded text-xs"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-slate-500">金额</label>
                                                                <input 
                                                                    type="number"
                                                                    value={taxi.amount || 0} 
                                                                    onChange={e => {
                                                                        const details = [...editData.taxiDetails];
                                                                        details[idx].amount = parseFloat(e.target.value) || 0;
                                                                        setEditData({...editData, taxiDetails: details});
                                                                    }}
                                                                    className="w-full p-1 border rounded text-xs"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="mt-1">
                                                            <label className="text-slate-500 text-xs">起终点</label>
                                                            <input 
                                                                value={taxi.route || ''} 
                                                                onChange={e => {
                                                                    const details = [...editData.taxiDetails];
                                                                    details[idx].route = e.target.value;
                                                                    setEditData({...editData, taxiDetails: details});
                                                                }}
                                                                className="w-full p-1 border rounded text-xs"
                                                                placeholder="起点 → 终点"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                <p className="text-[10px] text-slate-500">
                                                    打车费总计: ¥{editData.taxiDetails.reduce((sum: number, t: any) => sum + (t.amount || 0), 0).toFixed(2)}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                                <div className="pt-4 border-t border-slate-100">
                                    <p className="text-xs text-slate-400">应付金额: ¥{((editData.totalAmount || 0) - (editData.prepaidAmount || 0)).toFixed(2)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {/* 右侧预览区域 */}
                <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8 print:p-0 print:overflow-visible print:gap-0">
                    {/* 报销单 */}
                    {(previewMode === 'all' || previewMode === 'report') && (
                        <div ref={reportRef} className="bg-white shadow-lg print:shadow-none">
                            {editData.isTravel ? <TravelReimbursementForm data={editData}/> : <GeneralReimbursementForm data={editData}/>}
                        </div>
                    )}
                    
                    {/* 差旅报销的打车行程表 */}
                    {(previewMode === 'all' || previewMode === 'report') && editData.isTravel && editData.taxiDetails && editData.taxiDetails.length > 0 && (
                        <div ref={taxiTableRef} className="bg-white shadow-lg print:shadow-none">
                            <TaxiExpenseTable data={{
                                createdDate: editData.createdDate,
                                userSnapshot: editData.userSnapshot,
                                tripReason: editData.tripReason,
                                taxiDetails: editData.taxiDetails,
                            }} />
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
        </div>
    );
};

// Add LoanDetailView - 借款单详情/编辑视图
const LoanDetailView = ({ loan, onUpdate, onBack }: any) => {
    const [generating, setGenerating] = useState(false);
    const [editData, setEditData] = useState({ ...loan });
    const canEdit = loan.status !== 'paid'; // 未完成借款时可编辑
    const [editPanelCollapsed, setEditPanelCollapsed] = useState(false); // 编辑面板伸缩状态
    const loanSheet1Ref = useRef<HTMLDivElement>(null);
    const loanSheet2Ref = useRef<HTMLDivElement>(null);
    
    // 保存编辑
    const handleSave = () => {
        if (onUpdate) {
            onUpdate(editData);
            alert('保存成功！');
        }
    };
    
    // 生成 PDF - 直接截取预览页面显示的内容（所见即所得），每联单独一页
    const generatePDF = async () => {
        if (generating) return;
        setGenerating(true);
        
        try {
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true // 启用压缩
            });
            
            const a4Width = 297;
            const a4Height = 210;
            
            // 截图函数 - 直接截取预览中显示的元素
            const captureElement = async (element: HTMLElement) => {
                const canvas = await html2canvas(element, {
                    scale: 1.5, // 降低分辨率以减小文件大小
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                });
                return canvas;
            };
            
            // 添加图片到 PDF，直接填满页面
            const addToPDF = (canvas: HTMLCanvasElement, isFirst: boolean) => {
                if (!isFirst) {
                    pdf.addPage('a4', 'landscape');
                }
                
                // 使用 JPEG 格式并压缩
                const imgData = canvas.toDataURL('image/jpeg', 0.85);
                
                // 直接填满整个 A4 页面
                pdf.addImage(imgData, 'JPEG', 0, 0, a4Width, a4Height);
            };
            
            // 1. 添加第一联：财务留存联
            if (loanSheet1Ref.current) {
                const canvas = await captureElement(loanSheet1Ref.current);
                addToPDF(canvas, true);
            }
            
            // 2. 添加第二联：员工留存联
            if (loanSheet2Ref.current) {
                const canvas = await captureElement(loanSheet2Ref.current);
                addToPDF(canvas, false);
            }
            
            // 3. 添加附件页面 - 每张附件单独一页
            const attachments = editData.attachments || [];
            for (let i = 0; i < attachments.length; i++) {
                const attachment = attachments[i];
                pdf.addPage('a4', 'portrait');
                
                const portraitWidth = 210;
                const portraitHeight = 297;
                
                if (attachment.data) {
                    const img = new Image();
                    img.src = attachment.data;
                    await new Promise((resolve, reject) => { 
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    
                    const imgRatio = img.width / img.height;
                    const pageRatio = portraitWidth / portraitHeight;
                    
                    let finalWidth, finalHeight, x, y;
                    
                    if (imgRatio > pageRatio) {
                        finalWidth = portraitWidth - 10;
                        finalHeight = finalWidth / imgRatio;
                        x = 5;
                        y = (portraitHeight - finalHeight) / 2;
                    } else {
                        finalHeight = portraitHeight - 10;
                        finalWidth = finalHeight * imgRatio;
                        x = (portraitWidth - finalWidth) / 2;
                        y = 5;
                    }
                    
                    pdf.addImage(attachment.data, 'JPEG', x, y, finalWidth, finalHeight);
                }
            }
            
            // 保存 PDF
            const fileName = `借款单_${editData.reason || editData.id}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.pdf`;
            pdf.save(fileName);
            
        } catch (error) {
            console.error('PDF 生成失败:', error);
            alert('PDF 生成失败，请重试');
        } finally {
            setGenerating(false);
        }
    };
    
    return (
        <div className="h-full flex flex-col bg-slate-100 -m-8">
            <div className="bg-white p-4 flex justify-between items-center shadow-sm print:hidden">
                <button onClick={onBack} className="flex items-center gap-1 font-bold text-slate-500"><ChevronRight className="rotate-180"/> 返回</button>
                <div className="flex gap-2">
                    {canEdit && (
                        <button onClick={handleSave} className="px-4 py-2 border border-slate-200 text-slate-600 rounded font-bold flex items-center gap-2 hover:bg-slate-50">
                            <Save size={16}/> 保存
                        </button>
                    )}
                    <button 
                        onClick={generatePDF} 
                        disabled={generating}
                        className="px-4 py-2 bg-amber-500 text-white rounded font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        <Download size={16}/> {generating ? '生成中...' : '导出 PDF'}
                    </button>
                </div>
            </div>
            {/* 主内容区域 */}
            <div className="flex-1 overflow-hidden flex relative">
                {/* 伸缩按钮 - 始终可见，固定在左侧边线上 */}
                {canEdit && (
                    <button 
                        onClick={() => setEditPanelCollapsed(!editPanelCollapsed)}
                        className={`absolute top-8 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all z-50 ${editPanelCollapsed ? 'left-0 -translate-x-1/2' : 'left-80 -translate-x-1/2'}`}
                        style={{ transition: 'left 0.3s ease' }}
                        title={editPanelCollapsed ? "展开编辑面板" : "收起编辑面板"}
                    >
                        {editPanelCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                )}
                
                {/* 左侧编辑面板 - 仅在可编辑时显示，支持伸缩 */}
                {canEdit && (
                    <div className={`bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 transition-all duration-300 ${editPanelCollapsed ? 'w-0 overflow-hidden' : 'w-80'}`}>
                        {/* 编辑表单 - 收起时隐藏 */}
                        {!editPanelCollapsed && (
                            <div className="p-4 space-y-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
                                    <Edit2 size={14} className="text-amber-500"/> 编辑借款单
                                </h3>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">借款金额</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                                        <input 
                                            type="number"
                                            value={editData.amount || 0} 
                                            onChange={e => setEditData({...editData, amount: parseFloat(e.target.value) || 0})}
                                            className="w-full pl-7 p-2 border border-slate-200 rounded-lg text-sm font-bold text-amber-600"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">大写：{digitToChinese(editData.amount || 0)}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">借款事由</label>
                                    <textarea 
                                        value={editData.reason || ''} 
                                        onChange={e => setEditData({...editData, reason: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">审批单号</label>
                                    <input 
                                        value={editData.approvalNumber || ''} 
                                        onChange={e => setEditData({...editData, approvalNumber: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">申请日期</label>
                                    <input 
                                        type="date"
                                        value={editData.date || ''} 
                                        onChange={e => setEditData({...editData, date: e.target.value})}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {/* 右侧预览区域 */}
                <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8 print:p-0 print:overflow-visible">
                    {/* 第一联：财务留存联 */}
                    <div ref={loanSheet1Ref} className="bg-white shadow-lg print:shadow-none">
                        <LoanFormSheet 
                            data={editData}
                            sheetNumber={1}
                            sheetName="第一联：财务留存联"
                            showNote={false}
                        />
                    </div>
                    
                    {/* 第二联：员工留存联 */}
                    <div ref={loanSheet2Ref} className="bg-white shadow-lg print:shadow-none">
                        <LoanFormSheet 
                            data={editData}
                            sheetNumber={2}
                            sheetName="第二联：员工留存联"
                            showNote={true}
                        />
                    </div>
                    
                    {/* 附件预览 */}
                    {editData.attachments && editData.attachments.length > 0 && (
                        <>
                            <h3 className="text-lg font-bold text-slate-700">附件资料</h3>
                            {editData.attachments.map((attachment: any, index: number) => (
                                <div key={index} className="bg-white shadow-lg print:shadow-none">
                                    <A4SingleAttachment 
                                        attachment={attachment} 
                                        title="审批单" 
                                        index={index}
                                    />
                                </div>
                            ))}
                        </>
                    )}
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
    // 管理员首次登录提示修改密码
    if (user.role === 'admin' && !hasChangedPassword) {
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
    // 使用后端返回的 role 字段，不再基于邮箱判断
    const userWithRole = {
      ...user,
      role: user.role || 'user'
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
