# 易报销 Pro - Docker 部署指南

本文档介绍如何使用 Docker Compose 在宝塔面板的 Linux 服务器上部署易报销 Pro 系统。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    宝塔面板服务器                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Frontend   │  │   Backend   │  │   PostgreSQL    │  │
│  │  (Nginx)    │──│   (Motia)   │──│   (Database)    │  │
│  │  :80        │  │   :3000     │  │   :5432         │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 前置要求

1. **服务器配置**
   - 操作系统：Linux (推荐 CentOS 7+ / Ubuntu 20.04+)
   - 内存：最少 2GB，推荐 4GB+
   - 硬盘：最少 20GB 可用空间

2. **软件要求**
   - 宝塔面板已安装
   - Docker 已安装
   - Docker Compose 已安装

## 安装 Docker（宝塔面板）

1. 登录宝塔面板
2. 进入 **软件商店** → 搜索 **Docker**
3. 安装 Docker 管理器
4. 或通过命令行安装：

```bash
# CentOS
curl -fsSL https://get.docker.com | bash -s docker
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

## 部署步骤

### 1. 上传项目代码

将项目代码上传到服务器，例如 `/www/wwwroot/yibao/`：

```bash
cd /www/wwwroot/
git clone <你的仓库地址> yibao
# 或者通过宝塔面板文件管理上传
```

### 2. 配置环境变量

复制并编辑生产环境配置文件：

```bash
cd /www/wwwroot/yibao
cp .env.production .env
```

编辑 `.env` 文件，修改以下配置：

```bash
# 数据库密码（请修改为强密码）
POSTGRES_PASSWORD=your_strong_password_here

# AI 配置（可选）
DEFAULT_AI_PROVIDER=gemini
DEFAULT_AI_API_KEY=your_api_key_here
```

### 3. 构建并启动服务

```bash
cd /www/wwwroot/yibao

# 构建并启动所有服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 4. 初始化数据库

首次部署时，需要初始化数据库表结构：

```bash
# 进入后端容器
docker-compose exec backend sh

# 运行数据库迁移
npm run db:push

# 退出容器
exit
```

### 5. 访问系统

打开浏览器访问：`http://服务器IP/`

## 常用命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f [服务名]

# 重新构建并启动
docker-compose up -d --build

# 进入容器
docker-compose exec backend sh
docker-compose exec frontend sh
docker-compose exec postgres psql -U yibao -d yibao
```

## 数据备份

### 备份数据库

```bash
# 导出数据库
docker-compose exec postgres pg_dump -U yibao yibao > backup_$(date +%Y%m%d).sql

# 恢复数据库
cat backup_20241128.sql | docker-compose exec -T postgres psql -U yibao -d yibao
```

### 备份数据卷

```bash
# 查看数据卷
docker volume ls

# 备份 PostgreSQL 数据
docker run --rm -v yibao_postgres_data:/data -v $(pwd):/backup alpine tar cvf /backup/postgres_backup.tar /data
```

## 更新部署

```bash
cd /www/wwwroot/yibao

# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

## 故障排查

### 查看容器状态

```bash
docker-compose ps
```

### 查看容器日志

```bash
# 查看所有日志
docker-compose logs

# 查看特定服务日志
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# 实时查看日志
docker-compose logs -f
```

### 常见问题

1. **端口被占用**
   ```bash
   # 检查端口占用
   netstat -tlnp | grep 80
   netstat -tlnp | grep 3000
   netstat -tlnp | grep 5432
   ```

2. **数据库连接失败**
   - 检查 PostgreSQL 容器是否正常运行
   - 检查 `.env` 中的数据库配置是否正确

3. **前端无法访问后端 API**
   - 检查 Nginx 配置是否正确
   - 检查后端服务是否正常运行

## 安全建议

1. **修改默认密码**
   - 修改 PostgreSQL 密码
   - 使用强密码

2. **配置防火墙**
   ```bash
   # 只开放必要端口
   firewall-cmd --add-port=80/tcp --permanent
   firewall-cmd --reload
   ```

3. **定期备份**
   - 设置定时任务备份数据库
   - 备份文件存储到异地

## 技术支持

如有问题，请检查：
1. Docker 和 Docker Compose 版本是否兼容
2. 服务器资源是否充足
3. 网络配置是否正确

