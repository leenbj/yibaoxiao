-- 易报销 Pro - 数据库初始化脚本
-- 用于首次部署时初始化数据库和超级管理员
-- 
-- 使用方法：
-- psql -U yibao -d yibao -f init-db.sql
-- 或在 Docker 环境中自动执行

-- ==================== 枚举类型 ====================
-- 注意：如果枚举已存在会报错，生产环境建议使用 drizzle-kit push

DO $$ 
BEGIN
    -- 费用状态枚举
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_status') THEN
        CREATE TYPE expense_status AS ENUM ('pending', 'processing', 'done');
    END IF;
    
    -- 报销单/借款状态枚举
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'paid');
    END IF;
    
    -- 用户角色枚举
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'user');
    END IF;
    
    -- 附件类型枚举
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attachment_type') THEN
        CREATE TYPE attachment_type AS ENUM ('invoice', 'approval', 'voucher', 'other');
    END IF;
    
    -- AI 厂商枚举
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_provider') THEN
        CREATE TYPE ai_provider AS ENUM (
            'gemini', 'deepseek', 'minimax', 'glm', 'openai', 
            'claude', 'qwen', 'moonshot', 'doubao', 'volcengine'
        );
    END IF;
END $$;

-- ==================== 用户表 ====================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'user',
    password TEXT,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== 收款账户表 ====================
CREATE TABLE IF NOT EXISTS payment_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    bank_branch TEXT,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== 预算项目表 ====================
CREATE TABLE IF NOT EXISTS budget_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== 费用记录表 ====================
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    remarks TEXT,
    status expense_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== 报销单表 ====================
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_date TEXT NOT NULL,
    status report_status NOT NULL DEFAULT 'draft',
    total_amount NUMERIC(12, 2) NOT NULL,
    prepaid_amount NUMERIC(12, 2) DEFAULT 0,
    payable_amount NUMERIC(12, 2) NOT NULL,
    approval_number TEXT,
    budget_project_id TEXT,
    budget_project_data JSONB,
    payment_account_id TEXT,
    payment_account_data JSONB,
    user_snapshot JSONB NOT NULL,
    invoice_count INTEGER,
    is_travel BOOLEAN DEFAULT FALSE,
    trip_reason TEXT,
    trip_legs JSONB,
    taxi_details JSONB,
    ai_recognition_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== 报销单关联费用项表 ====================
CREATE TABLE IF NOT EXISTS report_items (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    expense_id TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT,
    budget_project_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== 附件表 ====================
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    report_id TEXT REFERENCES reports(id) ON DELETE CASCADE,
    loan_id TEXT,
    type attachment_type NOT NULL,
    data TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== 借款单表 ====================
CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    date TEXT NOT NULL,
    approval_number TEXT,
    status report_status NOT NULL DEFAULT 'draft',
    budget_project_id TEXT,
    budget_project_data JSONB,
    payment_method TEXT DEFAULT 'transfer',
    payee_info JSONB NOT NULL,
    user_snapshot JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 添加外键约束（附件表关联借款单）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'attachments_loan_id_fkey'
    ) THEN
        ALTER TABLE attachments 
        ADD CONSTRAINT attachments_loan_id_fkey 
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ==================== AI 配置表 ====================
CREATE TABLE IF NOT EXISTS ai_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider ai_provider NOT NULL,
    api_key TEXT NOT NULL,
    api_url TEXT,
    model TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== Token 使用记录表 ====================
CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    input_cost NUMERIC(12, 6) NOT NULL,
    output_cost NUMERIC(12, 6) NOT NULL,
    total_cost NUMERIC(12, 6) NOT NULL,
    cached BOOLEAN DEFAULT FALSE,
    operation TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== 索引优化 ====================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_ai_configs_user_id ON ai_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);

-- ==================== 初始化超级管理员 ====================
-- 默认管理员账号：wangbo@knet.cn / 123456
-- 可通过环境变量 ADMIN_EMAIL, ADMIN_PASSWORD 覆盖

INSERT INTO users (id, name, department, email, role, password, is_current, created_at, updated_at)
VALUES (
    'user_wangbo',
    '王波',
    '管理部',
    'wangbo@knet.cn',
    'admin',
    '123456',
    FALSE,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    updated_at = NOW();

-- 为管理员创建默认收款账户
INSERT INTO payment_accounts (id, user_id, bank_name, bank_branch, account_number, account_name, is_default, created_at, updated_at)
VALUES (
    'pa_wangbo_default',
    'user_wangbo',
    '中国工商银行',
    '北京分行',
    '6222000000000000000',
    '王波',
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 为管理员创建默认预算项目
INSERT INTO budget_projects (id, user_id, name, code, is_default, created_at, updated_at)
VALUES (
    'bp_wangbo_default',
    'user_wangbo',
    '日常运营费用',
    'OP001',
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ==================== 完成 ====================
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '超级管理员账号: wangbo@knet.cn';
    RAISE NOTICE '默认密码: 123456';
END $$;



