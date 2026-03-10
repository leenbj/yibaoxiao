# 易报销 Pro - AI 驱动的财务报销系统

一个使用 **Supabase Cloud** 作为后端的智能财务报销系统，支持 AI 自动识别发票、审批单，简化报销流程。

## 功能特性

- **记账本** - 快速记录待报销费用
- **语音录入** - AI 识别语音自动填写
- **通用报销** - 上传发票/审批单，AI 自动识别
- **差旅报销** - 差旅费用专项报销
- **借款申请** - 预借款申请管理
- **历史记录** - 查看所有报销/借款记录
- **数据统计** - 各时期报销数据分析
- **系统设置** - 用户、收款人、预算项目管理

## 技术栈

- **后端**: Supabase Cloud (PostgreSQL + Auth + Storage)
- **前端**: React + Vite + Tailwind CSS
- **AI**: 支持多种 AI 模型 (Gemini, DeepSeek, 豆包, GLM 等)
- **部署**: Docker + GitHub Actions

## 项目结构

```
yibaoxiao/
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── api/           # Supabase API 客户端
│   │   ├── components/    # React 组件
│   │   ├── hooks/         # React Hooks
│   │   └── lib/           # 工具库
│   └── package.json
│
├── supabase/              # Supabase 配置
│   ├── migrations/        # 数据库迁移
│   └── config.toml        # Supabase 配置
│
├── docs/                  # 文档
├── scripts/               # 部署脚本
└── package.json
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/leenbj/yibaoxiao.git
cd yibaoxiao
```

### 2. 安装前端依赖

```bash
cd frontend
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

## 部署

### GitHub Actions 自动部署

1. 在 GitHub 仓库 Settings → Secrets 中配置：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`（服务器部署）

2. 推送代码到 main 分支自动触发构建

### Docker 部署

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=eyJ... \
  -f Dockerfile.frontend \
  -t yibaoxiao-frontend .
```

## Supabase 配置

详细配置说明请查看 [docs/SUPABASE_DEPLOYMENT_GUIDE.md](docs/SUPABASE_DEPLOYMENT_GUIDE.md)

### 数据库迁移

```bash
# 链接项目
npx supabase link --project-ref your-project-id

# 推送数据库 Schema
npx supabase db push
```

## API 概览

前端通过 `supabase-client.ts` 直接调用 Supabase API：

| 功能 | 函数 |
|------|------|
| 用户注册 | `register(email, password, name, department)` |
| 用户登录 | `login(email, password)` |
| 费用管理 | `getExpenses()`, `createExpense()`, `updateExpense()` |
| 报销单 | `getReports()`, `createReport()`, `updateReportStatus()` |
| 借款 | `getLoans()`, `createLoan()`, `updateLoanStatus()` |
| 文件上传 | `supabase.storage.from('attachments').upload()` |

## 开发命令

```bash
# 前端开发
cd frontend && npm run dev

# 构建生产版本
cd frontend && npm run build

# 数据库迁移
npx supabase db push

# 查看数据库差异
npx supabase db diff
```

## 许可证

MIT License

---

**易报销 Pro** - 让报销更简单！
