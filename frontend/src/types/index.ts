/**
 * 易报销系统 - 类型定义
 * 包含所有共享的TypeScript接口和类型
 */

// ==================== 基础类型 ====================

/**
 * 费用状态
 * - pending: 未报销
 * - processing: 报销中
 * - done: 已报销
 */
export type ExpenseStatus = "pending" | "processing" | "done";

/**
 * 报销单/借款单状态
 * - draft: 未打印（草稿）
 * - submitted: 报销中（已提交）
 * - paid: 已报销（已完成）
 */
export type ReportStatus = "draft" | "submitted" | "paid";

// ==================== 用户相关 ====================

/**
 * 预算项目
 */
export interface BudgetProject {
  id: string;
  name: string;
  code: string;
  isDefault?: boolean;
}

/**
 * 收款账户
 */
export interface PaymentAccount {
  id: string;
  bankName: string;
  bankBranch?: string;
  accountNumber: string;
  accountName: string; // 账户持有人姓名
  isDefault: boolean;
}

/**
 * 应用用户
 */
export interface AppUser {
  id: string;
  name: string;
  department: string;
  email: string;
  role: 'admin' | 'user';
  isCurrent?: boolean;
}

/**
 * 用户设置（包含用户、预算项目、收款账户）
 */
export interface UserSettings {
  currentUser: AppUser;
  users: AppUser[];
  budgetProjects: BudgetProject[];
  paymentAccounts: PaymentAccount[];
  // 向后兼容旧属性名
  payees?: PaymentAccount[];
  projects?: BudgetProject[];
}

// ==================== 费用相关 ====================

/**
 * 费用项目
 */
export interface ExpenseItem {
  id: string;
  userId?: string; // 关联用户ID（可选）
  amount: number;
  description: string;
  date: string; // ISO日期字符串
  category: string;
  remarks?: string;
  status: ExpenseStatus;
}

/**
 * 附件
 */
export interface Attachment {
  type: 'invoice' | 'approval' | 'voucher' | 'other';
  data: string; // base64编码的图片
  name?: string;
}

// ==================== 差旅相关 ====================

/**
 * 出租车明细
 */
export interface TaxiDetail {
  date: string;
  reason: string;
  startPoint: string;
  endPoint: string;
  amount: number;
  employeeName: string;
}

/**
 * 出租车明细项（表单使用）
 */
export interface TaxiDetailItem extends TaxiDetail {
  id?: string;
}

/**
 * 差旅行程段
 */
export interface TripLeg {
  dateRange: string; // 例如：2023.7.29-8.1
  route: string; // 例如：北京-成都

  // 交通费用
  transportFee: number;

  // 住宿费用
  hotelLocation: string; // 地区
  hotelDays: number;    // 天数
  hotelFee: number;     // 金额

  // 其他费用
  cityTrafficFee: number; // 市内交通
  mealFee: number;        // 餐费
  otherFee: number;       // 其他

  subTotal: number; // 小计
}

// ==================== 报销单相关 ====================

/**
 * 报销单
 */
export interface Report {
  id: string;
  title: string; // 发票内容（事项）
  createdDate: string;
  status: ReportStatus;
  totalAmount: number;
  prepaidAmount: number; // 预支借款抵扣
  payableAmount: number; // 应付金额
  items: ExpenseItem[]; // 费用明细
  approvalNumber?: string; // 审批单号
  budgetProject?: BudgetProject;
  paymentAccount?: PaymentAccount;
  attachments: Attachment[];
  userSnapshot: AppUser; // 用户快照

  // 表单特定字段
  invoiceCount?: number; // 发票数量

  // AI识别数据（存储原始AI识别结果用于编辑）
  aiRecognitionData?: {
    invoiceDetails?: any[];
    approvalData?: any;
    tripLegs?: any[];
    taxiDetails?: any[];
  };

  // 差旅特定字段
  isTravel?: boolean;
  tripReason?: string;
  tripLegs?: TripLeg[];
  taxiDetails?: TaxiDetailItem[];
}

// ==================== 借款相关 ====================

/**
 * 借款记录
 */
export interface LoanRecord {
  id: string;
  amount: number;
  reason: string; // 借款事由（最多20字）
  date: string; // 申请日期
  approvalNumber?: string; // 审批单号
  status: ReportStatus;
  budgetProject?: BudgetProject;
  attachments: Attachment[];
  paymentMethod: "transfer"; // 付款方式（目前仅支持转账）
  payeeInfo: PaymentAccount; // 收款人信息
  userSnapshot: AppUser; // 用户快照
}

// ==================== 组件Props类型 ====================

/**
 * 登录视图Props
 */
export interface LoginViewProps {
  onLogin: (user: AppUser, token: string) => void;
}

/**
 * 主应用Props
 */
export interface MainAppProps {
  user: AppUser;
  onLogout: () => void;
}

/**
 * 概览视图Props
 */
export interface OverviewViewProps {
  expenses: ExpenseItem[];
  reports: Report[];
  loans: LoanRecord[];
  onNavigate: (view: ViewType) => void;
}

/**
 * 视图类型（在此定义以供Props使用）
 */
export type ViewType = 'dashboard' | 'ledger' | 'record' | 'create' | 'create-travel'
  | 'loan' | 'history' | 'settings' | 'report-detail' | 'loan-detail' | 'profile' | 'login';

/**
 * 账本视图Props
 */
export interface LedgerViewProps {
  expenses: ExpenseItem[];
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  onAdd?: (expense: ExpenseItem) => Promise<void>;
  onBack?: () => void;
}

/**
 * 记账视图Props
 */
export interface RecordViewProps {
  onSave: (expense: ExpenseItem) => void;
  onBack: () => void;
}

/**
 * 创建报销单视图Props
 */
export interface CreateReportViewProps {
  settings: UserSettings;
  expenses: ExpenseItem[];
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  loans: LoanRecord[];
  onAction: (report: Report, action: 'save' | 'print') => Promise<void>;
  onBack: () => void;
}

/**
 * 借款视图Props
 */
export interface LoanViewProps {
  settings: UserSettings;
  onAction: (loan: LoanRecord, action: 'save' | 'print') => void;
  onBack: () => void;
}

/**
 * 历史记录视图Props
 */
export interface HistoryViewProps {
  reports: Report[];
  loans: LoanRecord[];
  onDelete: (id: string, type: 'report' | 'loan') => void;
  onComplete: (id: string, type: 'report' | 'loan') => void;
  onSelect: (id: string, type: 'report' | 'loan') => void;
}

/**
 * 个人设置视图Props
 */
export interface ProfileViewProps {
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
}

/**
 * 系统设置视图Props
 */
export interface SettingsViewProps {
  settings: UserSettings;
  onUpdate: React.Dispatch<React.SetStateAction<UserSettings>>;
  onNavigate: (view: ViewType) => void;
}

/**
 * 创建差旅报销单视图Props
 */
export interface CreateTravelReportViewProps {
  settings: UserSettings;
  loans: LoanRecord[];
  onAction: (report: Report, action: 'save' | 'print') => void;
  onBack: () => void;
}

/**
 * 报销单详情视图Props
 */
export interface ReportDetailViewProps {
  report: Report;
  onUpdate: (report: Report) => void;
  onBack: () => void;
}

/**
 * 借款详情视图Props
 */
export interface LoanDetailViewProps {
  loan: LoanRecord;
  onUpdate: (loan: LoanRecord) => void;
  onBack: () => void;
}
