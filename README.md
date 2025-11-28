# 易报销 Pro - AI 驱动的财务报销系统

一个使用 **Motia 框架** 构建的智能财务报销系统，支持 AI 自动识别发票、审批单，简化报销流程。

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

- **后端**: Motia 框架 (Node.js + TypeScript)
- **前端**: React + Vite + Tailwind CSS
- **数据库**: PostgreSQL
- **AI**: 支持多种 AI 模型 (Gemini, DeepSeek, 豆包, GLM 等)
- **部署**: Docker + Docker Compose

## 📦 项目结构

```
yibao/
├── frontend/               # 前端代码
│   ├── index.html
│   ├── index.tsx           # React 应用入口
│   └── src/
│       └── api/
│           └── client.ts   # API 客户端
│
├── steps/                  # Motia Steps (后端 API)
│   └── reimbursement/      # 报销系统模块
│       ├── types/          # 类型定义
│       ├── auth/           # 用户认证
│       ├── user/           # 用户管理
│       ├── expenses/       # 费用记账
│       ├── reports/        # 报销单
│       ├── loans/          # 借款
│       ├── settings/       # 系统设置
│       │   ├── payees/     # 收款人
│       │   └── projects/   # 预算项目
│       ├── ai/             # AI 识别
│       └── statistics/     # 统计
│
├── middlewares/            # 中间件
├── motia.config.ts         # Motia 配置
└── package.json
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端服务

```bash
npm run dev
```

后端服务启动后：
- API 服务: http://localhost:3000
- Motia Workbench: http://localhost:3000 (可视化工作流)

### 3. 启动前端（可选）

前端目前使用独立运行模式，直接在浏览器打开 `frontend/index.html` 即可使用。

如果需要连接后端 API，请确保后端服务已启动。

## 📡 API 接口列表

### 用户认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |

### 用户管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/profile?userId=xxx` | 获取用户配置 |
| PUT | `/api/user/profile` | 更新用户信息 |

### 费用记账
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/expenses?userId=xxx` | 获取费用列表 |
| POST | `/api/expenses` | 创建费用记录 |
| PUT | `/api/expenses/:id` | 更新费用记录 |
| DELETE | `/api/expenses/:id?userId=xxx` | 删除费用记录 |

### 报销单
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports?userId=xxx` | 获取报销单列表 |
| POST | `/api/reports` | 创建报销单 |
| GET | `/api/reports/:id?userId=xxx` | 获取报销单详情 |
| PUT | `/api/reports/:id` | 更新报销单 |
| PATCH | `/api/reports/:id/status` | 更新报销单状态 |

### 借款
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/loans?userId=xxx` | 获取借款列表 |
| POST | `/api/loans` | 创建借款申请 |
| GET | `/api/loans/:id?userId=xxx` | 获取借款详情 |
| PATCH | `/api/loans/:id/status` | 更新借款状态 |

### 收款人设置
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings/payees?userId=xxx` | 获取收款人列表 |
| POST | `/api/settings/payees` | 创建收款人 |
| PUT | `/api/settings/payees/:id` | 更新收款人 |
| DELETE | `/api/settings/payees/:id?userId=xxx` | 删除收款人 |

### 预算项目设置
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings/projects?userId=xxx` | 获取预算项目列表 |
| POST | `/api/settings/projects` | 创建预算项目 |
| PUT | `/api/settings/projects/:id` | 更新预算项目 |
| DELETE | `/api/settings/projects/:id?userId=xxx` | 删除预算项目 |

### AI 识别
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/recognize` | AI 识别发票/审批单 |

### 统计
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/statistics/overview?userId=xxx&period=6m` | 获取统计概览 |

## 🔧 开发命令

```bash
# 启动开发服务器
npm run dev

# 生成 TypeScript 类型
npm run generate-types

# 构建生产版本
npm run build

# 清理项目
npm run clean
```

## 🤖 配置 AI 识别

系统支持使用 Google Gemini API 进行智能发票/审批单识别。

### 获取 API Key

1. 访问 https://makersuite.google.com/app/apikey
2. 登录 Google 账号
3. 创建 API Key

### 配置 API Key

在项目根目录创建 `.env` 文件：

```bash
# Google Gemini API Key
GEMINI_API_KEY=your_api_key_here
```

然后重启后端服务：

```bash
npm run dev
```

> **注意**: 如果没有配置 API Key，AI 识别功能会返回模拟数据，不影响其他功能使用。

## 🔗 前后端集成

### 前端 API 调用

前端通过 `frontend/src/api/` 目录下的文件调用后端 API：

- `client.ts` - 基础 API 客户端，封装所有接口调用
- `hooks.ts` - React Hooks，提供响应式数据管理

### 使用示例

```typescript
import { useAuth, useExpenses } from './src/api/hooks'

