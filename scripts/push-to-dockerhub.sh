#!/bin/bash
# ============================================================
# 易报销 Pro - 从 GitHub Actions artifact 推送到 Docker Hub
# ============================================================
#
# 使用方法：
#   1. 从 GitHub Actions 下载 artifact（两个 zip 文件）
#   2. 将 zip 文件放到项目根目录或指定目录
#   3. 运行: ./scripts/push-to-dockerhub.sh YOUR_DOCKER_USERNAME
#
# 示例：
#   ./scripts/push-to-dockerhub.sh leenbj
#   ./scripts/push-to-dockerhub.sh leenbj ~/Downloads
#
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ==================== 配置 ====================
DOCKER_USERNAME="${1:-}"
ARTIFACT_DIR="${2:-.}"

echo ""
echo "============================================"
echo "  易报销 Pro - 推送镜像到 Docker Hub"
echo "============================================"
echo ""

# 检查 Docker 用户名
if [ -z "$DOCKER_USERNAME" ]; then
    read -p "请输入 Docker Hub 用户名: " DOCKER_USERNAME
    if [ -z "$DOCKER_USERNAME" ]; then
        error "Docker Hub 用户名不能为空"
    fi
fi

info "Docker 用户名: $DOCKER_USERNAME"
info "Artifact 目录: $ARTIFACT_DIR"
echo ""

# ==================== 检查 Docker ====================
info "检查 Docker 环境..."

if ! command -v docker &> /dev/null; then
    error "Docker 未安装，请先安装 Docker Desktop"
fi

if ! docker info &> /dev/null; then
    error "Docker 未运行，请启动 Docker Desktop"
fi

# 检查是否登录
if ! docker info 2>/dev/null | grep -q "Username"; then
    warn "未登录 Docker Hub，正在登录..."
    docker login || error "Docker Hub 登录失败"
fi

success "Docker 环境检查通过"

# ==================== 查找 artifact 文件 ====================
echo ""
info "查找 artifact 文件..."

# 可能的文件位置
BACKEND_ZIP=""
FRONTEND_ZIP=""
BACKEND_TAR=""
FRONTEND_TAR=""

# 查找后端镜像
for f in "$ARTIFACT_DIR/yibao-backend-image.zip" \
         "$ARTIFACT_DIR/yibao-backend-image/yibao-backend.tar.gz" \
         "$ARTIFACT_DIR/yibao-backend.tar.gz" \
         "$ARTIFACT_DIR/yibao-backend.tar"; do
    if [ -f "$f" ]; then
        case "$f" in
            *.zip) BACKEND_ZIP="$f" ;;
            *.tar.gz) BACKEND_TAR="$f" ;;
            *.tar) BACKEND_TAR="$f" ;;
        esac
        break
    fi
done

# 查找前端镜像
for f in "$ARTIFACT_DIR/yibao-frontend-image.zip" \
         "$ARTIFACT_DIR/yibao-frontend-image/yibao-frontend.tar.gz" \
         "$ARTIFACT_DIR/yibao-frontend.tar.gz" \
         "$ARTIFACT_DIR/yibao-frontend.tar"; do
    if [ -f "$f" ]; then
        case "$f" in
            *.zip) FRONTEND_ZIP="$f" ;;
            *.tar.gz) FRONTEND_TAR="$f" ;;
            *.tar) FRONTEND_TAR="$f" ;;
        esac
        break
    fi
done

# 检查是否找到文件
if [ -z "$BACKEND_ZIP" ] && [ -z "$BACKEND_TAR" ]; then
    warn "未找到后端镜像文件"
    warn "请确保已下载 yibao-backend-image artifact"
fi

if [ -z "$FRONTEND_ZIP" ] && [ -z "$FRONTEND_TAR" ]; then
    warn "未找到前端镜像文件"
    warn "请确保已下载 yibao-frontend-image artifact"
fi

if [ -z "$BACKEND_ZIP" ] && [ -z "$BACKEND_TAR" ] && [ -z "$FRONTEND_ZIP" ] && [ -z "$FRONTEND_TAR" ]; then
    echo ""
    error "未找到任何镜像文件！请先从 GitHub Actions 下载 artifact"
