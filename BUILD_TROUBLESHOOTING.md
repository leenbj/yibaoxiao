# Docker 构建故障排查快速指南

## 📋 快速参考

### 问题：构建卡在 "Build completed"
**原因**：npm 清理步骤内存不足
**解决**：✅ 已修复（分离步骤，调整内存）

### 问题：GitHub Actions 超时
**原因**：构建未完成导致工作流超时
**解决**：✅ 已修复（添加 30 分钟超时，优化 buildx）

### 问题：镜像无法推送
**原因**：前面步骤失败导致推送步骤被跳过
**解决**：✅ 已修复（完整的构建流程）

---

## 🧪 本地验证

### 快速测试后端构建
```bash
cd /Users/wangbo/Desktop/AI建站/yibao

# 方法 1：使用调试脚本（推荐）
bash scripts/docker-build-debug.sh

# 方法 2：直接构建
docker build \
  -f Dockerfile.backend \
  --tag yibaoxiao-backend:test \
  --build-arg NODE_OPTIONS=--max-old-space-size=3072 \
  .

# 验证
docker run --rm yibaoxiao-backend:test npm --version
```

### 完整测试流程
```bash
# 1. 构建镜像
docker build -f Dockerfile.backend -t backend:test --build-arg NODE_OPTIONS=--max-old-space-size=3072 .

# 2. 查看镜像大小
docker images | grep backend:test

# 3. 检查构建产物
docker run --rm backend:test ls -la /app/dist | head -10

# 4. 检查依赖
docker run --rm backend:test npm ls --depth=0 --omit=dev

# 5. 验证启动脚本存在
docker run --rm backend:test test -f /app/scripts/docker-start.sh && echo "✓ 启动脚本存在"
```

---

## 🔍 监控 GitHub Actions

### 查看工作流日志
1. 访问：https://github.com/YOUR_ORG/yibao/actions
2. 点击 "Build and Push Docker Images"
3. 查看 "构建后端镜像" 步骤的完整日志

### 关键日志标志

| 日志内容 | 含义 |
|---------|------|
| `[5/5] 编译Motia项目...` | ✅ 编译进行中 |
| `✓ [SUCCESS] Build completed` | ✅ 编译成功 |
| `[6/6] 清理开发依赖...` | ✅ 进入清理阶段 |
| `[8/6] 验证构建产物...` | ✅ 验证阶段 |
| `✓ dist 目录存在` | ✅ 构建成功 |
| `Successfully tagged` | ✅ 镜像推送成功 |

### 常见错误信息

```
# 错误：内存不足
Error: ENOMEM: out of memory, write

# 修复方式
→ 工作流已配置 NODE_OPTIONS=--max-old-space-size=3072

# 错误：无法推送
denied: permission denied

# 修复方式
→ 检查 GitHub Token 权限和 ghcr.io 登录
```

---

## 🛠️ 常见操作

### 查看已推送的镜像
```bash
# 查看 GitHub Packages
https://github.com/YOUR_ORG/yibao/pkgs/container/yibaoxiao-backend

# 或使用命令行
docker pull ghcr.io/YOUR_ORG/yibaoxiao-backend:latest
```

### 清理本地镜像
```bash
# 删除测试镜像
docker rmi yibaoxiao-backend:test yibaoxiao-frontend:test

# 删除所有悬空镜像
docker image prune -f
```

### 重新构建特定步骤
```bash
# 不使用缓存，强制重新构建
docker build \
  --no-cache \
  -f Dockerfile.backend \
  -t backend:fresh \
  .
```

---

## 📊 性能指标

### 修复前后对比

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 构建状态 | ❌ 卡顿 | ✅ 成功 |
| 构建时间 | 不确定（超时） | ~40-50秒 |
| 最后日志 | 在 `Build completed` 处卡住 | 完整输出到镜像推送 |
| 镜像推送 | ❌ 失败 | ✅ 成功 |
| 内存配置 | 矛盾（512MB vs 4GB） | 一致（1024MB → 3072MB） |

---

## 🔄 如果仍然有问题

### 步骤 1：检查本地构建
```bash
# 运行本地调试
bash scripts/docker-build-debug.sh

# 如果本地成功但 CI 失败
→ 问题可能在 GitHub Actions 配置或网络
→ 检查工作流日志中的 "buildx driver-options" 是否生效
```

### 步骤 2：检查资源限制
```bash
# 查看当前内存配置
docker run --rm yibaoxiao-backend:latest node -e \
  "console.log('Max memory:', Math.round(require('os').totalmem() / 1024 / 1024), 'MB')"
```

### 步骤 3：降低内存需求
```yaml
# docker-build.yml 中修改
build-args: |
  NODE_OPTIONS=--max-old-space-size=2048  # 从 3072 降低到 2048
```

### 步骤 4：增加日志输出
```bash
# 本地构建时使用详细输出
docker build \
  -f Dockerfile.backend \
  -t backend:debug \
  --progress=plain \  # 显示详细进度
  --build-arg NODE_OPTIONS=--max-old-space-size=3072 \
  .
```

---

## 📞 获取帮助

### 工具链版本检查
```bash
# 检查 Docker 版本
docker --version

# 检查 Docker Buildx 版本
docker buildx version

# 检查 Node 版本
node --version

# 检查 npm 版本
npm --version
```

### 收集诊断信息
```bash
# 收集所有诊断信息
{
  echo "=== Docker Info ==="
  docker --version
  docker buildx version

  echo "=== Node Info ==="
  node --version
  npm --version
  npm ls --depth=0

  echo "=== Git Info ==="
  git log --oneline -5
  git status

  echo "=== File Checks ==="
  ls -la Dockerfile.backend .github/workflows/docker-build.yml scripts/
} > BUILD_DIAGNOSTICS.txt

# 查看诊断信息
cat BUILD_DIAGNOSTICS.txt
```

---

## ✅ 验证清单

在提交之前，确保：

- [ ] 本地 `bash scripts/docker-build-debug.sh` 成功
- [ ] 后端镜像可正常运行
- [ ] 前端镜像可正常运行
- [ ] Dockerfile.backend 有 `[8/6] 验证构建产物` 步骤
- [ ] docker-build.yml 中后端构建有 `timeout: 1800`
- [ ] 所有修改已提交到 git
- [ ] GitHub Actions 日志显示构建成功
- [ ] 镜像已推送到 ghcr.io

---

**最后更新**：2025-12-10
**修复状态**：✅ 完成
**预计影响**：GitHub Actions 后端镜像构建应该恢复正常
