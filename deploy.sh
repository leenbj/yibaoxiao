#!/bin/bash
# 易报销 Pro - 一键部署脚本
# 
# 使用方法 1（推荐）: 
#   在服务器上执行：
#   curl -fsSL https://raw.githubusercontent.com/leenbj/yibaoxiao/main/deploy.sh -o deploy.sh && bash deploy.sh
#
# 使用方法 2:
#   git clone https://github.com/leenbj/yibaoxiao.git && cd yibaoxiao && bash deploy.sh

set -e

echo "=========================================="
echo "       易报销 Pro - 一键部署脚本"
echo "=========================================="

# 配置
INSTALL_DIR="${INSTALL_DIR:-/root/yibaoxiao}"
REPO_URL="https://raw.githubusercontent.com/leenbj/yibaoxiao/main"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker: curl -fsSL https://get.docker.com | bash"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    exit 1
fi

# 创建安装目录
echo ""
echo "[1/6] 创建安装目录: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 下载配置文件
echo ""
echo "[2/6] 下载配置文件..."
curl -fsSL -o docker-compose.yml "$REPO_URL/docker-compose.prod.yml"
curl -fsSL -o .env.example "$REPO_URL/.env.production"

# 配置环境变量
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ""
    echo "=========================================="
    echo "⚠️  首次部署，请配置环境变量"
    echo "=========================================="
    
    # 交互式配置
    read -p "数据库密码 [yibao123456]: " db_pass
    db_pass=${db_pass:-yibao123456}
    
    read -p "管理员邮箱 [admin@example.com]: " admin_email
    admin_email=${admin_email:-admin@example.com}
    
    read -p "管理员密码 [admin123456]: " admin_pass
    admin_pass=${admin_pass:-admin123456}
    
    # 更新 .env 文件
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$db_pass/" .env
    sed -i "s/ADMIN_EMAIL=.*/ADMIN_EMAIL=$admin_email/" .env
    sed -i "s/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$admin_pass/" .env
    
    echo ""
    echo "✅ 配置已保存到 .env"
fi

# 登录 ghcr.io（如果需要）
echo ""
echo "[3/6] 检查镜像仓库访问..."
if ! docker pull ghcr.io/leenbj/yibaoxiao-backend:latest 2>/dev/null; then
    echo ""
    echo "⚠️  镜像为私有，需要登录 GitHub Container Registry"
    echo ""
    echo "请访问 https://github.com/settings/tokens 创建 Token"
    echo "勾选 read:packages 权限"
    echo ""
    read -p "请输入 GitHub Token: " github_token
    echo "$github_token" | docker login ghcr.io -u leenbj --password-stdin
fi

# 拉取镜像
echo ""
echo "[4/6] 拉取 Docker 镜像..."
docker-compose pull

# 停止旧容器
echo ""
echo "[5/6] 停止旧容器..."
docker-compose down 2>/dev/null || true

# 启动服务
echo ""
echo "[6/6] 启动服务..."
docker-compose up -d

# 获取服务器 IP
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || curl -s ifconfig.me 2>/dev/null || echo "服务器IP")

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo ""
echo "📍 访问地址: http://$SERVER_IP"
echo "👤 管理员账号: $(grep ADMIN_EMAIL .env | cut -d= -f2)"
echo ""
echo "⏳ 首次启动需要 3-5 分钟构建，请耐心等待"
echo "   查看启动进度: cd $INSTALL_DIR && docker-compose logs -f backend"
echo ""
echo "📋 常用命令:"
echo "   cd $INSTALL_DIR"
echo "   docker-compose logs -f      # 查看日志"
echo "   docker-compose restart      # 重启服务"
echo "   docker-compose down         # 停止服务"
echo "   docker-compose pull && docker-compose up -d  # 更新版本"
echo "=========================================="