fi

# ==================== 处理后端镜像 ====================
if [ -n "$BACKEND_ZIP" ] || [ -n "$BACKEND_TAR" ]; then
    echo ""
    info "处理后端镜像..."
    
    # 解压 zip
    if [ -n "$BACKEND_ZIP" ]; then
        info "解压 $BACKEND_ZIP..."
        unzip -o "$BACKEND_ZIP" -d "$ARTIFACT_DIR"
        BACKEND_TAR="$ARTIFACT_DIR/yibao-backend.tar.gz"
    fi
    
    # 解压 gzip
    if [[ "$BACKEND_TAR" == *.tar.gz ]]; then
        info "解压 $BACKEND_TAR..."
        gunzip -f "$BACKEND_TAR"
        BACKEND_TAR="${BACKEND_TAR%.gz}"
    fi
    
    # 加载镜像
    info "加载后端镜像到 Docker..."
    docker load -i "$BACKEND_TAR"
    
    # 打标签
    info "打标签: ${DOCKER_USERNAME}/yibao-backend:latest"
    docker tag yibao-backend:latest "${DOCKER_USERNAME}/yibao-backend:latest"
    
    # 推送
    info "推送后端镜像到 Docker Hub..."
    docker push "${DOCKER_USERNAME}/yibao-backend:latest"
    
    success "后端镜像推送完成: ${DOCKER_USERNAME}/yibao-backend:latest"
fi

# ==================== 处理前端镜像 ====================
if [ -n "$FRONTEND_ZIP" ] || [ -n "$FRONTEND_TAR" ]; then
    echo ""
    info "处理前端镜像..."
    
    # 解压 zip
    if [ -n "$FRONTEND_ZIP" ]; then
        info "解压 $FRONTEND_ZIP..."
        unzip -o "$FRONTEND_ZIP" -d "$ARTIFACT_DIR"
        FRONTEND_TAR="$ARTIFACT_DIR/yibao-frontend.tar.gz"
    fi
    
    # 解压 gzip
    if [[ "$FRONTEND_TAR" == *.tar.gz ]]; then
        info "解压 $FRONTEND_TAR..."
        gunzip -f "$FRONTEND_TAR"
        FRONTEND_TAR="${FRONTEND_TAR%.gz}"
    fi
    
    # 加载镜像
    info "加载前端镜像到 Docker..."
    docker load -i "$FRONTEND_TAR"
    
    # 打标签
    info "打标签: ${DOCKER_USERNAME}/yibao-frontend:latest"
    docker tag yibao-frontend:latest "${DOCKER_USERNAME}/yibao-frontend:latest"
    
    # 推送
    info "推送前端镜像到 Docker Hub..."
    docker push "${DOCKER_USERNAME}/yibao-frontend:latest"
    
    success "前端镜像推送完成: ${DOCKER_USERNAME}/yibao-frontend:latest"
fi

# ==================== 完成 ====================
echo ""
echo "============================================"
echo "  🎉 推送完成！"
echo "============================================"
echo ""
success "后端镜像: ${DOCKER_USERNAME}/yibao-backend:latest"
success "前端镜像: ${DOCKER_USERNAME}/yibao-frontend:latest"
echo ""
echo "============================================"
echo "  📋 服务器部署步骤"
echo "============================================"
echo ""
echo "1. SSH 登录服务器"
echo ""
echo "2. 创建部署目录并进入:"
echo "   mkdir -p /www/wwwroot/yibao && cd /www/wwwroot/yibao"
echo ""
echo "3. 下载部署脚本:"
echo "   curl -O https://raw.githubusercontent.com/leenbj/yibaoxiao/main/scripts/deploy-server.sh"
echo "   chmod +x deploy-server.sh"
echo ""
echo "4. 运行部署:"
echo "   ./deploy-server.sh ${DOCKER_USERNAME}"
echo ""
echo "============================================"










