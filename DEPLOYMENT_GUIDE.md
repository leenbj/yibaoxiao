# 🚀 易报销 Pro - 快速部署指南

**针对用户：** leenbj
**镜像仓库：** GitHub Container Registry (ghcr.io)
**最后更新：** 2025-12-11

---

## 📋 部署前准备

### 1. 服务器要求

- **操作系统**：CentOS 7+, Ubuntu 18.04+, Debian 10+
- **配置**：至少 2核4G 内存，10GB 可用磁盘空间
- **软件**：Docker 20.10+, Docker Compose 1.29+
- **端口**：80（前端）、3000（后端）

### 2. GitHub Container Registry 设置

#### 首次使用需要设置镜像可见性：

1. 访问：https://github.com/leenbj?tab=packages
2. 找到 `yibaoxiao-backend` 和 `yibaoxiao-frontend`
3. 点击包名进入详情页
4. 点击右侧 **Package settings**
5. 滚动到 **Danger Zone** → **Change package visibility**
6. 选择 **Public**（公开）或配置访问权限

> 💡 **提示**：设置为 Public 后无需登录即可拉取镜像

---

## 🚀 快速部署（推荐）

### 方式一：使用一键部署脚本

```bash
# 1. 下载项目（或克隆仓库）
git clone https://github.com/leenbj/yibaoxiao.git
cd yibaoxiao

# 2. 运行部署脚本
./scripts/quick-deploy.sh
```

脚本会自动：
- ✅ 检查系统依赖
- ✅ 创建配置文件
- ✅ 拉取镜像
- ✅ 启动服务
- ✅ 等待服务就绪

---

## 🔧 手动部署（完整控制）

### 步骤 1：准备配置文件

```bash
# 复制配置模板
cp .env.production.example .env

# 编辑配置（重要！）
nano .env  # 或使用 vim .env
```

#### 必须修改的配置：

```bash
# 数据库密码（请使用强密码）
POSTGRES_PASSWORD=你的强密码

# 管理员配置
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=管理员强密码
ADMIN_NAME=管理员姓名
```

### 步骤 2：拉取镜像

```bash
docker-compose -f docker-compose.prod.yml pull
```

**预期输出：**
```
Pulling postgres ... done
Pulling backend  ... done
Pulling frontend ... done
```

### 步骤 3：启动服务

```bash
docker-compose -f docker-compose.prod.yml up -d
```

**预期输出：**
```
Creating yibao-postgres ... done
Creating yibao-backend  ... done
Creating yibao-frontend ... done
```

### 步骤 4：验证部署

```bash
# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 检查后端健康状态
curl http://localhost:3000/api/health

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 🌐 访问应用

部署成功后：

| 服务 | 地址 | 说明 |
|------|------|------|
| **前端** | http://localhost | Web 界面 |
| **后端 API** | http://localhost:3000 | API 接口 |
| **健康检查** | http://localhost:3000/api/health | 健康状态 |

### 默认管理员账号

- **邮箱**：查看 `.env` 文件中的 `ADMIN_EMAIL`
- **密码**：查看 `.env` 文件中的 `ADMIN_PASSWORD`

> ⚠️ **重要**：首次登录后请立即修改密码！

---

## 🔄 更新应用

### 从 GitHub 拉取新版本

```bash
# 1. 拉取最新镜像
docker-compose -f docker-compose.prod.yml pull

# 2. 重启服务（滚动更新）
docker-compose -f docker-compose.prod.yml up -d

# 3. 查看更新日志
docker-compose -f docker-compose.prod.yml logs -f --tail=50
```

### 回滚到指定版本

```bash
# 1. 修改 .env 文件，指定版本
BACKEND_IMAGE=ghcr.io/leenbj/yibaoxiao-backend:v1.0.0
FRONTEND_IMAGE=ghcr.io/leenbj/yibaoxiao-frontend:v1.0.0

# 2. 拉取指定版本
docker-compose -f docker-compose.prod.yml pull

# 3. 重启服务
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔧 常用运维命令