function MyComponent() {
  // 用户认证
  const { user, login, logout } = useAuth()
  
  // 费用管理（自动获取当前用户的费用）
  const { expenses, add, delete: deleteExpense } = useExpenses(user?.id)
  
  // 添加费用
  const handleAdd = async () => {
    await add({
      amount: 100,
      description: '午餐',
      date: new Date().toISOString(),
      category: '餐饮'
    })
  }
  
  return (
    <div>
      {/* 渲染费用列表 */}
      {expenses.map(e => <div key={e.id}>{e.description}: ¥{e.amount}</div>)}
    </div>
  )
}
```

### 集成版前端入口

查看 `frontend/app.tsx` 获取完整的前后端集成示例，包括：

- 用户登录/注册
- 费用记录管理
- 统计数据展示
- AI 识别测试

## 🚀 服务器部署

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                       服务器                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Frontend   │  │   Backend   │  │   PostgreSQL    │  │
│  │  (Nginx)    │──│   (Motia)   │──│   (Database)    │  │
│  │  :80        │  │   :3000     │  │   :5432         │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 部署步骤

**步骤 1：创建目录**

```bash
mkdir -p /root/yibaoxiao && cd /root/yibaoxiao
```

**步骤 2：下载配置文件**

```bash
curl -O https://raw.githubusercontent.com/leenbj/yibaoxiao/main/docker-compose.prod.yml
curl -O https://raw.githubusercontent.com/leenbj/yibaoxiao/main/.env.production
mv docker-compose.prod.yml docker-compose.yml
mv .env.production .env
```

**步骤 3：编辑配置**

```bash
nano .env
```

修改以下配置项：
- `POSTGRES_PASSWORD` - 数据库密码
- `ADMIN_EMAIL` - 管理员邮箱
- `ADMIN_PASSWORD` - 管理员密码
- `DEFAULT_AI_API_KEY` - AI API密钥（可选）

**步骤 4：拉取镜像**

```bash
docker-compose pull
```

**步骤 5：启动服务**

```bash
docker-compose up -d
```

**步骤 6：查看启动进度**

```bash
docker-compose logs -f backend
```

等待看到 `✓ [SUCCESS] Build completed` 后，服务即可访问。

**首次启动需要 3-5 分钟**（Motia 运行时构建），后续重启只需几秒钟。

### 访问系统

- 访问地址：`http://服务器IP`
- 管理员账号：配置文件中设置的 `ADMIN_EMAIL`

### 常用命令

```bash
cd /root/yibaoxiao

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f backend

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新到最新版本
docker-compose pull && docker-compose up -d
```

### 数据备份

```bash
# 备份数据库
docker-compose exec postgres pg_dump -U yibao yibao > backup_$(date +%Y%m%d).sql

# 恢复数据库
cat backup.sql | docker-compose exec -T postgres psql -U yibao -d yibao
```

详细部署说明请查看 [DEPLOY.md](DEPLOY.md)

## 注意事项

1. **数据存储**: 使用 PostgreSQL 数据库存储数据，支持 Docker 容器化部署。

2. **AI 识别**: 支持多种 AI 模型，在系统设置中配置 API Key 即可使用。

3. **用户认证**: 当前使用简化的 Token 认证。生产环境建议使用 JWT。

4. **跨域访问**: 生产环境通过 Nginx 反向代理，开发环境使用 Vite 代理。

## 快速体验 (本地开发)

```bash
# 1. 安装依赖
npm install
cd frontend && npm install && cd ..

# 2. 配置数据库连接
cp .env.example .env
# 编辑 .env 配置 DATABASE_URL

# 3. 启动后端
npm run dev

# 4. 启动前端（另一个终端）
cd frontend && npm run dev

# 5. 访问
# 前端: http://localhost:5173
# 后端: http://localhost:3000
```

## 许可证

MIT License

---

**易报销 Pro** - 让报销更简单！

