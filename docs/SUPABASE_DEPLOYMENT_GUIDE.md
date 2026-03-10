# 易报销 Pro - Supabase 云服务部署指南

> 完整的生产环境部署流程，从零开始部署到 Supabase 云服务

---

## 目录

1. [前置准备](#1-前置准备)
2. [创建 Supabase 项目](#2-创建-supabase-项目)
3. [配置数据库](#3-配置数据库)
4. [配置 Storage](#4-配置-storage)
5. [配置前端环境变量](#5-配置前端环境变量)
6. [本地测试](#6-本地测试)
7. [部署前端](#7-部署前端)
8. [部署 Edge Functions（可选）](#8-部署-edge-functions可选)
9. [验证部署](#9-验证部署)
10. [常见问题](#10-常见问题)

---

## 1. 前置准备

### 1.1 需要的账户和工具

| 项目 | 说明 |
|------|------|
| GitHub 账户 | 用于代码托管和 Vercel/Netlify 部署 |
| Supabase 账户 | 免费注册 [supabase.com](https://supabase.com) |
| Node.js 18+ | 本地开发环境 |
| Supabase CLI | 可选，用于 Edge Functions 部署 |

### 1.2 安装 Supabase CLI（可选）

```bash
# macOS
brew install supabase/tap/supabase

# 或使用 NPM
npm install -g supabase

# 验证安装
supabase --version
```

---

## 2. 创建 Supabase 项目

### 2.1 注册并登录

1. 访问 [https://supabase.com](https://supabase.com)
2. 点击 "Start your project"
3. 使用 GitHub 账户登录（推荐）或邮箱注册

### 2.2 创建组织

1. 登录后点击 "New organization"
2. 填写组织名称，如：`My Company`
3. 选择计划：**Free**（免费层足够开发测试）

### 2.3 创建项目

1. 在组织中点击 "New project"
2. 填写项目信息：

   | 字段 | 值 |
   |------|-----|
   | Name | `yibaoxiao-pro` |
   | Database Password | **保存好密码！**（建议使用密码管理器） |
   | Region | `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)` |
   | Plan | Free |

3. 点击 "Create new project"
4. 等待约 2 分钟，项目创建完成

### 2.4 获取项目凭证

项目创建完成后：

1. 进入项目 Dashboard
2. 点击左侧菜单 **Settings** → **API**
3. 记录以下信息：

```
Project URL: https://xxxxxxxx.supabase.co
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（仅服务端使用，保密！）
```

---

## 3. 配置数据库

### 方式一：使用 Supabase CLI（推荐）

```bash
# 1. 进入项目目录
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao

# 2. 登录 Supabase
npx supabase login

# 3. 链接到远程项目
# 项目 ID 在 Dashboard URL 中：https://app.supabase.com/project/YOUR_PROJECT_ID
npx supabase link --project-ref YOUR_PROJECT_ID

# 4. 推送数据库 Schema
npx supabase db push

# 输出示例：
# Applying migration 001_initial_schema.sql...
# Success: Schema applied successfully
```

### 方式二：使用 SQL Editor

1. 在 Supabase Dashboard 中，点击左侧 **SQL Editor**
2. 点击 "New query"
3. 复制 `supabase/migrations/001_initial_schema.sql` 的全部内容
4. 粘贴到编辑器中
5. 点击 **Run** 执行

### 3.1 验证数据库

在 SQL Editor 中运行：

```sql
-- 检查表是否创建成功
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- 应该看到：profiles, expenses, reports, loans, payment_accounts, budget_projects, ai_configs, attachments, report_items, token_usage

-- 检查 RLS 是否启用
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';

-- 所有表的 rowsecurity 应该为 true
```

---

## 4. 配置 Storage

### 4.1 创建 Storage Bucket

1. 在 Dashboard 中，点击左侧 **Storage**
2. 点击 "New bucket"
3. 填写：
   - Name: `attachments`
   - Public bucket: **关闭**（保持私有）
4. 点击 "Create bucket"

### 4.2 配置 Storage 策略

数据库迁移脚本已自动创建 Storage 策略。如需手动验证：

1. 进入 Storage → `attachments` bucket
2. 点击 "Policies" 标签
3. 应该看到以下策略：
   - "用户可以上传自己的附件" (INSERT)
   - "用户可以查看自己的附件" (SELECT)
   - "用户可以删除自己的附件" (DELETE)

如果没有，在 SQL Editor 中运行：

```sql
-- Storage 策略（如果迁移脚本未执行）
CREATE POLICY "用户可以上传自己的附件"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "用户可以查看自己的附件"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "用户可以删除自己的附件"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 5. 配置前端环境变量

### 5.1 创建环境变量文件

```bash
# 进入前端目录
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao/frontend

# 创建 .env 文件
cat > .env << 'EOF'
# Supabase 配置
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key...

# AI 配置（可选，用于发票识别）
VITE_GEMINI_API_KEY=your-gemini-api-key
EOF
```

### 5.2 替换实际值

将以下占位符替换为实际值：

| 变量 | 获取位置 |
|------|----------|
| `YOUR_PROJECT_ID` | Supabase Dashboard → Settings → General → Reference ID |
| `anon-key` | Supabase Dashboard → Settings → API → anon public |
| `gemini-api-key` | [Google AI Studio](https://aistudio.google.com/app/apikey)（可选） |

### 5.3 验证配置

```bash
# 查看配置文件
cat .env

# 确保格式正确，没有多余空格或引号
```

---

## 6. 本地测试

### 6.1 安装依赖

```bash
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao/frontend
npm install
```

### 6.2 启动开发服务器

```bash
npm run dev
```

### 6.3 测试功能

访问 http://localhost:5173

测试清单：

- [ ] 打开页面无报错
- [ ] 点击注册，填写信息，提交
- [ ] 检查 Supabase Dashboard → Authentication → Users 是否有新用户
- [ ] 检查 Table Editor → profiles 是否有新记录
- [ ] 登录功能正常
- [ ] 创建费用记录
- [ ] 创建报销单并上传附件
- [ ] 检查 Storage → attachments 是否有文件

### 6.4 常见问题排查

**问题：无法连接 Supabase**

```bash
# 检查环境变量是否正确加载
# 在浏览器控制台输入：
console.log(import.meta.env.VITE_SUPABASE_URL)
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
```

**问题：RLS 策略阻止操作**

```sql
-- 临时禁用 RLS 测试（仅调试用）
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 测试后记得启用
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

**问题：认证邮件未收到**

1. Supabase 免费层默认关闭邮件发送
2. Dashboard → Authentication → Providers → Email → Confirm email → 关闭
3. 或配置自定义 SMTP 服务器

---

## 7. 部署前端

### 7.1 构建

```bash
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao/frontend

# 确保 .env 文件存在且配置正确
npm run build

# 构建产物在 dist/ 目录
```

### 7.2 部署选项

#### 选项 A：Vercel（推荐）

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao/frontend
vercel --prod

# 首次部署会提示配置：
# - Link to existing project? No
# - Project name: yibaoxiao-pro
# - Framework preset: Vite
# - Build command: npm run build
# - Output directory: dist
```

**在 Vercel Dashboard 配置环境变量**：

1. 进入项目 → Settings → Environment Variables
2. 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 重新部署

#### 选项 B：Netlify

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 初始化并部署
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao/frontend
netlify init
netlify deploy --prod --dir=dist
```

#### 选项 C：服务器静态托管

```bash
# 1. 构建
npm run build

# 2. 将 dist/ 目录上传到服务器
scp -r dist/* user@your-server:/var/www/yibaoxiao/

# 3. Nginx 配置
# /etc/nginx/sites-available/yibaoxiao
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/yibaoxiao;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 选项 D：GitHub Pages

```bash
# 1. 安装 gh-pages
npm install -D gh-pages

# 2. 在 package.json 中添加脚本
# "scripts": {
#   "deploy": "npm run build && gh-pages -d dist"
# }

# 3. 部署
npm run deploy
```

### 7.3 配置 Supabase 回调 URL

部署完成后，需要在 Supabase 中配置允许的域名：

1. Dashboard → Authentication → URL Configuration
2. Site URL: `https://your-domain.com`
3. Redirect URLs: 添加 `https://your-domain.com/**`

---

## 8. 部署 Edge Functions（可选）

如果需要使用 AI 识别等后端功能：

### 8.1 配置环境变量

在 Supabase Dashboard：

1. Settings → Edge Functions → Add secret
2. 添加：
   - `GEMINI_API_KEY` 或其他 AI API Key
   - `SUPABASE_URL`（自动设置）
   - `SUPABASE_SERVICE_ROLE_KEY`（自动设置）

### 8.2 部署函数

```bash
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao

# 登录（如果未登录）
npx supabase login

# 链接项目（如果未链接）
npx supabase link --project-ref YOUR_PROJECT_ID

# 部署单个函数
npx supabase functions deploy ai-recognize

# 或部署所有函数
npx supabase functions deploy
```

### 8.3 测试函数

```bash
# 测试 AI 识别函数
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/ai/recognize" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"images": ["base64-image-data"], "type": "invoice"}'
```

---

## 9. 验证部署

### 9.1 功能测试清单

| 功能 | 测试步骤 | 预期结果 |
|------|----------|----------|
| 用户注册 | 填写邮箱密码注册 | 收到确认邮件或直接登录 |
| 用户登录 | 使用注册信息登录 | 成功进入首页 |
| 创建费用 | 添加一条费用记录 | 显示在列表中 |
| 创建报销单 | 选择费用创建报销单 | 报销单创建成功 |
| 上传附件 | 上传发票图片 | 图片显示，Storage 有记录 |
| AI 识别 | 拍照识别发票 | 自动填充费用信息 |
| 用户设置 | 修改个人信息 | 保存成功 |

### 9.2 性能检查

```bash
# 使用 Lighthouse 检查性能
# 在 Chrome DevTools → Lighthouse

# 或使用 CLI
npx lighthouse https://your-domain.com --output html --output-path ./report.html
```

### 9.3 安全检查

1. 确认 `service_role` key 未暴露在前端代码中
2. 确认所有表都启用了 RLS
3. 确认 Storage bucket 是私有的
4. 检查 Supabase Dashboard → Logs → 无异常错误

---

## 10. 常见问题

### Q1: 前端报错 "Missing Supabase environment variables"

**原因**：环境变量未正确配置

**解决**：
```bash
# 检查 .env 文件是否存在
ls -la frontend/.env

# 确认变量名以 VITE_ 开头
grep VITE_ frontend/.env

# 重启开发服务器
npm run dev
```

### Q2: 注册后用户无法登录

**原因**：Supabase 默认需要邮箱确认

**解决**：
1. Dashboard → Authentication → Providers → Email
2. 关闭 "Confirm email" 选项
3. 或配置 SMTP 服务器发送邮件

### Q3: RLS 策略阻止数据访问

**原因**：用户未认证或策略配置错误

**解决**：
```sql
-- 检查当前用户
SELECT auth.uid();

-- 检查策略
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- 临时添加管理员策略测试
CREATE POLICY "临时全访问" ON profiles FOR ALL USING (true);
```

### Q4: Storage 上传失败

**原因**：Bucket 不存在或策略未配置

**解决**：
1. 确认 `attachments` bucket 已创建
2. 检查 Storage Policies
3. 确认用户已登录

### Q5: 构建后页面空白

**原因**：环境变量未注入构建产物

**解决**：
```bash
# 在部署平台（Vercel/Netlify）配置环境变量
# 或在构建时传入
VITE_SUPABASE_URL=https://xxx.supabase.co \
VITE_SUPABASE_ANON_KEY=eyJ... \
npm run build
```

### Q6: CORS 错误

**原因**：前端域名未在 Supabase 中配置

**解决**：
1. Dashboard → Authentication → URL Configuration
2. 添加前端域名到 "Site URL" 和 "Redirect URLs"

---

## 附录：环境变量参考

### 本地开发 (.env)

```env
# Supabase（必须）
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI 服务（可选）
VITE_GEMINI_API_KEY=AIza...
# 或
VITE_DEEPSEEK_API_KEY=sk-...
```

### Vercel 环境变量

在 Vercel Dashboard → Settings → Environment Variables 中配置：

| Name | Value | Environment |
|------|-------|-------------|
| VITE_SUPABASE_URL | https://xxx.supabase.co | Production, Preview, Development |
| VITE_SUPABASE_ANON_KEY | eyJhbG... | Production, Preview, Development |

### Supabase Edge Functions 环境变量

在 Supabase Dashboard → Settings → Edge Functions 中配置：

| Name | Value |
|------|-------|
| GEMINI_API_KEY | AIza... |
| DEEPSEEK_API_KEY | sk-... |

---

## 支持

- Supabase 文档：https://supabase.com/docs
- Supabase Discord：https://discord.supabase.com
- 项目 Issues：https://github.com/your-repo/yibaoxiao/issues

---

**最后更新**: 2026-03-10
**版本**: 1.0.0