```bash
# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志（所有服务）
docker-compose -f docker-compose.prod.yml logs -f

# 查看后端日志
docker-compose -f docker-compose.prod.yml logs -f backend

# 查看前端日志
docker-compose -f docker-compose.prod.yml logs -f frontend

# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 重启后端
docker-compose -f docker-compose.prod.yml restart backend

# 停止服务
docker-compose -f docker-compose.prod.yml down

# 停止并删除数据卷（危险！）
docker-compose -f docker-compose.prod.yml down -v

# 查看资源占用
docker stats yibao-backend yibao-frontend yibao-postgres

# 进入容器调试
docker exec -it yibao-backend sh
docker exec -it yibao-postgres psql -U yibao -d yibao
```

---

## 🛡️ 生产环境建议

### 1. 配置反向代理（推荐）

使用 Nginx 或 Traefik 配置反向代理和 SSL 证书：

```nginx
# Nginx 配置示例
server {
    listen 443 ssl http2;
    server_name yibao.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. 配置防火墙

```bash
# CentOS/RHEL
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# Ubuntu/Debian
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 3. 定期备份数据库

```bash
# 备份脚本
#!/bin/bash
BACKUP_DIR="/backups/yibao"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份 PostgreSQL
docker exec yibao-postgres pg_dump -U yibao yibao > \
    $BACKUP_DIR/yibao_$DATE.sql

# 压缩备份
gzip $BACKUP_DIR/yibao_$DATE.sql

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "备份完成: $BACKUP_DIR/yibao_$DATE.sql.gz"
```

### 4. 配置监控

建议安装：
- **Prometheus + Grafana**：资源监控
- **Loki**：日志聚合
- **Uptime Kuma**：服务可用性监控

---

## 🚨 故障排查

### 问题 1：无法拉取镜像

**错误信息：**
```
Error response from daemon: pull access denied
```

**解决方案：**
1. 确认镜像已设置为 Public
2. 检查镜像名称是否正确（全小写）
3. 如果是私有镜像，需要登录：
   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u leenbj --password-stdin
   ```

### 问题 2：端口被占用

**错误信息：**
```
Error starting userland proxy: listen tcp 0.0.0.0:80: bind: address already in use
```

**解决方案：**
```bash
# 查看占用端口的进程
netstat -tlnp | grep :80

# 停止占用进程或修改 .env 文件中的端口
FRONTEND_PORT=8080
BACKEND_PORT=3001
```

### 问题 3：数据库连接失败

**错误信息：**
```
Error: connect ECONNREFUSED
```

**解决方案：**
```bash
# 1. 检查数据库容器状态
docker-compose -f docker-compose.prod.yml ps postgres

# 2. 查看数据库日志
docker-compose -f docker-compose.prod.yml logs postgres

# 3. 等待数据库就绪（健康检查）
docker-compose -f docker-compose.prod.yml up -d postgres
sleep 30

# 4. 重启后端
docker-compose -f docker-compose.prod.yml restart backend
```

### 问题 4：内存不足

**症状：** 容器频繁重启，日志显示 `Killed`

**解决方案：**
```bash
# 1. 查看内存使用
free -h
docker stats

# 2. 调整内存限制（编辑 docker-compose.prod.yml）
deploy:
  resources:
    limits:
      memory: 2G  # 增加内存限制

# 3. 重启服务
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📊 性能优化建议

### 低配服务器（2核4G）

已默认优化，无需额外配置。

### 高配服务器（4核8G+）

编辑 `docker-compose.prod.yml`，调整资源限制：

```yaml
# 后端
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G

# PostgreSQL
command: >
  postgres
  -c shared_buffers=512MB
  -c effective_cache_size=2GB
  -c max_connections=200
```

---

## 🔐 安全检查清单

- [ ] 已修改默认数据库密码
- [ ] 已修改管理员密码
- [ ] 已配置防火墙规则
- [ ] 已配置 HTTPS 证书
- [ ] 已限制 PostgreSQL 仅内网访问
- [ ] 已配置定期备份
- [ ] 已配置日志轮转
- [ ] 已设置监控告警

---

## 📚 相关文档

- [Docker 优化文档](./DOCKER_OPTIMIZATION.md)
- [完整部署文档](./DEPLOY.md)
- [故障排查指南](./BUILD_TROUBLESHOOTING.md)

---

## 🆘 技术支持

遇到问题？

1. **查看日志**：`docker-compose -f docker-compose.prod.yml logs`
2. **检查文档**：参考上述故障排查部分
3. **GitHub Issues**：https://github.com/leenbj/yibaoxiao/issues

---

**祝部署顺利！🎉**
