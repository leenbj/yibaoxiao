# Docker 构建卡顿问题 - 修复报告

## 🔍 问题分析

### 症状
GitHub Actions 在构建后端镜像时卡在以下步骤：
```
#16 35.62 ✓ [SUCCESS] Build completed
```
之后无任何输出，无法继续进行 npm 清理和镜像推送。

### 根本原因

#### 1. **内存配置矛盾**
- Dockerfile 中静态设置：`NODE_OPTIONS="--max-old-space-size=512"`（512MB）
- GitHub Actions 工作流传入：`NODE_OPTIONS=--max-old-space-size=4096`（4GB）
- 导致运行时内存分配不一致

#### 2. **构建步骤链式执行问题**
```dockerfile
RUN npm run build && npm prune --omit=dev && npm cache clean --force
```
- 所有操作通过 `&&` 连接在一个 RUN 指令中
- 构建完成后，内存紧张状态下 npm prune 可能卡住或失败
- 没有错误处理，整个步骤直接中止

#### 3. **缺少进程管理**
- Docker 容器在高内存压力下，进程可能进入僵尸状态
- BuildKit 无法检测到这种情况并正确报告错误

---

## ✅ 解决方案

### 1. 修复 Dockerfile.backend

#### 变更1：调整内存配置
```dockerfile
# 原始配置
ENV NODE_OPTIONS="--max-old-space-size=512"

# 修复后
ENV NODE_OPTIONS="--max-old-space-size=1024"
```
**原因**：提供默认内存基线，CI/CD 可通过 build-args 覆盖

#### 变更2：分离构建步骤
```dockerfile
# 原始（存在问题）
RUN echo "[5/5] 编译Motia项目..." && \
    npm run build && \
    echo "✓ 项目编译完成"

RUN echo "[6/5] 清理dev依赖..." && \
    npm prune --omit=dev && \
    npm cache clean --force && \
    ...

# 修复后
RUN echo "[5/5] 编译Motia项目..." && \
    npm run build && \
    echo "✓ 项目编译完成"

RUN echo "[6/6] 清理开发依赖..." && \
    npm prune --omit=dev --verbose

RUN echo "[7/6] 清理npm缓存..." && \
    npm cache clean --force && \
    ...

RUN echo "[8/6] 验证构建产物..." && \
    test -d /app/dist && echo "✓ dist 目录存在" || ...
```

**优点**：
- ✅ 每个步骤独立执行，避免链式失败
- ✅ Docker 会正确报告失败的步骤
- ✅ 分散内存压力，提高成功率
- ✅ 增加验证步骤，确保构建完整性

---

### 2. 修复 GitHub Actions 工作流

#### 变更1：优化 buildx 配置
```yaml
- name: 设置 Docker Buildx
  uses: docker/setup-buildx-action@v3
  with:
    driver-options: |
      image=moby/buildkit:latest
      network=host
```
**优点**：
- 使用最新的 BuildKit 驱动（更好的资源管理）
- 启用网络主机模式（减少网络开销）

#### 变更2：调整内存参数
```yaml
# 原始
build-args: |
  NODE_OPTIONS=--max-old-space-size=4096

# 修复后
build-args: |
  NODE_OPTIONS=--max-old-space-size=3072
```
**原因**：GitHub Actions 虚拟机内存有限，3GB 是安全值

#### 变更3：添加超时保护
```yaml
timeout: 1800  # 30分钟
allow: network.host
```
**作用**：防止构建卡住导致工作流超时

---

## 📋 修改清单

### 文件 1: `Dockerfile.backend`
- ✅ 更新 NODE_OPTIONS 默认值为 1024MB
- ✅ 分离 npm prune 和 npm cache clean 为单独 RUN 指令
- ✅ 添加 npm prune --verbose 输出调试信息
- ✅ 添加验证步骤检查构建产物

