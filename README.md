# 易报销 Pro - AI 驱动的财务报销系统

一个使用 **Motia 框架** 构建的智能财务报销系统，支持 AI 自动识别发票、审批单，简化报销流程。

## 🚀 功能特性

- 📋 **记账本** - 快速记录待报销费用
- 🎙️ **语音录入** - AI 识别语音自动填写
- 📄 **通用报销** - 上传发票/审批单，AI 自动识别
- ✈️ **差旅报销** - 差旅费用专项报销
- 💰 **借款申请** - 预借款申请管理
- 📜 **历史记录** - 查看所有报销/借款记录
- 📊 **数据统计** - 各时期报销数据分析
- ⚙️ **系统设置** - 用户、收款人、预算项目管理

## 🛠️ 技术栈

- **后端**: Motia 框架 (Node.js + TypeScript)
- **前端**: React + Tailwind CSS
- **AI**: Google Gemini API (发票/审批单识别)
- **数据**: Motia State Manager (内置状态管理)

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

## 📝 注意事项

1. **数据存储**: 当前使用 Motia 内置的 State Manager 存储数据，适合开发测试。生产环境建议对接数据库。

2. **AI 识别**: 默认返回模拟数据，配置 GEMINI_API_KEY 后使用真实 AI 识别。

3. **用户认证**: 当前使用简化的 Token 认证。生产环境建议使用 JWT。

4. **跨域访问**: 前端默认访问 `http://localhost:3000`，如需修改请编辑 `frontend/src/api/client.ts`。

## 🚀 快速体验

```bash
# 1. 安装依赖
npm install

# 2. 启动后端（终端 1）
npm run dev

# 3. 打开浏览器访问 Motia Workbench
open http://localhost:3000

# 4. 测试 API（可选）
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"测试用户","email":"test@test.com","password":"123456","department":"技术部"}'
```

## 📄 许可证

MIT License

---

**易报销 Pro** - 让报销更简单！🎉

