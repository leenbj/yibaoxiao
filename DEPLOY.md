# 易报销 Pro - 部署指南

本文档详细说明如何将易报销 Pro 部署到宝塔面板的 Linux 服务器上。

## 📋 目录

- [方案选择](#方案选择)
- [方案一：GitHub Actions 构建（推荐）](#方案一github-actions-构建推荐)
- [方案二：本地构建](#方案二本地构建)
- [服务器部署](#服务器部署)
- [配置域名（可选）](#配置域名可选)
- [常用运维命令](#常用运维命令)
- [故障排查](#故障排查)

---

## 方案选择

| 方案 | 优点 | 缺点 | 推荐场景 |
|------|------|------|----------|
| **方案一：GitHub Actions** | 构建快、网络好 | 需要下载 artifact | 网络环境差 |
| **方案二：本地构建** | 一键完成 | 构建慢、依赖网络 | 网络环境好 |

---

## 方案一：GitHub Actions 构建（推荐）

利用 GitHub 的国外服务器构建镜像，然后下载到本地推送到 Docker Hub。

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  GitHub Actions │      │   你的电脑      │      │   Docker Hub    │      │  Linux 服务器   │
│                 │      │                 │      │                 │      │                 │
│  构建镜像 ──────┼──────▶ 下载 artifact ──┼──────▶ 推送镜像 ──────┼──────▶  拉取并运行    │
│                 │ zip  │                 │ push │                 │ pull │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

### 步骤 1：触发 GitHub Actions 构建

推送代码到 main 分支会自动触发构建，或手动触发：

1. 打开 GitHub 仓库页面
2. 点击 **Actions** 标签
3. 选择 **Build Docker Images** 工作流
4. 点击 **Run workflow**

### 步骤 2：下载构建好的镜像

构建完成后（约 5-10 分钟）：

1. 在 Actions 页面点击完成的工作流
2. 滚动到页面底部的 **Artifacts** 区域
3. 下载两个文件：
   - `yibao-backend-image` (后端镜像)
   - `yibao-frontend-image` (前端镜像)

### 步骤 3：推送到 Docker Hub

```bash
# 进入项目目录
cd /Users/wangbo/Desktop/AI建站/yibao

# 将下载的 zip 文件移动到项目目录
mv ~/Downloads/yibao-backend-image.zip .
mv ~/Downloads/yibao-frontend-image.zip .

# 运行推送脚本（替换 YOUR_USERNAME 为你的 Docker Hub 用户名）
./scripts/push-to-dockerhub.sh YOUR_USERNAME
```

脚本会自动：
- 解压 artifact
- 加载镜像到 Docker
- 打标签并推送到 Docker Hub

---

## 方案二：本地构建

直接在本地 Mac 上构建并推送镜像。

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   本地 Mac      │      │   Docker Hub    │      │  Linux 服务器   │
│                 │      │                 │      │  (宝塔面板)     │
│  构建镜像 ──────┼──────▶  存储镜像 ──────┼──────▶  拉取并运行    │
│                 │ push │                 │ pull │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### 前置要求

- Docker Desktop 已安装并运行
- Docker Hub 账号（免费注册：https://hub.docker.com）

### 运行构建脚本

```bash
# 进入项目目录
cd /Users/wangbo/Desktop/AI建站/yibao

# 登录 Docker Hub
docker login

# 运行构建脚本（替换 YOUR_USERNAME）
./scripts/build-and-push.sh YOUR_USERNAME
```

构建过程约 10-15 分钟（取决于网络）。

---

## 服务器部署

### 前置要求

- Linux 服务器（CentOS/Ubuntu/Debian）
- 宝塔面板（可选，但推荐）
- 至少 2GB 内存，10GB 磁盘空间
- 开放端口：80（前端）、3000（后端）

### 服务器环境准备

### 安装 Docker（宝塔面板方式）

1. 登录宝塔面板
2. 进入 **软件商店**
3. 搜索 **Docker管理器**
4. 点击安装

### 安装 Docker（命令行方式）

```bash
# CentOS
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 验证安装

```bash
docker --version
docker-compose --version
```

### 部署应用

#### 方式一：使用部署脚本（推荐）

```bash
# 创建部署目录
mkdir -p /www/wwwroot/yibao && cd /www/wwwroot/yibao

# 下载部署脚本
curl -O https://raw.githubusercontent.com/leenbj/yibaoxiao/main/scripts/deploy-server.sh
chmod +x deploy-server.sh

# 运行部署（替换 YOUR_USERNAME 为你的 Docker Hub 用户名）
./deploy-server.sh YOUR_USERNAME
```

#### 方式二：手动部署

##### 创建部署目录

```bash
mkdir -p /www/wwwroot/yibao
cd /www/wwwroot/yibao
```

##### 创建 docker-compose.yml

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    container_name: yibao-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: yibao
      POSTGRES_PASSWORD: yibao123456  # 请修改为强密码
      POSTGRES_DB: yibao
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U yibao"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - yibao-network

  # 后端服务（替换 YOUR_USERNAME）
  backend:
    image: YOUR_USERNAME/yibao-backend:latest
    container_name: yibao-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://yibao:yibao123456@postgres:5432/yibao
      ADMIN_EMAIL: wangbo@knet.cn
      ADMIN_PASSWORD: 123456
      ADMIN_NAME: 王波
      ADMIN_DEPARTMENT: 管理部
    ports:
      - "3000:3000"
    networks:
      - yibao-network

  # 前端服务（替换 YOUR_USERNAME）
  frontend:
    image: YOUR_USERNAME/yibao-frontend:latest
    container_name: yibao-frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"
    networks:
      - yibao-network

networks:
  yibao-network:
    driver: bridge
```

##### 启动服务

```bash
# 拉取镜像
docker-compose pull

# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps
```

---

## 配置域名（可选）

### 宝塔面板配置反向代理

1. 进入 **网站** → **添加站点**
2. 输入域名，如 `yibao.example.com`
3. 进入站点设置 → **反向代理**
4. 添加反向代理：
   - 目标URL：`http://127.0.0.1:80`
   - 发送域名：`$host`

### 配置 SSL 证书

1. 站点设置 → **SSL**
2. 选择 **Let's Encrypt** 免费证书
3. 申请并部署

---

## 常用运维命令

```bash
# 进入部署目录
cd /www/wwwroot/yibao

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f              # 所有服务
docker-compose logs -f backend      # 仅后端
docker-compose logs -f frontend     # 仅前端

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新镜像
docker-compose pull
docker-compose up -d

# 清理旧镜像
docker image prune -f

# 查看资源占用
docker stats
```

---

## 故障排查

### 问题1：无法拉取镜像

```bash
# 检查网络
ping hub.docker.com

# 配置镜像加速（阿里云）
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << EOF
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
EOF
systemctl restart docker
```

### 问题2：后端无法连接数据库

```bash
# 检查数据库状态
docker-compose logs postgres

# 重启数据库
docker-compose restart postgres

# 等待数据库就绪后重启后端
docker-compose restart backend
```

### 问题3：前端无法访问后端 API

```bash
# 检查后端是否运行
curl http://localhost:3000/api/health

# 检查后端日志
docker-compose logs backend
```

### 问题4：端口被占用

```bash
# 查看端口占用
netstat -tlnp | grep 80
netstat -tlnp | grep 3000

# 停止占用端口的服务，或修改 docker-compose.yml 中的端口映射
```

---

## 默认账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 超级管理员 | wangbo@knet.cn | 123456 |

> ⚠️ **安全提示**：首次登录后请立即修改默认密码！

---

## 技术支持

如有问题，请检查：
1. Docker 日志：`docker-compose logs`
2. 服务器资源：`docker stats`
3. 网络连接：`curl http://localhost:3000/api/health`
