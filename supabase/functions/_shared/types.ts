export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'user'
export type ExpenseStatus = 'pending' | 'processing' | 'done'
export type ReportStatus = 'draft' | 'submitted' | 'paid'
export type AttachmentType = 'invoice' | 'approval' | 'voucher' | 'other' | 'ticket' | 'hotel' | 'taxi-invoice' | 'taxi-trip'
export type AIProvider = 'gemini' | 'deepseek' | 'minimax' | 'glm' | 'openai' | 'claude' | 'qwen' | 'moonshot' | 'doubao' | 'volcengine'

export interface Profile {
  id: string
  name: string
  department: string
  email: string
  role: UserRole
  is_current: boolean
  created_at: string
  updated_at: string
}

export interface PaymentAccount {
  id: string
  user_id: string
  bank_name: string
  bank_branch: string | null
  account_number: string
  account_name: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface BudgetProject {
  id: string
  user_id: string
  name: string
  code: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  user_id: string
  amount: string
  description: string
  date: string
  category: string
  remarks: string | null
  status: ExpenseStatus
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  user_id: string
  title: string
  created_date: string
  status: ReportStatus
  total_amount: string
  prepaid_amount: string
  payable_amount: string
  approval_number: string | null
  budget_project_id: string | null
  budget_project_data: Json | null
  payment_account_id: string | null
  payment_account_data: Json | null
  user_snapshot: Json
  invoice_count: number | null
  is_travel: boolean
  trip_reason: string | null
  trip_legs: Json | null
  taxi_details: Json | null
  ai_recognition_data: Json | null
  created_at: string
  updated_at: string
}

export interface ReportItem {
  id: string
  report_id: string
  expense_id: string | null
  amount: string
  description: string
  date: string
  category: string | null
  budget_project_data: Json | null
  created_at: string
}

export interface Attachment {
  id: string
  report_id: string | null
  loan_id: string | null
  type: AttachmentType
  storage_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  data: string | null
  name: string | null
  created_at: string
}

export interface Loan {
  id: string
  user_id: string
  amount: string
  reason: string
  date: string
  approval_number: string | null
  status: ReportStatus
  budget_project_id: string | null
  budget_project_data: Json | null
  payment_method: string
  payee_info: Json
  user_snapshot: Json
  created_at: string
  updated_at: string
}

export interface AIConfig {
  id: string
  user_id: string
  provider: AIProvider
  api_key: string
  api_url: string | null
  model: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TokenUsage {
  id: string
  user_id: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_cost: string
  output_cost: string
  total_cost: string
  cached: boolean
  operation: string | null
  created_at: string
}