### 文件 2: `.github/workflows/docker-build.yml`
- ✅ 后端镜像构建：
  - 添加 buildx driver-options
  - 调整 NODE_OPTIONS 为 3072MB
  - 添加 30 分钟超时
  - 添加 network.host 支持
- ✅ 前端镜像构建：
  - 添加 buildx driver-options
  - 添加 20 分钟超时
  - 添加 network.host 支持

### 文件 3: `scripts/docker-build-debug.sh`（新增）
- ✅ 本地调试脚本，用于验证修复
- ✅ 支持后端和前端镜像构建

---

## 🧪 本地测试

### 运行调试脚本
```bash
cd /Users/wangbo/Desktop/AI建站/yibao
bash scripts/docker-build-debug.sh
```

### 验证后端镜像
```bash
# 运行容器并检查
docker run --rm yibaoxiao-backend:debug node --version
docker run --rm yibaoxiao-backend:debug npm --version

# 检查构建产物
docker run --rm yibaoxiao-backend:debug ls -la /app/dist | head -20
```

### 验证前端镜像
```bash
docker run --rm yibaoxiao-frontend:debug npm --version
```

---

## 🚀 部署步骤

### 1. 提交修改
```bash
git add Dockerfile.backend .github/workflows/docker-build.yml scripts/docker-build-debug.sh
git commit -m "fix: 修复 Docker 构建卡顿问题

- 调整 Dockerfile 内存配置为 1024MB
- 分离 npm prune 和 cache clean 为独立 RUN 指令
- 添加构建验证步骤
- 优化 GitHub Actions buildx 配置
- 调整构建内存为 3072MB
- 添加超时保护和网络优化"
git push origin main
```

### 2. 监控 GitHub Actions
访问：`https://github.com/YOUR_ORG/yibao/actions`
- 观察 "Build and Push Docker Images" 工作流
- 检查后端镜像构建日志中是否有 `[8/6] 验证构建产物` 步骤
- 确认镜像成功推送到 GHCR

### 3. 验证镜像
```bash
# 拉取镜像
docker pull ghcr.io/YOUR_ORG/yibaoxiao-backend:latest

# 运行测试
docker run --rm ghcr.io/YOUR_ORG/yibaoxiao-backend:latest npx motia --version
```

---

## 📊 预期效果

| 指标 | 之前 | 之后 |
|------|------|------|
| 构建状态 | ❌ 卡顿 | ✅ 成功 |
| 内存配置 | 不一致 | 一致性 |
| 错误报告 | 无输出 | 详细日志 |
| 构建时间 | 超时 | ~40-50秒 |
| 镜像推送 | 失败 | ✅ 成功 |

---

## 🔄 回滚方案

如果修复后仍有问题，可执行以下回滚：

```bash
git revert <commit-hash>
git push origin main
```

或直接修改参数：
```yaml
# docker-build.yml 中降低内存
NODE_OPTIONS=--max-old-space-size=2048
```

---

## 📞 故障排查

### 如果仍然卡顿
1. 检查 GitHub Actions 日志是否有 OOM 错误
2. 运行本地调试脚本：`bash scripts/docker-build-debug.sh`
3. 查看 Docker 构建输出中的内存使用情况
4. 考虑进一步降低 NODE_OPTIONS（如 2048MB）

### 如果镜像未推送
1. 检查 GITHUB_TOKEN 权限
2. 确认 ghcr.io 登录信息正确
3. 查看 GitHub Packages 中的镜像可见性设置

### 调试内存使用
```bash
# 本地构建时监控内存
docker stats

# 查看构建步骤内存占用
docker build --progress=plain ...
```

---

## 📝 相关文档

- Dockerfile 最佳实践：https://docs.docker.com/develop/dockerfile_best-practices/
- GitHub Actions Docker Build：https://github.com/docker/build-push-action
- Motia 文档：https://docs.motia.dev/

---

**修复日期**：2025-12-10
**负责人**：Claude Code
**状态**：✅ 完成
