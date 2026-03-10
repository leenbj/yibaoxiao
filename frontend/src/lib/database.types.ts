export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          department: string
          email: string
          role: 'admin' | 'user'
          is_current: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          department: string
          email: string
          role?: 'admin' | 'user'
          is_current?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          department?: string
          email?: string
          role?: 'admin' | 'user'
          is_current?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
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
        Insert: {
          id: string
          user_id: string
          bank_name: string
          bank_branch?: string | null
          account_number: string
          account_name: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bank_name?: string
          bank_branch?: string | null
          account_number?: string
          account_name?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_projects: {
        Row: {
          id: string
          user_id: string
          name: string
          code: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          name: string
          code: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          code?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          amount: string
          description: string
          date: string
          category: string
          remarks: string | null
          status: 'pending' | 'processing' | 'done'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          amount: string
          description: string
          date: string
          category: string
          remarks?: string | null
          status?: 'pending' | 'processing' | 'done'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: string
          description?: string
          date?: string
          category?: string
          remarks?: string | null
          status?: 'pending' | 'processing' | 'done'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          id: string
          user_id: string
          title: string
          created_date: string
          status: 'draft' | 'submitted' | 'paid'
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
        Insert: {
          id: string
          user_id: string
          title: string
          created_date: string
          status?: 'draft' | 'submitted' | 'paid'
          total_amount: string
          prepaid_amount?: string
          payable_amount: string
          approval_number?: string | null
          budget_project_id?: string | null
          budget_project_data?: Json | null
          payment_account_id?: string | null
          payment_account_data?: Json | null
          user_snapshot: Json
          invoice_count?: number | null
          is_travel?: boolean
          trip_reason?: string | null
          trip_legs?: Json | null
          taxi_details?: Json | null
          ai_recognition_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          created_date?: string
          status?: 'draft' | 'submitted' | 'paid'
          total_amount?: string
          prepaid_amount?: string
          payable_amount?: string
          approval_number?: string | null
          budget_project_id?: string | null
          budget_project_data?: Json | null
          payment_account_id?: string | null
          payment_account_data?: Json | null
          user_snapshot?: Json
          invoice_count?: number | null
          is_travel?: boolean
          trip_reason?: string | null
          trip_legs?: Json | null
          taxi_details?: Json | null
          ai_recognition_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_items: {
        Row: {
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
        Insert: {
          id: string
          report_id: string
          expense_id?: string | null
          amount: string
          description: string
          date: string
          category?: string | null
          budget_project_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          expense_id?: string | null
          amount?: string
          description?: string
          date?: string
          category?: string | null
          budget_project_data?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          id: string
          report_id: string | null
          loan_id: string | null
          type: 'invoice' | 'approval' | 'voucher' | 'other' | 'ticket' | 'hotel' | 'taxi-invoice' | 'taxi-trip'
          storage_path: string | null
          file_name: string | null
          file_size: number | null
          mime_type: string | null
          data: string | null
          name: string | null
          created_at: string
        }
        Insert: {
          id: string
          report_id?: string | null
          loan_id?: string | null
          type: 'invoice' | 'approval' | 'voucher' | 'other' | 'ticket' | 'hotel' | 'taxi-invoice' | 'taxi-trip'
          storage_path?: string | null
          file_name?: string | null
          file_size?: number | null
          mime_type?: string | null
          data?: string | null
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string | null
          loan_id?: string | null
          type?: 'invoice' | 'approval' | 'voucher' | 'other' | 'ticket' | 'hotel' | 'taxi-invoice' | 'taxi-trip'
          storage_path?: string | null
          file_name?: string | null
          file_size?: number | null
          mime_type?: string | null
          data?: string | null
          name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          id: string
          user_id: string
          amount: string
          reason: string
          date: string
          approval_number: string | null
          status: 'draft' | 'submitted' | 'paid'
          budget_project_id: string | null
          budget_project_data: Json | null
          payment_method: string
          payee_info: Json
          user_snapshot: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          amount: string
          reason: string
          date: string
          approval_number?: string | null
          status?: 'draft' | 'submitted' | 'paid'
          budget_project_id?: string | null
          budget_project_data?: Json | null
          payment_method?: string
          payee_info: Json
          user_snapshot: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: string
          reason?: string
          date?: string
          approval_number?: string | null
          status?: 'draft' | 'submitted' | 'paid'
          budget_project_id?: string | null
          budget_project_data?: Json | null
          payment_method?: string
          payee_info?: Json
          user_snapshot?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_configs: {
        Row: {
          id: string
          user_id: string
          provider: 'gemini' | 'deepseek' | 'minimax' | 'glm' | 'openai' | 'claude' | 'qwen' | 'moonshot' | 'doubao' | 'volcengine'
          api_key: string
          api_url: string | null
          model: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          provider: 'gemini' | 'deepseek' | 'minimax' | 'glm' | 'openai' | 'claude' | 'qwen' | 'moonshot' | 'doubao' | 'volcengine'
          api_key: string
          api_url?: string | null
          model?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: 'gemini' | 'deepseek' | 'minimax' | 'glm' | 'openai' | 'claude' | 'qwen' | 'moonshot' | 'doubao' | 'volcengine'
          api_key?: string
          api_url?: string | null
          model?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      token_usage: {
        Row: {
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
        Insert: {
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
          cached?: boolean
          operation?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          model?: string
          input_tokens?: number
          output_tokens?: number
          total_tokens?: number
          input_cost?: string
          output_cost?: string
          total_cost?: string
          cached?: boolean
          operation?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_owner: {
        Args: { user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      expense_status: 'pending' | 'processing' | 'done'
      report_status: 'draft' | 'submitted' | 'paid'
      user_role: 'admin' | 'user'
      attachment_type: 'invoice' | 'approval' | 'voucher' | 'other' | 'ticket' | 'hotel' | 'taxi-invoice' | 'taxi-trip'
      ai_provider: 'gemini' | 'deepseek' | 'minimax' | 'glm' | 'openai' | 'claude' | 'qwen' | 'moonshot' | 'doubao' | 'volcengine'
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
