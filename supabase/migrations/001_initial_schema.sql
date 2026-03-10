-- Yibaoxiao Pro - Database Initialization Migration
-- Migration from Drizzle ORM to Supabase PostgreSQL

-- ==================== Enum Types ====================

CREATE TYPE expense_status AS ENUM ('pending', 'processing', 'done');

CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'paid');

CREATE TYPE user_role AS ENUM ('admin', 'user');

CREATE TYPE attachment_type AS ENUM (
  'invoice',
  'approval',
  'voucher',
  'other',
  'ticket',
  'hotel',
  'taxi-invoice',
  'taxi-trip'
);

CREATE TYPE ai_provider AS ENUM (
  'gemini', 'deepseek', 'minimax', 'glm', 'openai',
  'claude', 'qwen', 'moonshot', 'doubao', 'volcengine'
);

-- ==================== Profiles Table ====================

CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name text NOT NULL,
  department text NOT NULL,
  email text NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'user',
  is_current boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==================== Payment Accounts Table ====================

CREATE TABLE public.payment_accounts (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  bank_branch text,
  account_number text NOT NULL,
  account_name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER handle_payment_accounts_updated_at
  BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==================== Budget Projects Table ====================

CREATE TABLE public.budget_projects (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER handle_budget_projects_updated_at
  BEFORE UPDATE ON public.budget_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==================== Expenses Table ====================

CREATE TABLE public.expenses (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  description text NOT NULL,
  date text NOT NULL,
  category text NOT NULL,
  remarks text,
  status expense_status NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER handle_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==================== Reports Table ====================

CREATE TABLE public.reports (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_date text NOT NULL,
  status report_status NOT NULL DEFAULT 'draft',
  total_amount numeric(12, 2) NOT NULL,
  prepaid_amount numeric(12, 2) DEFAULT '0',
  payable_amount numeric(12, 2) NOT NULL,
  approval_number text,
  budget_project_id text,
  budget_project_data jsonb,
  payment_account_id text,
  payment_account_data jsonb,
  user_snapshot jsonb NOT NULL,
  invoice_count integer,
  is_travel boolean DEFAULT false,
  trip_reason text,
  trip_legs jsonb,
  taxi_details jsonb,
  ai_recognition_data jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER handle_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==================== Report Items Table ====================

CREATE TABLE public.report_items (
  id text PRIMARY KEY,
  report_id text NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  expense_id text,
  amount numeric(12, 2) NOT NULL,
  description text NOT NULL,
  date text NOT NULL,
  category text,
  budget_project_data jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==================== Attachments Table ====================

CREATE TABLE public.attachments (
  id text PRIMARY KEY,
  report_id text REFERENCES public.reports(id) ON DELETE CASCADE,
  loan_id text,
  type attachment_type NOT NULL,
  storage_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  data text,
  name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==================== Loans Table ====================

CREATE TABLE public.loans (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  reason text NOT NULL,
  date text NOT NULL,
  approval_number text,
  status report_status NOT NULL DEFAULT 'draft',
  budget_project_id text,
  budget_project_data jsonb,
  payment_method text DEFAULT 'transfer',
  payee_info jsonb NOT NULL,
  user_snapshot jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_loan_id_fkey
  FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;

CREATE TRIGGER handle_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==================== AI Configs Table ====================

CREATE TABLE public.ai_configs (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider ai_provider NOT NULL,
  api_key text NOT NULL,
  api_url text,
  model text,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER handle_ai_configs_updated_at
  BEFORE UPDATE ON public.ai_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==================== Token Usage Table ====================

CREATE TABLE public.token_usage (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  total_tokens integer NOT NULL,
  input_cost numeric(12, 6) NOT NULL,
  output_cost numeric(12, 6) NOT NULL,
  total_cost numeric(12, 6) NOT NULL,
  cached boolean DEFAULT false,
  operation text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==================== Indexes ====================

CREATE INDEX idx_payment_accounts_user_id ON public.payment_accounts(user_id);
CREATE INDEX idx_budget_projects_user_id ON public.budget_projects(user_id);
CREATE INDEX idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_reports_user_id ON public.reports(user_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_report_items_report_id ON public.report_items(report_id);
CREATE INDEX idx_attachments_report_id ON public.attachments(report_id);
CREATE INDEX idx_attachments_loan_id ON public.attachments(loan_id);
CREATE INDEX idx_loans_user_id ON public.loans(user_id);
CREATE INDEX idx_ai_configs_user_id ON public.ai_configs(user_id);
CREATE INDEX idx_token_usage_user_id ON public.token_usage(user_id);

-- ==================== RLS Policies ====================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_owner(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() = check_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Payment accounts policy
CREATE POLICY "Users manage own payment accounts"
  ON public.payment_accounts FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- Budget projects policy
CREATE POLICY "Users manage own budget projects"
  ON public.budget_projects FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- Expenses policy
CREATE POLICY "Users manage own expenses"
  ON public.expenses FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- Reports policy
CREATE POLICY "Users manage own reports"
  ON public.reports FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- Report items policy
CREATE POLICY "Users manage own report items"
  ON public.report_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reports
      WHERE reports.id = report_items.report_id
      AND (reports.user_id = auth.uid() OR public.is_admin())
    )
  );

-- Attachments policy
CREATE POLICY "Users manage own attachments"
  ON public.attachments FOR ALL
  USING (
    (report_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.reports
      WHERE reports.id = attachments.report_id
      AND (reports.user_id = auth.uid() OR public.is_admin())
    ))
    OR
    (loan_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.loans
      WHERE loans.id = attachments.loan_id
      AND (loans.user_id = auth.uid() OR public.is_admin())
    ))
  );

-- Loans policy
CREATE POLICY "Users manage own loans"
  ON public.loans FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- AI configs policy
CREATE POLICY "Users manage own ai configs"
  ON public.ai_configs FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- Token usage policy
CREATE POLICY "Users view own token usage"
  ON public.token_usage FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- ==================== Storage ====================

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ==================== User Creation Trigger ====================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, department, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'department', 'Unassigned'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
