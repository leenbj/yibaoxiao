# 易报销 Pro - 部署指南

本文档详细说明如何将易报销 Pro 部署到宝塔面板的 Linux 服务器上。

## 📋 目录

- [方案概述](#方案概述)
- [前置要求](#前置要求)
- [第一步：本地构建镜像](#第一步本地构建镜像)
- [第二步：服务器环境准备](#第二步服务器环境准备)
- [第三步：部署应用](#第三步部署应用)
- [第四步：配置域名（可选）](#第四步配置域名可选)
- [常用运维命令](#常用运维命令)
- [故障排查](#故障排查)

---

## 方案概述

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   本地 Mac      │      │   Docker Hub    │      │  Linux 服务器   │
│                 │      │                 │      │  (宝塔面板)     │
│  构建镜像 ──────┼──────▶  存储镜像 ──────┼──────▶  拉取并运行    │
│                 │ push │                 │ pull │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## 前置要求

### 本地环境（Mac）
- [x] Docker Desktop 已安装并运行
- [x] Docker Hub 账号（免费注册：https://hub.docker.com）

### 服务器环境
- [x] Linux 服务器（CentOS/Ubuntu/Debian）
- [x] 宝塔面板（可选，但推荐）
- [x] 至少 2GB 内存，10GB 磁盘空间
- [x] 开放端口：80（前端）、3000（后端）

---

## 第一步：本地构建镜像

### 1.1 登录 Docker Hub

```bash
# 登录 Docker Hub
docker login
# 输入用户名和密码
```

### 1.2 运行构建脚本

```bash
# 进入项目目录
cd /Users/wangbo/Desktop/AI建站/yibao

# 运行构建脚本（替换 YOUR_USERNAME 为你的 Docker Hub 用户名）
./scripts/build-and-push.sh YOUR_USERNAME
```

### 1.3 等待构建完成

构建过程大约需要 10-15 分钟，完成后会显示：
- 后端镜像：`YOUR_USERNAME/yibao-backend:latest`
- 前端镜像：`YOUR_USERNAME/yibao-frontend:latest`

---

## 第二步：服务器环境准备

### 2.1 安装 Docker（宝塔面板方式）

1. 登录宝塔面板
2. 进入 **软件商店**
3. 搜索 **Docker管理器**
4. 点击安装

### 2.2 安装 Docker（命令行方式）

```bash
# CentOS
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 2.3 验证安装

```bash
docker --version
docker-compose --version
```

---

## 第三步：部署应用

### 方式一：使用部署脚本（推荐）

```bash
# 下载部署脚本
curl -O https://raw.githubusercontent.com/YOUR_REPO/main/scripts/deploy-server.sh
chmod +x deploy-server.sh

# 运行部署（替换 YOUR_USERNAME 为你的 Docker Hub 用户名）
./deploy-server.sh YOUR_USERNAME
```

### 方式二：手动部署

#### 3.1 创建部署目录

```bash
mkdir -p /www/wwwroot/yibao
cd /www/wwwroot/yibao
```

#### 3.2 创建 docker-compose.yml

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

#### 3.3 启动服务

```bash
# 拉取镜像
docker-compose pull

# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps
```

---

## 第四步：配置域名（可选）

### 4.1 宝塔面板配置反向代理

1. 进入 **网站** → **添加站点**
2. 输入域名，如 `yibao.example.com`
3. 进入站点设置 → **反向代理**
4. 添加反向代理：
   - 目标URL：`http://127.0.0.1:80`
   - 发送域名：`$host`

### 4.2 配置 SSL 证书

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
